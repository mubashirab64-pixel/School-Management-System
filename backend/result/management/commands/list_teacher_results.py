from django.core.management.base import BaseCommand
from result.models import Result
from teachers.models import Teacher

class Command(BaseCommand):
    help = 'List all results for a given teacher (by email or id)'

    def add_arguments(self, parser):
        parser.add_argument('--teacher', type=str, required=True, help='Teacher email or id')

    def handle(self, *args, **options):
        teacher_arg = options['teacher']
        teacher = None
        if teacher_arg.isdigit():
            teacher = Teacher.objects.filter(id=int(teacher_arg)).first()
        else:
            teacher = Teacher.objects.filter(email=teacher_arg).first()
        if not teacher:
            self.stdout.write(self.style.ERROR(f'Teacher not found: {teacher_arg}'))
            return
        results = Result.objects.filter(teacher=teacher).order_by('exam_type', 'month', 'student__name')
        if not results.exists():
            self.stdout.write(self.style.WARNING('No results found for this teacher.'))
            return
        self.stdout.write(f"Results for teacher: {teacher} ({teacher.id})\n")
        for r in results:
            self.stdout.write(f"Student: {r.student} | Exam: {r.exam_type} | Month: {r.month} | Status: {r.status} | Created: {r.created_at}")
