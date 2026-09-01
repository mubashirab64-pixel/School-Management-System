from django.db import models
from django.contrib.auth.models import UserManager
from .middleware import get_current_organization

class MultiTenantUserManager(UserManager):
    """
    Custom manager that supports standard User creation + multi-tenant filtering.
    """
    def get_queryset(self):
        from .middleware import get_current_user
        user = get_current_user()
        org = get_current_organization()
        
        queryset = super().get_queryset()
        
        # If no user or superadmin, don't filter (essential for login)
        if not user or user.is_superadmin():
            return queryset
            
        # Filter by organization if it exists on the model
        if org and hasattr(self.model, 'organization'):
            return queryset.filter(organization=org)
            
        return queryset

class OrganizationManager(models.Manager):
    """
    Custom manager that automatically filters all queries by the 
    organization of the currently logged-in user (from thread-local storage).
    Superadmins can see all data.
    """
    def get_queryset(self):
        from .middleware import get_current_user, get_current_organization
        user = get_current_user()
        org = get_current_organization()
        
        # Base queryset
        queryset = super().get_queryset()
        
        # If no user, return empty (very secure)
        if not user:
            return queryset.none()

        # Superadmins can see all data
        if user.is_superadmin():
            return queryset
            
        # ─── PARTNER ADMIN LOGIC ───
        if user.role == 'admin':
            if self.model.__name__ == 'Organization':
                # Admins see only organizations they created
                return queryset.filter(created_by=user)
            
            # For other models (Student, Campus, etc.), filter by organizations the admin created
            # This ensures they only see data belonging to THEIR portfolio
            if org and hasattr(self.model, 'organization'):
                # First verify they own this org
                if org.created_by == user:
                     return queryset.filter(organization=org)
                else:
                    return queryset.none()
            
            # If no specific org selected, but trying to list students/etc. (should not happen normally in UI)
            if hasattr(self.model, 'organization'):
                return queryset.filter(organization__created_by=user)
            
            return queryset

        # ─── ORG ADMIN / STAFF LOGIC ───
        if hasattr(self.model, 'organization'):
            if org:
                # Multi-org: show only records belonging to this org
                return queryset.filter(organization=org)
            else:
                # No org on user: show only untagged records (org=None)
                return queryset.filter(organization__isnull=True)

        # Model has no organization field — cannot filter by org, return all
        return queryset
