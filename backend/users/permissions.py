from rest_framework import permissions

class IsSuperAdmin(permissions.BasePermission):
    """
    Permission class for SuperAdmin only
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.is_superadmin()
        )

class IsAdmin(permissions.BasePermission):
    """
    Permission class for Admin (Reseller) only
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'admin'
        )

class IsOrgAdmin(permissions.BasePermission):
    """
    Permission class for Organization Admin only
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'org_admin'
        )

class IsPrincipal(permissions.BasePermission):
    """
    Permission class for Principal only
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.is_principal()
        )

class IsCoordinator(permissions.BasePermission):
    """
    Permission class for Coordinator only
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.is_coordinator()
        )

class IsTeacher(permissions.BasePermission):
    """
    Permission class for Teacher only
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.is_teacher()
        )

class IsSuperAdminOrPrincipal(permissions.BasePermission):
    """
    Permission class for SuperAdmin or Principal
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            (request.user.is_superadmin() or request.user.role == 'admin' or request.user.role == 'org_admin' or request.user.is_principal())
        )

class IsCoordinatorOrAbove(permissions.BasePermission):
    """
    Permission class for Coordinator and above
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.can_approve_requests()
        )

class IsTeacherOrAbove(permissions.BasePermission):
    """
    Permission class for Teacher and above
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['superadmin', 'admin', 'org_admin', 'principal', 'coordinator', 'teacher', 'accounts_officer', 'donor']
        )

class CanManageCampus(permissions.BasePermission):
    """
    Permission class for users who can manage campus
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.can_manage_campus()
        )

class CanViewAllData(permissions.BasePermission):
    """
    Permission class for users who can view all data
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.can_view_all_data()
        )

class SuperAdminOnlyForCampusCreation(permissions.BasePermission):
    """
    Permission class that allows:
    - SuperAdmin: Full CRUD access to campus
    - Principal: Read, Update, Delete access (no creation)
    - Others: No access
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        
        # For campus creation (POST), only superadmin allowed
        if request.method == 'POST':
            return request.user.is_superadmin()
        
        # For other operations (GET, PUT, PATCH, DELETE), allow superadmin or principal
        return request.user.is_superadmin() or request.user.is_principal()
    
    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False
        
        # For object-level operations, allow superadmin or principal
        return request.user.is_superadmin() or request.user.is_principal()

class IsStudent(permissions.BasePermission):
    """
    Permission class for Student only
    """
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == 'student'
        )

class IsNotDonorForWrites(permissions.BasePermission):
    """
    Donor is a read-only ("view access") role.

    Safe methods (GET/HEAD/OPTIONS) are always allowed — actual data scoping is
    still handled by the tenant-aware OrganizationManager and the other permission
    classes on the view. Any write method (POST/PUT/PATCH/DELETE) is denied for
    donors so a view-only supporter can never mutate org data.
    """
    message = "Donor accounts have view-only access."

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return not (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'donor'
        )


class HasDynamicPermission(permissions.BasePermission):
    """
    Dynamic permission class that checks the RolePermission model
    Urdu: Database se role ki permissions check karta hai
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
            
        # SuperAdmin and OrgAdmin bypass dynamic checks (Master Roles)
        if request.user.is_superadmin() or request.user.role == 'org_admin':
            return True

        # Check if the view specifies a required permission
        codename = getattr(view, 'required_permission', None)
        if not codename:
            # If no permission is explicitly required, allow authenticated
            return True

        from .models import RolePermission
        return RolePermission.objects.filter(
            organization=request.user.organization,
            role=request.user.role,
            permission_codename=codename,
            is_allowed=True
        ).exists()