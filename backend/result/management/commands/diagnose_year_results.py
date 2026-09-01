"""Read-only: show, per campus, how many results exist for each academic_year
and exam_type. Answers "why does 2026-27 show a pass rate when I only made
2025-26 results?" — the chart is built from Result.academic_year, so this lists
exactly what is stored.

Usage:
    python manage.py diagnose_year_results
    python manage.py diagnose_year_results --campus "Campus 2"
    python manage.py diagnose_year_results --campus "Campus 2" --exam-type final
"""
from django.core.management.base import BaseCommand
from django.db.models import Count, Q


class Command(BaseCommand):
    help = "Per-campus breakdown of results by academic_year and exam_type (read-only)."

    def add_arguments(self, parser):
        parser.add_argument('--campus', type=str, default=None,
                            help='Filter to one campus by name (icontains) or id.')
        parser.add_argument('--exam-type', type=str, default=None,
                            help='Filter to one exam_type (monthly/midterm/final).')
        parser.add_argument('--year', type=str, default=None,
                            help='Filter to one academic_year (e.g. 2026-27).')
        parser.add_argument('--detail', action='store_true',
                            help='List individual approved (live) result rows instead of counts.')

    def handle(self, *args, **opts):
        from result.models import Result

        # _base_manager bypasses org scoping but INCLUDES soft-deleted rows, so we
        # split them out explicitly below.
        qs = Result._base_manager.all()

        camp = opts.get('campus')
        if camp:
            if str(camp).isdigit():
                qs = qs.filter(student__campus_id=int(camp))
            else:
                qs = qs.filter(student__campus__campus_name__icontains=camp)
        if opts.get('exam_type'):
            qs = qs.filter(exam_type=opts['exam_type'])
        if opts.get('year'):
            qs = qs.filter(academic_year=opts['year'])

        # --detail: show the actual approved (live) rows so a stray result can be
        # identified (student id/name/grade) before deciding to delete it.
        if opts.get('detail'):
            rows = qs.filter(status='approved', is_deleted=False).values(
                'id', 'student_id', 'student__student_code', 'student__name',
                'student__current_grade', 'academic_year', 'exam_type', 'month',
                'pass_status', 'percentage',
            ).order_by('academic_year', 'exam_type', 'student__name')
            if not rows:
                self.stdout.write("No approved live results match that filter.")
                return
            hdr = (f"{'ResultID':<9}{'Code':<16}{'Student':<24}{'Grade':<12}"
                   f"{'Year':<10}{'Exam':<9}{'Month':<8}{'Pass':<6}{'%':>6}")
            self.stdout.write(hdr)
            self.stdout.write('-' * len(hdr))
            for r in rows:
                self.stdout.write(
                    f"{r['id']:<9}{(r['student__student_code'] or ''):<16}"
                    f"{(r['student__name'] or '')[:22]:<24}"
                    f"{(r['student__current_grade'] or '')[:10]:<12}"
                    f"{r['academic_year']:<10}{r['exam_type']:<9}"
                    f"{(r['month'] or ''):<8}{r['pass_status']:<6}{round(r['percentage'] or 0, 1):>6}"
                )
            self.stdout.write('')
            self.stdout.write(f"Total: {len(rows)} approved live result(s).")
            return

        rows = qs.values(
            'student__campus__campus_name', 'academic_year', 'exam_type',
        ).annotate(
            total=Count('id'),
            deleted=Count('id', filter=Q(is_deleted=True)),
            approved=Count('id', filter=Q(status='approved', is_deleted=False)),
            approved_pass=Count('id', filter=Q(status='approved', is_deleted=False, pass_status='pass')),
            approved_fail=Count('id', filter=Q(status='approved', is_deleted=False, pass_status='fail')),
        ).order_by('student__campus__campus_name', 'academic_year', 'exam_type')

        if not rows:
            self.stdout.write("No results match that filter.")
            return

        hdr = f"{'Campus':<22}{'Year':<10}{'Exam':<10}{'Approved':>9}{'Pass':>6}{'Fail':>6}{'Deleted':>9}{'Total':>7}"
        self.stdout.write(hdr)
        self.stdout.write('-' * len(hdr))
        cur_campus = None
        for r in rows:
            name = r['student__campus__campus_name'] or '(no campus)'
            if name != cur_campus:
                if cur_campus is not None:
                    self.stdout.write('')
                cur_campus = name
            live_only = "" if r['approved'] else "  <- no live approved results"
            self.stdout.write(
                f"{name:<22}{r['academic_year']:<10}{r['exam_type']:<10}"
                f"{r['approved']:>9}{r['approved_pass']:>6}{r['approved_fail']:>6}"
                f"{r['deleted']:>9}{r['total']:>7}{live_only}"
            )

        self.stdout.write('')
        self.stdout.write(
            "NOTE: The 'This Year vs Last Year' chart uses Approved (live, not deleted) "
            "results grouped by academic_year. If a year shows an Approved count here, "
            "that year will appear in the chart — even if you thought you only made "
            "results for another year."
        )
