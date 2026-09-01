# models.py

from django.db import models
from django.utils import timezone
from django.db.models import Q
from django.core.validators import RegexValidator
from django.core.exceptions import ValidationError
from phonenumber_field.modelfields import PhoneNumberField
from .validators import StudentValidator


from users.managers import OrganizationManager

class FormOption(models.Model):
    OPTION_CATEGORIES = (
        ('gender', 'Gender'),
        ('religion', 'Religion'),
        ('mother_tongue', 'Mother Tongue'),
        ('nationality', 'Nationality'),
        ('blood_group', 'Blood Group'),
        ('special_needs', 'Special Needs'),
        ('emergency_relationship', 'Emergency Relationship'),
        ('father_status', 'Father Status'),
        ('mother_status', 'Mother Status'),
        ('marital_status', 'Marital Status'),
        ('shift', 'Shift'),
        ('section', 'Section'),
    )
    
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    
    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='form_options')
    category = models.CharField(max_length=50, choices=OPTION_CATEGORIES)
    value = models.CharField(max_length=100)
    label = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ('organization', 'category', 'value')
        ordering = ['category', 'label']

    def __str__(self):
        return f"{self.get_category_display()} - {self.label}"


class StudentManager(OrganizationManager):
    """Custom manager to exclude soft deleted students by default and filter by organization"""
    
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)
    
    def with_deleted(self):
        """Return all students including soft deleted ones"""
        return super().get_queryset()
    
    def only_deleted(self):
        """Return only soft deleted students"""
        return super().get_queryset().filter(is_deleted=True)


# ─── Enrollment lifecycle ─────────────────────────────────────────────────────
ENROLLMENT_STATUS_CHOICES = [
    ('enrolled', 'Enrolled'),
    ('left', 'Left'),
    ('re_enrolled', 'Re-enrolled'),
    ('graduated', 'Graduated'),
    ('transferred', 'Transferred'),
]
# Statuses in which the student is actively studying (drives is_active).
ACTIVE_ENROLLMENT_STATUSES = {'enrolled', 're_enrolled'}
# A reason must be supplied when moving into these statuses.
REASON_REQUIRED_STATUSES = {'left', 'transferred'}
# Structured exit-reason codes. "Dropout" is a SUBSET of Left — this distinction
# is what makes Dropout% analytics reliable (not all leavers are dropouts).
REASON_CODE_CHOICES = [
    ('dropout', 'Dropout'),
    ('transferred_out', 'Transferred Out'),
    ('graduated', 'Graduated'),
    ('other', 'Other'),
]
# These count as "away" for gap-before-rejoin calculations.
INACTIVE_EVENT_TYPES = ['left', 'transferred']
# Allowed status transitions (state machine).
ENROLLMENT_TRANSITIONS = {
    'enrolled':    {'left', 'graduated', 'transferred'},
    'left':        {'re_enrolled'},
    're_enrolled': {'left', 'graduated', 'transferred'},
    'transferred': {'re_enrolled', 'left'},
    'graduated':   set(),  # final
}


