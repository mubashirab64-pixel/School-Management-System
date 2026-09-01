"""Repair EnrollmentSnapshots that an older PromoteStudentsView stamped with the
CURRENT academic year instead of the year the student actually completed.

Bug: the FROM grade (pre-promotion) was recorded under date.today()'s year, so a
student promoted in the new session got their old grade stamped under the new
year — leaving no prior-year snapshot for Grade Progression to compare against.

This rebuilds, for each student promoted via the result flow (an approved Final
pass):
    • (completed_year, end_of_year, FROM grade)   — the year they finished
    • (entering_year, start_of_year, current grade) — the year they entered
and deletes the mis-yeared FROM-grade snapshots. Idempotent.
"""
from datetime import date

from django.core.management.base import BaseCommand

from students.models import Student, EnrollmentSnapshot
from result.models import Result


class Command(BaseCommand):
    help = "Fix promotion snapshots mis-stamped with the current year instead of the completed year."

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **opts):
        dry = opts['dry_run']

        # Grade ranks (from Grade.order) to derive "one grade below current" when a
        # student has no recoverable prior-year snapshot. Run backfill_grade_order
        # first so these are populated.
        from classes.models import Grade
        order_by_name = {n: o for n, o in Grade._base_manager.values_list('name', 'order') if o}
        ranked = sorted((o, n) for n, o in order_by_name.items())

        def grade_below(current_grade):
            """The grade immediately below `current_grade` by rank (their FROM grade
            after a normal one-step promotion)."""
            o = order_by_name.get(current_grade)
            if o is None:
                return None
            lower = [n for oo, n in ranked if oo < o]
            return lower[-1] if lower else None  # highest rank still below current

        # Students promoted via the result flow = those with an approved Final pass.
        finals = Result._base_manager.filter(
            exam_type='final', status='approved', pass_status='pass')
        years_by_student = {}
        for sid, ay in finals.values_list('student_id', 'academic_year'):
            if ay:
                years_by_student.setdefault(sid, set()).add(ay)

        fixed = skipped = 0
        for sid, years in years_by_student.items():
            student = Student._base_manager.filter(id=sid).first()
            if not student or not student.current_grade:
                continue
            completed_ay = max(years)                      # latest completed year
            cs = int(completed_ay.split('-')[0])
            entering_ay = f"{cs + 1}-{str(cs + 2)[-2:]}"
            cur = student.current_grade

            snaps = list(EnrollmentSnapshot.all_objects.filter(student_id=sid))
            from_grades = {s.grade for s in snaps if s.grade and s.grade != cur}
            if len(from_grades) == 1:
                from_grade = next(iter(from_grades))      # recovered from a snapshot
            else:
                from_grade = grade_below(cur)             # derive: one grade below current
            if not from_grade or from_grade == cur:
                skipped += 1
                continue  # can't determine the prior grade (unranked grade, or none below)

            has_from = any(s.academic_year == completed_ay and s.grade == from_grade for s in snaps)
            has_to = any(s.academic_year == entering_ay and s.grade == cur for s in snaps)
            mis_yeared = [s for s in snaps if s.grade == from_grade and s.academic_year != completed_ay]
            if has_from and has_to and not mis_yeared:
                continue  # already correct

            self.stdout.write(f"  {sid} {student.name[:18]:18} → {from_grade}@{completed_ay} + {cur}@{entering_ay}")
            if dry:
                fixed += 1
                continue

            common = {
                'campus': student.campus, 'classroom': student.classroom,
                'section': student.section, 'status': student.enrollment_status,
                'gender': student.gender, 'organization': student.organization,
            }
            EnrollmentSnapshot.all_objects.update_or_create(
                student_id=sid, academic_year=completed_ay, snapshot_type='end_of_year',
                defaults={'grade': from_grade, 'snapshot_date': date(cs + 1, 3, 31), **common})
            EnrollmentSnapshot.all_objects.update_or_create(
                student_id=sid, academic_year=entering_ay, snapshot_type='start_of_year',
                defaults={'grade': cur, 'snapshot_date': date(cs + 1, 4, 1), **common})
            # Remove the FROM grade wherever it was mis-stamped (any year but completed).
            EnrollmentSnapshot.all_objects.filter(
                student_id=sid, grade=from_grade).exclude(academic_year=completed_ay).delete()
            fixed += 1

        self.stdout.write(self.style.SUCCESS(
            f"{'Would fix' if dry else 'Fixed'} {fixed} student(s); "
            f"{skipped} skipped (no determinable prior grade)."))
