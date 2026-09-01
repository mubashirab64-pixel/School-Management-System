"""
Management command: fix_teacher_classrooms

Re-processes classroom assignments for already-uploaded teachers from a CSV file.
Only updates teachers that currently have NO classroom assignments.

Usage:
  python manage.py fix_teacher_classrooms --csv /path/to/file.csv
"""
import csv
import re
from django.core.management.base import BaseCommand
from teachers.models import Teacher
from campus.models import Campus
from classes.models import ClassRoom


def clean_name(val):
    if not val:
        return ""
    return str(val).strip().lower().replace(' ', '').replace('-', '')


class Command(BaseCommand):
    help = 'Fix classroom assignments for already-uploaded teachers from CSV'

    def add_arguments(self, parser):
        parser.add_argument('--csv', required=True, help='Path to CSV file')
        parser.add_argument('--dry-run', action='store_true', help='Preview without saving')

    def handle(self, *args, **options):
        csv_path = options['csv']
        dry_run = options['dry_run']

        try:
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                rows = list(csv.DictReader(f))
        except Exception as e:
            self.stderr.write(f'Cannot read CSV: {e}')
            return

        fixed = 0
        skipped = 0
        not_found = 0

        for idx, row in enumerate(rows, start=2):
            email = row.get('email', '').strip().lower()
            class_input = row.get('assigned_classrooms', '').strip()
            campus_name = row.get('campus', '').strip()

            if not email or not class_input or class_input == '-':
                continue

            teacher = Teacher.objects.filter(email=email).first()
            if not teacher:
                self.stdout.write(self.style.WARNING(f'Row {idx}: Teacher not found for {email}'))
                not_found += 1
                continue

            if teacher.assigned_classrooms.exists():
                self.stdout.write(f'Row {idx} [{teacher.full_name}]: Already has classrooms — skipping')
                skipped += 1
                continue

            campus = Campus.objects.filter(
                campus_name__icontains=campus_name,
                organization=teacher.organization
            ).first()

            if not campus:
                self.stdout.write(self.style.WARNING(f'Row {idx}: Campus "{campus_name}" not found'))
                continue

            all_classrooms = ClassRoom.objects.filter(
                organization=teacher.organization
            ).select_related('grade', 'grade__level__campus')

            assigned = []
            for t_name in [c.strip() for c in class_input.split(',') if c.strip()]:
                stripped = re.sub(r'\s*\([^)]*\)', '', t_name).strip()
                cleaned_t = clean_name(stripped)
                if not cleaned_t:
                    continue
                for cls in all_classrooms:
                    if cls.grade.level.campus != campus:
                        continue
                    cls_full = f"{cls.grade.name}{cls.section}"
                    cls_dash = f"{cls.grade.name} - {cls.section}"
                    if (clean_name(cls.code) == cleaned_t
                            or clean_name(cls_full) == cleaned_t
                            or clean_name(cls_dash) == cleaned_t):
                        assigned.append(cls)
                        break

            if assigned:
                if not dry_run:
                    for cls in assigned:
                        teacher.assigned_classrooms.add(cls)
                names = ', '.join(f"{c.grade.name}-{c.section}" for c in assigned)
                self.stdout.write(self.style.SUCCESS(
                    f'Row {idx} [{teacher.full_name}]: {"[DRY] " if dry_run else ""}Assigned → {names}'
                ))
                fixed += 1
            else:
                self.stdout.write(self.style.WARNING(
                    f'Row {idx} [{teacher.full_name}]: No matching classroom found for "{class_input}"'
                ))

        self.stdout.write('')
        self.stdout.write(f'Fixed: {fixed} | Skipped (already had): {skipped} | Not found: {not_found}')
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no changes saved'))
