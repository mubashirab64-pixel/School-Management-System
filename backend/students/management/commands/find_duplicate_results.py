"""Find (and optionally remove) duplicate Result rows — the same student having
more than one result for the same exam type + academic year (+ month). These
inflate result counts; they do NOT affect snapshot-based Grade Progression.

    # report only
    python manage.py find_duplicate_results --year 2025-26 --exam-type final

    # remove the extras (keeps ONE per student — the latest, prefers 'approved')
    python manage.py find_duplicate_results --year 2025-26 --exam-type final --delete
"""
from collections import defaultdict, Counter

from django.core.management.base import BaseCommand

from result.models import Result


class Command(BaseCommand):
    help = "Report or soft-remove duplicate results (same student, exam type, year, month)."

    def add_arguments(self, parser):
        parser.add_argument('--year', type=str, default=None, help="academic_year filter, e.g. 2025-26")
        parser.add_argument('--exam-type', type=str, default=None, help="final / midterm / monthly")
        parser.add_argument('--delete', action='store_true',
                            help="Soft-delete the extras, keeping one per student.")

    def handle(self, *args, **opts):
        # all_objects: no org filter (a command has no request user). Only live rows.
        qs = Result.all_objects.filter(is_deleted=False)
        if opts['year']:
            qs = qs.filter(academic_year=opts['year'])
        if opts['exam_type']:
            qs = qs.filter(exam_type=opts['exam_type'])

        w0 = self.stdout.write
        w0(f"Live (is_deleted=False) results by (academic_year): "
           f"{dict(Counter(qs.values_list('academic_year', flat=True)))}")
        w0(f"Live results by (academic_year, status): "
           f"{dict(Counter(qs.values_list('academic_year', 'status')))}")

        groups = defaultdict(list)
        for r in qs.only('id', 'student_id', 'exam_type', 'academic_year', 'month', 'status', 'updated_at'):
            key = (r.student_id, r.exam_type, r.academic_year, r.month or '')
            groups[key].append(r)

        dup_groups = {k: v for k, v in groups.items() if len(v) > 1}
        extra_rows = sum(len(v) - 1 for v in dup_groups.values())

        w = self.stdout.write
        w(f"Scanned {qs.count()} results. Duplicate students: {len(dup_groups)}; extra rows: {extra_rows}")
        for (sid, et, ay, mo), rows in list(dup_groups.items())[:60]:
            ids = sorted(r.id for r in rows)
            w(f"  student={sid} {et} {ay} {mo}: {len(rows)} rows -> ids {ids}")

        if not dup_groups:
            w(self.style.SUCCESS("No duplicates found."))
            return

        if not opts['delete']:
            w("")
            w("Report only. Re-run with --delete to remove the extras (keeps one per student).")
            return

        # Keep one per group: prefer an 'approved' row, then the newest (highest id).
        def keep_key(r):
            return (r.status == 'approved', r.id)

        removed = 0
        for rows in dup_groups.values():
            keep = max(rows, key=keep_key)
            for r in rows:
                if r.id != keep.id:
                    Result.all_objects.filter(id=r.id).update(is_deleted=True)
                    removed += 1
        w(self.style.SUCCESS(f"Soft-deleted {removed} duplicate result(s); kept 1 per student."))
