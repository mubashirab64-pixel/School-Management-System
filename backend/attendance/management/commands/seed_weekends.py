from datetime import date, timedelta, datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from attendance.models import Weekend
from classes.models import Level


class Command(BaseCommand):
    help = (
        "Seed Weekend (Sunday) entries for all Levels for the next N months. "
        "By default, seeds 12 months ahead starting today."
    )

    def add_arguments(self, parser):
        parser.add_argument("--months", type=int, default=12, help="Months to seed ahead (default: 12)")
        parser.add_argument(
            "--start",
            type=str,
            default=None,
            help="Start date in YYYY-MM-DD (default: today)",
        )
        parser.add_argument("--dry-run", action="store_true", help="Only show what would be created")

    def handle(self, *args, **options):
        months: int = options.get("months") or 12
        start_str: str | None = options.get("start")
        dry_run: bool = options.get("dry_run", False)

        if months < 1:
            self.stderr.write(self.style.ERROR("months must be >= 1"))
            return

        if start_str:
            try:
                start_date = datetime.strptime(start_str, "%Y-%m-%d").date()
            except ValueError:
                self.stderr.write(self.style.ERROR("Invalid --start format. Use YYYY-MM-DD"))
                return
        else:
            start_date = timezone.now().date()

        # Approximate end date (months * 31 days) – safe upper bound
        end_date = start_date + timedelta(days=months * 31)

        levels = list(Level.objects.all())
        if not levels:
            self.stdout.write(self.style.WARNING("No levels found. Nothing to seed."))
            return

        created_count = 0
        skipped_count = 0

        current = start_date
        while current <= end_date:
            if current.weekday() == 6:  # Sunday
                for level in levels:
                    if dry_run:
                        # Count as would-create if not exists
                        exists = Weekend.objects.filter(date=current, level=level).exists()
                        if exists:
                            skipped_count += 1
                        else:
                            created_count += 1
                    else:
                        _, created = Weekend.objects.get_or_create(
                            date=current,
                            level=level,
                            defaults={"created_by": None},
                        )
                        if created:
                            created_count += 1
                        else:
                            skipped_count += 1
            current += timedelta(days=1)

        msg = (
            f"Weekend seeding complete. Months: {months}, Start: {start_date}, End: {end_date}. "
            f"Created: {created_count}, Skipped: {skipped_count}."
        )
        if dry_run:
            msg = "[DRY-RUN] " + msg
        self.stdout.write(self.style.SUCCESS(msg))


