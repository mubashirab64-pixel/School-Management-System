from django.db import models
from users.managers import OrganizationManager

class StudentBehaviourRecord(models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    """Stores a weekly behaviour record for a student along with rating metrics.
    Ratings use a 1-4 scale where 1=Needs Improvement, 2=Fair, 3=Good, 4=Excellent.
    """

    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="behaviour_records")
    
    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='behaviour_records'
    )
    week_start = models.DateField()
    week_end = models.DateField()
    metrics = models.JSONField(default=dict)  # { punctuality, obedience, classBehaviour, participation, homework, respect }
    notes = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"BehaviourRecord(student={self.student_id}, {self.week_start}–{self.week_end})"


class StudentEventParticipation(models.Model):
    """Individual event participation linked to a behaviour record."""

    record = models.ForeignKey(StudentBehaviourRecord, on_delete=models.CASCADE, related_name="events")
    date = models.DateField()
    name = models.CharField(max_length=255)
    progress = models.CharField(max_length=100, default="Participated")
    award = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self) -> str:
        return f"Event({self.name} @ {self.date})"


class MonthlyBehaviourRecord(models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    """Monthly aggregate behaviour snapshot per student.
    Stores percent values (0-100) already averaged across the month's weeks.
    """

    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="monthly_behaviour_records")
    
    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='monthly_behaviour_records'
    )
    # First day of month to identify which month this record belongs to
    month = models.DateField()  # normalize to first-of-month

    metrics = models.JSONField(default=dict)  # { punctuality, obedience, classBehaviour, participation, homework, respect }
    source_range_start = models.DateField(null=True, blank=True)
    source_range_end = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("student", "month")

    def __str__(self) -> str:
        return f"MonthlyBehaviour(student={self.student_id}, month={self.month})"


