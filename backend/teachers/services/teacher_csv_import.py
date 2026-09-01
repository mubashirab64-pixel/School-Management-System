import csv
import io
import os
import re
import tempfile
from django.db import transaction
from django.utils.dateparse import parse_date
from teachers.models import Teacher, TeacherSubjectAssignment
from campus.models import Campus
from classes.models import ClassRoom
from timetable.models import Subject
from coordinator.models import Coordinator

# Defining fields for the CSV structure
REQUIRED_FIELDS = [
    'full_name', 'gender', 'dob', 'contact_number', 'email', 'cnic',
    'joining_date', 'campus', 'shift'
]

# Optional fields including assignments
OPTIONAL_FIELDS = [
    'teacher_id', 'father_name', 'current_role_title', 'education_level', 
    'total_experience_years', 'marital_status', 'current_address',
    'is_class_teacher', 'is_subject_teacher',
    'assigned_classrooms', 'subject_assignments', 'coordinators'
]

TEMPLATE_HEADERS = REQUIRED_FIELDS + OPTIONAL_FIELDS

SAMPLE_ROW = {
    'full_name': 'Zia Khan',
    'gender': 'male',
    'dob': '1985-05-20',
    'contact_number': '+923001234567',
    'email': 'zia@example.com',
    'cnic': '42101-1234567-1',
    'joining_date': '2024-01-01',
    'campus': 'Main Campus',
    'shift': 'morning',
    'teacher_id': 'T-1001',
    'father_name': 'Ali Khan',
    'current_role_title': 'Subject Teacher',
    'education_level': 'Masters',
    'total_experience_years': '5',
    'marital_status': 'married',
    'current_address': 'House 1, Street 2, Karachi',
    'is_class_teacher': 'yes',
    'is_subject_teacher': 'yes',
    'assigned_classrooms': 'Grade 1-A, Grade 2-B',
    'subject_assignments': 'Grade 1-A:Mathematics, Grade 2-B:Science',
    'coordinators': 'Ahad Ahmed'
}

def clean_name(val):
    """Utility to clean names/codes for better matching"""
    if not val: return ""
    return str(val).strip().lower().replace(' ', '').replace('-', '')

