import os
from django.db import models
from django.db.models import Q
from django.contrib.auth import get_user_model
from django.utils import timezone
from campus.models import Campus


def principal_photo_path(instance, filename):
    """
    Save photo as:  principals/photos/principal_{id}.{ext}
    Fixed filename per principal → new upload silently overwrites old one.
    No duplicate files, no manual cleanup needed.
    """
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'jpg'
    # Use employee_code if id not yet set (new unsaved instance)
    identifier = instance.id or instance.employee_code or 'new'
    # Delete old file from disk before saving new one
    if instance.pk:
        try:
            old = Principal.objects.get(pk=instance.pk)
            if old.photo and old.photo.name != f'principals/photos/principal_{identifier}.{ext}':
                if os.path.isfile(old.photo.path):
                    os.remove(old.photo.path)
        except Exception:
            pass
    return f'principals/photos/principal_{identifier}.{ext}'

User = get_user_model()

# Choices
GENDER_CHOICES = [
    ("male", "Male"),
    ("female", "Female"),
    ("other", "Other"),
]

SHIFT_CHOICES = [
    ("morning", "Morning"),
    ("afternoon", "Afternoon"),
    ("evening", "Evening"),
    ("both", "Both"),
    ("all", "All Shifts"),
]


from users.managers import OrganizationManager


class PrincipalManager(OrganizationManager):
    """Custom manager to exclude soft deleted principals by default and filter by organization"""
    
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)
    
    def with_deleted(self):
        """Return all principals including soft deleted ones"""
        return super().get_queryset()
    
    def only_deleted(self):
        """Return only soft deleted principals"""
        return super().get_queryset().filter(is_deleted=True)


