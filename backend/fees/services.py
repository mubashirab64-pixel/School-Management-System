from django.db import transaction, models
from django.utils import timezone
from decimal import Decimal
from .models import FeeStructure, StudentFee, Payment, FeeLineItem, FeeType
from students.models import Student

class FeeService:
    @staticmethod
    def get_student_fee_structure(student):
        """
        Inheritance logic:
        1. Section-level structure
        2. Grade-level structure
        3. Level-level structure
        4. School default structure
        """
        campus = student.campus
        # 1. Section-level
        if student.classroom:
            structure = FeeStructure.objects.filter(
                campus=campus, section=student.classroom, is_active=True
            ).first()
            if structure:
                return structure
        
        # 2. Grade-level
        grade = student.grade_from_classroom
        if grade:
            structure = FeeStructure.objects.filter(
                campus=campus, grade=grade, section__isnull=True, is_active=True
            ).first()
            if structure:
                return structure
        
        # 3. Level-level
        level = student.level
        if level:
            structure = FeeStructure.objects.filter(
                campus=campus, level=level, grade__isnull=True, section__isnull=True, is_active=True
            ).first()
            if structure:
                return structure
        
        # 4. School default
        # If grade=None, it's school default
        structure = FeeStructure.objects.filter(
            campus=campus, is_default=True, level__isnull=True, grade__isnull=True, section__isnull=True, is_active=True
        ).first()
        
        if structure:
            return structure
            
        # 5. Last resort fallback (in case user forgot to check 'is_default')
        return FeeStructure.objects.filter(
            campus=campus, level__isnull=True, grade__isnull=True, section__isnull=True, is_active=True
        ).first()

    @staticmethod
    def generate_challans(month, year, campus_id=None, level_id=None, grade_id=None, structure_id=None, level_ids=None, grade_ids=None, section_ids=None, student_id=None):
        if student_id:
            students = Student.objects.filter(id=student_id, is_deleted=False)
            print(f"DEBUG: Selected specific student ID: {student_id}")
        else:
            students = Student.objects.filter(campus_id=campus_id, is_deleted=False)
            print(f"DEBUG: Found {students.count()} students for campus {campus_id}")
        
        if level_ids and len(level_ids) > 0:
            students = students.filter(classroom__grade__level_id__in=level_ids)
            print(f"DEBUG: Filtered to {students.count()} students for levels {level_ids}")
        elif level_id:
            students = students.filter(classroom__grade__level_id=level_id)
            print(f"DEBUG: Filtered to {students.count()} students for level {level_id}")
            
        if grade_ids and len(grade_ids) > 0:
            students = students.filter(classroom__grade_id__in=grade_ids)
            print(f"DEBUG: Filtered to {students.count()} students for grades {grade_ids}")
        elif grade_id:
            students = students.filter(classroom__grade_id=grade_id)
            print(f"DEBUG: Filtered to {students.count()} students for grade {grade_id}")

        if section_ids and len(section_ids) > 0:
            students = students.filter(classroom_id__in=section_ids)
            print(f"DEBUG: Filtered to {students.count()} students for sections {section_ids}")
            
        generated_count = 0
        error_count = 0
        
        for student in students:
            try:
                # 1. Check draft state (Wait for user choice or just check if it's the issue)
                if student.is_draft:
                    print(f"DEBUG: Skipping student {student.name} (ID: {student.id}) because they are in DRAFT state.")
                    continue

                # 2. Check if already generated
                if StudentFee.objects.filter(student=student, month=month, year=year).exists():
                    print(f"DEBUG: Skipping student {student.name} - Fee already exists for {month}/{year}")
                    continue
                    
                # 3. Find Fee Structure
                if structure_id:
                    structure = FeeStructure.objects.filter(id=structure_id).first()
                else:
                    structure = FeeService.get_student_fee_structure(student)
                
                if not structure:
                    print(f"DEBUG: Skipping student {student.name} - No Fee Structure found for their scope.")
                    continue
                
                print(f"DEBUG: Found structure '{structure.name}' for student {student.name}")
                
                # 4. Determine applicable fees
                applicable_line_items = []
                # ... Rest of logic stays the same but I'll add a print at creation
                line_items = structure.line_items.all()
                # ...
                
                # Determine session start month for yearly fees
                session_start_month = 1 # Default to Jan
                if student.campus and student.campus.academic_year_start:
                    session_start_month = student.campus.academic_year_start.month
                
                for item in line_items:
                    freq = getattr(item, 'frequency', '').lower()
                    
                    if freq == 'monthly':
                        applicable_line_items.append(item)
                        
                    elif freq == 'yearly':
                        # Fetch all fees for this year manually to avoid SQLite JSON __contains bugs
                        already_charged_yearly = False
                        student_fees_this_year = StudentFee.objects.filter(student=student, year=year)
                        for sf in student_fees_this_year:
                            if isinstance(sf.fee_structure_details, list):
                                if any(str(detail.get('fee_type_id')) == str(item.fee_type.id) for detail in sf.fee_structure_details):
                                    already_charged_yearly = True
                                    break
                                    
                        # Apply if it's the session start month OR if it hasn't been charged yet this year
                        if month == session_start_month or not already_charged_yearly:
                            applicable_line_items.append(item)
                            
                    elif freq == 'one_time':
                        # Check if already charged EVER manually
                        already_charged = False
                        # Optimization: only check fees for this student
                        all_student_fees = StudentFee.objects.filter(student=student)
                        for sf in all_student_fees:
                            if isinstance(sf.fee_structure_details, list):
                                if any(str(detail.get('fee_type_id')) == str(item.fee_type.id) for detail in sf.fee_structure_details):
                                    already_charged = True
                                    break
                                    
                        if not already_charged:
                            applicable_line_items.append(item)
                
                if not applicable_line_items:
                    continue
                    
                current_fees_total = sum(item.amount for item in applicable_line_items)
                
                # 4. Arrears
                # Sum of remaining_amount of previous unpaid StudentFees
                arrears = StudentFee.objects.filter(
                    student=student, 
                    status__in=['unpaid', 'partial', 'issued']
                ).exclude(month=month, year=year).aggregate(
                    total_remaining=models.Sum('remaining_amount')
                )['total_remaining'] or Decimal('0.00')
                
                # 5. Create StudentFee
                snapshot = [
                    {
                        'fee_type_id': item.fee_type.id,
                        'fee_type_name': item.fee_type.name,
                        'amount': str(item.amount),
                        'frequency': item.frequency
                    } for item in applicable_line_items
                ]
                
                due_date = timezone.datetime(year, month, 10).date()
                
                # Determine organization - fallback to campus org if student org is None
                fee_org = student.organization
                if not fee_org and student.campus:
                    fee_org = student.campus.organization

                with transaction.atomic():
                    StudentFee.objects.create(
                        student=student,
                        fee_structure=structure,
                        month=month,
                        year=year,
                        total_amount=current_fees_total + arrears,
                        due_date=due_date,
                        fee_structure_details=snapshot,
                        organization=fee_org
                    )
                generated_count += 1
            except Exception as e:
                print(f"Error generating fee for student {student.id}: {e}")
                error_count += 1
                
        return generated_count, error_count

    @staticmethod
    @transaction.atomic
    def record_payment(student_fee_id, amount, method, received_by=None, bank_details=None):
        """
        Records a payment and allocates it using FIFO (First-In-First-Out)
        to the oldest outstanding balances for the student.
        """
        primary_fee = StudentFee.objects.select_for_update().get(id=student_fee_id)
        student = primary_fee.student
        
        # 1. Create the Payment record (linked to the fee they intended to pay)
        payment = Payment.objects.create(
            student_fee=primary_fee,
            amount=amount,
            method=method,
            received_by=received_by,
            bank_name=bank_details.get('bank_name') if bank_details else None,
            transaction_id=bank_details.get('transaction_id') if bank_details else None,
            deposit_date=bank_details.get('deposit_date') if bank_details else None,
        )
        
        # 2. Allocate payment amount to oldest unpaid fees first (FIFO)
        # We look for all unfinished fees for this student
        pending_fees = StudentFee.objects.filter(
            student=student,
            status__in=['unpaid', 'partial', 'issued']
        ).order_by('year', 'month')
        
        remaining_payment = Decimal(str(amount))
        
        for fee in pending_fees:
            if remaining_payment <= 0:
                break
                
            fee_to_pay = fee.remaining_amount
            allocation = min(remaining_payment, fee_to_pay)
            
            fee.paid_amount += allocation
            remaining_payment -= allocation
            # save() triggers status and remaining_amount updates
            fee.save()
            
        return payment
