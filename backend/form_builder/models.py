from django.db import models
from users.managers import OrganizationManager

class FormTemplate(models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    name = models.CharField(max_length=255, unique=True, help_text="Common name for the form (e.g. 'student_admission')")
    target_model = models.CharField(max_length=255, help_text="The model this form primarily targets (e.g. 'students.Student')")
    schema = models.JSONField(help_text="JSON schema defining form fields, types, and structure")
    
    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='form_templates'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.target_model})"

    class Meta:
        verbose_name = "Form Template"
        verbose_name_plural = "Form Templates"
        ordering = ['-created_at']
