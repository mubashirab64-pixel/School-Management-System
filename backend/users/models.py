from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from datetime import timedelta
import secrets
from .managers import OrganizationManager, MultiTenantUserManager

class SubscriptionPlan(models.Model):
    """
    Model for different subscription tiers/packages.
    """
    name = models.CharField(max_length=100, unique=True)
    max_users = models.PositiveIntegerField()
    max_students = models.PositiveIntegerField()
    max_campuses = models.PositiveIntegerField()
    
    # Pricing Fields (PKR)
    price_per_student = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    price_per_user = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    base_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_enterprise = models.BooleanField(default=False)

    description = models.TextField(blank=True, null=True)
    
    # Pricing fields
    base_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    price_per_student = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    price_per_user = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    is_enterprise = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_plans')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} Plan"

    class Meta:
        db_table = 'users_subscription_plan'
        verbose_name = 'Subscription Plan'
        verbose_name_plural = 'Subscription Plans'

class Organization(models.Model):
    # Custom manager for multi-tenancy (filters by current user)
    objects = OrganizationManager()
    # Unfiltered manager — management commands aur signals ke liye
    all_objects = models.Manager()
    name = models.CharField(max_length=255)
    subdomain = models.CharField(max_length=100, unique=True, null=True, blank=True)
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.SET_NULL, null=True, blank=True, related_name='organizations')
    max_users = models.PositiveIntegerField(default=50)
    max_students = models.PositiveIntegerField(default=1000)
    max_campuses = models.PositiveIntegerField(default=3)
    is_active = models.BooleanField(default=True)
    enabled_features = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_organizations')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'users_organization'
        verbose_name = 'Organization'
        verbose_name_plural = 'Organizations'




