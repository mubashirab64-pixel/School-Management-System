"""Re-sync a year's start_of_year EnrollmentSnapshots to each student's CURRENT
grade / classroom.

Grade Progression reads snapshots, not the live student record. So if you correct
a student's grade from the student list (e.g. fixing a mistaken promotion), the
snapshot is left stale and the student can still show as 'repeated' or wrong. This
propagates the correction into the snapshot.

    # report what WOULD change (safe, writes nothing)
    python manage.py resync_year_snapshots --year 2026-27

    # apply
    python manage.py resync_year_snapshots --year 2026-27 --apply
"""
from django.core.management.base import BaseCommand

from students.models import EnrollmentSnapshot


class Command(BaseCommand):
    help = "Re-sync a year's start_of_year snapshots to students' current grade."

    def add_arguments(self, parser):
        parser.add_argument('--year', required=True, help="e.g. 2026-27")
        parser.add_argument('--apply', action='store_true',
                            help="Write the changes (default is report-only).")
        parser.add_argument('--students', default='',
                            help="Comma-separated student_id/student_code/pk to limit to.")
        parser.add_argument('--remove', action='store_true',
                            help="Instead of syncing, DELETE the year's snapshots for the "
                                 "targeted students (removes them from that year's progression). "
                                 "Requires --students.")

    def handle(self, *args, **opts):
        from django.db.models import Q
        from students.enrollment_kpis import grade_name_rank, prev_academic_year

        year = opts['year']
        apply = opts['apply']
        prev = prev_academic_year(year)

        wanted = [x.strip() for x in opts['students'].split(',') if x.strip()]

        def student_filter(qs):
            q = (Q(student__student_id__in=wanted) | Q(student__student_code__in=wanted)
                 | Q(student__gr_no__in=wanted))
            ids = [int(x) for x in wanted if x.isdigit()]
            if ids:
                q |= Q(student_id__in=ids)
            return qs.filter(q)

        # --remove: drop this year's snapshots for the named students (un-promote /
        # undo a mistaken promotion) so they leave the year's progression entirely.
        if opts['remove']:
            if not wanted:
                self.stderr.write("--remove requires --students (safety).")
                return
            to_del = student_filter(
                EnrollmentSnapshot.all_objects.filter(academic_year=year).select_related('student'))
            for snap in to_del:
                s = snap.student
                code = (s.student_id or s.student_code or s.id) if s else snap.student_id
                self.stdout.write(f"  {code} {(s.name[:16] if s else ''):16} remove {year} {snap.snapshot_type} grade={snap.grade!r}")
            n = to_del.count()
            if apply:
                to_del.delete()
            verb = "Removed" if apply else "Would remove"
            self.stdout.write(self.style.SUCCESS(
                f"{verb} {n} snapshot(s) for {year}." + ("" if apply else "  (re-run with --apply)")))
            return

        snaps = student_filter(EnrollmentSnapshot.all_objects
                               .filter(academic_year=year, snapshot_type='start_of_year')
                               .select_related('student')) if wanted else (
            EnrollmentSnapshot.all_objects.filter(academic_year=year, snapshot_type='start_of_year').select_related('student'))

        # Previous-year grade per student (for context: will re-sync make them progress?).
        prev_grade = {}
        for sid, g in (EnrollmentSnapshot.all_objects
                       .filter(academic_year=prev, snapshot_type__in=['end_of_year', 'start_of_year', 'promotion'])
                       .values_list('student_id', 'grade')):
            prev_grade.setdefault(sid, g)

        changed = 0
        for snap in snaps:
            s = snap.student
            if not s or getattr(s, 'is_deleted', False):
                continue
            cur = s.current_grade
            gp = prev_grade.get(s.id)

            def cmp(g):
                a, b = grade_name_rank(gp), grade_name_rank(g)
                if a is None or b is None:
                    return '?'
                return 'UP' if b > a else 'SAME' if b == a else 'DOWN'

            code = s.student_id or s.student_code or s.id
            self.stdout.write(
                f"  {code} {s.name[:16]:16} | {prev}={gp!r} | snapshot={snap.grade!r}({cmp(snap.grade)}) "
                f"-> current={cur!r}({cmp(cur)})")
            if cur and snap.grade != cur:
                if apply:
                    snap.grade = cur
                    snap.classroom = s.classroom
                    snap.section = s.section
                    snap.campus = s.campus
                    snap.save(update_fields=['grade', 'classroom', 'section', 'campus'])
                changed += 1

        verb = "Updated" if apply else "Would update"
        self.stdout.write(self.style.SUCCESS(
            f"{verb} {changed} snapshot(s) to match current grade."
            + ("" if apply else "  (re-run with --apply to write)")))
