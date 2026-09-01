"""
Organization-aware mixins for Django REST Framework views.
These mixins automatically:
1. Filter querysets by the user's organization
2. Assign organization on create
3. Check quota limits before creating new records
"""
from rest_framework.exceptions import PermissionDenied, ValidationError


class OrganizationQuerySetMixin:
    """
    Automatically filters queryset by the logged-in user's organization.
    Superadmin users see all data (no filter applied).
    """
    
    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        
        # Superadmin sees everything
        if user.is_superadmin():
            return qs
        
        # Organization-bound users only see their own org's data
        if user.organization:
            if hasattr(qs.model, 'organization'):
                return qs.filter(organization=user.organization)
        
        return qs


class OrganizationCreateMixin:
    """
    Automatically assigns organization from the logged-in user when creating records.
    """
    
    def perform_create(self, serializer):
        user = self.request.user
        
        # Only assign organization if the model has the field
        model = serializer.Meta.model
        if hasattr(model, 'organization'):
            if user.organization:
                serializer.save(organization=user.organization)
                return
        
        # Fallback to default save
        serializer.save()


class OrganizationQuotaMixin:
    """
    Checks organization quota limits before creating new records.
    Subclasses should set `quota_model_field` and `quota_limit_field`.
    
    Example:
        class CampusCreateView(OrganizationQuotaMixin, CreateAPIView):
            quota_model_field = 'campuses'      # related_name on Organization
            quota_limit_field = 'max_campuses'   # field on Organization model
    """
    quota_model_field = None  # e.g. 'campuses'
    quota_limit_field = None  # e.g. 'max_campuses'
    quota_exceeded_message = "Quota exceeded. Please contact your provider to upgrade your package."
    
    def perform_create(self, serializer):
        user = self.request.user
        
        # Superadmins bypass quota checks
        if user.is_superadmin():
            if hasattr(serializer.Meta.model, 'organization') and user.organization:
                serializer.save(organization=user.organization)
            else:
                serializer.save()
            return
        
        org = user.organization
        if not org:
            raise PermissionDenied("You are not assigned to any organization.")
        
        # Check quota if configured
        if self.quota_model_field and self.quota_limit_field:
            current_count = getattr(org, self.quota_model_field).count()
            max_allowed = getattr(org, self.quota_limit_field)
            
            if current_count >= max_allowed:
                raise ValidationError({
                    'detail': f"{self.quota_exceeded_message} "
                              f"Current: {current_count}/{max_allowed}"
                })
        
        # Auto-assign organization
        if hasattr(serializer.Meta.model, 'organization'):
            serializer.save(organization=org)
        else:
            serializer.save()


class OrganizationViewMixin(OrganizationQuerySetMixin, OrganizationCreateMixin):
    """
    Combined mixin that provides both queryset filtering and auto-assignment.
    Use this as a convenient shorthand when you need both behaviors.
    """
    pass
