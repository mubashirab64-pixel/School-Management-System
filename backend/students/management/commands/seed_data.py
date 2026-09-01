from django.core.management.base import BaseCommand
from django.utils import timezone
from students.models import Student
from campus.models import Campus
from teachers.models import Teacher
import random
from datetime import date, timedelta

class Command(BaseCommand):
    help = 'Seed the database with sample data'

    def add_arguments(self, parser):
        parser.add_argument('--students', type=int, default=50, help='Number of students to create')
        parser.add_argument('--teachers', type=int, default=10, help='Number of teachers to create')

    def handle(self, *args, **options):
        self.stdout.write('Starting to seed data...')
        
        # Create sample campuses if they don't exist
        campus1, created = Campus.objects.get_or_create(
            name="Campus 1",
            defaults={
                'code': 'C01',
                'status': 'active',
                'address': '123 Main Street, City',
                'grades_offered': 'Grade 1 to Grade 12',
                'languages_of_instruction': 'English, Urdu',
                'capacity': 500,
                'num_students': 0,
                'num_teachers': 0,
                'is_draft': False
            }
        )
        
        campus2, created = Campus.objects.get_or_create(
            name="Campus 2", 
            defaults={
                'code': 'C02',
                'status': 'active',
                'address': '456 Oak Avenue, City',
                'grades_offered': 'Grade 1 to Grade 10',
                'languages_of_instruction': 'English',
                'capacity': 300,
                'num_students': 0,
                'num_teachers': 0,
                'is_draft': False
            }
        )

        # Create sample students
        student_count = options['students']
        first_names = ['Ahmed', 'Fatima', 'Ali', 'Aisha', 'Hassan', 'Zainab', 'Omar', 'Maryam', 'Yusuf', 'Khadija']
        last_names = ['Khan', 'Ahmed', 'Ali', 'Hassan', 'Malik', 'Sheikh', 'Raza', 'Syed', 'Butt', 'Chaudhry']
        grades = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th']
        religions = ['Islam', 'Christianity', 'Hinduism', 'Sikhism']
        mother_tongues = ['Urdu', 'Punjabi', 'Sindhi', 'Pashto', 'English']

        for i in range(student_count):
            first_name = random.choice(first_names)
            last_name = random.choice(last_names)
            gender = random.choice(['male', 'female'])
            
            student = Student.objects.create(
                name=f"{first_name} {last_name}",
                gender=gender,
                dob=date.today() - timedelta(days=random.randint(365*5, 365*18)),
                place_of_birth=random.choice(['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad']),
                religion=random.choice(religions),
                mother_tongue=random.choice(mother_tongues),
                emergency_contact=f"03{random.randint(10000000, 99999999)}",
                primary_phone=f"03{random.randint(10000000, 99999999)}",
                father_name=f"Mr. {random.choice(first_names)} {last_name}",
                father_cnic=f"{random.randint(1000000000000, 9999999999999)}",
                father_contact=f"03{random.randint(10000000, 99999999)}",
                father_occupation=random.choice(['Business', 'Teacher', 'Engineer', 'Doctor', 'Government']),
                mother_name=f"Mrs. {random.choice(first_names)} {last_name}",
                mother_cnic=f"{random.randint(1000000000000, 9999999999999)}",
                mother_contact=f"03{random.randint(10000000, 99999999)}",
                mother_occupation=random.choice(['Housewife', 'Teacher', 'Nurse', 'Business']),
                address=f"{random.randint(1, 100)} Street {random.randint(1, 50)}, Sector {random.randint(1, 20)}",
                family_income=random.randint(30000, 200000),
                house_owned=random.choice([True, False]),
                campus=random.choice([campus1, campus2]),
                current_grade=random.choice(grades),
                section=random.choice(['A', 'B', 'C']),
                gr_no=f"GR{random.randint(1000, 9999)}",
                is_draft=False
            )
            
            # Update campus student count
            student.campus.num_students += 1
            if gender == 'male':
                student.campus.num_students_male += 1
            else:
                student.campus.num_students_female += 1
            student.campus.save()

        # Create sample teachers
        teacher_count = options['teachers']
        for i in range(teacher_count):
            first_name = random.choice(first_names)
            last_name = random.choice(last_names)
            gender = random.choice(['male', 'female'])
            
            teacher = Teacher.objects.create(
                full_name=f"{first_name} {last_name}",
                dob=date.today() - timedelta(days=random.randint(365*25, 365*60)),
                gender=gender,
                contact_number=f"03{random.randint(10000000, 99999999)}",
                email=f"{first_name.lower()}.{last_name.lower()}@school.edu.pk",
                permanent_address=f"{random.randint(1, 100)} Street {random.randint(1, 50)}, Sector {random.randint(1, 20)}",
                current_address=f"{random.randint(1, 100)} Street {random.randint(1, 50)}, Sector {random.randint(1, 20)}",
                marital_status=random.choice(['single', 'married', 'divorced']),
                save_status='final'
            )
            
            # Update campus teacher count
            campus = random.choice([campus1, campus2])
            campus.num_teachers += 1
            if gender == 'male':
                campus.num_teachers_male += 1
            else:
                campus.num_teachers_female += 1
            campus.save()

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully created {student_count} students and {teacher_count} teachers!'
            )
        )
