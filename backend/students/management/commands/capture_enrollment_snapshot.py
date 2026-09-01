"""Freeze each active student's grade / campus / status for an academic year.

Run at the start of each academic year (e.g. via cron on 1 April) to build the
year-over-year GRADE history that Grade Progression + Cross-Year analytics need
(current_grade is mutable and overwritten on promotion, so it must be captured).

    python manage.py capture_enrollment_snapshot --academic_year 2026-27 --type start_of_year

Idempotent: re-running for the same (student, year, type) updates the row.
"""
from datetime import date, datetime
from django.core.management.base import BaseCommand
from students.models import Student, EnrollmentSnapshot


class Command(BaseCommand):
    help = "Capture a per-student enrollment snapshot (grade/campus/status) for an academic year."

    def add_arguments(self, parser):
        parser.add_argument('--academic_year', type=str, default=None,
                            help="e.g. 2026-27 (defaults to the current academic year)")
        parser.add_argument('--type', type=str, default='start_of_year',
                            choices=['start_of_year', 'end_of_year', 'promotion'])
        parser.add_argument('--date', type=str, default=None,
                            help="Snapshot date YYYY-MM-DD (defaults to the year's April 1 / today)")

    def _current_academic_year(self):
        today = date.today()
        start = today.year if today.month >= 4 else today.year - 1
        return f"{start}-{str(start + 1)[-2:]}"

    def handle(self, *args, **opts):
        academic_year = opts.get('academic_year') or self._current_academic_year()
        snap_type = opts.get('type')

        if opts.get('date'):
            try:
                snap_date = datetime.strptime(opts['date'], '%Y-%m-%d').date()
            except ValueError:
                self.stderr.write("Invalid --date, use YYYY-MM-DD.")
                return
        else:
            try:
                snap_date = date(int(academic_year.split('-')[0]), 4, 1)
            except (ValueError, IndexError):
                snap_date = date.today()

        # _base_manager → capture across every organization (append-only history).
        qs = Student._base_manager.filter(is_deleted=False, is_active=True).select_related(
            'campus', 'classroom', 'classroom__grade')
        created = updated = 0
        for s in qs.iterator():
            obj, was_created = EnrollmentSnapshot.all_objects.update_or_create(
                student=s, academic_year=academic_year, snapshot_type=snap_type,
                defaults={
                    'snapshot_date': snap_date,
                    'campus': s.campus,
                    'classroom': s.classroom,
                    'grade': s.current_grade,
                    'section': s.section,
                    'status': s.enrollment_status,
                    'gender': s.gender,
                    'organization': s.organization,
                },
            )
            created += was_created
            updated += (not was_created)

        self.stdout.write(self.style.SUCCESS(
            f"Snapshot '{snap_type}' for {academic_year} @ {snap_date}: "
            f"created {created}, updated {updated}."
        ))
