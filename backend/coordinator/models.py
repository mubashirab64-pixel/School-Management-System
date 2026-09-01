from django.db import models
from django.db.models import Q
from django.utils import timezone
from campus.models import Campus
from classes.models import Level
import os

# Choices
GENDER_CHOICES = [
    ("male", "Male"),
    ("female", "Female"),
    ("other", "Other"),
]


def coordinator_photo_path(instance, filename):
    """Save photo as: coordinators/photos/coordinator_{id}.{ext}"""
    ext = filename.rsplit('.', 1)[-1].lower()
    identifier = instance.pk or instance.employee_code or 'new'
    return f'coordinators/photos/coordinator_{identifier}.{ext}'

SHIFT_CHOICES = [
    ('morning', 'Morning'),
    ('afternoon', 'Afternoon'),
    ('evening', 'Evening'),
    ('both', 'Morning + Afternoon'),
    ('all', 'All Shifts'),
]

from users.managers import OrganizationManager


class CoordinatorManager(OrganizationManager):
    """Custom manager to exclude soft deleted coordinators by default and filter by organization"""
    
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)
    
    def with_deleted(self):
        """Return all coordinators including soft deleted ones"""
        return super().get_queryset()
    
    def only_deleted(self):
        """Return only soft deleted coordinators"""
        return super().get_queryset().filter(is_deleted=True)


