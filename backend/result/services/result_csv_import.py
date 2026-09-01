import csv
from datetime import date
from typing import List, Dict, Any, Tuple
from django.db import transaction
from django.db.models import Q
from students.models import Student
from teachers.models import Teacher
from result.models import Result, SubjectMark


def _get_academic_year_from_date(d: date = None) -> str:
    """Return current academic year in 'YYYY-YY' format. Year starts in April."""
    if d is None:
        d = date.today()
    start_year = d.year if d.month >= 4 else d.year - 1
    return f"{start_year}-{str(start_year + 1)[2:]}"


def _fetch_attendance_for_result(student, exam_type: str, month: str, academic_year: str):
    """
    Return (days_present, total_working_days) for the given student/exam/month.
    For monthly: just that month. For midterm: first 6 months. For final: all months.
    """
    from attendance.models import Attendance, StudentAttendance

    MONTH_MAP = {
        'April': 4, 'May': 5, 'June': 6, 'July': 7, 'August': 8, 'September': 9,
        'October': 10, 'November': 11, 'December': 12, 'January': 1, 'February': 2, 'March': 3
    }
    ALL_MONTHS_ORDER = ['April', 'May', 'June', 'July', 'August', 'September',
                        'October', 'November', 'December', 'January', 'February', 'March']

    if exam_type == 'monthly':
        months_to_check = [month] if month else []
    elif exam_type == 'midterm':
        months_to_check = ALL_MONTHS_ORDER[:6]
    else:  # final
        months_to_check = ALL_MONTHS_ORDER

    classroom = student.classroom
    if not classroom:
        return 0, 0

    try:
        base_year = int(academic_year.split('-')[0])
    except (ValueError, AttributeError):
        base_year = date.today().year if date.today().month >= 4 else date.today().year - 1

    total_present = 0
    total_working = 0

    for m_name in months_to_check:
        m_num = MONTH_MAP.get(m_name)
        if not m_num:
            continue
        cal_year = base_year + 1 if m_num <= 3 else base_year

        working = Attendance.objects.filter(
            classroom=classroom,
            date__year=cal_year,
            date__month=m_num,
            is_deleted=False
        ).count()

        present = StudentAttendance.objects.filter(
            student=student,
            attendance__date__year=cal_year,
            attendance__date__month=m_num,
            attendance__is_deleted=False
        ).filter(Q(status='present') | Q(status='late')).count()

        total_working += working
        total_present += present

    return total_present, total_working


def _resolve_student(identifier: str, id_type: str):
    from students.models import Student
    qs = Student.objects
    if id_type == 'id':
        try:
            return qs.filter(id=int(identifier)).first()
        except (ValueError, TypeError):
            return None
    if id_type == 'student_id':
        return qs.filter(student_id=identifier).first()
    if id_type == 'gr_no':
        return qs.filter(gr_no=identifier).first()
    if id_type == 'student_code':
        return qs.filter(student_code=identifier).first()
    return None


