"""Diagnostic: explain the Grade Progression numbers for an academic year.

Shows how many students moved up / stayed / moved DOWN / were skipped, plus
concrete examples — so we can see WHY progression is (e.g.) 164/193 instead of
223. Read-only; changes nothing.

    python manage.py diagnose_progression                 # defaults to 2026-27
    python manage.py diagnose_progression --year 2026-27
"""
from django.core.management.base import BaseCommand

from students.models import EnrollmentSnapshot
from classes.models import Grade


class Command(BaseCommand):
    help = "Explain the Grade Progression breakdown (up/same/down/skip) for a year."

    def add_arguments(self, parser):
        parser.add_argument('--year', type=str, default='2026-27')

    def handle(self, *args, **opts):
        cur_year = opts['year']
        prev_year = f"{int(cur_year.split('-')[0]) - 1}-{cur_year.split('-')[0][-2:]}"

        order_map = {n: o for n, o in Grade._base_manager.values_list('name', 'order') if o}

        rows = (EnrollmentSnapshot.all_objects
                .filter(academic_year__in=[prev_year, cur_year])
                .order_by('snapshot_date')
                .values_list('student_id', 'academic_year', 'grade'))
        by_student = {}
        for sid, ay, g in rows:
            by_student.setdefault(sid, {})[ay] = g

        up = down = same = 0
        skip_missing_year = skip_unranked = 0
        down_ex, missing_ex, unranked_ex = [], [], []
        for sid, y in by_student.items():
            gp, gc = y.get(prev_year), y.get(cur_year)
            if gp is None or gc is None:
                skip_missing_year += 1
                if len(missing_ex) < 8:
                    missing_ex.append((sid, 'has years=' + str(list(y.keys())), 'grade=' + str(gp or gc)))
                continue
            op, oc = order_map.get(gp), order_map.get(gc)
            if op is None or oc is None:
                skip_unranked += 1
                if len(unranked_ex) < 8:
                    unranked_ex.append((sid, gp, '->', gc, '(unranked grade)'))
                continue
            if oc > op:
                up += 1
            elif oc == op:
                same += 1
            else:
                down += 1
                if len(down_ex) < 12:
                    down_ex.append((sid, gp, '->', gc))

        eligible = up + same + down
        w = self.stdout.write
        w(f"Year {prev_year} -> {cur_year}")
        w(f"  {prev_year} snapshots: {EnrollmentSnapshot.all_objects.filter(academic_year=prev_year).count()}")
        w(f"  {cur_year} snapshots: {EnrollmentSnapshot.all_objects.filter(academic_year=cur_year).count()}")
        w(f"  students with a snapshot in either year: {len(by_student)}")
        w("")
        w(f"ELIGIBLE (both years, ranked) = {eligible}")
        w(f"   UP (progressed) = {up}")
        w(f"   SAME (repeated) = {same}")
        w(f"   DOWN (moved down!) = {down}")
        w(f"SKIPPED — only one year's snapshot = {skip_missing_year}")
        w(f"SKIPPED — grade not ranked (order 0/missing) = {skip_unranked}")
        w("")
        if down_ex:
            w("DOWN examples (student, prev grade -> current grade):")
            for e in down_ex:
                w(f"   {e}")
        if missing_ex:
            w("ONLY-ONE-YEAR examples (student, years present, grade):")
            for e in missing_ex:
                w(f"   {e}")
        if unranked_ex:
            w("UNRANKED-GRADE examples:")
            for e in unranked_ex:
                w(f"   {e}")

        # Why aren't all promoted (final-passed) students eligible? Show final-year
        # spread + snapshot coverage for those who passed the previous year's final.
        from result.models import Result
        from collections import Counter
        finals = Result._base_manager.filter(exam_type='final', status='approved', pass_status='pass')
        fin_years = Counter(finals.values_list('academic_year', flat=True))
        w("")
        w(f"Approved FINAL passes by academic_year: {dict(fin_years)}")
        passed_prev = set(finals.filter(academic_year=prev_year).values_list('student_id', flat=True))
        passed_cur = set(finals.filter(academic_year=cur_year).values_list('student_id', flat=True))
        both = only_p = only_c = neither = 0
        for sid in passed_prev:
            y = by_student.get(sid, {})
            hp, hc = prev_year in y, cur_year in y
            if hp and hc: both += 1
            elif hp: only_p += 1
            elif hc: only_c += 1
            else: neither += 1
        w(f"Passed {prev_year} final = {len(passed_prev)} students → both years={both}, only {prev_year}={only_p}, only {cur_year}={only_c}, no snapshot={neither}")
        w(f"Passed {cur_year} final = {len(passed_cur)} students (these promote INTO {cur_year}, so they belong to {cur_year}->next progression, not this one)")

        w("")
        w("GRADE ORDER MAP (order -> name) — a lower number must mean a lower grade:")
        for name, o in sorted(order_map.items(), key=lambda x: x[1]):
            w(f"   {o:5}  {name}")

        w("")
        w("Raw Grade rows (name, code, level.code, order) for any grade named like 'Grade III'/'Grade IV':")
        for g in Grade._base_manager.select_related('level').all():
            if g.name in ('Grade III', 'Grade IV', 'Grade II', 'Grade V'):
                lc = g.level.code if g.level else None
                w(f"   name={g.name!r} code={g.code!r} level_code={lc!r} order={g.order}")