def import_teachers_from_csv(path, user):
    org = getattr(user, 'organization', None)
    reports = []

    try:
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except Exception as e:
        return [{'row': 0, 'status': 'error', 'message': f'File read error: {str(e)}'}]

    if not rows:
        return [{'row': 0, 'status': 'error', 'message': 'CSV is empty.'}]

    # Pre-cache classrooms and subjects for better performance and matching
    all_classrooms = list(ClassRoom.objects.filter(organization=org).select_related('grade', 'grade__level__campus'))
    all_subjects = list(Subject.objects.filter(organization=org))
    all_coordinators = list(Coordinator.objects.filter(organization=org))

    for idx, row in enumerate(rows, start=2):
        row_num = idx
        name = row.get('full_name', '').strip()
        email = row.get('email', '').strip().lower()
        
        try:
            # 1. Validation
            missing = [f for f in REQUIRED_FIELDS if not row.get(f, '').strip()]
            if missing:
                reports.append({'row': row_num, 'status': 'error', 'name': name, 'message': f'Missing: {", ".join(missing)}'})
                continue

            # Check for existing teacher with same email
            if Teacher.objects.filter(email=email, organization=org).exists():
                reports.append({'row': row_num, 'status': 'error', 'name': name, 'message': f'Teacher with email "{email}" already exists.'})
                continue

            # 2. Data Cleaning
            raw_cnic = row.get('cnic', '').strip()
            clean_cnic = raw_cnic if len(raw_cnic) <= 15 else raw_cnic.replace('-', '').replace(' ', '')
            
            from datetime import datetime as _dt
            def _parse_flexible_date(raw):
                d = parse_date(raw)
                if d:
                    return d
                for _fmt in ('%d/%m/%Y', '%m/%d/%Y', '%d-%m-%Y', '%Y/%m/%d'):
                    try:
                        return _dt.strptime(raw, _fmt).date()
                    except ValueError:
                        continue
                return None

            dob = _parse_flexible_date(row['dob'].strip())
            joining_date = _parse_flexible_date(row['joining_date'].strip())
            if not dob or not joining_date:
                reports.append({'row': row_num, 'status': 'error', 'name': name, 'message': 'Invalid date format. Use YYYY-MM-DD or DD/MM/YYYY.'})
                continue

            # 3. Campus Resolution
            campus_name = row['campus'].strip()
            campus = Campus.objects.filter(campus_name__icontains=campus_name, organization=org).first()
            if not campus:
                reports.append({'row': row_num, 'status': 'error', 'name': name, 'message': f'Campus "{campus_name}" not found.'})
                continue

            # 4. Database Save
            with transaction.atomic():
                teacher = Teacher.objects.create(
                    organization=org,
                    full_name=name,
                    gender=row.get('gender', 'male').strip().lower(),
                    dob=dob,
                    joining_date=joining_date,
                    contact_number=row.get('contact_number', '').strip(),
                    email=email,
                    cnic=clean_cnic[:15],
                    current_campus=campus,
                    shift=row.get('shift', 'morning').strip().lower(),
                    teacher_id=row.get('teacher_id', '').strip() or None,
                    father_name=row.get('father_name', '').strip(),
                    current_role_title=row.get('current_role_title', 'Teacher').strip(),
                    education_level=row.get('education_level', '').strip(),
                    total_experience_years=float(row.get('total_experience_years', 0)) if row.get('total_experience_years') and str(row.get('total_experience_years')).replace('.','').isdigit() else 0,
                    marital_status=row.get('marital_status', 'single').strip().lower(),
                    current_address=row.get('current_address', '').strip(),
                    is_class_teacher=str(row.get('is_class_teacher', '')).lower() in ['yes', 'true', '1'],
                    is_subject_teacher=str(row.get('is_subject_teacher', '')).lower() in ['yes', 'true', '1'],
                    is_currently_active=True,
                    save_status='final'
                )
                
                # A. Handle Classroom Assignments
                class_input = row.get('assigned_classrooms', '').strip()
                if class_input:
                    target_names = [c.strip() for c in class_input.split(',') if c.strip()]
                    for t_name in target_names:
                        # Strip shift info in parentheses e.g. "Kg-Ii - A (Morning)" → "Kg-Ii - A"
                        t_name_stripped = re.sub(r'\s*\([^)]*\)', '', t_name).strip()
                        cleaned_t = clean_name(t_name_stripped)
                        match = None
                        for cls in all_classrooms:
                            if cls.grade.level.campus != campus: continue
                            cls_full_name = f"{cls.grade.name}{cls.section}"
                            cls_with_dash = f"{cls.grade.name} - {cls.section}"
                            if (clean_name(cls.code) == cleaned_t
                                    or clean_name(cls_full_name) == cleaned_t
                                    or clean_name(cls_with_dash) == cleaned_t):
                                match = cls
                                break
                        if match:
                            teacher.assigned_classrooms.add(match)

                # B. Handle Subject Assignments (Fixed subject_code attribute error)
                sub_input = row.get('subject_assignments', '').strip()
                if sub_input:
                    for entry in [e.strip() for e in sub_input.split(',') if e.strip()]:
                        if ':' in entry:
                            c_part, s_part = entry.split(':', 1)
                            # Strip shift info in parentheses from classroom part
                            c_part_stripped = re.sub(r'\s*\([^)]*\)', '', c_part).strip()
                            cleaned_c = clean_name(c_part_stripped)
                            cleaned_s = clean_name(s_part)

                            match_cls = None
                            for cls in all_classrooms:
                                if cls.grade.level.campus != campus: continue
                                cls_full = f"{cls.grade.name}{cls.section}"
                                cls_dash = f"{cls.grade.name} - {cls.section}"
                                if (clean_name(cls_full) == cleaned_c
                                        or clean_name(cls_dash) == cleaned_c
                                        or clean_name(cls.code) == cleaned_c):
                                    match_cls = cls
                                    break
                            
                            match_sub = None
                            for sub in all_subjects:
                                # Subject model has 'code' not 'subject_code'
                                if clean_name(sub.name) == cleaned_s or clean_name(sub.code) == cleaned_s:
                                    match_sub = sub
                                    break
                            
                            if match_cls and match_sub:
                                TeacherSubjectAssignment.objects.get_or_create(
                                    teacher=teacher,
                                    classroom=match_cls,
                                    subject=match_sub,
                                    organization=org
                                )

                # C. Handle Coordinator Assignment
                coord_input = row.get('coordinators', '').strip()
                if coord_input:
                    for c_ref in [c.strip() for c in coord_input.split(',') if c.strip()]:
                        cleaned_ref = clean_name(c_ref)
                        for coord in all_coordinators:
                            if clean_name(coord.full_name) == cleaned_ref or clean_name(coord.employee_code) == cleaned_ref:
                                teacher.assigned_coordinators.add(coord)
                                break

                # User account
                _ensure_teacher_user_account(teacher)

            reports.append({'row': row_num, 'status': 'ok', 'name': name, 'message': f'Success. ID: {teacher.employee_code}'})

        except Exception as e:
            reports.append({'row': row_num, 'status': 'error', 'name': name, 'message': str(e)})

    return reports

def _ensure_teacher_user_account(teacher):
    from users.models import User
    username = teacher.employee_code
    if not username or User.objects.filter(username=username).exists():
        return
    try:
        u = User.objects.create(
            username=username,
            email=teacher.email or f"{username}@al-khair.edu",
            role='teacher',
            organization=teacher.organization,
            campus=teacher.current_campus,
            is_verified=True,
        )
        u.set_password('12345')
        u.save()
        teacher.user = u
        teacher.save(update_fields=['user'])
    except Exception as e:
        print(f"[USER CREATE ERROR] {e}")
