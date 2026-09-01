import os
import sys
import django
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from campus.models import Campus
from classes.models import Level, Grade, ClassRoom
from coordinator.models import Coordinator
from teachers.models import Teacher

class Command(BaseCommand):
    help = 'Assign teachers to coordinators and classrooms based on shift and grade'

    def add_arguments(self, parser):
        parser.add_argument(
            '--campus-id',
            type=int,
            default=6,
            help='Campus ID to assign teachers for (default: 6)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run without actually assigning (for testing)'
        )

    def handle(self, *args, **options):
        campus_id = options['campus_id']
        dry_run = options['dry_run']

        self.stdout.write(f'Assigning teachers to coordinators for Campus {campus_id}...')

        # Get campus
        try:
            campus = Campus.objects.get(id=campus_id)
            self.stdout.write(f'Campus: {campus.campus_name}')
        except Campus.DoesNotExist:
            raise CommandError(f'Campus with ID {campus_id} not found')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No assignments will be made'))

        # Assign teachers
        self.assign_teachers_to_coordinators(campus, dry_run)

    def assign_teachers_to_coordinators(self, campus, dry_run):
        """Assign teachers to coordinators and classrooms"""
        
        # Get all coordinators for this campus
        coordinators = Coordinator.objects.filter(campus=campus, is_currently_active=True)
        
        if not coordinators.exists():
            self.stdout.write(self.style.ERROR('No coordinators found for this campus'))
            return

        # Get all teachers for this campus
        teachers = Teacher.objects.filter(current_campus=campus, is_currently_active=True)
        
        if not teachers.exists():
            self.stdout.write(self.style.ERROR('No teachers found for this campus'))
            return

        self.stdout.write(f'Found {coordinators.count()} coordinators and {teachers.count()} teachers')

        assigned_teachers = 0
        assigned_classrooms = 0

        with transaction.atomic():
            for coordinator in coordinators:
                self.stdout.write(f'\n👤 Processing: {coordinator.full_name} ({coordinator.shift})')
                
                if not coordinator.level:
                    self.stdout.write(f'  ❌ No level assigned to coordinator')
                    continue

                # Get teachers for this coordinator's shift and level
                teachers_for_coordinator = self.get_teachers_for_coordinator(teachers, coordinator)
                
                self.stdout.write(f'  📚 Found {len(teachers_for_coordinator)} teachers for this coordinator')
                
                # Skip if no teachers found
                if len(teachers_for_coordinator) == 0:
                    self.stdout.write(f'  ⏭️  Skipping {coordinator.full_name} - No suitable teachers found')
                    continue
                
                # Assign teachers to classrooms
                for teacher in teachers_for_coordinator:
                    classroom = self.find_suitable_classroom(teacher, coordinator)
                    
                    if classroom:
                        if not dry_run:
                            # Check if teacher is already assigned to another classroom
                            try:
                                existing_classroom = teacher.assigned_classroom_teacher
                                if existing_classroom:
                                    self.stdout.write(f'    ⏭️  {teacher.full_name} already assigned to {existing_classroom.grade.name}-{existing_classroom.section}')
                                    continue
                            except:
                                # Teacher not assigned to any classroom
                                pass
                            
                            # Assign teacher to classroom
                            classroom.class_teacher = teacher
                            classroom.assigned_at = django.utils.timezone.now()
                            classroom.save()
                            
                            # Assign coordinator to teacher
                            if coordinator not in teacher.assigned_coordinators.all():
                                teacher.assigned_coordinators.add(coordinator)
                        
                        assigned_classrooms += 1
                        self.stdout.write(
                            f'    ✅ Assigned {teacher.full_name} to {classroom.grade.name}-{classroom.section} ({classroom.shift})'
                        )
                    else:
                        self.stdout.write(f'    ❌ No suitable classroom found for {teacher.full_name}')
                
                assigned_teachers += len(teachers_for_coordinator)

        # Summary
        if dry_run:
            self.stdout.write(self.style.WARNING('\nDRY RUN COMPLETED - No assignments were made'))
        else:
            self.stdout.write(
                self.style.SUCCESS(f'\n📊 Assignment Summary:\n✅ Teachers Processed: {assigned_teachers}\n✅ Classrooms Assigned: {assigned_classrooms}')
            )

    def get_teachers_for_coordinator(self, teachers, coordinator):
        """Get teachers suitable for this coordinator based on shift and level"""
        suitable_teachers = []
        
        for teacher in teachers:
            # Check if teacher's shift matches coordinator's shift
            if coordinator.shift == 'both' or teacher.shift == coordinator.shift:
                # Check if teacher teaches grades in this coordinator's level
                if self.teacher_teaches_level(teacher, coordinator.level):
                    suitable_teachers.append(teacher)
        
        return suitable_teachers

    def teacher_teaches_level(self, teacher, level):
        """Check if teacher teaches grades in this level"""
        if not teacher.current_classes_taught:
            return False
        
        classes_text = teacher.current_classes_taught.lower()
        
        # Map level names to grade patterns
        level_patterns = {
            'Pre-Primary': ['nursery', 'kg-1', 'kg-2', 'kg1', 'kg2', 'kg-i', 'kg-ii'],
            'Primary': ['grade 1', 'grade 2', 'grade 3', 'grade 4', 'grade 5', 'grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5'],
            'Secondary': ['grade 6', 'grade 7', 'grade 8', 'grade 9', 'grade 10', 'grade-6', 'grade-7', 'grade-8', 'grade-9', 'grade-10']
        }
        
        patterns = level_patterns.get(level.name, [])
        return any(pattern in classes_text for pattern in patterns)

    def find_suitable_classroom(self, teacher, coordinator):
        """Find a suitable classroom for this teacher"""
        # Get classrooms under this coordinator's level
        if coordinator.shift == 'both':
            classrooms = ClassRoom.objects.filter(
                grade__level=coordinator.level,
                class_teacher__isnull=True  # Only unassigned classrooms
            )
        else:
            classrooms = ClassRoom.objects.filter(
                grade__level=coordinator.level,
                shift=coordinator.shift,
                class_teacher__isnull=True  # Only unassigned classrooms
            )
        
        # Try to find a classroom that matches teacher's grade preference
        teacher_grades = self.extract_teacher_grades(teacher)
        
        for classroom in classrooms:
            if self.classroom_matches_teacher_grade(classroom, teacher_grades):
                return classroom
        
        # If no perfect match, return any available classroom
        return classrooms.first()

    def extract_teacher_grades(self, teacher):
        """Extract grade preferences from teacher's current_classes_taught"""
        if not teacher.current_classes_taught:
            return []
        
        import re
        classes_text = teacher.current_classes_taught.lower()
        
        # Extract grade numbers
        grade_matches = re.findall(r'grade\s*[-]?\s*(\d+)', classes_text)
        grades = [f"Grade-{num}" for num in grade_matches]
        
        # Extract pre-primary classes
        if 'nursery' in classes_text:
            grades.append('Nursery')
        if 'kg-1' in classes_text or 'kg1' in classes_text or 'kg-i' in classes_text:
            grades.append('KG-I')
        if 'kg-2' in classes_text or 'kg2' in classes_text or 'kg-ii' in classes_text:
            grades.append('KG-II')
        
        return grades

    def classroom_matches_teacher_grade(self, classroom, teacher_grades):
        """Check if classroom grade matches teacher's grade preferences"""
        if not teacher_grades:
            return True  # If no specific grades, assign to any classroom
        
        return classroom.grade.name in teacher_grades