class Student(models.Model):
    # Custom manager
    objects = StudentManager()
    
    # --- User Account Link ---
    user = models.OneToOneField(
        'users.User', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='student_profile',
        help_text="User account associated with this student"
    )
    
    # --- Organization for Multi-tenant ---
    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='students')
    
    # --- Personal Details ---
    photo = models.ImageField(upload_to="students/photos/", null=True, blank=True)
    name = models.CharField(
        max_length=200,
        validators=[StudentValidator.validate_name],
        help_text="Student's full name"
    )
    gender = models.CharField(
        max_length=10,
        choices=(("male", "Male"), ("female", "Female")),
        null=True,
        blank=True
    )
    dob = models.DateField(
        null=True, 
        blank=True,
        validators=[StudentValidator.validate_date_of_birth],
        help_text="Date of birth (student must be 3-25 years old)"
    )
    place_of_birth = models.CharField(max_length=200, null=True, blank=True)
    religion = models.CharField(max_length=100, null=True, blank=True)
    mother_tongue = models.CharField(max_length=100, null=True, blank=True)
    student_cnic = models.CharField(
        max_length=20, 
        null=True, 
        blank=True,
        validators=[StudentValidator.validate_cnic],
        help_text="Student's B-Form / CNIC (13 digits)"
    )
    nationality = models.CharField(max_length=100, null=True, blank=True)
    blood_group = models.CharField(max_length=10, null=True, blank=True)
    special_needs_disability = models.CharField(max_length=100, null=True, blank=True)
    email = models.EmailField(null=True, blank=True, help_text="Student's email address (optional)")

    # --- Student Contact Details ---
    country_code = models.CharField(max_length=10, null=True, blank=True, help_text="Default country code (e.g. +92)")
    phone_number = PhoneNumberField(null=True, blank=True, help_text="Student's phone number")

    # --- Contact Details ---
    emergency_contact = PhoneNumberField(
        null=True, 
        blank=True,
        help_text="Emergency contact number"
    )
    emergency_relationship = models.CharField(max_length=50, null=True, blank=True)
    father_name = models.CharField(max_length=200, null=True, blank=True)
    father_cnic = models.CharField(
        max_length=20, 
        null=True, 
        blank=True,
        validators=[StudentValidator.validate_cnic],
        help_text="Father's CNIC (13 digits)"
    )
    father_contact = PhoneNumberField(
        null=True, 
        blank=True,
        help_text="Father's contact number"
    )
    father_profession = models.CharField(max_length=200, null=True, blank=True)

    guardian_name = models.CharField(max_length=200, null=True, blank=True)
    guardian_cnic = models.CharField(
        max_length=20, 
        null=True, 
        blank=True,
        validators=[StudentValidator.validate_cnic],
        help_text="Guardian's CNIC (13 digits)"
    )
    guardian_profession = models.CharField(max_length=200, null=True, blank=True)
    guardian_contact = PhoneNumberField(
        null=True, 
        blank=True,
        help_text="Guardian's contact number"
    )

    mother_name = models.CharField(max_length=200, null=True, blank=True)
    mother_cnic = models.CharField(
        max_length=20, 
        null=True, 
        blank=True,
        validators=[StudentValidator.validate_cnic],
        help_text="Mother's CNIC (13 digits)"
    )
    mother_status = models.CharField(
        max_length=20,
        choices=(("widowed", "Widowed"), ("divorced", "Divorced"), ("married", "Married")),
        null=True,
        blank=True
    )
    mother_contact = PhoneNumberField(
        null=True, 
        blank=True,
        help_text="Mother's contact number"
    )
    mother_profession = models.CharField(max_length=200, null=True, blank=True)


    address = models.TextField(
        null=True, 
        blank=True,
        validators=[StudentValidator.validate_address],
        help_text="Complete address (10-500 characters)"
    )
    family_income = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True,
        validators=[StudentValidator.validate_positive_number],
        help_text="Monthly family income in PKR"
    )
    house_owned = models.CharField(
        max_length=10,
        choices=(("yes", "Yes"), ("no", "No")),
        null=True,
        blank=True,
        help_text="Is the house owned by the family?"
    )
    zakat_status = models.CharField(
        max_length=20,
        choices=(("applicable", "Applicable"), ("not_applicable", "Not Applicable")),
        null=True,
        blank=True,
        help_text="Zakat eligibility status"
    )

    # --- Academic Details ---
    terminated_on = models.DateTimeField(null=True, blank=True)
    termination_reason = models.TextField(null=True, blank=True)

    # Campus reference - set to null if campus is deleted (data preservation)
    campus = models.ForeignKey("campus.Campus", on_delete=models.SET_NULL, null=True, blank=True)
    current_grade = models.CharField(max_length=50, null=True, blank=True)
    section = models.CharField(max_length=10, null=True, blank=True)
    last_class_teacher = models.CharField(max_length=200, null=True, blank=True)
    # The class the student passed before their current one (grade - section).
    # Written when a student is promoted to Section E and shown on the promotion
    # page; also populated from the "Last Class Passed" column on CSV import.
    last_class_passed = models.CharField(max_length=200, null=True, blank=True)
    old_gr_number = models.CharField(max_length=50, null=True, blank=True)
    transfer_reason = models.TextField(null=True, blank=True)
    siblings_count = models.PositiveIntegerField(
        null=True, 
        blank=True,
        help_text="Number of siblings (positive integer)"
    )
    father_status = models.CharField(
        max_length=20,
        choices=(
            ("alive", "Alive"),
            ("dead", "Dead"),
        ),
        null=True,
        blank=True
    )
    gr_no = models.CharField(max_length=50, null=True, blank=True, unique=False)

    # --- ID Generation Fields ---
    student_id = models.CharField(max_length=20, null=True, blank=True)
    student_code = models.CharField(max_length=20, editable=False, null=True, blank=True)
    enrollment_year = models.IntegerField(
        null=True, 
        blank=True,
        validators=[StudentValidator.validate_year],
        help_text="Year of enrollment (2000-2030)"
    )
    shift = models.CharField(
        max_length=20,
        choices=[
            ('morning', 'Morning'),
            ('afternoon', 'Afternoon'),
        ],
        null=True,
        blank=True,
        help_text="Student's shift"
    )

    # --- System Fields ---
    is_draft = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True, help_text="Active students appear in attendance sheets and class lists")
    enrollment_status = models.CharField(
        max_length=20, choices=ENROLLMENT_STATUS_CHOICES, default='enrolled', db_index=True,
        help_text="Lifecycle status. Change only via change_status() so the event log stays in sync."
    )
    deleted_at = models.DateTimeField(null=True, blank=True)
    dynamic_data = models.JSONField(default=dict, blank=True, null=True, help_text="Stores extra dynamic form data")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    classroom = models.ForeignKey(
        'classes.ClassRoom',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='students',
        help_text="Classroom where student is enrolled"
    )
    # Preserves the classroom a student had when they went inactive (left/
    # transferred). `classroom` is cleared on leaving so class lists/attendance
    # drop them, but this keeps the link so their former teacher/coordinator can
    # still find them in the inactive/left view.
    last_classroom = models.ForeignKey(
        'classes.ClassRoom',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='former_students',
        help_text="Classroom the student had before going inactive (left/transferred)"
    )

    # --- Properties ---
    @property
    def campus_from_classroom(self):
        return self.classroom.campus if self.classroom else self.campus

    @property
    def full_name(self):
        return self.name

    @property
    def level(self):
        return self.classroom.level if self.classroom else None

    @property
    def grade_from_classroom(self):
        return self.classroom.grade if self.classroom else None

    @property
    def level(self):
        # Expose level based on classroom/grade relationship when available
        try:
            return self.classroom.grade.level if self.classroom and self.classroom.grade else None
        except Exception:
            return None

    @property
    def class_teacher(self):
        return self.classroom.class_teacher if self.classroom else None

    def __str__(self):
        return f"{self.name} ({self.student_code or self.student_id or self.gr_no or 'No ID'})"
    
    def soft_delete(self):
        """Soft delete the student - uses update() to bypass signals"""
        import logging
        logger = logging.getLogger(__name__)
        
        if not self.pk:
            raise ValueError("Cannot soft delete student without primary key")
        
        logger.info(f"[SOFT_DELETE] soft_delete() called for student PK: {self.pk}, Name: {self.name}")
        
        updated_count = Student.objects.with_deleted().filter(pk=self.pk).update(
            is_deleted=True,
            deleted_at=timezone.now(),
            terminated_on=timezone.now(),
            termination_reason="Deleted from system"
        )
        
        logger.info(f"[SOFT_DELETE] Database update() returned updated_count: {updated_count}")
        
        if updated_count == 0:
            logger.error(f"[SOFT_DELETE] CRITICAL: update() returned 0 - no rows were updated! Student PK: {self.pk}")
            raise Exception(f"Soft delete failed - no rows updated for student PK: {self.pk}")
        
        # Refresh instance from database
        self.refresh_from_db()
        logger.info(f"[SOFT_DELETE] After refresh_from_db(), is_deleted: {self.is_deleted}")
    
    def restore(self):
        """Restore a soft deleted student"""
        self.is_deleted = False
        self.deleted_at = None
        self.terminated_on = None
        self.termination_reason = None
        self.save()
    
    def delete(self, using=None, keep_parents=False):
        """
        Override delete() to prevent accidental hard deletes.
        Always use soft_delete() instead.
        """
        # If someone accidentally calls .delete(), use soft delete instead
        if not self.is_deleted:
            self.soft_delete()
        else:
            # If already soft deleted and someone wants to hard delete, they must explicitly call hard_delete()
            raise ValueError(
                "Cannot hard delete student. Use hard_delete() method explicitly if you really want to permanently delete."
            )
    
    def hard_delete(self):
        """Permanently delete the student from database - use with caution!"""
        super().delete()
    
    def _auto_assign_classroom(self):
        """
        Automatically assign classroom based on campus, grade, section, and shift
        """
        try:
            from classes.models import ClassRoom, Grade
            
            # Normalize grade names for matching (e.g. "Grade 10" <-> "Class 10")
            clean_name = self.current_grade.lower().replace('grade', '').replace('class', '').strip()
            grade_name_variations = [
                self.current_grade,
                clean_name,
                f"Grade {clean_name}",
                f"Class {clean_name}",
                self.current_grade.replace('-', ' '),
                self.current_grade.replace(' ', '-'),
            ]
            
            # Find matching grade
            grade_query = Q()
            for grade_var in set(grade_name_variations):
                grade_query |= Q(name__iexact=grade_var) | Q(name__icontains=grade_var)
            
            # Find grades in the same campus
            matching_grades = Grade.objects.filter(
                grade_query,
                level__campus=self.campus
            )
            
            if not matching_grades.exists():
                print(f"[ERROR] No matching grade found for '{self.current_grade}' in campus '{self.campus.campus_name}'")
                return
            
            # Find classroom with matching grade, section, and shift
            classroom = ClassRoom.objects.filter(
                grade__in=matching_grades,
                section=self.section,
                shift=self.shift
            ).first()
            
            if classroom:
                self.classroom = classroom
                print(f"[OK] Auto-assigned student '{self.name}' to classroom '{classroom.grade.name}-{classroom.section}' ({classroom.shift})")
                
                # If classroom has a teacher, student is automatically connected to that teacher
                if classroom.class_teacher:
                    print(f"[OK] Student '{self.name}' is now connected to teacher '{classroom.class_teacher.full_name}'")
            else:
                print(f"[ERROR] No classroom found for Grade: {self.current_grade}, Section: {self.section}, Shift: {self.shift} in campus '{self.campus.campus_name}'")
                print(f"[INFO] Please create a classroom first for this combination")
                
        except Exception as e:
            error_msg = str(e).encode('ascii', 'replace').decode('ascii') if isinstance(str(e), str) else repr(e)
            print(f"[ERROR] Error in auto-assignment: {error_msg}")
            import traceback
            try:
                traceback.print_exc()
            except UnicodeEncodeError:
                print("[ERROR] Could not print traceback due to encoding error")

    def change_status(self, new_status, event_date, reason='', reason_code=None, user=None):
        """The ONLY sanctioned way to change enrollment_status.

        Validates the transition, records an EnrollmentEvent (with a structured
        reason_code), and keeps enrollment_status + is_active (+ classroom
        release) consistent — all in one atomic transaction. Raises
        ValidationError on any invalid input.
        """
        from django.db import transaction

        current = self.enrollment_status
        reason = (reason or '').strip()
        reason_code = (reason_code or '').strip() or None

        if new_status not in dict(ENROLLMENT_STATUS_CHOICES):
            raise ValidationError({'enrollment_status': f"Unknown status '{new_status}'."})
        if new_status == current:
            raise ValidationError({'enrollment_status': f"Student is already '{current}'."})
        if new_status not in ENROLLMENT_TRANSITIONS.get(current, set()):
            raise ValidationError({'enrollment_status': f"Cannot change status from '{current}' to '{new_status}'."})
        # Reason is mandatory for every status change (audit trail).
        if not reason:
            raise ValidationError({'reason': "A reason is required for every status change."})
        # A structured reason_code is mandatory when LEAVING — this is what keeps
        # Dropout% analytics clean (dropout vs transfer vs other).
        if new_status == 'left':
            if not reason_code:
                raise ValidationError({'reason_code': "Select an exit reason (Dropout / Transferred Out / Other)."})
            if reason_code not in dict(REASON_CODE_CHOICES):
                raise ValidationError({'reason_code': f"Invalid reason code '{reason_code}'."})
        # Derive a sensible code for the other terminal transitions.
        if not reason_code:
            if new_status == 'graduated':
                reason_code = 'graduated'
            elif new_status == 'transferred':
                reason_code = 'transferred_out'

        today = timezone.now().date()
        if event_date > today:
            raise ValidationError({'event_date': "Event date cannot be in the future."})
        last_event = self.enrollment_events.order_by('-event_date', '-created_at').first()
        if last_event and event_date < last_event.event_date:
            raise ValidationError({'event_date': f"Event date cannot be before the last event ({last_event.event_date})."})

        with transaction.atomic():
            EnrollmentEvent.objects.create(
                student=self, event_type=new_status, event_date=event_date,
                reason=reason, reason_code=reason_code, created_by=user,
            )
            self.enrollment_status = new_status
            if new_status in ACTIVE_ENROLLMENT_STATUSES:
                self.is_active = True
                # Re-enrolling: put the student back into the class they had
                # before leaving (if it still exists and they aren't already in
                # one), so they don't land as "Not Assigned".
                if new_status == 're_enrolled' and not self.classroom_id and self.last_classroom_id:
                    self.classroom_id = self.last_classroom_id
                    self.last_classroom = None
            else:
                # Leaving/graduating/transferring: deactivate and release the
                # classroom so class lists/attendance drop the student and save()
                # won't re-activate them. Preserve the former classroom first so
                # the student stays findable in the inactive/left view.
                self.is_active = False
                if self.classroom_id:
                    self.last_classroom_id = self.classroom_id
                self.classroom = None
            self.save()
        return self

    @property
    def current_gap_days(self):
        """Days the student is currently away (last inactive event → today), or
        None if the student is not currently in an inactive status.

        Reads self.enrollment_events.all() (Python filtering) so a prefetched
        queryset serves the value without a per-row query (avoids list N+1)."""
        if self.enrollment_status in ACTIVE_ENROLLMENT_STATUSES or self.enrollment_status == 'graduated':
            return None
        inactive = [e for e in self.enrollment_events.all() if e.event_type in INACTIVE_EVENT_TYPES]
        if not inactive:
            return None
        last = max(inactive, key=lambda e: (e.event_date, e.created_at or timezone.now()))
        return (timezone.now().date() - last.event_date).days

    def save(self, *args, **kwargs):
        # Set termination date automatically
        if hasattr(self, 'current_state') and self.current_state == "terminated" and not self.terminated_on:
            self.terminated_on = timezone.now()

        # Prevent termination fields from appearing at add time
        if not self.pk:  # means this is a new student
            self.terminated_on = None
            self.termination_reason = None

        # Logic for Classroom Assignment and Sync
        if self.classroom:
            # Sync academic details from classroom
            if self.classroom.grade:
                self.current_grade = self.classroom.grade.name
            if self.classroom.section:
                self.section = self.classroom.section
            if self.classroom.shift:
                self.shift = self.classroom.shift
            
            # Sync campus from classroom
            try:
                if self.classroom.campus:
                    self.campus = self.classroom.campus
            except Exception:
                pass
                
            # If assigned to a classroom, ensure student is active — but NOT when
            # the enrollment status is inactive (left/transferred/graduated),
            # otherwise a left student holding a stale classroom would be silently
            # re-activated on the next save.
            if not self.is_active and self.enrollment_status in ACTIVE_ENROLLMENT_STATUSES:
                self.is_active = True
                
        elif self.current_grade == 'Alumni':
            # Handle Alumni state
            self.is_active = False
            self.classroom = None
            self.section = None
            
        elif not self.is_draft:
            # Student is unassigned (no classroom) — keep grade and section as-is.
            # Section is preserved so the student retains their class identity
            # even while temporarily without a classroom assignment.
            pass
            
        # Otherwise, try to auto-assign classroom based on grade/section/shift ONLY during creation
        is_create = not self.pk
        if not self.classroom and is_create and all([self.campus, self.current_grade, self.section, self.shift]):
            self._auto_assign_classroom()
            # If creating and still no classroom, prevent save ONLY IF it is not a draft
            # Drafts can exist without a classroom assignment
            if not self.classroom and not self.is_draft:
                raise ValidationError({
                    'classroom': 'No classroom is available for the selected campus/grade/section/shift. Please create the classroom first.'
                })

        # Generate student code or ID
        if not self.student_code and self.classroom:
            try:
                from utils.id_generator import IDGenerator
                self.student_code = IDGenerator.generate_unique_student_code(
                    self.classroom, self.enrollment_year or 2025
                )
            except Exception as e:
                print(f"Error generating student code: {str(e)}")

        # Generate student_id using global student sequence
        if not self.student_id and all([self.campus, self.shift, self.enrollment_year]):
            try:
                from users.utils import generate_student_id, get_shift_code, get_next_student_number
                campus_code = self.campus.campus_code or f"C{self.campus.id:02d}"
                shift_code = get_shift_code(self.shift)
                year = str(self.enrollment_year)[-2:]
                seq = get_next_student_number(self.campus, self.enrollment_year)
                self.student_id = generate_student_id(campus_code, shift_code, year, seq)
                # Set GR number from sequence
                if not self.gr_no:
                    self.gr_no = f"GR-{seq:05d}"
            except Exception as e:
                print(f"Error generating student id: {e}")

        # Auto-generate GR No. from Student ID (last 5 digits)
        if self.student_id and not self.gr_no:
            # Extract last 5 digits from student_id
            if len(self.student_id) >= 5:
                last_5_digits = self.student_id[-5:]
                self.gr_no = f"GR-{last_5_digits}"
            else:
                # If student_id is shorter than 5 digits, pad with zeros
                padded_id = self.student_id.zfill(5)
                self.gr_no = f"GR-{padded_id}"

        super().save(*args, **kwargs)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['organization', 'email'], condition=Q(is_deleted=False), name='unique_active_student_email_per_org'),
            models.UniqueConstraint(fields=['organization', 'student_cnic'], condition=Q(is_deleted=False), name='unique_active_student_cnic_per_org'),
            models.UniqueConstraint(fields=['organization', 'student_id'], condition=Q(is_deleted=False), name='unique_active_student_id_per_org')
        ]
        indexes = [
            # Most common filter: is_deleted (used in almost every query)
            models.Index(fields=['is_deleted'], name='idx_student_is_deleted'),
            # Active students list (dashboard main query)
            models.Index(fields=['is_deleted', 'is_active'], name='idx_student_deleted_active'),
            # Organization scoping (multi-tenant)
            models.Index(fields=['organization', 'is_deleted'], name='idx_student_org_deleted'),
            # Campus-level filtering
            models.Index(fields=['campus', 'is_deleted'], name='idx_student_campus_deleted'),
            # Classroom filtering (teacher/list view)
            models.Index(fields=['classroom', 'is_deleted'], name='idx_student_classroom_deleted'),
            # Grade filtering
            models.Index(fields=['current_grade', 'is_deleted'], name='idx_student_grade_deleted'),
            # Composite: org + active + deleted (main dashboard query)
            models.Index(fields=['organization', 'is_active', 'is_deleted'], name='idx_student_org_active_deleted'),
            # created_at for ordering and enrollment trend
            models.Index(fields=['-created_at'], name='idx_student_created_at'),
            # student_id lookup (login / profile)
            models.Index(fields=['student_id'], name='idx_student_student_id'),
        ]
        verbose_name = "Student"
        verbose_name_plural = "Students"
        ordering = ['-created_at']

