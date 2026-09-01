from django.db import migrations, models
from django.db.models import Count, IntegerField, OuterRef, Subquery
from django.db.models.functions import Coalesce


def backfill_excused_count(apps, schema_editor):
    """Recount `excused` for rows written before this column existed.

    Until now `excused` had no counter, so those students sat inside
    total_students but outside every count, and the percentage read them as
    absences. New rows are counted by Attendance.update_counts(); older rows
    need this one-off pass or their percentages stay wrong forever.

    Mirrors update_counts() by counting every related StudentAttendance row with
    no is_deleted filter, so this counter stays consistent with its siblings.
    """
    Attendance = apps.get_model('attendance', 'Attendance')
    StudentAttendance = apps.get_model('attendance', 'StudentAttendance')

    excused_per_attendance = (
        StudentAttendance.objects
        .filter(attendance_id=OuterRef('pk'), status='excused')
        .order_by()
        .values('attendance_id')
        .annotate(total=Count('*'))
        .values('total')
    )
    Attendance.objects.update(
        excused_count=Coalesce(
            Subquery(excused_per_attendance, output_field=IntegerField()),
            0,
        ),
    )


def noop_reverse(apps, schema_editor):
    """Nothing to undo — the column is dropped by reversing the AddField."""


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0006_attendance_attendance__classro_94d184_idx'),
    ]

    operations = [
        migrations.AddField(
            model_name='attendance',
            name='excused_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.RunPython(backfill_excused_count, noop_reverse),
    ]
