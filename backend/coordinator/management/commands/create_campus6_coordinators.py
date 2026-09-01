import os
import sys
import django
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from campus.models import Campus
from classes.models import Level
from coordinator.models import Coordinator
from users.models import User

class Command(BaseCommand):
    help = 'Create coordinators for Campus 6 with shift-based assignment'

    def add_arguments(self, parser):
        parser.add_argument(
            '--campus-id',
            type=int,
            default=6,
            help='Campus ID to create coordinators for (default: 6)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run without actually creating records (for testing)'
        )

    def handle(self, *args, **options):
        campus_id = options['campus_id']
        dry_run = options['dry_run']

        self.stdout.write(f'Creating coordinators for Campus {campus_id}...')

        # Get campus
        try:
            campus = Campus.objects.get(id=campus_id)
            self.stdout.write(f'Campus: {campus.campus_name}')
        except Campus.DoesNotExist:
            raise CommandError(f'Campus with ID {campus_id} not found')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No records will be created'))

        # Create coordinators
        self.create_coordinators(campus, dry_run)

    def create_coordinators(self, campus, dry_run):
        """Create coordinators for different levels and shifts"""
        
        # Coordinator data
        coordinators_data = [
            {
                'full_name': 'Mr. Kashif Quraishi',
                'email': 'kashif.quraishi@campus6.edu.pk',
                'contact_number': '03001234567',
                'cnic': '42101-1234567-8',
                'level_name': 'Pre-Primary',
                'shift': 'both',  # Both morning and afternoon
                'role': 'Pre-Primary Coordinator'
            },
            {
                'full_name': 'Ms. Sarah Ahmed',
                'email': 'sarah.ahmed@campus6.edu.pk',
                'contact_number': '03001234568',
                'cnic': '42101-1234567-9',
                'level_name': 'Primary',
                'shift': 'both',  # Both morning and afternoon
                'role': 'Primary Coordinator'
            },
            {
                'full_name': 'Mr. Ali Hassan',
                'email': 'ali.hassan@campus6.edu.pk',
                'contact_number': '03001234569',
                'cnic': '42101-1234567-0',
                'level_name': 'Secondary',
                'shift': 'both',  # Both morning and afternoon
                'role': 'Secondary Coordinator'
            },
            # Afternoon Coordinators
            {
                'full_name': 'Ms. Fatima Khan',
                'email': 'fatima.khan@campus6.edu.pk',
                'contact_number': '03001234570',
                'cnic': '42101-1234567-1',
                'level_name': 'Pre-Primary',
                'shift': 'afternoon',
                'role': 'Pre-Primary Afternoon Coordinator'
            },
            {
                'full_name': 'Mr. Ahmed Ali',
                'email': 'ahmed.ali@campus6.edu.pk',
                'contact_number': '03001234571',
                'cnic': '42101-1234567-2',
                'level_name': 'Primary',
                'shift': 'afternoon',
                'role': 'Primary Afternoon Coordinator'
            },
            {
                'full_name': 'Ms. Ayesha Malik',
                'email': 'ayesha.malik@campus6.edu.pk',
                'contact_number': '03001234572',
                'cnic': '42101-1234567-3',
                'level_name': 'Secondary',
                'shift': 'afternoon',
                'role': 'Secondary Afternoon Coordinator'
            }
        ]

        created_count = 0

        with transaction.atomic():
            for coord_data in coordinators_data:
                if dry_run:
                    self.stdout.write(f'[DRY RUN] Would create coordinator: {coord_data["full_name"]}')
                    continue

                # Get or create level based on shift
                shift_for_level = 'morning' if coord_data['shift'] == 'both' else coord_data['shift']
                level = self.get_or_create_level(campus, coord_data['level_name'], shift_for_level)
                
                # Create coordinator
                coordinator = Coordinator.objects.create(
                    full_name=coord_data['full_name'],
                    dob='1985-01-01',  # Default DOB
                    gender='male' if coord_data['full_name'].startswith('Mr.') else 'female',
                    contact_number=coord_data['contact_number'],
                    email=coord_data['email'],
                    cnic=coord_data['cnic'],
                    permanent_address='Campus 6, Karachi',
                    education_level='Masters',
                    institution_name='University of Karachi',
                    year_of_passing=2010,
                    total_experience_years=15,
                    campus=campus,
                    level=level,
                    shift=coord_data['shift'],
                    joining_date='2020-01-01',
                    is_currently_active=True,
                    can_assign_class_teachers=True
                )

                # Create user account
                self.create_coordinator_user(coordinator)

                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'✅ Created coordinator: {coordinator.full_name} ({coordinator.employee_code})')
                )

        # Summary
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN COMPLETED - No records were created'))
        else:
            self.stdout.write(
                self.style.SUCCESS(f'\n📊 Coordinator Creation Summary:\n✅ Created: {created_count}')
            )

    def get_or_create_level(self, campus, level_name, shift):
        """Get or create level for coordinator"""
        level, created = Level.objects.get_or_create(
            campus=campus,
            name=level_name,
            shift=shift,
            defaults={
                'coordinator_assigned_at': None
            }
        )
        
        if created:
            self.stdout.write(f'  ✅ Created level: {level.name}-{level.shift.title()}')
        else:
            self.stdout.write(f'  ⏭️  Level already exists: {level.name}-{level.shift.title()}')
        
        return level

    def create_coordinator_user(self, coordinator):
        """Create user account for coordinator"""
        # Generate username from employee code
        username = coordinator.employee_code
        
        # Check if user already exists
        if User.objects.filter(email=coordinator.email).exists():
            self.stdout.write(f'  ⏭️  User already exists: {coordinator.email}')
            return User.objects.get(email=coordinator.email)
        
        # Create user
        user = User.objects.create_user(
            username=username,
            email=coordinator.email,
            password='coordinator123',  # Default password
            first_name=coordinator.full_name.split()[1] if len(coordinator.full_name.split()) > 1 else coordinator.full_name,
            last_name=' '.join(coordinator.full_name.split()[2:]) if len(coordinator.full_name.split()) > 2 else '',
            role='coordinator',
            campus=coordinator.campus,
            phone_number=coordinator.contact_number,
            is_active=True,
            is_verified=True,
            has_changed_default_password=False
        )
        
        self.stdout.write(f'  ✅ Created user account: {username}')
        return user
