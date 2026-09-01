"""Populate Grade.order for grades created before ordering was auto-maintained.

New grades get `order` set in Grade.save(); this backfills the historical rows.
Idempotent — re-running only rewrites values that changed.
"""
from django.core.management.base import BaseCommand

from classes.models import Grade
from classes.grade_ordering import grade_order_value


class Command(BaseCommand):
    help = "Populate Grade.order from structural codes (level band + grade code suffix)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help="Show what would change without writing.",
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        # _base_manager, not .objects: Grade uses OrganizationManager which needs
        # a request user; a management command has none, so it would see nothing.
        grades = Grade._base_manager.select_related('level').all()

        changed = 0
        for g in grades:
            level_code = g.level.code if g.level else None
            new_order = grade_order_value(g.code, level_code)
            if g.order == new_order:
                continue
            self.stdout.write(f"  {g.code or g.name}: {g.order} -> {new_order}")
            if not dry_run:
                Grade._base_manager.filter(pk=g.pk).update(order=new_order)
            changed += 1

        verb = "Would update" if dry_run else "Updated"
        self.stdout.write(self.style.SUCCESS(
            f"{verb} {changed} grade(s); {grades.count() - changed} already correct."
        ))
