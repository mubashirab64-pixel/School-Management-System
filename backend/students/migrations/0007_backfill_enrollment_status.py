from datetime import date

from django.db import migrations


def _seed_date(student):
    """Best-effort date for a backfilled enrollment event."""
    if student.enrollment_year:
        try:
            return date(int(student.enrollment_year), 1, 1)
        except (ValueError, TypeError):
            pass
    if getattr(student, 'created_at', None):
        return student.created_at.date()
    return date.today()


def backfill(apps, schema_editor):
    Student = apps.get_model('students', 'Student')
    EnrollmentEvent = apps.get_model('students', 'EnrollmentEvent')

    events = []
    for student in Student.objects.all().iterator():
        if student.current_grade == 'Alumni':
            status = 'graduated'
            event_date = (student.terminated_on.date() if student.terminated_on else _seed_date(student))
            reason = ''
        elif student.terminated_on or not student.is_active:
            status = 'left'
            event_date = (student.terminated_on.date() if student.terminated_on else _seed_date(student))
            reason = student.termination_reason or 'Backfilled from legacy record'
        else:
            status = 'enrolled'
            event_date = _seed_date(student)
            reason = ''

        # Keep the field in sync with the seeded event.
        if student.enrollment_status != status:
            student.enrollment_status = status
            student.save(update_fields=['enrollment_status'])

        events.append(EnrollmentEvent(
            student=student,
            event_type=status,
            event_date=event_date,
            reason=reason,
        ))

    EnrollmentEvent.objects.bulk_create(events, batch_size=500)


def unbackfill(apps, schema_editor):
    EnrollmentEvent = apps.get_model('students', 'EnrollmentEvent')
    EnrollmentEvent.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0006_student_enrollment_status_enrollmentevent'),
    ]

    operations = [
        migrations.RunPython(backfill, unbackfill),
    ]
