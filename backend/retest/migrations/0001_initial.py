import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('campus', '0002_initial'),
        ('classes', '0002_initial'),
        ('coordinator', '0002_initial'),
        ('principals', '0002_initial'),
        ('result', '0003_result_absent_pass_status'),
        ('students', '0004_remove_student_unique_active_student_code_and_more'),
        ('teachers', '0003_teacher_father_name'),
        ('timetable', '0003_alter_subject_unique_together'),
        ('users', '0001_initial'),
    ]

    operations = [
        # ── SchoolSettings ────────────────────────────────────────────────────
        migrations.CreateModel(
            name='SchoolSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('retest_policy', models.CharField(
                    choices=[('open', 'Open'), ('blocked', 'Blocked'), ('required', 'Required')],
                    default='open', max_length=10,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('campus', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='school_settings',
                    to='campus.campus',
                )),
                ('organization', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='school_settings',
                    to='users.organization',
                )),
            ],
            options={'verbose_name': 'School Settings', 'verbose_name_plural': 'School Settings'},
        ),

        # ── RetestSchedule ────────────────────────────────────────────────────
        migrations.CreateModel(
            name='RetestSchedule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('exam_type', models.CharField(
                    choices=[('monthly_test', 'Monthly Test'), ('mid_term', 'Mid Term'), ('final_term', 'Final Term')],
                    max_length=20,
                )),
                ('month', models.CharField(blank=True, max_length=20, null=True)),
                ('academic_year', models.CharField(max_length=10)),
                ('subject_name', models.CharField(max_length=200)),
                ('scheduled_date', models.DateField(blank=True, null=True)),
                ('scheduled_time', models.TimeField(blank=True, null=True)),
                ('venue', models.CharField(blank=True, max_length=200)),
                ('reason', models.CharField(
                    choices=[('absent', 'Absent'), ('fail', 'Fail')], max_length=10,
                )),
                ('status', models.CharField(
                    choices=[('scheduled', 'Scheduled'), ('completed', 'Completed'), ('cancelled', 'Cancelled')],
                    default='scheduled', max_length=15,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='retest_schedules',
                    to='users.organization',
                )),
                ('classroom', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='retest_schedules',
                    to='classes.classroom',
                )),
                ('section', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='retest_section_schedules',
                    to='classes.classroom',
                )),
                ('subject', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='retest_schedules',
                    to='timetable.subject',
                )),
                ('original_result', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='retest_schedules',
                    to='result.result',
                )),
                ('created_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='created_retest_schedules',
                    to='teachers.teacher',
                )),
            ],
            options={'ordering': ['-created_at']},
        ),

        # ── RetestResult ──────────────────────────────────────────────────────
        migrations.CreateModel(
            name='RetestResult',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('subject_name', models.CharField(max_length=200)),
                ('exam_type', models.CharField(max_length=20)),
                ('month', models.CharField(blank=True, max_length=20, null=True)),
                ('academic_year', models.CharField(max_length=10)),
                ('marks_obtained', models.FloatField(blank=True, null=True)),
                ('total_marks', models.FloatField(default=100)),
                ('is_absent', models.BooleanField(default=False)),
                ('pass_status', models.CharField(
                    choices=[('pass', 'Pass'), ('fail', 'Fail'), ('absent', 'Absent')],
                    default='fail', max_length=10,
                )),
                ('status', models.CharField(
                    choices=[
                        ('marks_pending', 'Marks Pending'),
                        ('draft', 'Draft'),
                        ('pending_coordinator', 'Pending Coordinator'),
                        ('pending_principal', 'Pending Principal'),
                        ('approved', 'Approved'),
                    ],
                    default='marks_pending', max_length=25,
                )),
                ('coordinator_approved_at', models.DateTimeField(blank=True, null=True)),
                ('principal_approved_at', models.DateTimeField(blank=True, null=True)),
                ('reject_reason', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='retest_results',
                    to='users.organization',
                )),
                ('retest_schedule', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='retest_results',
                    to='retest.retestschedule',
                )),
                ('original_result', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='retest_results',
                    to='result.result',
                )),
                ('student', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='retest_results',
                    to='students.student',
                )),
                ('created_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='created_retest_results',
                    to='teachers.teacher',
                )),
                ('coordinator_approved_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='coordinator_retest_approvals',
                    to='coordinator.coordinator',
                )),
                ('principal_approved_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='principal_retest_approvals',
                    to='principals.principal',
                )),
            ],
            options={'ordering': ['-created_at']},
        ),

        migrations.AlterUniqueTogether(
            name='retestresult',
            unique_together={('retest_schedule', 'student', 'subject_name')},
        ),
    ]
