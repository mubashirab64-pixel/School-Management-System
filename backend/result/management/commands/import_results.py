import os
from django.core.management.base import BaseCommand

from result.services.result_csv_import import import_results_from_csv


class Command(BaseCommand):
    help = 'Import results from a CSV file and create Result and SubjectMark records.'

    def add_arguments(self, parser):
        parser.add_argument('path', type=str, help='Path to CSV file to import')
        parser.add_argument('--teacher-id', type=int, help='Default teacher id to assign', default=None)
        parser.add_argument('--overwrite', action='store_true', help='Overwrite existing subject marks')

    def handle(self, *args, **options):
        path = options['path']
        teacher_id = options.get('teacher_id')
        overwrite = options.get('overwrite', False)

        if not os.path.exists(path):
            self.stderr.write(self.style.ERROR(f'File not found: {path}'))
            return

        self.stdout.write(f'Importing results from: {path}')
        reports = import_results_from_csv(path, teacher_id=teacher_id, overwrite=overwrite)

        total = len(reports)
        ok = sum(1 for r in reports if r.get('status') == 'ok')
        errors = [r for r in reports if r.get('status') == 'error']

        self.stdout.write(self.style.SUCCESS(f'Processed {total} rows — {ok} OK, {len(errors)} errors'))
        if errors:
            self.stdout.write('Errors:')
            for e in errors:
                self.stderr.write(self.style.ERROR(f"Row {e.get('row')}: {e.get('message')}"))
