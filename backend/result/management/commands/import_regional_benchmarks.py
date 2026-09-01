"""Import external regional benchmark scores (e.g. Ministry of Education averages)
from a CSV, for the "Regional Score Variance" indicator.

Expected CSV columns (header row required; grade & exam_type optional):

    academic_year,region,grade,subject,exam_type,average_percentage
    2025-26,National,Grade V,Mathematics,final,62.5
    2025-26,National,,English,,58.0          # grade/exam blank = applies to all

Idempotent: re-importing the same (org, year, region, grade, subject, exam_type)
updates the value. Scope to an org with --organization_id (blank = shared/global).

    python manage.py import_regional_benchmarks path/to/file.csv --source "Ministry of Education 2025"
"""
import csv

from django.core.management.base import BaseCommand, CommandError

from result.models import RegionalBenchmark


class Command(BaseCommand):
    help = "Import regional benchmark subject averages from a CSV."

    def add_arguments(self, parser):
        parser.add_argument('csv_path')
        parser.add_argument('--organization_id', type=int, default=None,
                            help="Owning org id; omit for shared/global reference data.")
        parser.add_argument('--source', type=str, default='',
                            help="Traceability label, e.g. 'Ministry of Education 2025'.")
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **opts):
        path = opts['csv_path']
        org_id = opts['organization_id']
        source = opts['source']
        dry = opts['dry_run']

        try:
            f = open(path, newline='', encoding='utf-8-sig')
        except OSError as e:
            raise CommandError(f"Cannot open {path}: {e}")

        created = updated = skipped = 0
        with f:
            reader = csv.DictReader(f)
            required = {'academic_year', 'region', 'subject', 'average_percentage'}
            missing = required - set(h.strip().lower() for h in (reader.fieldnames or []))
            if missing:
                raise CommandError(f"CSV missing required column(s): {', '.join(sorted(missing))}")

            for i, row in enumerate(reader, start=2):  # row 1 is the header
                row = {(k or '').strip().lower(): (v or '').strip() for k, v in row.items()}
                try:
                    avg = float(row['average_percentage'])
                except (KeyError, ValueError):
                    self.stderr.write(f"  row {i}: bad average_percentage {row.get('average_percentage')!r} — skipped")
                    skipped += 1
                    continue
                if not row.get('subject') or not row.get('academic_year'):
                    self.stderr.write(f"  row {i}: missing subject/academic_year — skipped")
                    skipped += 1
                    continue

                lookup = dict(
                    organization_id=org_id,
                    academic_year=row['academic_year'],
                    region=row.get('region') or 'National',
                    grade=row.get('grade') or '',
                    subject_name=row['subject'],
                    exam_type=row.get('exam_type') or '',
                )
                if dry:
                    self.stdout.write(f"  row {i}: {lookup['subject_name']} ({lookup['grade'] or 'all'}) = {avg}%")
                    created += 1
                    continue
                _, was_created = RegionalBenchmark.objects.update_or_create(
                    **lookup,
                    defaults={'average_percentage': avg, 'source': source},
                )
                created += was_created
                updated += (not was_created)

        verb = "Would import" if dry else "Imported"
        self.stdout.write(self.style.SUCCESS(
            f"{verb} {created} new, {updated} updated, {skipped} skipped."))
