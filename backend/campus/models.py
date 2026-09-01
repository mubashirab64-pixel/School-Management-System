from django.db import models
from users.managers import OrganizationManager


class Campus(models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive"),
        ("pending", "Pending"),
        ("closed", "Closed"),
        ("under_construction", "Under Construction"),
    ]

    CAMPUS_TYPE_CHOICES = [
        ("main", "Main"),
        ("branch", "Branch"),
    ]

    SHIFT_CHOICES = [
        ("morning", "Morning"),
        ("afternoon", "Afternoon"),
        ("both", "Both"),
    ]

    # 🔹 Primary Key
    id = models.AutoField(primary_key=True)

    # 🔹 Organization for Multi-tenant
    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='campuses')

    # 🔹 Basic Info
    campus_photo = models.ImageField(upload_to='campus/photos/', blank=True, null=True, help_text="Campus photo (optional)")
    campus_id = models.CharField(
        max_length=50,
        blank=True,
        help_text="Auto-generated if left blank: CITY-YEAR-POSTAL-CODE (e.g., KHI-25-75080-C01)"
    )
    campus_code = models.CharField(max_length=50, blank=True, null=True)
    campus_name = models.CharField(max_length=255, blank=True)
    campus_type = models.CharField(max_length=20, choices=CAMPUS_TYPE_CHOICES, default="main")
    governing_body = models.CharField(max_length=255, blank=True, null=True)
    accreditation = models.CharField(max_length=255, blank=True, null=True)
    instruction_language = models.CharField(max_length=255, blank=True, null=True, help_text="e.g. English, Urdu")
    academic_year_start = models.DateField(blank=True, null=True)
    academic_year_end = models.DateField(blank=True, null=True)
    established_year = models.PositiveIntegerField(blank=True, null=True)
    registration_number = models.CharField(max_length=100, blank=True, null=True)

    # 🔹 Location
    address_full = models.TextField(blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    city = models.CharField(max_length=100, blank=True)
    district = models.CharField(max_length=100, blank=True, null=True)

    # 🔹 Contact
    primary_phone = models.CharField(max_length=20, blank=True)
    secondary_phone = models.CharField(max_length=20, blank=True, null=True)
    official_email = models.EmailField(blank=True)

    # 🔹 Administration
    campus_head_name = models.CharField(max_length=255, blank=True)
    campus_head_phone = models.CharField(max_length=50, blank=True, null=True)
    campus_head_email = models.EmailField(blank=True, null=True)



    # 🔹 Students

    student_capacity = models.PositiveIntegerField(default=0)



    
    # Academic Year (as months)
    academic_year_start_month = models.CharField(max_length=20, blank=True, null=True, help_text="Month name e.g. 'April'")
    academic_year_end_month = models.CharField(max_length=20, blank=True, null=True, help_text="Month name e.g. 'March'")

    # 🔹 Academic / Shifts
    shift_available = models.CharField(max_length=20, choices=SHIFT_CHOICES, default="morning", blank=True)
    grades_available = models.TextField(blank=True, null=True, help_text="Comma separated e.g. Nursery, 1, 2, 3")
    grades_offered = models.TextField(blank=True, null=True, help_text="Grades offered by campus")

    # 🔹 Infrastructure
    total_rooms = models.PositiveIntegerField(default=0, editable=False)
    total_classrooms = models.PositiveIntegerField(default=0)
    total_staff_rooms = models.PositiveIntegerField(default=0)
    has_computer_lab = models.BooleanField(default=False)
    has_science_lab = models.BooleanField(default=False)
    has_biology_lab = models.BooleanField(default=False)
    has_chemistry_lab = models.BooleanField(default=False)
    has_physics_lab = models.BooleanField(default=False)

    library_available = models.BooleanField(default=False, blank=True)
    power_backup = models.BooleanField(default=False)
    internet_available = models.BooleanField(default=False)
    teacher_transport = models.BooleanField(default=False)
    student_transport = models.BooleanField(default=False, help_text="Student transport available")
    canteen_facility = models.BooleanField(default=False)
    meal_program = models.BooleanField(default=False)



    # 🔹 Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")

    # 🔹 Sports
    sports_available = models.TextField(
        blank=True,
        null=True,
        help_text="If available, list sports e.g. Cricket, Football, Swimming"
    )

    # 🔹 Grades (structured JSON: [{level, grade, classrooms: {count, names}}])
    grades_data = models.JSONField(default=list, blank=True, help_text="Structured grades with levels, grades, and classrooms")

    # 🔹 System Fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # 🔹 Draft Flag (bilkul end me)
    is_draft = models.BooleanField(default=False, help_text="If True, campus is in draft mode")

    # 🔹 Auto Calculations
    def save(self, *args, **kwargs):
        # Auto-generate campus_id only if not manually provided
        if not self.campus_id:
            city_code = self.city[:3].upper() if self.city else "CMP"
            year_code = str(self.established_year or 2025)[-2:]
            postal = self.postal_code[-5:] if self.postal_code else "00000"
            campus_code_suffix = self.campus_code if self.campus_code else "C01"
            self.campus_id = f"{city_code}-{year_code}-{postal}-{campus_code_suffix}"

        # 🔹 Auto calculate totals for rooms
        self.total_rooms = self.total_classrooms + self.total_staff_rooms
        


        super().save(*args, **kwargs)

    class Meta:
        unique_together = [
            ('organization', 'campus_id'),
        ]

    def __str__(self):
        return f"{self.campus_name} ({self.campus_code})"