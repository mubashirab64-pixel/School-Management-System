from django.contrib import admin
from django.contrib.auth.models import Group
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from .models import User, Organization, SubscriptionPlan, SystemVersion

# Unregister Group model if it is registered
try:
    admin.site.unregister(Group)
except admin.sites.NotRegistered:
    pass



@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("email",)
    list_display = (
        "email",
        "username",
        "first_name",
        "last_name",
        "role",
        "organization",
        "campus",
        "is_staff",
        "is_superuser",
        "is_active",
    )
    list_filter = ("role", "organization", "is_staff", "is_superuser", "is_active", "campus")
    search_fields = ("email", "username", "first_name", "last_name")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Personal info"), {"fields": ("username", "first_name", "last_name", "phone_number")}),
        (
            _("Roles and access"),
            {"fields": ("role", "organization", "campus", "is_active", "is_staff", "is_superuser", "is_verified")},
        ),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "username",
                    "role",
                    "campus",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_superuser",
                    "is_active",
                ),
            },
        ),
    )

    readonly_fields = ("last_login",)

    def user_change_password(self, request, id, form_url=""):
        """Override to log password changes made via the dedicated admin password-change form."""
        response = super().user_change_password(request, id, form_url)
        # Django redirects on success; on POST with valid form the user password was changed
        if request.method == "POST":
            from django.http import HttpResponseRedirect
            if isinstance(response, HttpResponseRedirect):
                try:
                    target_user = User.objects.get(pk=id)
                    from attendance.models import AuditLog
                    AuditLog.objects.create(
                        feature=getattr(target_user, 'role', 'user') if getattr(target_user, 'role', 'user') in ('student','teacher','coordinator','principal','org_admin') else 'user',
                        action='password_change',
                        entity_type='User',
                        entity_id=target_user.id,
                        organization=target_user.organization,
                        user=request.user if not request.user.is_anonymous else None,
                        ip_address=request.META.get('REMOTE_ADDR'),
                        changes={
                            'name': target_user.get_full_name() or target_user.username,
                            'email': target_user.email,
                            'role': getattr(target_user, 'role', ''),
                            'changed_by': request.user.username,
                            'changed_by_role': getattr(request.user, 'role', 'superadmin'),
                            'source': 'django_admin',
                        },
                    )
                except Exception:
                    pass
        return response

    def save_model(self, request, obj, form, change):
        old_password = None
        old_is_active = None
        if change and obj.pk:
            try:
                old_obj = User.objects.get(pk=obj.pk)
                old_password = old_obj.password
                old_is_active = old_obj.is_active
            except Exception:
                pass
        super().save_model(request, obj, form, change)
        feature = getattr(obj, 'role', 'user') if getattr(obj, 'role', 'user') in ('student', 'teacher', 'coordinator', 'principal', 'org_admin') else 'user'
        # Log password change
        if change and old_password and obj.password != old_password:
            try:
                from attendance.models import AuditLog
                AuditLog.objects.create(
                    feature=feature,
                    action='password_change',
                    entity_type='User',
                    entity_id=obj.id,
                    organization=obj.organization,
                    user=request.user if not request.user.is_anonymous else None,
                    ip_address=request.META.get('REMOTE_ADDR'),
                    changes={
                        'name': obj.get_full_name() or obj.username,
                        'email': obj.email,
                        'role': obj.role,
                        'changed_by': request.user.username,
                        'changed_by_role': getattr(request.user, 'role', 'superadmin'),
                        'source': 'django_admin',
                    },
                )
            except Exception:
                pass
        # Log active/inactive status change
        if change and old_is_active is not None and obj.is_active != old_is_active:
            try:
                from attendance.models import AuditLog
                new_status = 'activated' if obj.is_active else 'deactivated'
                AuditLog.objects.create(
                    feature=feature,
                    action='status_change',
                    entity_type='User',
                    entity_id=obj.id,
                    organization=obj.organization,
                    user=request.user if not request.user.is_anonymous else None,
                    ip_address=request.META.get('REMOTE_ADDR'),
                    changes={
                        'name': obj.get_full_name() or obj.username,
                        'email': obj.email,
                        'role': obj.role,
                        'status_changed_to': new_status,
                        'changed_by': request.user.username,
                        'changed_by_role': getattr(request.user, 'role', 'superadmin'),
                        'field': 'is_active',
                        'source': 'django_admin',
                    },
                    reason=f'User {new_status} via Django admin by {request.user.username}',
                )
            except Exception:
                pass


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ("name", "max_users", "max_students", "max_campuses", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "subdomain", "plan", "max_users", "max_students", "max_campuses", "is_active", "created_at")
    list_filter = ("plan", "is_active")
    search_fields = ("name", "subdomain")
    raw_id_fields = ("plan",)


@admin.register(SystemVersion)
class SystemVersionAdmin(admin.ModelAdmin):
    list_display = ('version', 'build', 'released_by', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('version', 'release_notes')
    readonly_fields = ('build', 'released_by', 'created_at')
