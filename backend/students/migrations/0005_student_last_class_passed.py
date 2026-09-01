from django.db import migrations


class Migration(migrations.Migration):
    """No-op. Kept so the recorded migration history stays intact.

    This added `last_class_passed` on a branch that immediately dropped it again
    in 0006_remove_student_last_class_passed, so the pair's net effect was always
    zero. The column that survives is the one added by 0012.

    The pair had to go: it sits on a chain that never reaches 0012, so Django was
    free to order this AddField *after* 0012's — which crashed on a fresh
    database, and would otherwise have let 0006 drop a column the model needs.
    """

    dependencies = [
        ('students', '0004_remove_student_unique_active_student_code_and_more'),
    ]

    operations = []
