"""
Management command: auto_release_version

Reads VERSION and RELEASE_NOTES.txt (written by deploy.sh on the host).
If version changed → creates SystemVersion entry + notifies admins/principals.
Git is NOT called here — deploy.sh handles that on the host before docker build.
"""

import os
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = 'Auto-release a new version from VERSION and RELEASE_NOTES.txt files'

    def handle(self, *args, **options):
        version_str = self._read_version()

        if not version_str:
            self.stdout.write(self.style.WARNING('[version] VERSION file not found or empty — skipping.'))
            return

        from users.models import SystemVersion, User
        from notifications.services import create_notification

        latest = SystemVersion.current()

        if latest and latest.version == version_str:
            self.stdout.write(self.style.SUCCESS(
                f'[version] Already on v{version_str} (build {latest.build}) — no release needed.'
            ))
            return

        release_notes = self._read_release_notes()
        build = SystemVersion.next_build()

        sv = SystemVersion.objects.create(
            version=version_str,
            build=build,
            release_notes=release_notes,
            released_by=None,
        )

        self.stdout.write(self.style.SUCCESS(f'[version] Released v{sv.version} (build {sv.build})'))
        if release_notes:
            self.stdout.write(f'[version] Notes:\n{release_notes}')

        recipients = User.objects.filter(
            role__in=['superadmin', 'org_admin', 'principal'],
            is_active=True,
        )

        display = f"v{sv.version} (build {sv.build})"
        notes_snippet = f" — {release_notes[:150]}" if release_notes else ""
        verb = f"System updated to {display}"
        target_text = f"Newton AMS has been updated to {display}{notes_snippet}"

        count = 0
        for user in recipients:
            create_notification(
                recipient=user,
                actor=None,
                verb=verb,
                target_text=target_text,
                data={'type': 'system_update', 'version': sv.version, 'build': sv.build, 'release_notes': release_notes},
            )
            count += 1

        self.stdout.write(self.style.SUCCESS(f'[version] Notified {count} user(s).'))

    def _base_dir(self):
        return str(getattr(settings, 'BASE_DIR',
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))))

    def _read_version(self):
        env = os.environ.get('RELEASE_VERSION', '').strip()
        if env:
            return env
        path = os.path.join(self._base_dir(), 'VERSION')
        if os.path.exists(path):
            return open(path).read().strip()
        return ''

    def _read_release_notes(self):
        env = os.environ.get('RELEASE_NOTES', '').strip()
        if env:
            return env
        path = os.path.join(self._base_dir(), 'RELEASE_NOTES.txt')
        if os.path.exists(path):
            return open(path).read().strip()
        return ''
