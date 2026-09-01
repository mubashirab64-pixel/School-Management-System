"""Seed SYNTHETIC prior-year snapshots so the Grade Progression card shows
real-looking numbers in a demo / meeting.

⚠️  THIS IS NOT REAL DATA. The system only began capturing grade snapshots in the
current year, so there is no genuine prior-year grade history to compute
progression from. This command fabricates a prior year by placing most students
ONE GRADE BELOW their current grade (→ progressed) and a few at the SAME grade
(→ repeated). "One below" is derived from the real structural grade order
(classes.grade_ordering / Grade.order), not a hardcoded list.

Fully reversible — the prior year has no real rows, so --undo just deletes what
this created:

    python manage.py seed_demo_progression           # create demo prior-year snapshots
    python manage.py seed_demo_progression --undo     # delete them

The current year is taken from the latest existing snapshots; the prior year is
the one Grade Progression compares against.
"""
import bisect
from datetime import date

from django.core.management.base import BaseCommand

from students.models import EnrollmentSnapshot
from students.enrollment_kpis import prev_academic_year
from classes.models import Grade

# 1-in-N students "repeated" (same grade) so the demo isn't an unrealistic 100%.
REPEAT_EVERY = 8


class Command(BaseCommand):
    help = "Seed synthetic prior-year snapshots to demo the Grade Progression KPI (reversible)."

    def add_arguments(self, parser):
        parser.add_argument('--undo', action='store_true',
                            help="Delete the demo prior-year snapshots this created.")
        parser.add_argument('--current_year', type=str, default=None,
                            help="Override the current academic year (defaults to the latest snapshot year).")

    def _latest_year(self):
        years = sorted(set(EnrollmentSnapshot.all_objects.values_list('academic_year', flat=True)), reverse=True)
        return years[0] if years else None

    def handle(self, *args, **opts):
        current_year = opts.get('current_year') or self._latest_year()
        if not current_year:
            self.stderr.write("No snapshots exist yet — capture the current year first.")
            return
        prior_year = prev_academic_year(current_year)

        if opts['undo']:
            deleted, _ = EnrollmentSnapshot.all_objects.filter(
                academic_year=prior_year, snapshot_type='start_of_year').delete()
            self.stdout.write(self.style.SUCCESS(
                f"Removed {deleted} demo snapshot(s) for {prior_year}."))
            return

        # name → order and a sorted list of distinct orders, from the real
        # structural grade ranking. _base_manager: no request user in a command.
        name_order = {n: o for n, o in Grade._base_manager.values_list('name', 'order') if o}
        order_name = {}
        for n, o in name_order.items():
            order_name.setdefault(o, n)
        orders = sorted(order_name)

        def one_below(grade_name):
            o = name_order.get(grade_name)
            if o is None:
                return None
            i = bisect.bisect_left(orders, o)
            return order_name[orders[i - 1]] if i > 0 else None

        # Current-year snapshots are the source of truth for who/where each student is.
        current = EnrollmentSnapshot.all_objects.filter(
            academic_year=current_year, snapshot_type='start_of_year')

        created = skipped = repeated = 0
        for idx, snap in enumerate(current.iterator()):
            make_repeat = (idx % REPEAT_EVERY == 0)
            prior_grade = snap.grade if make_repeat else one_below(snap.grade)
            if not prior_grade:
                # lowest grade (no grade below) — can't have progressed into it; skip.
                skipped += 1
                continue
            EnrollmentSnapshot.all_objects.update_or_create(
                student_id=snap.student_id, academic_year=prior_year,
                snapshot_type='start_of_year',
                defaults={
                    'snapshot_date': date(int(prior_year.split('-')[0]), 4, 1),
                    'grade': prior_grade,
                    'campus_id': snap.campus_id,
                    'classroom_id': snap.classroom_id,
                    'section': snap.section,
                    'status': snap.status,
                    'gender': snap.gender,
                    'organization_id': snap.organization_id,
                },
            )
            created += 1
            repeated += make_repeat

        self.stdout.write(self.style.SUCCESS(
            f"DEMO: created {created} synthetic {prior_year} snapshot(s) "
            f"({repeated} repeated, {created - repeated} progressed, {skipped} skipped as lowest grade).\n"
            f"Undo any time: python manage.py seed_demo_progression --undo"))
