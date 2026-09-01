from django.db import migrations


class Migration(migrations.Migration):
    """No-op. Paired with 0005_student_last_class_passed — see the note there.

    Dropping `last_class_passed` here would delete the column added by 0012,
    which the Student model still declares.
    """

    dependencies = [
        ('students', '0005_student_last_class_passed'),
    ]

    operations = []
