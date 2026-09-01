import csv
import os
from datetime import datetime, date
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_date
from teachers.models import Teacher
from campus.models import Campus
from classes.models import Grade, ClassRoom
from users.models import User
from services.user_creation_service import UserCreationService
import re


class Command(BaseCommand):
    help = 'Populate teachers data from CSV file with classroom assignments'

    def add_arguments(self, parser):
        parser.add_argument(
            'csv_file_path',
            type=str,
            help='Path to the CSV file containing teacher data'
        )
        parser.add_argument(
            '--campus-code',
            type=str,
            default='C06',
            help='Campus code to assign teachers to (default: C06)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run without actually saving data (for testing)'
        )

    def handle(self, *args, **options):
        csv_file_path = options['csv_file_path']
        campus_code = options['campus_code']
        dry_run = options['dry_run']

        self.stdout.write(f'Starting teacher data population...')
        self.stdout.write(f'CSV file: {csv_file_path}')
        self.stdout.write(f'Campus code: {campus_code}')
        self.stdout.write(f'Dry run: {dry_run}')

        # Check if CSV file exists
        if not os.path.exists(csv_file_path):
            raise CommandError(f'CSV file not found: {csv_file_path}')
        
        self.stdout.write(f'CSV file found: {csv_file_path}')

        # Get campus
        try:
            campus = Campus.objects.get(campus_code=campus_code)
            self.stdout.write(
                self.style.SUCCESS(f'Found campus: {campus.campus_name} ({campus.campus_code})')
            )
        except Campus.DoesNotExist:
            raise CommandError(f'Campus not found with code: {campus_code}')

        # Read CSV file
        teachers_data = []
        try:
            with open(csv_file_path, 'r', encoding='utf-8') as file:
                csv_reader = csv.DictReader(file)
                for row_num, row in enumerate(csv_reader, start=2):  # Start from 2 because header is row 1
                    teachers_data.append(row)
                    name = row.get("Full Name:", row.get("Full Name", "Unknown"))
                    self.stdout.write(f'Read row {row_num}: {name}')
        except Exception as e:
            raise CommandError(f'Error reading CSV file: {str(e)}')

        self.stdout.write(f'Total rows read: {len(teachers_data)}')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No data will be saved'))

        # Process each teacher
        success_count = 0
        error_count = 0
        errors = []

        for row_num, teacher_data in enumerate(teachers_data, start=2):
            try:
                # Get email first to check for existing teacher
                email = self.get_value(teacher_data, ['Email Address:', 'Email Address', 'Email address:', "Teacher's Own email Address", 'Email'])
                cnic = self.clean_cnic(self.get_value(teacher_data, ['CNIC']))
                
                existing_teacher = None
                if email:
                    existing_teacher = Teacher.objects.filter(email=email).first()
                if not existing_teacher and cnic:
                    existing_teacher = Teacher.objects.filter(cnic=cnic).first()

                teacher, classrooms = self.process_teacher_data(teacher_data, campus, row_num, existing_teacher)
                
                if not dry_run:
                    teacher.save()
                    
                    # Manual user creation check for existing teachers
                    # (since signal only triggers on created=True)
                    if not getattr(teacher, 'user', None):
                        success, message = UserCreationService.create_user_from_entity(teacher, 'teacher')
                        if success:
                            self.stdout.write(self.style.SUCCESS(f'  - User created for {teacher.full_name}'))
                        else:
                            self.stdout.write(self.style.WARNING(f'  - User creation note: {message}'))

                    # Assign classrooms (ManyToMany)
                    if classrooms:
                        for cr in classrooms:
                            teacher.assigned_classrooms.add(cr)
                    
                    status = "Updated" if existing_teacher else "Created"
                    self.stdout.write(
                        self.style.SUCCESS(f'Row {row_num}: {status} teacher {teacher.full_name}')
                    )
                else:
                    status = "Would update" if existing_teacher else "Would create"
                    self.stdout.write(
                        self.style.WARNING(f'Row {row_num}: {status} teacher {teacher.full_name}')
                    )
                
                success_count += 1
                
            except Exception as e:
                error_count += 1
                error_msg = f'Row {row_num}: {str(e)}'
                errors.append(error_msg)
                self.stdout.write(
                    self.style.ERROR(f'{error_msg}')
                )

        # Summary
        self.stdout.write('\n' + '='*50)
        self.stdout.write('SUMMARY:')
        self.stdout.write(f'Total rows processed: {len(teachers_data)}')
        self.stdout.write(f'Successfully processed: {success_count}')
        self.stdout.write(f'Errors: {error_count}')
        
        if errors:
            self.stdout.write('\nERRORS:')
            for error in errors:
                self.stdout.write(f'  - {error}')

        if dry_run:
            self.stdout.write(self.style.WARNING('\nThis was a DRY RUN - No data was actually saved'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\nSuccessfully processed {success_count} teachers'))

    def get_value(self, data, keys, default=''):
        """Helper to get value from multiple possible keys"""
        for key in keys:
            if key in data and data[key]:
                return data[key].strip()
        return default

    def process_teacher_data(self, data, campus, row_num, existing_teacher=None):
        """Process individual teacher data and create/update Teacher object"""
        
        # Extract and clean data
        full_name = self.clean_text(self.get_value(data, ['Full Name:', 'Full Name']))
        if not full_name:
            raise ValueError('Full name is required')

        # Parse date of birth
        dob_str = self.get_value(data, ['Date of Birth:', 'Date of Birth'])
        dob = self.parse_date(dob_str)
        if not dob:
            # Fallback for dob if required
            dob = self.parse_date("01-Jan-1990")

        # Parse gender
        gender_str = self.get_value(data, ['Gender:', 'Gender']).lower()
        gender = self.map_gender(gender_str)

        # Parse marital status
        marital_str = self.get_value(data, ['Marital Status:', 'Marital Status']).lower()
        marital_status = self.map_marital_status(marital_str)

        # Parse shift
        shift_str = self.get_value(data, ['Shift:', 'Shift']).lower()
        shift = self.map_shift(shift_str)

        # Parse joining date
        joining_date_str = self.get_value(data, ['Date of Joining of Current School:', 'Joining Date', 'Date of Joining'])
        joining_date = self.parse_date(joining_date_str)

        # Parse CNIC
        cnic = self.clean_cnic(self.get_value(data, ['CNIC']))
        if not cnic:
            raise ValueError('CNIC is required')

        # Parse Email
        email = self.get_value(data, ['Email Address:', 'Email Address', 'Email address:', "Teacher's Own email Address", 'Email'])
        if not email:
            raise ValueError('Email is required for teacher registration')

        # Parse contact number
        contact_number = self.get_value(data, ['Contact Number:', 'Contact Number', 'Contect Number', 'Contact'])

        # Parse education information
        education_level = self.clean_text(self.get_value(data, ['Last Education:', 'Last Education', 'Education']))
        institution_name = self.clean_text(self.get_value(data, ['Last Institute Name', 'Institute Name']))
        year_str = self.get_value(data, ['Year of Passing'])
        year_of_passing = self.parse_year(year_str)
        specialization = self.clean_text(self.get_value(data, ['Specialization', 'Subjects']))
        grade = self.clean_text(self.get_value(data, ['Grade']))

        # Parse experience information
        previous_institution = self.clean_text(self.get_value(data, ['Last Organization Name', 'Previous School']))
        previous_position = self.clean_text(self.get_value(data, ['Position/Designation', 'Designation']))
        experience_from_date = self.parse_date(self.get_value(data, ['Last work Start Date']))
        experience_to_date = self.parse_date(self.get_value(data, ['Last day of Previous work']))

        # Parse current roles
        current_classes = self.clean_text(self.get_value(data, ['Classes', 'Teaching Classes']))
        current_subjects = self.clean_text(self.get_value(data, ['Subjects Taught']))
        additional_responsibilities = self.clean_text(self.get_value(data, ['Additional Responsibilities']))

        # Class teacher info
        is_class_teacher_str = self.get_value(data, ['If class teacher', 'Is Class Teacher']).lower()
        is_class_teacher = is_class_teacher_str in ['yes', 'y', '1', 'true']
        
        class_teacher_grade = self.clean_text(self.get_value(data, ['Class teacher of class', 'Class teacher grade:', 'Class Teacher Grade']))
        class_teacher_section = self.clean_text(self.get_value(data, ['Section', 'Class Teacher Section']))

        # Use existing teacher if provided
        teacher = existing_teacher if existing_teacher else Teacher()
        
        # Update fields
        teacher.full_name = full_name
        teacher.dob = dob
        teacher.gender = gender
        teacher.contact_number = contact_number
        teacher.email = email
        teacher.permanent_address = self.clean_text(self.get_value(data, ['Permanent Address:', 'Permanent Address']))
        teacher.current_address = self.clean_text(self.get_value(data, ['Temporary Address (if different):', 'Temporary Address']))
        teacher.marital_status = marital_status
        teacher.cnic = cnic
        teacher.education_level = education_level
        teacher.institution_name = institution_name
        teacher.year_of_passing = year_of_passing
        teacher.education_subjects = specialization
        teacher.education_grade = grade
        teacher.previous_institution_name = previous_institution
        teacher.previous_position = previous_position
        teacher.experience_from_date = experience_from_date
        teacher.experience_to_date = experience_to_date
        teacher.joining_date = joining_date
        teacher.current_campus = campus
        teacher.shift = shift
        teacher.current_subjects = current_subjects
        teacher.current_classes_taught = current_classes
        teacher.current_extra_responsibilities = additional_responsibilities
        teacher.is_currently_active = True
        teacher.is_class_teacher = is_class_teacher
        teacher.class_teacher_grade = class_teacher_grade
        teacher.class_teacher_section = class_teacher_section
        teacher.save_status = 'final'

        # Find classrooms to assign
        assigned_classrooms = []
        if is_class_teacher and class_teacher_grade and class_teacher_section:
            classroom = self.find_classroom(campus, class_teacher_grade, class_teacher_section, shift)
            if classroom:
                assigned_classrooms.append(classroom)
                # For backward compatibility, also set the OneToOne field if it's currently empty
                # or if it's already this teacher
                try:
                    current_legacy_teacher = classroom.legacy_class_teacher
                except Exception:
                    current_legacy_teacher = None
                
                if not current_legacy_teacher or (teacher.pk and current_legacy_teacher.pk == teacher.pk):
                    teacher.assigned_classroom = classroom

        return teacher, assigned_classrooms

    def find_classroom(self, campus, grade_name, section, shift):
        """Find classroom based on grade, section, and shift"""
        try:
            grade_mapping = {
                'Grade 1': 'Grade I', 'Grade 2': 'Grade II', 'Grade 3': 'Grade III',
                'Grade 4': 'Grade IV', 'Grade 5': 'Grade V', 'Grade 6': 'Grade VI',
                'Grade 7': 'Grade VII', 'Grade 8': 'Grade VIII', 'Grade 9': 'Grade IX',
                'Grade 10': 'Grade X',
                '1': 'Grade I', '2': 'Grade II', '3': 'Grade III', '4': 'Grade IV',
                '5': 'Grade V', '6': 'Grade VI', '7': 'Grade VII', '8': 'Grade VIII',
                '9': 'Grade IX', '10': 'Grade X',
                'KG-1': 'KG-I', 'KG-2': 'KG-II', 'KG1': 'KG-I', 'KG2': 'KG-II',
                'Nursery': 'Nursery',
            }
            
            mapped_grade_name = grade_mapping.get(grade_name, grade_name)
            
            # Find the grade
            grade = Grade.objects.filter(
                name=mapped_grade_name,
                level__campus=campus,
                level__shift=shift
            ).first()
            
            if not grade:
                return None
            
            # Find the classroom
            return ClassRoom.objects.filter(
                grade=grade,
                section=section,
                shift=shift
            ).first()
            
        except Exception:
            return None

    def clean_text(self, text):
        """Clean and normalize text data"""
        if not text or text.strip() in ['000', '0000', 'nil', 'N/A', 'No']:
            return ''
        return text.strip()

    def clean_cnic(self, cnic):
        """Clean and validate CNIC"""
        if not cnic or cnic.strip() in ['000', '0000', 'nil', 'N/A']:
            return ''
        
        # Remove any non-digit characters except hyphens
        cleaned = re.sub(r'[^\d-]', '', cnic.strip())
        
        # Validate CNIC format (should be 13 digits with optional hyphens)
        digits_only = re.sub(r'-', '', cleaned)
        if len(digits_only) == 13 and digits_only.isdigit():
            return cleaned
        else:
            return cnic.strip()  # Return original if validation fails

    def parse_date(self, date_str):
        """Parse various date formats"""
        if not date_str or date_str.strip() in ['000', '0000', 'nil', 'N/A']:
            return None

        date_str = date_str.strip()
        
        # Common date formats to try
        date_formats = [
            '%d-%b-%y',      # 28-Jul-93
            '%d-%b-%Y',      # 28-Jul-1993
            '%d/%m/%Y',      # 28/07/1993
            '%d-%m-%Y',      # 28-07-1993
            '%Y-%m-%d',      # 1993-07-28
            '%d-%m-%y',      # 28-07-93
            '%d/%m/%y',      # 28/07/93
        ]

        for fmt in date_formats:
            try:
                parsed_date = datetime.strptime(date_str, fmt).date()
                # Handle 2-digit years
                if parsed_date.year < 1950:
                    parsed_date = parsed_date.replace(year=parsed_date.year + 100)
                return parsed_date
            except ValueError:
                continue

        # Try parsing with dateutil if available
        try:
            from dateutil import parser
            return parser.parse(date_str).date()
        except:
            pass

        return None

    def parse_year(self, year_str):
        """Parse year from string"""
        if not year_str or year_str.strip() in ['000', '0000', 'nil', 'N/A']:
            return None
        
        try:
            year = int(year_str.strip())
            # Handle 2-digit years
            if year < 50:
                year += 2000
            elif year < 100:
                year += 1900
            return year
        except ValueError:
            return None

    def map_gender(self, gender_str):
        """Map gender string to model choice"""
        gender_map = {
            'male': 'male',
            'm': 'male',
            'female': 'female',
            'f': 'female',
            'other': 'other',
            'o': 'other'
        }
        return gender_map.get(gender_str, 'other')

    def map_marital_status(self, status_str):
        """Map marital status string to model choice"""
        status_map = {
            'single': 'single',
            'married': 'married',
            'divorced': 'divorced',
            'widowed': 'widowed'
        }
        return status_map.get(status_str, 'single')

    def map_shift(self, shift_str):
        """Map shift string to model choice"""
        shift_map = {
            'morning': 'morning',
            'afternoon': 'afternoon',
            'both': 'both',
            'morning afternoon': 'both',
            'afternoon morning': 'both'
        }
        return shift_map.get(shift_str, 'morning')