class User(AbstractUser):
    # Custom manager for multi-tenancy + standard user creation
    objects = MultiTenantUserManager()
    """
    Custom User model with role-based access control
    """
    ROLE_CHOICES = [
        ('superadmin', 'Super Admin'),
        ('admin', 'Admin'),
        ('org_admin', 'Organization Admin'),
        ('principal', 'Principal'),
        ('coordinator', 'Teacher Coordinator'),
        ('teacher', 'Teacher'),
        ('donor', 'Donor'),
        ('accounts_officer', 'Accountant'),
        ('admissions_counselor', 'Receptionist'),
        ('compliance_officer', 'Auditor'),
        ('student', 'Student'),
    ]
    
    # Override default fields
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, unique=True)
    
    # Custom fields
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='organization_users')
    is_org_admin = models.BooleanField(default=False)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    campus = models.ForeignKey('campus.Campus', on_delete=models.SET_NULL, null=True, blank=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    biometric_id = models.CharField(max_length=50, blank=True, null=True, help_text="User ID on Biometric Device")
    photo = models.ImageField(upload_to='users/photos/', null=True, blank=True)
    is_verified = models.BooleanField(default=False)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    has_changed_default_password = models.BooleanField(default=False)
    
    # Token versioning for session invalidation (incremented on role switch)
    token_version = models.PositiveIntegerField(default=0)

    # Login attempt tracking for account lockout
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    lockout_until = models.DateTimeField(null=True, blank=True)
    
    @property
    def employee_code(self):
        """Dynamic employee code based on profile or username fallback"""
        if hasattr(self, 'teacher_profile') and self.teacher_profile:
            return self.teacher_profile.employee_code
        if hasattr(self, 'principal_profile') and self.principal_profile:
            return self.principal_profile.employee_code
        # For coordinators (linked by username) or others
        return self.username

    # System fields
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email', 'role']
    
    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"
    
    def get_role_display(self):
        return dict(self.ROLE_CHOICES).get(self.role, self.role)
    
    def is_superadmin(self):
        return self.role == 'superadmin'
    
    def is_org_admin_role(self):
        return self.role == 'org_admin' or self.is_org_admin
    
    def is_principal(self):
        return self.role == 'principal'
    
    def is_coordinator(self):
        return self.role == 'coordinator'
    
    def is_teacher(self):
        return self.role == 'teacher'

    def is_student(self):
        return self.role == 'student'
    
    def is_admin(self):
        return self.role == 'admin'
    
    def can_manage_campus(self):
        return self.role in ['superadmin', 'org_admin', 'principal'] or self.is_org_admin
    
    def can_approve_requests(self):
        return self.role in ['superadmin', 'org_admin', 'principal', 'coordinator'] or self.is_org_admin
    
    def can_view_all_data(self):
        return self.role in ['superadmin', 'org_admin', 'principal'] or self.is_org_admin
    
    def save(self, *args, **kwargs):
        # Auto-generate employee code for super admin or org admin if not provided
        # Students have their username set externally (student_id) so skip them
        if self.role == 'student':
            super().save(*args, **kwargs)
            return
        if not self.username or (self.role == 'superadmin' and not self.username.startswith('S')) or (self.role == 'org_admin' and not self.username.startswith('OA')):
            try:
                from utils.id_generator import IDGenerator
                
                if self.role == 'superadmin':
                    employee_code = IDGenerator.generate_superadmin_code()
                elif self.role == 'admin':
                    employee_code = IDGenerator.generate_admin_code()
                elif self.role == 'org_admin':
                    employee_code = IDGenerator.generate_orgadmin_code()
                else:
                    employee_code = None
                
                if employee_code:
                    # Set username to employee code
                    self.username = employee_code
                    print(f"[OK] Auto-generated {self.role} employee code: {employee_code}")
                    
            except Exception as e:
                error_msg = str(e).encode('ascii', 'replace').decode('ascii') if isinstance(str(e), str) else repr(e)
                print(f"[ERROR] Error generating employee code: {error_msg}")
        
        # Ensure super admin doesn't have campus assignment
        if self.role == 'superadmin':
            self.campus = None
        
        super().save(*args, **kwargs)
    
    class Meta:
        db_table = 'users_user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'


class PasswordChangeOTP(models.Model):
    """Model to store OTP codes for password change verification"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_change_otps')
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    session_token = models.CharField(max_length=64, unique=True, null=True, blank=True)
    
    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=5)
        if not self.otp_code:
            self.otp_code = self.generate_otp()
        if not self.session_token:
            self.session_token = secrets.token_hex(32)
        super().save(*args, **kwargs)
    
    def generate_otp(self):
        """Generate a 6-digit random OTP"""
        return str(secrets.randbelow(900000) + 100000)
    
    def is_expired(self):
        """Check if OTP has expired (5 minutes)"""
        return timezone.now() > self.expires_at
    
    def verify_otp(self, code):
        """Verify OTP code and mark as used if valid"""
        if self.is_used or self.is_expired():
            return False
        
        if self.otp_code == code:
            self.is_used = True
            self.save()
            return True
        return False
    
    def __str__(self):
        return f"OTP for {self.user.email} - {self.otp_code}"
    
    class Meta:
        db_table = 'users_password_change_otp'
        verbose_name = 'Password Change OTP'
        verbose_name_plural = 'Password Change OTPs'


class RolePermission(models.Model):
    """
    Dynamic role-based permissions.
    SuperAdmin can toggle any permission for any role.
    Each row = one permission for one role, with is_allowed toggle.
    """
    PERMISSION_CHOICES = [
        ('view_dashboard', 'View Dashboard'),
        ('view_students', 'View Students'),
        ('add_student', 'Add Student'),
        ('edit_student', 'Edit Student'),
        ('view_teachers', 'View Teachers'),
        ('add_teacher', 'Add Teacher'),
        ('edit_teacher', 'Edit Teacher'),
        ('view_campus', 'View Campus'),
        ('add_campus', 'Add Campus'),
        ('view_principals', 'View Principals'),
        ('add_principal', 'Add Principal'),
        ('edit_principal', 'Edit Principal'),
        ('view_coordinators', 'View Coordinators'),
        ('add_coordinator', 'Add Coordinator'),
        ('edit_coordinator', 'Edit Coordinator'),
        ('view_attendance', 'View Attendance'),
        ('mark_attendance', 'Mark Attendance'),
        ('approve_attendance', 'Approve Attendance'),
        ('view_results', 'View Results'),
        ('approve_results', 'Approve Results'),
        ("bulk_import_results", "Bulk Import Results"),
        ("edit_results", "Edit Results"),
        ('view_transfers', 'View Transfers'),
        ('view_timetable', 'View Timetable'),
        ('view_requests', 'View Requests'),
        ('view_promotions', 'View Promotions'),
        ('view_subjects', 'View Subjects'),
        # Chart Permissions
        ('view_grade_distribution_chart', 'View Grade Distribution Chart'),
        ('view_gender_distribution_chart', 'View Gender Distribution Chart'),
        ('view_mother_tongue_chart', 'View Mother Tongue Chart'),
        ('view_religion_chart', 'View Religion Chart'),
        ('view_enrollment_trend_chart', 'View Enrollment Trend Chart'),
        ('view_age_distribution_chart', 'View Age Distribution Chart'),
        ('view_weekly_attendance_chart', 'View Weekly Attendance Chart'),
        ('view_zakat_status_chart', 'View Zakat Status Chart'),
        ('view_house_ownership_chart', 'View House Ownership Chart'),
        ('view_network_performance_chart', 'View Network Performance Dashboard'),
        # KPI Permissions
        ('view_total_students_kpi', 'View Total Students KPI'),
        ('view_total_teachers_kpi', 'View Total Teachers KPI'),
        ('view_teacher_student_ratio_kpi', 'View Teacher-Student Ratio KPI'),
        ('view_avg_attendance_kpi', 'View Average Attendance KPI'),
        # Fees/Finance
        ('view_fees', 'View Fees & Vouchers'),
        ('manage_fees', 'Manage Fees Collections'),
        # Management
        ('manage_permissions', 'Manage Permissions'),
        ('manage_forms', 'Manage Forms'),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='role_permissions')
    role = models.CharField(max_length=20, choices=User.ROLE_CHOICES)
    permission_codename = models.CharField(max_length=100, choices=PERMISSION_CHOICES)
    is_allowed = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users_role_permission'
        unique_together = ('organization', 'role', 'permission_codename')
        verbose_name = 'Role Permission'
        verbose_name_plural = 'Role Permissions'
        ordering = ['organization', 'role', 'permission_codename']

    def __str__(self):
        status = '✅' if self.is_allowed else 'X'
        org_name = self.organization.name if self.organization else "Default"
        return f"[{org_name}] {self.get_role_display()} - {self.get_permission_codename_display()} {status}"


class SystemVersion(models.Model):
    """
    Tracks the deployed version of the application.
    Creating a new entry triggers notifications to principals, org_admins, and superadmins.
    """
    version = models.CharField(max_length=50)
    build = models.PositiveIntegerField()
    release_notes = models.TextField(blank=True, default='')
    released_by = models.ForeignKey(
        'User', on_delete=models.SET_NULL, null=True, blank=True, related_name='released_versions'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'users_system_version'
        verbose_name = 'System Version'
        verbose_name_plural = 'System Versions'
        ordering = ['-created_at']

    def __str__(self):
        return f"v{self.version} (build {self.build})"

    @classmethod
    def current(cls):
        return cls.objects.first()

    @classmethod
    def next_build(cls):
        latest = cls.objects.first()
        return (latest.build + 1) if latest else 1
