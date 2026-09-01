from django.core.management.base import BaseCommand
from django.db.models import Q
from students.models import Student
from classes.models import ClassRoom


class Command(BaseCommand):
    help = 'Assign classroom to active students that have grade/section/shift but no classroom'

    def handle(self, *args, **options):
        students = Student.objects.filter(
            classroom__isnull=True,
            is_deleted=False,
            current_grade__isnull=False,
            section__isnull=False,
            
            shift__isnull=False,
            campus__isnull=False,
        )
        self.stdout.write(f'Found {students.count()} students without classroom')

        fixed = 0
        skipped = 0
        for student in students:
            grade_name = student.current_grade or ''
            section = student.section or ''
            shift = student.shift or ''
            campus = student.campus
            org = student.organization

            norm_grade = grade_name.lower().replace('grade', '').replace('class', '').strip()
            classroom = ClassRoom.objects.filter(
                organization=org,
                grade__level__campus=campus,
                section__iexact=section,
                shift__iexact=shift,
            ).filter(
                Q(grade__name__iexact=grade_name) | Q(grade__name__icontains=norm_grade)
            ).first()

            if classroom:
                student.classroom = classroom
                student.save(update_fields=['classroom'])
                self.stdout.write(f'  ✓ {student.name} → {classroom}')
                fixed += 1
            else:
                self.stdout.write(
                    f'  ✗ {student.name} — no classroom for grade={grade_name}, section={section}, shift={shift}'
                )
                skipped += 1

        self.stdout.write(f'\nDone: {fixed} fixed, {skipped} skipped (no matching classroom found)')
