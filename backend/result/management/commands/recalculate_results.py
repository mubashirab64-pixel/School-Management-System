from django.core.management.base import BaseCommand

from result.models import Result


class Command(BaseCommand):
    help = (
        "Recalculate totals, percentage, grade and pass status for existing "
        "results. Use this after changing the grading rules in "
        "Result.calculate_totals() so already-saved results pick up the new logic."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--exam-type",
            choices=["monthly", "midterm", "final"],
            help="Only recalculate results of this exam type (default: all).",
        )

    def handle(self, *args, **options):
        # objects manager filters by the (non-existent) request org in a command
        # context, so use all_objects and exclude soft-deleted rows ourselves.
        qs = Result.all_objects.filter(is_deleted=False)
        if options.get("exam_type"):
            qs = qs.filter(exam_type=options["exam_type"])

        total = qs.count()
        self.stdout.write(f"Recalculating {total} result(s)...")

        changed = 0
        for result in qs.iterator():
            before = (result.grade, result.pass_status, result.result_status,
                      round(result.percentage, 2))
            result.calculate_totals()
            after = (result.grade, result.pass_status, result.result_status,
                     round(result.percentage, 2))
            if before != after:
                changed += 1
                self.stdout.write(
                    f"  #{result.pk} {result.student.name} "
                    f"[{result.exam_type}] {before} -> {after}"
                )

        self.stdout.write(self.style.SUCCESS(
            f"Done. {changed} of {total} result(s) changed."
        ))
