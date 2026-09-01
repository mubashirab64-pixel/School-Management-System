"""Rebuild a year's EnrollmentSnapshots cleanly from the LIVE student record.

After a lot of manual transfer / delete-result / re-promote cycles, a student can
end up with several conflicting snapshots for the same year (e.g. an old Grade II
plus a new Grade III), and Grade Progression — which reads the latest snapshot —
picks a stale one, so a promoted student shows as 'repeated'.

This collapses each active student to EXACTLY ONE start_of_year snapshot for the
year, holding their CURRENT grade / classroom. It only touches the given year;
the previous year's snapshots (the progression's 'from' side) are left alone.

    python manage.py rebuild_year_snapshots --year 2026-27            # report
    python manage.py rebuild_year_snapshots --year 2026-27 --apply
    python manage.py rebuild_year_snapshots --year 2026-27 --students C02-M-25-02093,... --apply
"""
from datetime import date

from django.core.management.base import BaseCommand
from django.db.models import Q

from students.models import Student, EnrollmentSnapshot


class Command(BaseCommand):
    help = "Rebuild a year's snapshots to one-per-student = current grade."

    def add_arguments(self, parser):
        parser.add_argument('--year', required=True, help="e.g. 2026-27")
        parser.add_argument('--apply', action='store_true', help="Write (default report-only).")
        parser.add_argument('--students', default='',
                            help="Comma-separated student_id/student_code/pk to limit to.")
        parser.add_argument('--force', action='store_true',
                            help="Also rebuild students with a single (non-conflicting) "
                                 "snapshot whose grade differs from current. Default: "
                                 "conflicts only.")

    def handle(self, *args, **opts):
        year = opts['year']
        apply = opts['apply']
        yr = int(year.split('-')[0])
        snap_date = date(yr, 4, 1)

        students = Student._base_manager.filter(is_deleted=False, is_active=True)
        wanted = [x.strip() for x in opts['students'].split(',') if x.strip()]
        if wanted:
            q = Q(student_id__in=wanted) | Q(student_code__in=wanted) | Q(gr_no__in=wanted)
            ids = [int(x) for x in wanted if x.isdigit()]
            if ids:
                q |= Q(id__in=ids)
            students = students.filter(q)

        rebuilt = 0
        for s in students.select_related('classroom', 'campus'):
            cur = s.current_grade
            if not cur:
                continue
            existing = list(EnrollmentSnapshot.all_objects.filter(student=s, academic_year=year))
            # Only resolve CONFLICTS: a student with more than one snapshot for the
            # year (e.g. a stale end_of_year 'Grade II' fighting a start_of_year
            # 'Grade III'), where progression reads the wrong one and shows a
            # promoted student as 'repeated'. Students with 0 or 1 snapshot are
            # left untouched — unless --force is given.
            if len(existing) <= 1 and not opts['force']:
                continue
            if not existing:
                continue

            before = [(e.snapshot_type, e.grade) for e in existing]
            self.stdout.write(
                f"  {s.student_id or s.id} {s.name[:16]:16} {before} -> [(start_of_year, {cur!r})]")
            if apply:
                EnrollmentSnapshot.all_objects.filter(student=s, academic_year=year).delete()
                EnrollmentSnapshot.all_objects.create(
                    student=s, academic_year=year, snapshot_type='start_of_year',
                    grade=cur, snapshot_date=snap_date, classroom=s.classroom,
                    section=s.section, campus=s.campus, status=s.enrollment_status,
                    gender=s.gender, organization=s.organization)
            rebuilt += 1

        verb = "Rebuilt" if apply else "Would rebuild"
        self.stdout.write(self.style.SUCCESS(
            f"{verb} {rebuilt} student snapshot(s) for {year}."
            + ("" if apply else "  (re-run with --apply)")))
