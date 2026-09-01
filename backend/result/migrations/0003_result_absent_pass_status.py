from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('result', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='result',
            name='is_absent',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='result',
            name='pass_status',
            field=models.CharField(
                choices=[('pass', 'Pass'), ('fail', 'Fail'), ('absent', 'Absent')],
                default='fail',
                max_length=10,
            ),
        ),
    ]
