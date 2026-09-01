from django.db import models
from users.managers import OrganizationManager

class GlobalCounter(models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    """
    Thread-safe monotonically increasing counters for system-wide sequences.
    Key examples: 'student', 'employee'. Now per-organization.
    """
    key = models.CharField(max_length=50)
    value = models.PositiveIntegerField(default=0)
    
    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='counters'
    )

    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'global_counters'
        unique_together = ('key', 'organization')

    def __str__(self):
        return f"{self.key}:{self.value}"

from django.db import models

# Create your models here.
