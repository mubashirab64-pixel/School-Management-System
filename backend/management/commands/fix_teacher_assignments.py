from django.core.management.base import BaseCommand
from django.db import transaction
from teachers.models import Teacher
from classes.models import ClassRoom

class Command(BaseCommand):
    help = 'Fix duplicate teacher classroom assignments'

    def handle(self, *args, **options):
        self.stdout.write("🔧 Fixing teacher classroom assignments...")
        
        with transaction.atomic():
            # Find teachers assigned to multiple classrooms
            teachers_with_multiple_classrooms = []
            
            for teacher in Teacher.objects.filter(assigned_classroom__isnull=False):
                # Count how many classrooms this teacher is assigned to
                classroom_count = ClassRoom.objects.filter(class_teacher=teacher).count()
                if classroom_count > 1:
                    teachers_with_multiple_classrooms.append(teacher)
            
            self.stdout.write(f"Found {len(teachers_with_multiple_classrooms)} teachers with multiple assignments")
            
            # Fix each teacher
            for teacher in teachers_with_multiple_classrooms:
                self.stdout.write(f"Fixing assignments for {teacher.full_name}...")
                
                # Get all classrooms assigned to this teacher
                classrooms = ClassRoom.objects.filter(class_teacher=teacher)
                
                # Keep only the first assignment, remove others
                first_classroom = classrooms.first()
                other_classrooms = classrooms.exclude(pk=first_classroom.pk)
                
                # Remove teacher from other classrooms
                for classroom in other_classrooms:
                    classroom.class_teacher = None
                    classroom.save()
                    self.stdout.write(f"  Removed from {classroom}")
                
                # Ensure teacher's assigned_classroom matches
                teacher.assigned_classroom = first_classroom
                teacher.save()
                
                self.stdout.write(f"  Kept assignment to {first_classroom}")
            
            # Find classrooms with multiple teachers
            classrooms_with_multiple_teachers = []
            
            for classroom in ClassRoom.objects.filter(class_teacher__isnull=False):
                teacher_count = Teacher.objects.filter(assigned_classroom=classroom).count()
                if teacher_count > 1:
                    classrooms_with_multiple_teachers.append(classroom)
            
            self.stdout.write(f"Found {len(classrooms_with_multiple_teachers)} classrooms with multiple teachers")
            
            # Fix each classroom
            for classroom in classrooms_with_multiple_teachers:
                self.stdout.write(f"Fixing assignments for {classroom}...")
                
                # Get all teachers assigned to this classroom
                teachers = Teacher.objects.filter(assigned_classroom=classroom)
                
                # Keep only the first teacher, remove others
                first_teacher = teachers.first()
                other_teachers = teachers.exclude(pk=first_teacher.pk)
                
                # Remove classroom from other teachers
                for teacher in other_teachers:
                    teacher.assigned_classroom = None
                    teacher.is_class_teacher = False
                    teacher.save()
                    self.stdout.write(f"  Removed {teacher.full_name} from classroom")
                
                # Ensure classroom's class_teacher matches
                classroom.class_teacher = first_teacher
                classroom.save()
                
                self.stdout.write(f"  Kept {first_teacher.full_name} as class teacher")
        
        self.stdout.write(self.style.SUCCESS("✅ Successfully fixed all teacher classroom assignments!"))
