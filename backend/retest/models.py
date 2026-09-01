from django.db import models
from users.managers import OrganizationManager


class SchoolSettings(models.Model):
    RETEST_POLICY_CHOICES = [
        ('open', 'Open'),
        ('blocked', 'Blocked'),
        ('required', 'Required'),
    ]

    objects = OrganizationManager()

    campus = models.OneToOneField(
        'campus.Campus', on_delete=models.CASCADE, related_name='school_settings'
    )
    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE, null=True, blank=True,
        related_name='school_settings'
    )
    retest_policy = models.CharField(
        max_length=10, choices=RETEST_POLICY_CHOICES, default='open'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.campus} – {self.retest_policy}"

    class Meta:
        verbose_name = 'School Settings'
        verbose_name_plural = 'School Settings'


class RetestSchedule(models.Model):
    EXAM_TYPE_CHOICES = [
        ('monthly', 'Monthly Test'),
        ('midterm', 'Mid Term'),
        ('final', 'Final Term'),
    ]
    REASON_CHOICES = [
        ('absent', 'Absent'),
        ('fail', 'Fail'),
    ]
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    objects = OrganizationManager()

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE, null=True, blank=True,
        related_name='retest_schedules'
    )
    exam_type = models.CharField(max_length=20, choices=EXAM_TYPE_CHOICES)
    month = models.CharField(max_length=20, null=True, blank=True)
    academic_year = models.CharField(max_length=10)
    classroom = models.ForeignKey(
        'classes.ClassRoom', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='retest_schedules'
    )
    section = models.ForeignKey(
        'classes.ClassRoom', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='retest_section_schedules'
    )
    # Store subject by name (matches SubjectMark.subject_name)
    subject_name = models.CharField(max_length=200)
    # Optional FK if timetable Subject exists
    subject = models.ForeignKey(
        'timetable.Subject', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='retest_schedules'
    )
    original_result = models.ForeignKey(
        'result.Result', on_delete=models.CASCADE, null=True, blank=True,
        related_name='retest_schedules'
    )
    scheduled_date = models.DateField(null=True, blank=True)
    scheduled_time = models.TimeField(null=True, blank=True)
    venue = models.CharField(max_length=200, blank=True)
    reason = models.CharField(max_length=10, choices=REASON_CHOICES)
    created_by = models.ForeignKey(
        'teachers.Teacher', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_retest_schedules'
    )
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='scheduled')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Retest: {self.subject_name} – {self.exam_type} ({self.scheduled_date})"

    class Meta:
        ordering = ['-created_at']


class RetestResult(models.Model):
    PASS_STATUS_CHOICES = [
        ('pass', 'Pass'),
        ('fail', 'Fail'),
        ('absent', 'Absent'),
    ]
    STATUS_CHOICES = [
        ('marks_pending', 'Marks Pending'),
        ('draft', 'Draft'),
        ('pending_coordinator', 'Pending Coordinator'),
        ('pending_principal', 'Pending Principal'),
        ('approved', 'Approved'),
    ]

    objects = OrganizationManager()

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE, null=True, blank=True,
        related_name='retest_results'
    )
    retest_schedule = models.ForeignKey(
        RetestSchedule, on_delete=models.CASCADE, related_name='retest_results'
    )
    original_result = models.ForeignKey(
        'result.Result', on_delete=models.CASCADE, null=True, blank=True,
        related_name='retest_results'
    )
    student = models.ForeignKey(
        'students.Student', on_delete=models.CASCADE, related_name='retest_results'
    )
    subject_name = models.CharField(max_length=200)
    exam_type = models.CharField(max_length=20)
    month = models.CharField(max_length=20, null=True, blank=True)
    academic_year = models.CharField(max_length=10)
    marks_obtained = models.FloatField(null=True, blank=True)
    total_marks = models.FloatField(default=100)
    is_absent = models.BooleanField(default=False)
    pass_status = models.CharField(max_length=10, choices=PASS_STATUS_CHOICES, default='fail')
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='marks_pending')
    created_by = models.ForeignKey(
        'teachers.Teacher', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_retest_results'
    )
    coordinator_approved_by = models.ForeignKey(
        'coordinator.Coordinator', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='coordinator_retest_approvals'
    )
    principal_approved_by = models.ForeignKey(
        'principals.Principal', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='principal_retest_approvals'
    )
    coordinator_approved_at = models.DateTimeField(null=True, blank=True)
    principal_approved_at = models.DateTimeField(null=True, blank=True)
    reject_reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def calculate_pass_status(self):
        if self.is_absent:
            self.pass_status = 'absent'
            self.marks_obtained = 0
            return
        if self.marks_obtained is None:
            return
        threshold = 33 if self.exam_type == 'midterm' else 40
        pct = (self.marks_obtained / self.total_marks * 100) if self.total_marks > 0 else 0
        self.pass_status = 'pass' if pct >= threshold else 'fail'

    def save(self, *args, **kwargs):
        self.calculate_pass_status()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"RetestResult: {self.student} – {self.subject_name} ({self.pass_status})"

    class Meta:
        ordering = ['-created_at']
        unique_together = ['retest_schedule', 'student', 'subject_name']
