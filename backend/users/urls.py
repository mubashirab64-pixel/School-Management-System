from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    UserRegistrationView,
    UserLoginView,
    UserProfileView,
    UserListView,
    check_email_exists,
    current_user_profile,
    upload_my_photo,
    check_password_change_required,
    first_login_change_password,
    send_password_change_otp,
    verify_password_change_otp,
    change_password_with_otp,
    send_forgot_password_otp,
    verify_forgot_password_otp,
    reset_password_with_otp,
    get_role_permissions,
    toggle_permission,
    get_my_permissions,
    OrganizationListCreateView,
    OrganizationDetailView,
    OrganizationDashboardView,
    SubscriptionPlanListCreateView,
    SubscriptionPlanDetailView,
    UserDetailView,
    admin_reset_password,
    student_direct_password_change,
    OrgStaffListView,
    switch_user_role,
    toggle_user_active,
    get_current_version,
    release_new_version,
    sidebar_badges,
)

urlpatterns = [
    # Subscription plans list for dropdowns
    path('plans/', SubscriptionPlanListCreateView.as_view(), name='plan_list_create'),
    path('plans/<int:pk>/', SubscriptionPlanDetailView.as_view(), name='plan_detail'),
    
    # Authentication endpoints
    path('auth/login/', UserLoginView.as_view(), name='user_login'),
    path('auth/register/', UserRegistrationView.as_view(), name='user_register'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # User management endpoints
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    path('current-user/', current_user_profile, name='current_user_profile'),
    path('current-user/upload-photo/', upload_my_photo, name='upload_my_photo'),
    path('sidebar-badges/', sidebar_badges, name='sidebar_badges'),
    path('users/', UserListView.as_view(), name='user_list'),
    path('users/check-email/', check_email_exists, name='check_email_exists'),
    path('users/org-staff/', OrgStaffListView.as_view(), name='org_staff_list'),
    path('users/<int:pk>/reset-password/', admin_reset_password, name='admin_reset_password'),
    path('users/<int:pk>/switch-role/', switch_user_role, name='switch_user_role'),
    path('users/<int:pk>/toggle-active/', toggle_user_active, name='toggle_user_active'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user_detail'),

    # Permission management endpoints
    path('permissions/', get_role_permissions, name='get_role_permissions'),
    path('permissions/toggle/', toggle_permission, name='toggle_permission'),
    path('permissions/my/', get_my_permissions, name='get_my_permissions'),

    # Direct first-login password change (no OTP)
    path('first-login-change-password/', first_login_change_password, name='first_login_change_password'),

    # Password change OTP endpoints
    path('check-password-change-required/', check_password_change_required, name='check_password_change_required'),
    path('send-password-change-otp/', send_password_change_otp, name='send_password_change_otp'),
    path('verify-password-change-otp/', verify_password_change_otp, name='verify_password_change_otp'),
    path('change-password-with-otp/', change_password_with_otp, name='change_password_with_otp'),

    # Forgot password OTP endpoints
    path('send-forgot-password-otp/', send_forgot_password_otp, name='send_forgot_password_otp'),
    path('verify-forgot-password-otp/', verify_forgot_password_otp, name='verify_forgot_password_otp'),
    path('reset-password-with-otp/', reset_password_with_otp, name='reset_password_with_otp'),

    # Student direct password change (first login, no OTP)
    path('student-direct-change-password/', student_direct_password_change, name='student_direct_password_change'),

    # Organization management (SuperAdmin CRUD + Org Admin dashboard)
    path('organizations/', OrganizationListCreateView.as_view(), name='organization_list_create'),
    path('organizations/my-dashboard/', OrganizationDashboardView.as_view(), name='organization_dashboard'),
    path('organizations/<int:pk>/', OrganizationDetailView.as_view(), name='organization_detail'),

    # System version
    path('version/', get_current_version, name='get_current_version'),
    path('version/release/', release_new_version, name='release_new_version'),
]