class Coordinator(models.Model):
    # Custom manager
    objects = CoordinatorManager()
    
    # Organization
    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='coordinators')
    
    # Profile Photo
    photo = models.ImageField(upload_to=coordinator_photo_path, null=True, blank=True)

    # Personal Information
    full_name = models.CharField(max_length=150)
    dob = models.DateField()
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    contact_number = models.CharField(max_length=20)
    email = models.EmailField()
    cnic = models.CharField(max_length=15)
    biometric_id = models.CharField(max_length=50, blank=True, null=True, help_text="User ID on Biometric Device")
    permanent_address = models.TextField()
    marital_status = models.CharField(max_length=20, null=True, blank=True)
    religion = models.CharField(max_length=50, null=True, blank=True)
    
    # Professional Information
    education_level = models.CharField(max_length=100)
    institution_name = models.CharField(max_length=200)
    year_of_passing = models.IntegerField()
    total_experience_years = models.PositiveIntegerField()
    
    # Work Assignment
    campus = models.ForeignKey(Campus, on_delete=models.SET_NULL, null=True, blank=True)
    # For single-shift coordinators, we keep a single level assignment
    level = models.ForeignKey(
        'classes.Level', 
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='coordinator_set'
    )
    # For 'both' shift coordinators, allow assignment to multiple levels (e.g. L1-M and L1-A)
    assigned_levels = models.ManyToManyField(
        'classes.Level',
        blank=True,
        related_name='assigned_coordinators',
        help_text='Levels managed by this coordinator when shift is both'
    )
    shift = models.CharField(
        max_length=20,
        choices=SHIFT_CHOICES,
        default='both',
        help_text="Shift(s) this coordinator manages"
    )
    joining_date = models.DateField()
    is_currently_active = models.BooleanField(default=True)
    
    # Add permission to assign class teachers
    can_assign_class_teachers = models.BooleanField(default=True, help_text="Can this coordinator assign class teachers?")
    
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
        # Detect campus change
        old_campus = None
        if self.pk:
            try:
                old_instance = Coordinator.objects.with_deleted().get(pk=self.pk)
                old_campus = old_instance.campus
            except Coordinator.DoesNotExist:
                pass

        campus_changed = old_campus and self.campus and old_campus.id != self.campus.id

        # Detect shift change
        shift_changed = False
        if self.pk and self.employee_code:
            try:
                parts = self.employee_code.split('-')
                if len(parts) >= 5:
                    from utils.id_generator import IDGenerator
                    current_code_shift = parts[1]
                    new_shift_code = IDGenerator.get_shift_code(self.shift)
                    if current_code_shift != new_shift_code:
                        shift_changed = True
            except Exception:
                pass

        if campus_changed or shift_changed:
            # 1. Update employee code to reflect new campus/shift (keep same serial number if possible)
            if self.employee_code:
                try:
                    parts = self.employee_code.split('-')
                    if len(parts) >= 5:
                        serial_str = parts[-1]
                        if serial_str.isdigit():
                            from utils.id_generator import IDGenerator
                            serial_num = int(serial_str)
                            year = self.joining_date.year if self.joining_date else 2025
                            
                            # Generate new code with updated campus and shift
                            new_code = IDGenerator.generate_employee_code(
                                self.campus.campus_code if self.campus else parts[0], 
                                self.shift, 
                                year, 
                                'coordinator', 
                                serial_num
                            )

                            # Collision check: Ensure new_code is actually available
                            from teachers.models import Teacher
                            from principals.models import Principal
                            
                            is_taken = (
                                Coordinator.objects.with_deleted().filter(employee_code=new_code).exclude(pk=self.pk).exists() or
                                Teacher.objects.with_deleted().filter(employee_code=new_code).exists() or
                                Principal.objects.filter(employee_code=new_code).exists()
                            )

                            if is_taken:
                                new_code = IDGenerator.generate_unique_employee_code(
                                    self.campus, 
                                    self.shift, 
                                    year, 
                                    'coordinator'
                                )

                            # Store old code to update user later
                            old_code = self.employee_code
                            self.employee_code = new_code
                            
                            # Update User account if it exists (linked by employee_code/username)
                            from users.models import User
                            user = User.objects.filter(username=old_code).first()
                            if user:
                                user.username = new_code
                                if campus_changed:
                                    user.campus = self.campus
                                user.save(update_fields=['username', 'campus'] if campus_changed else ['username'])
                except Exception as e:
                    pass

        # Auto-generate employee_code if not provided (for new coordinators)
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
                # Choose appropriate shift for employee code generation.
                shift_for_code = self.shift if self.shift in ('morning', 'afternoon', 'both', 'all') else 'morning'
                self.employee_code = IDGenerator.generate_unique_employee_code(
                    self.campus, shift_for_code, year, 'coordinator'
                )
            except Exception as e:
                pass
        
        is_new = self.pk is None
        super().save(*args, **kwargs)

        # Clear ManyToMany levels if campus shifted
        if campus_changed:
            self.assigned_levels.clear()
    
    def get_assigned_teachers(self):
        """
        Get all teachers assigned to this coordinator through level -> grades -> classrooms
        Now considers coordinator's shift assignment
        """
        from teachers.models import Teacher
        from classes.models import ClassRoom

        # Determine which levels this coordinator manages
        managed_levels = []
        if self.assigned_levels.exists():
            managed_levels = list(self.assigned_levels.all())
        elif self.level:
            managed_levels = [self.level]
        else:
            return []
        
        # Get classrooms based on coordinator's shift and managed levels
        if self.shift == 'both':
            classrooms = ClassRoom.objects.filter(
                grade__level__in=managed_levels
            ).select_related('class_teacher')
        else:
            classrooms = ClassRoom.objects.filter(
                grade__level__in=managed_levels,
                shift=self.shift
            ).select_related('class_teacher')
        
        # Get teachers from those classrooms
        teachers = []
        for classroom in classrooms:
            if classroom.class_teacher:
                teachers.append(classroom.class_teacher)
        
        return teachers
    
    def get_assigned_teachers_count(self):
        """Get count of assigned teachers"""
        return len(self.get_assigned_teachers())
    
    def get_assigned_classrooms(self):
        """Get all classrooms under this coordinator's level based on shift"""
        from classes.models import ClassRoom

        # Determine which levels this coordinator manages
        managed_levels = []
        if self.assigned_levels.exists():
            managed_levels = list(self.assigned_levels.all())
        elif self.level:
            managed_levels = [self.level]
        else:
            return ClassRoom.objects.none()
        
        # Get classrooms based on coordinator's shift
        if self.shift == 'both':
            # Coordinator manages both morning and afternoon
            return ClassRoom.objects.filter(
                grade__level__in=managed_levels
            ).select_related('grade', 'class_teacher')
        else:
            # Coordinator manages specific shift
            return ClassRoom.objects.filter(
                grade__level__in=managed_levels,
                shift=self.shift
            ).select_related('grade', 'class_teacher')

    @classmethod
    def get_for_user(cls, user):
        """
        Robust lookup: try employee_code == user.username, then email == user.email.
        Returns a Coordinator instance or None. This avoids raising DoesNotExist
        when data isn't perfectly aligned and centralizes the lookup logic.
        """
        if not user:
            return None

        # Try employee_code first (legacy behaviour)
        try:
            obj = cls.objects.filter(employee_code=user.username).first()
            if obj:
                return obj
        except Exception:
            # Swallow unexpected DB issues here - caller will handle None
            pass

        # Fallback to email if available
        try:
            if getattr(user, 'email', None):
                obj = cls.objects.filter(email=user.email).first()
                if obj:
                    return obj
        except Exception:
            pass

        return None
    
    def soft_delete(self):
        """Soft delete the coordinator - uses update() to bypass signals"""
        import logging
        logger = logging.getLogger(__name__)
        
        if not self.pk:
            raise ValueError("Cannot soft delete coordinator without primary key")
        
        logger.info(f"[SOFT_DELETE] soft_delete() called for coordinator PK: {self.pk}, Name: {self.full_name}")
        
        # Use update() to directly update database without triggering signals
        # This ensures no post_delete or other signals interfere
        # IMPORTANT: Use with_deleted() to bypass custom manager's filter
        updated_count = Coordinator.objects.with_deleted().filter(pk=self.pk).update(
            is_deleted=True,
            deleted_at=timezone.now(),
            is_currently_active=False
        )
        
        logger.info(f"[SOFT_DELETE] Database update() returned updated_count: {updated_count}")
        
        if updated_count == 0:
            logger.error(f"[SOFT_DELETE] CRITICAL: update() returned 0 - no rows were updated! Coordinator PK: {self.pk}")
            raise Exception(f"Soft delete failed - no rows updated for coordinator PK: {self.pk}")
        
        # Refresh instance from database
        self.refresh_from_db()
        logger.info(f"[SOFT_DELETE] After refresh_from_db(), is_deleted: {self.is_deleted}")
    
    def restore(self):
        """Restore a soft deleted coordinator"""
        import logging
        logger = logging.getLogger(__name__)
        
        if not self.pk:
            raise ValueError("Cannot restore coordinator without primary key")
        
        logger.info(f"[RESTORE] restore() called for coordinator PK: {self.pk}, Name: {self.full_name}")
        
        # Use update() to bypass signals
        updated_count = Coordinator.objects.with_deleted().filter(pk=self.pk).update(
            is_deleted=False,
            deleted_at=None
        )
        
        if updated_count == 0:
            logger.error(f"[RESTORE] CRITICAL: update() returned 0 - no rows were updated! Coordinator PK: {self.pk}")
            raise Exception(f"Restore failed - no rows updated for coordinator PK: {self.pk}")
        
        self.refresh_from_db()
        logger.info(f"[RESTORE] After refresh_from_db(), is_deleted: {self.is_deleted}")
    
    def delete(self, using=None, keep_parents=False):
        """
        Override delete() to prevent accidental hard deletes.
        Always use soft_delete() instead.
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"[OVERRIDE_DELETE] delete() called for coordinator PK: {self.pk}, Name: {self.full_name}, is_deleted: {self.is_deleted}")
        
        if not self.is_deleted:
            logger.info(f"[OVERRIDE_DELETE] Calling soft_delete() instead of hard delete")
            self.soft_delete()
        else:
            raise ValueError(
                "Cannot hard delete coordinator. Use hard_delete() method explicitly if you really want to permanently delete."
            )
    
    def hard_delete(self):
        """Permanently delete the coordinator from database"""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.warning(f"[HARD_DELETE] hard_delete() called for coordinator PK: {self.pk}, Name: {self.full_name}")
        super().delete()


    class Meta:
        verbose_name = "Coordinator"
        verbose_name_plural = "Coordinators"
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['email'],
                condition=Q(is_deleted=False),
                name='unique_active_coordinator_email'
            ),
            models.UniqueConstraint(
                fields=['cnic'],
                condition=Q(is_deleted=False),
                name='unique_active_coordinator_cnic'
            ),
            models.UniqueConstraint(
                fields=['employee_code'],
                condition=Q(is_deleted=False),
                name='unique_active_coordinator_employee_code'
            )
        ]

    def __str__(self):
        return f"{self.full_name} ({self.employee_code})"