class EnrollmentEvent(models.Model):
    """Append-only log of a student's enrollment lifecycle changes.

    One row per status change (enrolled / left / re_enrolled / graduated /
    transferred). Preserves full history so a student can leave and re-join
    multiple times, and so gaps, dropout reasons and analytics are derivable.
    Never edit enrollment_status directly — use Student.change_status().
    """
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name='enrollment_events'
    )
    event_type = models.CharField(max_length=20, choices=ENROLLMENT_STATUS_CHOICES)
    event_date = models.DateField(help_text="Date the change actually took effect")
    reason = models.TextField(blank=True, help_text="Free-text detail (required for 'left' / 'transferred')")
    reason_code = models.CharField(
        max_length=20, choices=REASON_CODE_CHOICES, null=True, blank=True, db_index=True,
        help_text="Structured exit reason (dropout / transferred_out / graduated / other)"
    )
    created_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='enrollment_events_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['event_date', 'created_at']
        indexes = [
            models.Index(fields=['student', 'event_date']),
            models.Index(fields=['event_type', 'event_date']),
        ]

    def __str__(self):
        return f"{self.student_id} - {self.event_type} @ {self.event_date}"

    @property
    def gap_days(self):
        """For a re_enrolled event: days since the most recent prior inactive
        (left/transferred) event — i.e. how long the student was away. None
        otherwise, or if there is no prior inactive event.

        Reads student.enrollment_events.all() (Python filtering) so a prefetched
        list of events serves the value without a per-event query."""
        if self.event_type != 're_enrolled':
            return None
        prior = [
            e for e in self.student.enrollment_events.all()
            if e.event_type in INACTIVE_EVENT_TYPES and e.event_date < self.event_date
        ]
        if not prior:
            return None
        last = max(prior, key=lambda e: (e.event_date, e.created_at or timezone.now()))
        return (self.event_date - last.event_date).days


