from django.core.management.base import BaseCommand
from students.models import Student
from classes.models import ClassRoom, Grade, Level
from campus.models import Campus
from teachers.models import Teacher


class Command(BaseCommand):
    help = 'Test automatic student classroom assignment'

    def add_arguments(self, parser):
        parser.add_argument(
            '--campus-id',
            type=int,
            help='Campus ID to test with',
            default=6
        )

    def handle(self, *args, **options):
        campus_id = options['campus_id']
        
        try:
            campus = Campus.objects.get(id=campus_id)
            self.stdout.write(f"🏫 Testing with Campus: {campus.campus_name}")
            
            # Check existing classrooms
            classrooms = ClassRoom.objects.filter(grade__level__campus=campus)
            self.stdout.write(f"\n📚 Existing Classrooms in {campus.campus_name}:")
            for classroom in classrooms:
                teacher_name = classroom.class_teacher.full_name if classroom.class_teacher else "No Teacher"
                self.stdout.write(f"  - {classroom.grade.name}-{classroom.section} ({classroom.shift}) - Teacher: {teacher_name}")
            
            # Check existing students
            students = Student.objects.filter(campus=campus)
            self.stdout.write(f"\n👥 Existing Students in {campus.campus_name}:")
            for student in students:
                classroom_name = f"{student.classroom.grade.name}-{student.classroom.section}" if student.classroom else "No Classroom"
                self.stdout.write(f"  - {student.name} - Grade: {student.current_grade}, Section: {student.section}, Shift: {student.shift} - Classroom: {classroom_name}")
            
            # Test assignment for unassigned students
            unassigned_students = students.filter(classroom__isnull=True)
            if unassigned_students.exists():
                self.stdout.write(f"\n🔄 Testing auto-assignment for {unassigned_students.count()} unassigned students:")
                
                for student in unassigned_students:
                    self.stdout.write(f"\n  Testing student: {student.name}")
                    self.stdout.write(f"    Campus: {student.campus.campus_name}")
                    self.stdout.write(f"    Grade: {student.current_grade}")
                    self.stdout.write(f"    Section: {student.section}")
                    self.stdout.write(f"    Shift: {student.shift}")
                    
                    # Trigger auto-assignment
                    student._auto_assign_classroom()
                    
                    # Check if assignment worked
                    student.refresh_from_db()
                    if student.classroom:
                        teacher_name = student.classroom.class_teacher.full_name if student.classroom.class_teacher else "No Teacher"
                        self.stdout.write(f"    ✅ Assigned to: {student.classroom.grade.name}-{student.classroom.section} ({student.classroom.shift})")
                        self.stdout.write(f"    👨‍🏫 Teacher: {teacher_name}")
                    else:
                        self.stdout.write(f"    ❌ No classroom assigned")
            else:
                self.stdout.write(f"\n✅ All students are already assigned to classrooms!")
                
        except Campus.DoesNotExist:
            self.stdout.write(f"❌ Campus with ID {campus_id} not found")
        except Exception as e:
            self.stdout.write(f"❌ Error: {str(e)}")
            import traceback
            traceback.print_exc()
