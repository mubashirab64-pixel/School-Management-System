"""
Organization Tenant Middleware
Automatically filters querysets based on the logged-in user's organization.
Superadmin users bypass this filter.
Supports ASGI/Asyncio by using contextvars instead of threading.local.
"""
from contextvars import ContextVar
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed

# Context variables to hold the current organization and user.
# These are safer for ASGI/Asyncio (Daphne/Uvicorn) than threading.local.
_organization_var = ContextVar('organization', default=None)
_user_var = ContextVar('user', default=None)


def get_current_organization():
    """Get the current organization from context variables"""
    return _organization_var.get()


def get_current_user():
    """Get the current user from context variables"""
    return _user_var.get()


class OrganizationMiddleware:
    """
    Middleware that sets the current organization on each request.
    This allows models and querysets to automatically filter by organization.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Reset context variables for this request/coroutine
        token_org = _organization_var.set(None)
        token_user = _user_var.set(None)
        
        try:
            user = getattr(request, 'user', None)
            
            # If user is anonymous (common for JWT API calls at middleware level),
            # try to manually authenticate via JWT if a header exists.
            if not user or not user.is_authenticated:
                try:
                    auth = JWTAuthentication()
                    header = auth.get_header(request)
                    if header:
                        raw_token = auth.get_raw_token(header)
                        validated_token = auth.get_validated_token(raw_token)
                        user = auth.get_user(validated_token)
                except (AuthenticationFailed, Exception):
                    user = None
            
            # Set context if we found a valid user
            if user and user.is_authenticated:
                # Block inactive organizations (bypass for superadmins)
                if user.organization and not user.organization.is_active and not user.is_superadmin():
                    from django.http import JsonResponse
                    return JsonResponse({
                        'error': 'Organization is inactive',
                        'detail': 'Your organization has been deactivated. Please contact the administrator.'
                    }, status=403)

                _user_var.set(user)
                _organization_var.set(getattr(user, 'organization', None))
            
            response = self.get_response(request)
            return response
            
        finally:
            # Clean up context variables after the request
            _organization_var.reset(token_org)
            _user_var.reset(token_user)