class EnrollmentStatusRequest(models.Model):
    """A teacher's request to change a student's enrollment status, pending a
    coordinator's approval.

    Flow: a teacher submits a request (status + event_date + reason); the
    responsible coordinator approves (which runs Student.change_status() and
    logs the EnrollmentEvent) or rejects. Coordinators / principals / admins
    change status directly and never create a request. Mirrors the result
    edit-request approval pattern so no lifecycle change happens without a
    coordinator's authorisation + an audit trail.
    """
    objects = OrganizationManager()
    all_objects = models.Manager()

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name='enrollment_status_requests'
    )
    requested_status = models.CharField(max_length=20, choices=ENROLLMENT_STATUS_CHOICES)
    event_date = models.DateField(help_text="Date the change should take effect")
    reason = models.TextField(blank=True, help_text="Why the change is needed")
    reason_code = models.CharField(
        max_length=20, choices=REASON_CODE_CHOICES, null=True, blank=True,
        help_text="Structured exit reason (required when requesting 'left')"
    )

    requested_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='enrollment_status_requests_made'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    reviewed_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='enrollment_status_requests_reviewed'
    )
    coordinator_response = models.TextField(
        blank=True, null=True, help_text="Coordinator's note on approve/reject"
    )

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE, null=True, blank=True,
        related_name='enrollment_status_requests'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['student', 'status']),
        ]

    def __str__(self):
        return f"StatusRequest({self.student_id} → {self.requested_status}) - {self.status}"


