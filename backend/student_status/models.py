from django.db import models
from django.utils import timezone
from users.managers import OrganizationManager

EXIT_TYPES = (
    ("termination", "Termination"),
    ("transfer", "Transfer"),
    ("leaving", "Leaving"),
)

REASONS = (
    ("expelled", "Expelled"),
    ("withdrawn", "Withdrawn"),
    ("academic_dismissal", "Academic Dismissal"),
    ("transfer_abroad", "Transfer Abroad"),
    ("parent_request", "Parent Request"),
    ("other", "Other"),
)

class ExitRecord(models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="exit_records")
    
    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='exit_records'
    )
    exit_type = models.CharField(max_length=20, choices=EXIT_TYPES)
    reason = models.CharField(max_length=50, choices=REASONS)
    other_reason = models.TextField(null=True, blank=True)

    date_of_request = models.DateField(default=timezone.now)
    date_of_effect = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Student Exit Record"
        verbose_name_plural = "Student Exit Records"

    def __str__(self):
        return f"{self.get_exit_type_display()} - {self.student.name}"

    def save(self, *args, **kwargs):
        # Auto-update student's state depending on exit_type
        if self.exit_type == "termination":
            self.student.termination_reason = self.get_reason_display()
            self.student.terminated_on = timezone.now()
        elif self.exit_type in ["transfer", "leaving"]:
            self.student.termination_reason = self.get_reason_display()
            self.student.terminated_on = timezone.now()

        self.student.save(update_fields=["termination_reason", "terminated_on"])
        super().save(*args, **kwargs)