class Principal(models.Model):
    # Custom manager
    objects = PrincipalManager()
    # User relationship
    user = models.OneToOneField(User, on_delete=models.SET_NULL, related_name='principal_profile', null=True, blank=True)
    
    # Organization
    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='principals')
    
    # --- Step 1: Personal Information ---
    photo = models.ImageField(upload_to=principal_photo_path, null=True, blank=True)
    full_name = models.CharField(max_length=150)
    father_name = models.CharField(max_length=150, null=True, blank=True)
    dob = models.DateField()
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    contact_number = models.CharField(max_length=20)
    emergency_contact = models.CharField(max_length=20, null=True, blank=True)
    email = models.EmailField()
    cnic = models.CharField(max_length=20)
    nationality = models.CharField(max_length=100, default='Pakistani')
    religion = models.CharField(max_length=50, null=True, blank=True)
    permanent_address = models.TextField()
    marital_status = models.CharField(max_length=20, null=True, blank=True)
    biometric_id = models.CharField(max_length=50, blank=True, null=True, help_text="User ID on Biometric Device")
    
    # --- Step 2: Professional Information ---
    education_level = models.CharField(max_length=100)
    degree_title = models.CharField(max_length=200, null=True, blank=True)
    institution_name = models.CharField(max_length=200)
    year_of_passing = models.IntegerField()
    total_experience_years = models.PositiveIntegerField()
    specialization = models.CharField(max_length=200, null=True, blank=True)
    previous_organization = models.CharField(max_length=200, null=True, blank=True)
    previous_designation = models.CharField(max_length=150, null=True, blank=True)
    license_number = models.CharField(max_length=100, null=True, blank=True)
    
    # --- Step 3: Work Assignment ---
    DESIGNATION_CHOICES = [
        ('principal', 'Principal'),
        ('vice_principal', 'Vice Principal'),
        ('acting', 'Acting Principal'),
    ]
    designation = models.CharField(max_length=50, choices=DESIGNATION_CHOICES, default='principal')
    
    campus = models.ForeignKey(Campus, on_delete=models.SET_NULL, null=True, blank=True)
    shift = models.CharField(
        max_length=20, 
        choices=SHIFT_CHOICES,
        default='morning',
        help_text="Principal's working shift"
    )
    
    CONTRACT_TYPE_CHOICES = [
        ('permanent', 'Permanent'),
        ('contract', 'Contract'),
        ('visiting', 'Visiting'),
    ]
    contract_type = models.CharField(max_length=20, choices=CONTRACT_TYPE_CHOICES, default='permanent')
    contract_end_date = models.DateField(null=True, blank=True)
    
    joining_date = models.DateField()
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('on_leave', 'On Leave'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    is_currently_active = models.BooleanField(default=True)
    
    # Digital Signature
    signature = models.TextField(null=True, blank=True, help_text="Base64 encoded signature image")
    signature_updated_at = models.DateTimeField(null=True, blank=True)

    # System Fields
    employee_code = models.CharField(max_length=20, editable=True, blank=True, null=True)
    biometric_id = models.CharField(max_length=50, null=True, blank=True, help_text="ZKTeco device user ID for auto-mapping")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Soft Delete Fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        # Force regenerate employee code if requested
        regenerate_code_flag = kwargs.pop('regenerate_code', False)
        
        # Detect campus or shift change
        campus_changed = False
        shift_changed = False
        old_code = None
        
        if self.pk:
            try:
                old_instance = Principal.objects.get(pk=self.pk)
                if self.campus and old_instance.campus and self.campus.id != old_instance.campus.id:
                    campus_changed = True
                
                if self.employee_code:
                    old_code = self.employee_code
                    parts = self.employee_code.split('-')
                    if len(parts) >= 5:
                        from utils.id_generator import IDGenerator
                        current_code_shift = parts[1]
                        new_shift_code = IDGenerator.get_shift_code(self.shift)
                        if current_code_shift != new_shift_code:
                            shift_changed = True
            except Principal.DoesNotExist:
                pass

        if (campus_changed or shift_changed or regenerate_code_flag) and old_code:
            try:
                parts = old_code.split('-')
                if len(parts) >= 5:
                    serial_str = parts[-1]
                    if serial_str.isdigit():
                        from utils.id_generator import IDGenerator
                        serial_num = int(serial_str)
                        year = self.joining_date.year if self.joining_date else 2025
                        
                        new_code = IDGenerator.generate_employee_code(
                            self.campus.campus_code if self.campus else parts[0],
                            self.shift,
                            year,
                            'principal',
                            serial_num
                        )
                        
                        # Collision check
                        from teachers.models import Teacher
                        from coordinator.models import Coordinator
                        
                        is_taken = (
                            Principal.objects.with_deleted().filter(employee_code=new_code).exclude(pk=self.pk).exists() or
                            Teacher.objects.with_deleted().filter(employee_code=new_code).exists() or
                            Coordinator.objects.with_deleted().filter(employee_code=new_code).exists()
                        )
                        
                        if is_taken:
                            new_code = IDGenerator.generate_unique_employee_code(
                                self.campus, self.shift, year, 'principal'
                            )
                        
                        self.employee_code = new_code
                        
                        # Update User
                        user_to_update = self.user
                        if not user_to_update and old_code:
                            from users.models import User
                            user_to_update = User.objects.filter(username=old_code).first()
                            
                        if user_to_update:
                            user_to_update.username = new_code
                            if campus_changed:
                                user_to_update.campus = self.campus
                            user_to_update.save(update_fields=['username', 'campus'] if campus_changed else ['username'])
                            self.user = user_to_update
            except Exception as e:
                print(f"[PRINCIPAL_SAVE] Error regenerating code: {e}")

        # Auto-generate employee_code if not provided (for new principals)
        if not self.employee_code and self.campus:
            try:
                # Get year from joining date or current year
                if self.joining_date:
                    if isinstance(self.joining_date, str):
                        from datetime import datetime
                        joining_date = datetime.strptime(self.joining_date, '%Y-%m-%d').date()
                        year = joining_date.year
                    else:
                        year = self.joining_date.year
                else:
                    year = 2025
                
                # Generate employee code using IDGenerator
                from utils.id_generator import IDGenerator
                self.employee_code = IDGenerator.generate_unique_employee_code(
                    self.campus, self.shift, year, 'principal'
                )
            except Exception as e:
                print(f"Error generating employee code: {str(e)}")
        
        super().save(*args, **kwargs)
    
    def get_shift_display(self):
        """Return display text for shift"""
        shift_dict = dict(SHIFT_CHOICES)
        return shift_dict.get(self.shift, self.shift)

    @classmethod
    def get_for_user(cls, user):
        """
        Robust lookup: try employee_code == user.username, then email == user.email.
        Returns a Principal instance or None.
        """
        if not user:
            return None

        try:
            obj = cls.objects.filter(employee_code=user.username).first()
            if obj:
                return obj
        except Exception:
            pass

        try:
            if getattr(user, 'email', None):
                obj = cls.objects.filter(email=user.email).first()
                if obj:
                    return obj
        except Exception:
            pass

        return None
    
    def soft_delete(self):
        """Soft delete the principal"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.is_currently_active = False
        self.save()
    
    def restore(self):
        """Restore a soft deleted principal"""
        self.is_deleted = False
        self.deleted_at = None
        self.save()
    
    def hard_delete(self):
        """Permanently delete the principal from database"""
        super().delete()
    
    def __str__(self):
        return f"{self.full_name} ({self.employee_code})"

    class Meta:
        verbose_name = "Principal"
        verbose_name_plural = "Principals"
        ordering = ['-created_at']
        constraints = [
            # Ensure only one principal per campus AND shift combination
            # This allows multiple principals if they have different shifts (morning/afternoon/both)
            models.UniqueConstraint(
                fields=['campus', 'shift'],
                condition=Q(is_deleted=False),
                name='unique_principal_per_campus_shift'
            ),
            models.UniqueConstraint(
                fields=['email'],
                condition=Q(is_deleted=False),
                name='unique_active_principal_email'
            ),
            models.UniqueConstraint(
                fields=['cnic'],
                condition=Q(is_deleted=False),
                name='unique_active_principal_cnic'
            ),
            models.UniqueConstraint(
                fields=['employee_code'],
                condition=Q(is_deleted=False),
                name='unique_active_principal_employee_code'
            )
        ]