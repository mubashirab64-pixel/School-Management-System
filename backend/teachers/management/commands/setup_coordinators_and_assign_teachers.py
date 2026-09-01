from django.core.management.base import BaseCommand
from django.db import transaction
from teachers.models import Teacher
from coordinator.models import Coordinator
from classes.models import Grade, Level
from campus.models import Campus

class Command(BaseCommand):
    help = 'Setup coordinators for all campuses and assign teachers automatically'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
        parser.add_argument(
            '--create-coordinators',
            action='store_true',
            help='Create coordinators for campuses that need them',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        create_coordinators = options['create_coordinators']
        
        self.stdout.write(
            self.style.SUCCESS('Starting coordinator setup and teacher assignment...')
        )
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN MODE - No changes will be made')
            )
        
        # Get all campuses
        all_campuses = Campus.objects.all()
        
        total_assigned = 0
        total_coordinators_created = 0
        
        for campus in all_campuses:
            self.stdout.write(f"\nProcessing Campus: {campus.campus_name}")
            
            # Get teachers for this campus
            teachers = Teacher.objects.filter(current_campus=campus)
            teachers_with_coordinator = teachers.filter(assigned_coordinator__isnull=False).count()
            teachers_without_coordinator = teachers.filter(assigned_coordinator__isnull=True).count()
            
            self.stdout.write(f"  Teachers: {teachers.count()} (with coordinator: {teachers_with_coordinator}, without: {teachers_without_coordinator})")
            
            if teachers_without_coordinator == 0:
                self.stdout.write(f"  All teachers already have coordinators")
                continue
            
            # Check if campus has levels/grades
            levels = Level.objects.filter(campus=campus)
            if not levels.exists():
                self.stdout.write(f"  No levels defined for this campus - skipping")
                continue
            
            self.stdout.write(f"  Levels: {[l.name for l in levels]}")
            
            # Process each level
            for level in levels:
                self.stdout.write(f"\n  Processing Level: {level.name}")
                
                # Get or create coordinator for this level and campus
                coordinator = Coordinator.objects.filter(
                    level=level,
                    campus=campus,
                    is_currently_active=True
                ).first()
                
                if not coordinator and create_coordinators:
                    # Create a coordinator for this level
                    coordinator_name = f"Coordinator-{level.name}-{campus.campus_name}"
                    if not dry_run:
                        coordinator = Coordinator.objects.create(
                            full_name=coordinator_name,
                            campus=campus,
                            level=level,
                            is_currently_active=True
                        )
                        total_coordinators_created += 1
                    self.stdout.write(f"    {'Would create' if dry_run else 'Created'} coordinator: {coordinator_name}")
                elif not coordinator:
                    self.stdout.write(f"    No coordinator found for {level.name} in {campus.campus_name}")
                    continue
                else:
                    self.stdout.write(f"    Using existing coordinator: {coordinator.full_name}")
                
                # Get grades for this level
                grades = Grade.objects.filter(level=level)
                grade_names = [g.name for g in grades]
                self.stdout.write(f"    Grades: {grade_names}")
                
                # Find teachers for this campus and level who don't have coordinators
                teachers_to_assign = teachers.filter(
                    assigned_coordinator__isnull=True,
                    current_classes_taught__isnull=False
                )
                
                assigned_count = 0
                for teacher in teachers_to_assign:
                    try:
                        # Extract grade from current_classes_taught
                        classes_text = teacher.current_classes_taught.lower()
                        grade_name = None
                        
                        # Try to extract grade from classes taught
                        import re
                        grade_match = re.search(r'grade\s*[-]?\s*(\d+)', classes_text)
                        if grade_match:
                            grade_number = grade_match.group(1)
                            grade_name = f"Grade-{grade_number}"
                        else:
                            # Check for Pre-Primary classes
                            if any(term in classes_text for term in ['nursery', 'kg-1', 'kg-2', 'kg1', 'kg2', 'kg-ii', 'kg-i']):
                                if 'nursery' in classes_text:
                                    grade_name = 'Nursary'
                                elif 'kg-1' in classes_text or 'kg1' in classes_text or 'kg-i' in classes_text:
                                    grade_name = 'KG-1'
                                elif 'kg-2' in classes_text or 'kg2' in classes_text or 'kg-ii' in classes_text:
                                    grade_name = 'KG-2'
                        
                        if grade_name and grade_name in grade_names:
                            if not dry_run:
                                teacher.assigned_coordinator = coordinator
                                teacher.save(update_fields=['assigned_coordinator'])
                            assigned_count += 1
                            self.stdout.write(f"      {'Would assign' if dry_run else 'Assigned'} {teacher.full_name} ({grade_name})")
                        else:
                            self.stdout.write(f"      Skipped {teacher.full_name} - grade '{grade_name}' not in {grade_names}")
                            
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(f"      Error processing {teacher.full_name}: {str(e)}")
                        )
                
                self.stdout.write(f"    {'Would assign' if dry_run else 'Assigned'}: {assigned_count} teachers")
                total_assigned += assigned_count
        
        # Summary
        self.stdout.write(f"\nSUMMARY:")
        if create_coordinators:
            if dry_run:
                self.stdout.write(f"   Would create: {total_coordinators_created} coordinators")
            else:
                self.stdout.write(f"   Created: {total_coordinators_created} coordinators")
        if dry_run:
            self.stdout.write(f"   Would assign: {total_assigned} teachers")
        else:
            self.stdout.write(f"   Assigned: {total_assigned} teachers")
        
        self.stdout.write(
            self.style.SUCCESS('Coordinator setup and teacher assignment completed!')
        )