class EnrollmentSnapshot(models.Model):
    """A frozen record of a student's grade / campus / status at a point in time
    (year boundary or promotion). `current_grade` is mutable and overwritten on
    promotion, so this preserves the historical grade-per-year needed for Grade
    Progression + Cross-Year analytics. Append-only; never edit in place.
    """
    objects = OrganizationManager()
    all_objects = models.Manager()

    SNAPSHOT_TYPES = [
        ('start_of_year', 'Start of Year'),
        ('end_of_year', 'End of Year'),
        ('promotion', 'Promotion'),
    ]

    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name='enrollment_snapshots'
    )
    academic_year = models.CharField(max_length=20, db_index=True)
    snapshot_type = models.CharField(max_length=20, choices=SNAPSHOT_TYPES, default='start_of_year')
    snapshot_date = models.DateField()

    # Frozen values as of the snapshot.
    campus = models.ForeignKey('campus.Campus', on_delete=models.SET_NULL, null=True, blank=True)
    classroom = models.ForeignKey('classes.ClassRoom', on_delete=models.SET_NULL, null=True, blank=True)
    grade = models.CharField(max_length=50, null=True, blank=True, help_text="current_grade at snapshot time")
    section = models.CharField(max_length=20, null=True, blank=True)
    status = models.CharField(max_length=20, choices=ENROLLMENT_STATUS_CHOICES, null=True, blank=True)
    gender = models.CharField(max_length=10, null=True, blank=True)  # denormalised for analytics

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE, null=True, blank=True,
        related_name='enrollment_snapshots'
    )
    captured_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'academic_year', 'snapshot_type')
        indexes = [
            models.Index(fields=['academic_year', 'snapshot_type']),
            models.Index(fields=['student', 'academic_year']),
        ]

    def __str__(self):
        return f"Snapshot({self.student_id} {self.academic_year}/{self.snapshot_type} grade={self.grade})"
