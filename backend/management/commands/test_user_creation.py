from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from teachers.models import Teacher
from coordinator.models import Coordinator
from principals.models import Principal
from campus.models import Campus
from classes.models import Level
from services.user_creation_service import UserCreationService

User = get_user_model()

class Command(BaseCommand):
    help = 'Test automatic user creation for all entity types'

    def add_arguments(self, parser):
        parser.add_argument(
            '--entity-type',
            type=str,
            choices=['teacher', 'coordinator', 'principal'],
            help='Type of entity to test'
        )

    def handle(self, *args, **options):
        entity_type = options.get('entity_type', 'teacher')
        
        self.stdout.write(f'Testing user creation for {entity_type}...')
        
        # Get or create test campus
        campus, created = Campus.objects.get_or_create(
            campus_name='Test Campus',
            defaults={
                'campus_code': 'TC',
                'address': 'Test Address',
                'phone_number': '1234567890',
                'is_active': True
            }
        )
        
        if created:
            self.stdout.write(f'Created test campus: {campus.campus_name}')
        
        if entity_type == 'teacher':
            self.test_teacher_creation(campus)
        elif entity_type == 'coordinator':
            self.test_coordinator_creation(campus)
        elif entity_type == 'principal':
            self.test_principal_creation(campus)

    def test_teacher_creation(self, campus):
        """Test teacher creation and user generation"""
        self.stdout.write('Creating test teacher...')
        
        # Create teacher
        teacher = Teacher.objects.create(
            full_name='Test Teacher',
            dob='1990-01-01',
            gender='male',
            contact_number='1234567890',
            email='teacher@test.com',
            permanent_address='Test Address',
            education_level='Bachelor',
            institution_name='Test University',
            year_of_passing=2012,
            total_experience_years=5,
            current_campus=campus,
            joining_date='2024-01-01',
            shift='morning',
            is_currently_active=True
        )
        
        self.stdout.write(f'Teacher created: {teacher.full_name}')
        self.stdout.write(f'Employee Code: {teacher.employee_code}')
        
        # Check if user was created
        try:
            user = User.objects.get(email=teacher.email)
            self.stdout.write(f'✅ User created successfully: {user.username}')
            self.stdout.write(f'User role: {user.role}')
            self.stdout.write(f'User campus: {user.campus}')
        except User.DoesNotExist:
            self.stdout.write('❌ User was not created')

    def test_coordinator_creation(self, campus):
        """Test coordinator creation and user generation"""
        self.stdout.write('Creating test coordinator...')
        
        # Get or create test level
        level, created = Level.objects.get_or_create(
            name='Test Level',
            campus=campus,
            defaults={'description': 'Test Level Description'}
        )
        
        if created:
            self.stdout.write(f'Created test level: {level.name}')
        
        # Create coordinator
        coordinator = Coordinator.objects.create(
            full_name='Test Coordinator',
            dob='1985-01-01',
            gender='female',
            contact_number='1234567890',
            email='coordinator@test.com',
            cnic='1234567890123',
            permanent_address='Test Address',
            education_level='Master',
            institution_name='Test University',
            year_of_passing=2010,
            total_experience_years=8,
            campus=campus,
            level=level,
            joining_date='2024-01-01',
            is_currently_active=True,
            can_assign_class_teachers=True
        )
        
        self.stdout.write(f'Coordinator created: {coordinator.full_name}')
        self.stdout.write(f'Employee Code: {coordinator.employee_code}')
        
        # Check if user was created
        try:
            user = User.objects.get(email=coordinator.email)
            self.stdout.write(f'✅ User created successfully: {user.username}')
            self.stdout.write(f'User role: {user.role}')
            self.stdout.write(f'User campus: {user.campus}')
        except User.DoesNotExist:
            self.stdout.write('❌ User was not created')

    def test_principal_creation(self, campus):
        """Test principal creation and user generation"""
        self.stdout.write('Creating test principal...')
        
        # Create principal
        principal = Principal.objects.create(
            full_name='Test Principal',
            dob='1980-01-01',
            gender='male',
            contact_number='1234567890',
            email='principal@test.com',
            cnic='1234567890124',
            permanent_address='Test Address',
            education_level='PhD',
            institution_name='Test University',
            year_of_passing=2008,
            total_experience_years=12,
            campus=campus,
            shift='morning',
            joining_date='2024-01-01',
            is_currently_active=True
        )
        
        self.stdout.write(f'Principal created: {principal.full_name}')
        self.stdout.write(f'Employee Code: {principal.employee_code}')
        
        # Check if user was created
        try:
            user = User.objects.get(email=principal.email)
            self.stdout.write(f'✅ User created successfully: {user.username}')
            self.stdout.write(f'User role: {user.role}')
            self.stdout.write(f'User campus: {user.campus}')
        except User.DoesNotExist:
            self.stdout.write('❌ User was not created')
