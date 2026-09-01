"""
Management command to create User accounts for existing students who don't have one yet.

Usage:
    python manage.py create_student_accounts
    python manage.py create_student_accounts --dry-run   (preview only, no changes)
    python manage.py create_student_accounts --reset-password  (also reset password for existing accounts)
"""

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Create User login accounts for existing students who do not have one.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview what would be done without making any changes.',
        )
        parser.add_argument(
            '--reset-password',
            action='store_true',
            help='Also reset password to 12345 for students who already have an account.',
        )

    def handle(self, *args, **options):
        from students.models import Student
        from users.models import User
        from users.middleware import _user_var, _organization_var

        dry_run = options['dry_run']
        reset_password = options['reset_password']

        if dry_run:
            self.stdout.write(self.style.WARNING('--- DRY RUN MODE (no changes will be made) ---\n'))

        # OrganizationManager needs a user in context — set a superadmin so all data is visible
        superadmin = User.objects.filter(role='superadmin').first()
        if not superadmin:
            self.stdout.write(self.style.ERROR('No superadmin found. Cannot proceed.'))
            return
        token_user = _user_var.set(superadmin)
        token_org = _organization_var.set(None)

        try:
            self._run(options, dry_run, reset_password)
        finally:
            _user_var.reset(token_user)
            _organization_var.reset(token_org)

    def _run(self, options, dry_run, reset_password):
        from students.models import Student
        from users.models import User
        from django.db import transaction

        # Now OrganizationManager sees superadmin → returns all students
        students = Student.objects.filter(
            is_deleted=False,
            student_id__isnull=False,
        ).exclude(student_id='').select_related('campus', 'organization')

        total = students.count()
        created = 0
        skipped = 0
        reset = 0
        errors = 0

        self.stdout.write(f'Found {total} students with student_id.\n')

        for student in students:
            sid = student.student_id
            placeholder_email = f"{sid}@student.portal"

            existing_user = User.objects.filter(username=sid).first()

            if existing_user:
                if reset_password:
                    if not dry_run:
                        existing_user.set_password('12345')
                        existing_user.has_changed_default_password = False
                        existing_user.save(update_fields=['password', 'has_changed_default_password'])
                    reset += 1
                    self.stdout.write(f'  [RESET]   {sid} — {student.name}')
                else:
                    skipped += 1
                    self.stdout.write(f'  [EXISTS]  {sid} — {student.name}')
                continue

            # Check if placeholder email is taken by someone else
            if User.objects.filter(email__iexact=placeholder_email).exists():
                self.stdout.write(
                    self.style.ERROR(f'  [SKIP]    {sid} — email collision ({placeholder_email})')
                )
                errors += 1
                continue

            self.stdout.write(f'  [CREATE]  {sid} — {student.name}')

            if not dry_run:
                try:
                    with transaction.atomic():
                        u = User(
                            username=sid,
                            email=placeholder_email,
                            role='student',
                            organization=student.organization,
                            campus=student.campus,
                            has_changed_default_password=False,
                            is_verified=True,
                        )
                        u.set_password('12345')
                        u.save()
                    created += 1
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'           ERROR: {e}'))
                    errors += 1
            else:
                created += 1

        self.stdout.write('\n' + '='*50)
        self.stdout.write(self.style.SUCCESS(f'Created : {created}'))
        if reset:
            self.stdout.write(self.style.WARNING(f'Reset   : {reset}'))
        self.stdout.write(f'Skipped : {skipped}')
        if errors:
            self.stdout.write(self.style.ERROR(f'Errors  : {errors}'))
        if dry_run:
            self.stdout.write(self.style.WARNING('\nDry run complete — run without --dry-run to apply changes.'))
        else:
            self.stdout.write(self.style.SUCCESS('\nDone! Students can now login with their Student ID and password: 12345'))