def import_results_from_csv(path: str, teacher_id: int = None, overwrite: bool = False, chunk_size: int = 200) -> List[Dict[str, Any]]:
    """
    Import results from a CSV file. Expected headers:
    student_identifier,student_identifier_type,exam_type,academic_year,month,subject_name,total_marks,obtained_marks,grade,teacher_id,remarks

    Returns list of per-row reports: {row, status, message}
    """

    from result.models import Result  # Ensure Result is always available

    # Read CSV file and collect rows as list of dicts
    rows = []
    with open(path, newline='', encoding='utf-8-sig') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            rows.append(row)

    reports = []

    # process in chunks
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i:i+chunk_size]
        with transaction.atomic():
            for idx, row in enumerate(chunk, start=i+1):
                report = {'row': idx, 'status': 'ok', 'message': ''}
                try:
                    sid = (row.get('student_identifier') or '').strip()
                    sid_type = (row.get('student_identifier_type') or 'student_id').strip()
                    # Normalize exam_type and month for frontend compatibility
                    exam_type = (row.get('exam_type') or '').strip().lower()
                    if exam_type in ['monthly', 'monthly test', 'monthly_test']:
                        exam_type = 'monthly'
                    elif exam_type in ['midterm', 'mid_term', 'mid term']:
                        exam_type = 'midterm'
                    elif exam_type in ['finalterm', 'final_term', 'final term', 'final']:
                        exam_type = 'final'
                    academic_year = (row.get('academic_year') or '').strip()
                    month = (row.get('month') or '').strip().capitalize() or None
                    # Only allow valid months
                    valid_months = ['April','May','June','August','September','October','November','December','January','February','March']
                    if month and month not in valid_months:
                        month = None
                    row_teacher_id = row.get('teacher_id')
                    remarks = row.get('remarks')

                    # Allow academic_year to be optional for monthly_test uploads
                    if not sid or not exam_type:
                        raise ValueError('Missing required fields (student_identifier/exam_type)')
                    if not academic_year:
                        if exam_type == 'monthly':
                            # Use the CURRENT academic year (April–March), not the stale
                            # model default. This must match the year attendance was marked
                            # so the report card can fetch attendance correctly.
                            academic_year = _get_academic_year_from_date()
                        else:
                            raise ValueError('Missing required fields (academic_year)')

                    student = _resolve_student(sid, sid_type)
                    if not student:
                        raise ValueError(f'Student not found: {sid} ({sid_type})')

                    # determine teacher
                    # Always use the logged-in teacher (ignore teacher_id from CSV rows)
                    assigned_teacher = None
                    if teacher_id:
                        try:
                            assigned_teacher = Teacher.objects.filter(id=int(teacher_id)).first()
                        except (ValueError, TypeError):
                            assigned_teacher = None
                        if not assigned_teacher:
                            assigned_teacher = Teacher.objects.filter(teacher_id=teacher_id).first()
                    if not assigned_teacher:
                        raise ValueError('No teacher specified or found (provide --teacher-id argument)')

                    # SECURITY: Validate that the teacher_id column in the CSV matches the logged-in teacher
                    # This prevents uploading a CSV that was made for a different teacher
                    csv_teacher_id = (row.get('teacher_id') or '').strip()
                    if csv_teacher_id:
                        # Compare against teacher's employee_code and teacher_id fields
                        teacher_employee_code = (getattr(assigned_teacher, 'employee_code', '') or '').strip()
                        teacher_code = (getattr(assigned_teacher, 'teacher_id', '') or '').strip()
                        if (csv_teacher_id != teacher_employee_code and csv_teacher_id != teacher_code):
                            raise ValueError(
                                f'CSV teacher_id "{csv_teacher_id}" does not match your teacher ID '
                                f'("{teacher_employee_code}"). You can only upload results using your own teacher ID.'
                            )

                    # SECURITY: Verify the student belongs to the teacher's assigned classroom(s)
                    # Get all classroom IDs assigned to this teacher
                    teacher_classroom_ids = set()
                    if assigned_teacher.assigned_classroom_id:
                        teacher_classroom_ids.add(assigned_teacher.assigned_classroom_id)
                    if assigned_teacher.pk:
                        try:
                            for cls in assigned_teacher.assigned_classrooms.all():
                                teacher_classroom_ids.add(cls.id)
                        except Exception:
                            pass

                    if teacher_classroom_ids:
                        # Get the student's classroom id directly from DB
                        from students.models import Student as StudentModel
                        student_classroom_id = StudentModel.objects.filter(id=student.id).values_list('classroom_id', flat=True).first()
                        
                        if not student_classroom_id or student_classroom_id not in teacher_classroom_ids:
                            raise ValueError(
                                f'Student {sid} does not belong to your assigned classroom. '
                                f'You can only upload results for your own students.'
                            )

                    # BLOCK: Final Term upload requires Mid Term to be FULLY APPROVED (by both coordinator AND principal)
                    if exam_type == 'final':
                        mid_term_approved = Result.objects.filter(
                            student=student,
                            exam_type='midterm',
                            status='approved'  # 'approved' means both coordinator AND principal have approved
                        ).exists()
                        if not mid_term_approved:
                            # Check what status mid-term is in for a better error message
                            mid_term = Result.objects.filter(student=student, exam_type='midterm').first()
                            if not mid_term:
                                raise ValueError(
                                    f'Student {student.name}: Mid Term result does not exist. '
                                    f'Final Term cannot be uploaded until Mid Term is fully approved by coordinator and principal.'
                                )
                            elif mid_term.status == 'pending_coordinator':
                                raise ValueError(
                                    f'Student {student.name}: Mid Term result is still pending coordinator approval. '
                                    f'Both coordinator and principal must approve Mid Term before uploading Final Term.'
                                )
                            elif mid_term.status == 'pending_principal':
                                raise ValueError(
                                    f'Student {student.name}: Mid Term result is approved by coordinator but still pending principal approval. '
                                    f'Principal must approve Mid Term before uploading Final Term.'
                                )
                            else:
                                raise ValueError(
                                    f'Student {student.name}: Mid Term result (status: {mid_term.status}) is not fully approved. '
                                    f'Both coordinator and principal must approve Mid Term before uploading Final Term.'
                                )

                    # Always delete any existing result for this student/exam/month/year/semester before creating new
                    key = {'student': student, 'exam_type': exam_type, 'month': month}
                    if academic_year:
                        key['academic_year'] = academic_year
                    # Also use semester if present (default to 'Spring')
                    semester = 'Spring'

                    # Soft-delete existing result and log it
                    existing_results = list(Result._base_manager.filter(**key, semester=semester))
                    for old_result in existing_results:
                        old_id = old_result.id
                        old_org = getattr(old_result, 'organization', None)
                        Result._base_manager.filter(pk=old_id).update(is_deleted=True)
                        try:
                            from attendance.models import AuditLog
                            teacher_obj = assigned_teacher if assigned_teacher else None
                            AuditLog.objects.create(
                                feature='result',
                                action='delete',
                                entity_type='Result',
                                entity_id=old_id,
                                organization=old_org,
                                user=teacher_obj.user if teacher_obj and hasattr(teacher_obj, 'user') else None,
                                changes={
                                    'student_name': student.name,
                                    'exam_type': exam_type,
                                    'academic_year': academic_year or '',
                                    'student_id': student.id,
                                    'reason': 'Replaced by bulk upload',
                                },
                                reason=f'Result for {student.name} ({exam_type}) replaced by bulk upload'
                            )
                        except Exception:
                            pass
                    
                    result = Result.objects.create(
                        teacher=assigned_teacher,
                        semester=semester,
                        status='draft',
                        organization=student.organization,
                        teacher_remarks=(remarks or '').strip() or None,
                        **key
                    )
                    created = True
                    print(f"[DEBUG] Row {idx}: Result CREATED for student={student}, exam_type={exam_type}, month={month}, teacher={assigned_teacher}")

                    # Wide-format: handle all subject columns in the row
                    known_fields = {'student_name','student_identifier','student_identifier_type','exam_type','academic_year','month','teacher_id','remarks','grade','total_marks','obtained_marks','subject_name'}
                    subject_cols = [k for k in row.keys() if k not in known_fields]
                    subject_marks_created = 0
                    # Set per-exam-type default total marks
                    if exam_type == 'monthly':
                        default_total = 25
                    elif exam_type == 'midterm':
                        default_total = 75
                    elif exam_type == 'final':
                        default_total = 100
                    else:
                        default_total = 100

                    # If the row provides a total_marks value, it overrides the
                    # per-exam default and is applied to every subject in this row.
                    # Pass/fail, percentage, grade etc. are then computed from this total.
                    row_total = row.get('total_marks')
                    if row_total not in (None, '', 'NA'):
                        try:
                            effective_total = float(row_total)
                        except (TypeError, ValueError):
                            effective_total = default_total
                    else:
                        effective_total = default_total

                    # Behaviour field detection.
                    # Match the `behaviour_`/`behavior_` prefix used by the final template,
                    # or an EXACT canonical field name. Avoid loose substring matching so a
                    # real subject like "Response & Analysis" is never misread as behaviour.
                    behaviour_exact_names = {
                        'response', 'observation', 'participation',
                        'follow_rules', 'home_work', 'homework', 'personal_hygiene',
                        'respect_others'
                    }

                    def is_behaviour_column(col_name):
                        col_lower = col_name.lower().strip().replace(' ', '_')
                        if col_lower.startswith('behaviour_') or col_lower.startswith('behavior_'):
                            return True
                        return col_lower in behaviour_exact_names
                    
                    for subject_col in subject_cols:
                        subject_name = subject_col.strip()
                        raw_value = row.get(subject_col)
                        if raw_value in (None, '', 'NA'):
                            continue
                        
                        # Check if this is a behaviour column
                        if is_behaviour_column(subject_name):
                            # Store behaviour text value in grade field, not obtained_marks
                            # Behaviour values: Excellent, Good, Satisfactory, Needs Improvement, etc.
                            behaviour_value = str(raw_value).strip()
                            sm_defaults = {'total_marks': 100, 'obtained_marks': 0, 'grade': behaviour_value, 'organization': result.organization}
                            subject_mark, sm_created = SubjectMark.objects.get_or_create(result=result, subject_name=subject_name, defaults=sm_defaults)
                            if not sm_created and overwrite:
                                subject_mark.grade = behaviour_value
                                subject_mark.organization = result.organization
                                subject_mark.save()
                            elif sm_created:
                                # Ensure organization is saved
                                subject_mark.organization = result.organization
                                subject_mark.save()
                        else:
                            # Regular subject - parse as numeric
                            try:
                                obtained_marks = float(raw_value)
                            except Exception:
                                obtained_marks = 0.0
                            sm_defaults = {'total_marks': effective_total, 'obtained_marks': obtained_marks, 'grade': '', 'organization': result.organization}
                            subject_mark, sm_created = SubjectMark.objects.get_or_create(result=result, subject_name=subject_name, defaults=sm_defaults)
                            if not sm_created and overwrite:
                                subject_mark.total_marks = effective_total
                                subject_mark.obtained_marks = obtained_marks
                                subject_mark.organization = result.organization
                                subject_mark.save()
                            elif sm_created:
                                # Ensure organization is saved
                                subject_mark.organization = result.organization
                                subject_mark.save()
                        subject_marks_created += 1

                    # If no subject columns found, fallback to old format (single subject per row)
                    if subject_marks_created == 0:
                        subject_name = (row.get('subject_name') or '').strip()
                        if not subject_name:
                            raise ValueError('Missing required fields (subject_name or subject columns)')
                        # Use per-exam-type default if not specified
                        if row.get('total_marks') not in (None, '', 'NA'):
                            total_marks = float(row.get('total_marks'))
                        else:
                            if exam_type == 'monthly':
                                total_marks = 25
                            elif exam_type == 'midterm':
                                total_marks = 75
                            elif exam_type == 'final':
                                total_marks = 100
                            else:
                                total_marks = 100
                        obtained_marks = row.get('obtained_marks')
                        obtained_marks = float(obtained_marks) if obtained_marks not in (None, '', 'NA') else 0.0
                        grade = (row.get('grade') or '').strip() or None
                        sm_defaults = {'total_marks': total_marks, 'obtained_marks': obtained_marks, 'grade': grade or '', 'organization': result.organization}
                        subject_mark, sm_created = SubjectMark.objects.get_or_create(result=result, subject_name=subject_name, defaults=sm_defaults)
                        if not sm_created and overwrite:
                            subject_mark.total_marks = total_marks
                            subject_mark.obtained_marks = obtained_marks
                            if grade:
                                subject_mark.grade = grade
                            subject_mark.organization = result.organization
                            subject_mark.save()
                        elif sm_created:
                            subject_mark.organization = result.organization
                            subject_mark.save()

                    result.calculate_totals()

                    # Auto-fetch and save attendance from attendance records
                    try:
                        days_present, total_working = _fetch_attendance_for_result(
                            student, exam_type, month, academic_year or _get_academic_year_from_date()
                        )
                        result.attendance_score = days_present
                        result.total_attendance = total_working
                        result.save(update_fields=['attendance_score', 'total_attendance'])
                    except Exception as att_err:
                        print(f"[WARN] Row {idx}: Could not fetch attendance: {att_err}")

                    print(f"[DEBUG] Row {idx}: Result saved: id={result.id}, status={result.status}, total_marks={result.total_marks}, obtained_marks={result.obtained_marks}")
                    report['message'] = f"Result {'created' if created else 'updated'}, SubjectMarks added: {subject_marks_created} (status: draft, visible to teacher)"
                except Exception as e:
                    print(f"[ERROR] Row {idx}: {e}")
                    report['status'] = 'error'
                    report['message'] = str(e)
                reports.append(report)
    return reports

    # Remove duplicate/erroneous code at the end
 