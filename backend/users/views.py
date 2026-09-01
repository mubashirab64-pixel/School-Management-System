from django.db import models
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from django.conf import settings
import requests as http_requests
from .models import User, PasswordChangeOTP, RolePermission, Organization, SubscriptionPlan, SystemVersion
from .serializers import (
    UserSerializer, UserRegistrationSerializer, UserLoginSerializer,
    RolePermissionSerializer, OrganizationSerializer, OrganizationCreateSerializer,
    SubscriptionPlanSerializer, UserUpdateSerializer, SystemVersionSerializer
)
from .permissions import IsSuperAdmin, IsOrgAdmin, IsPrincipal, IsCoordinator, IsTeacher, IsAdmin
from .validators import validate_password_strength
from services.email_notification_service import EmailNotificationService
from notifications.services import create_notification
import secrets

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_email_exists(request):
    """Return whether a user or any related entity exists with the given email (case-insensitive)."""
    email = request.query_params.get('email')
    if not email:
        return Response({'error': 'email query param is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    # 1. Check User table
    if User.objects.filter(email__iexact=email).exists():
        return Response({'exists': True})
    
    # 2. Check Entity tables
    try:
        from principals.models import Principal
        if Principal.objects.filter(email__iexact=email).exists():
            return Response({'exists': True})
    except ImportError: pass

    try:
        from teachers.models import Teacher
        if Teacher.objects.filter(email__iexact=email).exists():
            return Response({'exists': True})
    except ImportError: pass

    try:
        from coordinator.models import Coordinator
        if Coordinator.objects.filter(email__iexact=email).exists():
            return Response({'exists': True})
    except ImportError: pass

    try:
        from students.models import Student
        # Students might not have unique emails or emails at all, but checking for safety
        if hasattr(Student, 'email') and Student.objects.filter(email__iexact=email).exists():
            return Response({'exists': True})
    except ImportError: pass

    return Response({'exists': False})

class UserRegistrationView(generics.CreateAPIView):
    """
    User registration endpoint
    Only SuperAdmin and Principal can create users
    """
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [IsAuthenticated, (IsSuperAdmin | IsOrgAdmin | IsPrincipal)]

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied

        requesting_user = self.request.user

        org = serializer.validated_data.get('organization') or getattr(requesting_user, 'organization', None)

        if org and not requesting_user.is_superadmin():
            current_count = User.objects.filter(organization=org).count()
            if current_count >= org.max_users:
                raise PermissionDenied(
                    f"User quota exceeded. Your plan allows a maximum of "
                    f"{org.max_users} user(s). You currently have {current_count}. "
                    f"Please upgrade your subscription to add more users."
                )

        serializer.save()

class UserLoginView(generics.GenericAPIView):
    """
    User login endpoint
    """
    serializer_class = UserLoginSerializer
    permission_classes = [AllowAny]

    def _verify_turnstile(self, token):
        # Skip in DEBUG mode (local development)
        if settings.DEBUG:
            return True

        secret = getattr(settings, 'TURNSTILE_SECRET_KEY', '')
        if not secret:
            return True
        try:
            resp = http_requests.post(
                'https://challenges.cloudflare.com/turnstile/v0/siteverify',
                data={'secret': secret, 'response': token},
                timeout=5,
            )
            result = resp.json()
            print(f"[Turnstile] success={result.get('success')} errors={result.get('error-codes')}")
            return result.get('success', False)
        except Exception as e:
            print(f"[Turnstile] Exception: {e}")
            return False

    def post(self, request):
        # Cloudflare Turnstile verification
        turnstile_token = request.data.get('recaptcha_token', '') or request.data.get('cf_turnstile_token', '')
        if not turnstile_token:
            return Response({
                'error': 'Verification required. Please complete the security check.'
            }, status=status.HTTP_400_BAD_REQUEST)
        if not self._verify_turnstile(turnstile_token):
            return Response({
                'error': 'Verification failed. Please try again.'
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email_or_code = serializer.validated_data['email']
        password = serializer.validated_data['password']

        # Find user first (for lockout check)
        try:
            lookup_user = User.objects.get(
                models.Q(email__iexact=email_or_code) | models.Q(username__iexact=email_or_code)
            )
        except User.DoesNotExist:
            lookup_user = None
        except User.MultipleObjectsReturned:
            lookup_user = User.objects.filter(
                models.Q(email__iexact=email_or_code) | models.Q(username__iexact=email_or_code)
            ).first()

        # Check lockout before authenticating
        if lookup_user and lookup_user.lockout_until:
            remaining = (lookup_user.lockout_until - timezone.now()).total_seconds()
            if remaining > 0:
                minutes = int(remaining // 60)
                seconds = int(remaining % 60)
                return Response({
                    'error': 'account_locked',
                    'message': f'Account locked. Try again in {minutes}m {seconds}s.',
                    'lockout_seconds': int(remaining),
                }, status=status.HTTP_429_TOO_MANY_REQUESTS)
            else:
                # Lockout expired — reset
                lookup_user.failed_login_attempts = 0
                lookup_user.lockout_until = None
                lookup_user.save(update_fields=['failed_login_attempts', 'lockout_until'])

        # Authenticate using custom backend (supports both email and username)
        user = authenticate(request, username=email_or_code, password=password)

        if user and user.is_active:
            # Reset failed attempts on successful login
            if user.failed_login_attempts > 0 or user.lockout_until:
                user.failed_login_attempts = 0
                user.lockout_until = None
                user.save(update_fields=['failed_login_attempts', 'lockout_until'])

            # Check if organization is active (for non-superadmins)
            if user.organization and not user.organization.is_active and not user.is_superadmin():
                return Response({
                    'error': 'Your organization is inactive. Please contact your administrator.'
                }, status=status.HTTP_403_FORBIDDEN)

            # Sync email from profile if needed (Self-healing for email mismatches)
            self._sync_email_from_profile(user)

            # Check if user needs to change password
            if not user.has_changed_default_password:
                # Students get a direct session token (no email OTP required)
                if user.role == 'student':
                    otp_entry = PasswordChangeOTP.objects.create(
                        user=user,
                        otp_code='000000',
                    )
                    return Response({
                        'requires_password_change': True,
                        'requires_direct_change': True,
                        'user_role': user.role,
                        'user_email': user.email,
                        'change_session_token': otp_entry.session_token,
                        'message': 'Password change required.'
                    }, status=status.HTTP_200_OK)
                return Response({
                    'requires_password_change': True,
                    'user_email': user.email,
                    'message': 'Password change required. Please verify your email to proceed.'
                }, status=status.HTTP_200_OK)

            # Generate JWT tokens (embed token_version for session invalidation)
            refresh = RefreshToken.for_user(user)
            refresh['token_version'] = user.token_version

            # Update last login timestamp + IP
            user.last_login = timezone.now()
            user.last_login_ip = self.get_client_ip(request)
            user.save(update_fields=['last_login', 'last_login_ip'])
            
            # Get complete user profile
            user_profile = self.get_complete_user_profile(user)
            
            # Build organization context
            org_data = None
            if user.organization:
                org = user.organization
                org_data = {
                    'id': org.id,
                    'name': org.name,
                    'max_users': org.max_users,
                    'max_students': org.max_students,
                    'max_campuses': org.max_campuses,
                    'used_users': org.organization_users.count(),
                    'used_students': org.students.count(),
                    'used_campuses': org.campuses.count(),
                    'enabled_features': org.enabled_features,
                }
            
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': user_profile,
                'organization': org_data,
                'requires_password_change': False
            }, status=status.HTTP_200_OK)
        
        # Wrong password — increment failed attempts
        MAX_ATTEMPTS = 5
        LOCKOUT_MINUTES = 15
        if lookup_user:
            lookup_user.failed_login_attempts += 1
            remaining_attempts = MAX_ATTEMPTS - lookup_user.failed_login_attempts
            if lookup_user.failed_login_attempts >= MAX_ATTEMPTS:
                lookup_user.lockout_until = timezone.now() + timezone.timedelta(minutes=LOCKOUT_MINUTES)
                lookup_user.save(update_fields=['failed_login_attempts', 'lockout_until'])
                return Response({
                    'error': 'account_locked',
                    'message': f'Account locked due to too many failed attempts. Try again in {LOCKOUT_MINUTES} minutes.',
                    'lockout_seconds': LOCKOUT_MINUTES * 60,
                }, status=status.HTTP_429_TOO_MANY_REQUESTS)
            else:
                lookup_user.save(update_fields=['failed_login_attempts'])
                return Response({
                    'error': 'Invalid credentials',
                    'attempts_remaining': remaining_attempts,
                    'message': f'Invalid credentials. {remaining_attempts} attempt(s) remaining before lockout.',
                }, status=status.HTTP_401_UNAUTHORIZED)

        return Response({
            'error': 'Invalid credentials'
        }, status=status.HTTP_401_UNAUTHORIZED)

    def _sync_email_from_profile(self, user):
        """
        Check if user's email matches their profile email.
        If not, update user email to match profile (Source of Truth).
        """
        try:
            profile_email = None
            
            if user.role == 'teacher':
                from teachers.models import Teacher
                try:
                    # Try getting by employee code (username)
                    teacher = Teacher.objects.get(employee_code=user.username)
                    if teacher.email:
                        profile_email = teacher.email
                except Teacher.DoesNotExist:
                    pass
                    
            elif user.role == 'coordinator':
                from coordinator.models import Coordinator
                try:
                    coordinator = Coordinator.get_for_user(user)
                    if coordinator and coordinator.email:
                        profile_email = coordinator.email
                except Exception:
                    pass
                    
            elif user.role == 'principal':
                from principals.models import Principal
                try:
                    principal = Principal.objects.get(employee_code=user.username)
                    if principal.email:
                        profile_email = principal.email
                except Principal.DoesNotExist:
                    pass
            
            # If we found a profile email and it differs from auth user email
            if profile_email and profile_email != user.email:
                print(f"[AUTO-SYNC] Updating User email from {user.email} to {profile_email} (from {user.role} profile)")
                
                # Check if this email is already taken by another user (safety check)
                if not User.objects.exclude(pk=user.pk).filter(email=profile_email).exists():
                    user.email = profile_email
                    user.save(update_fields=['email'])
                else:
                    print(f"[AUTO-SYNC] Skipped: Email {profile_email} already in use by another user")
                    
        except Exception as e:
            print(f"[AUTO-SYNC] Error syncing email: {str(e)}")
    
    def get_complete_user_profile(self, user):
        """Get complete user profile based on role"""
        profile_data = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'is_active': user.is_active,
            'first_name': user.first_name,
            'last_name': user.last_name,
        }
        
        if user.role == 'principal':
            try:
                from principals.models import Principal
                principal = Principal.objects.get(employee_code=user.username)
                profile_data.update({
                    'principal_id': principal.id,
                    'campus_id': principal.campus.id if principal.campus else None,
                    'campus_name': principal.campus.campus_name if principal.campus else None,
                    'campus_code': principal.campus.campus_code if principal.campus else None,
                    'full_name': principal.full_name,
                    'contact_number': principal.contact_number,
                    'employee_code': principal.employee_code,
                    'shift': principal.shift,
                    'signature': principal.signature,
                })
            except Principal.DoesNotExist:
                pass
                
        elif user.role == 'coordinator':
            try:
                from coordinator.models import Coordinator
                coordinator = Coordinator.get_for_user(user)
                if coordinator:
                    profile_data.update({
                        'coordinator_id': coordinator.id,
                        'campus_id': coordinator.campus.id if coordinator.campus else None,
                        'campus_name': coordinator.campus.campus_name if coordinator.campus else None,
                        'campus_code': coordinator.campus.campus_code if coordinator.campus else None,
                        'level_id': coordinator.level.id if coordinator.level else None,
                        'level_name': coordinator.level.name if coordinator.level else None,
                        'full_name': coordinator.full_name,
                        'contact_number': coordinator.contact_number,
                        'employee_code': coordinator.employee_code,
                        'signature': coordinator.signature,
                    })
            except Exception:
                # Swallow errors and return base profile_data
                pass
                
        elif user.role == 'teacher':
            try:
                from teachers.models import Teacher
                teacher = Teacher.objects.get(employee_code=user.username)
                # Build list of all assigned classrooms (M2M + FK back-ref)
                m2m_ids = set(teacher.assigned_classrooms.values_list('id', flat=True))
                fk_ids = set(teacher.classroom_set.values_list('id', flat=True))
                all_cr_ids = m2m_ids | fk_ids
                from classes.models import ClassRoom
                all_classrooms = ClassRoom.objects.filter(id__in=all_cr_ids).select_related('grade', 'grade__level', 'grade__level__campus')
                classrooms_list = []
                for cr in all_classrooms:
                    classrooms_list.append({
                        'id': cr.id,
                        'name': f"{cr.grade.name}-{cr.section}",
                        'grade': cr.grade.name if cr.grade else None,
                        'section': cr.section,
                        'shift': cr.shift,
                        'code': cr.code,
                    })
                profile_data.update({
                    'teacher_id': teacher.id,
                    'campus_id': teacher.current_campus.id if teacher.current_campus else None,
                    'campus_name': teacher.current_campus.campus_name if teacher.current_campus else None,
                    'full_name': teacher.full_name,
                    'contact_number': teacher.contact_number,
                    'employee_code': teacher.employee_code,
                    'shift': teacher.shift,
                    'photo': teacher.photo.url if teacher.photo else None,
                    'assigned_classroom_id': teacher.assigned_classroom.id if teacher.assigned_classroom else None,
                    'assigned_classroom_name': f"{teacher.assigned_classroom.grade.name}-{teacher.assigned_classroom.section}" if teacher.assigned_classroom else None,
                    'is_class_teacher': teacher.is_class_teacher,
                    'is_teacher_assistant': teacher.is_teacher_assistant,
                    'assigned_classrooms': classrooms_list,
                    'signature': teacher.signature,
                })
            except Teacher.DoesNotExist:
                pass
        
        elif user.role == 'student':
            try:
                from students.models import Student
                student = Student.objects.get(student_id=user.username)
                profile_data.update({
                    'student_db_id': student.id,
                    'student_id': student.student_id,
                    'student_code': student.student_code,
                    'gr_no': student.gr_no,
                    'name': student.name,
                    'gender': student.gender,
                    'campus_id': student.campus.id if student.campus else None,
                    'campus_name': student.campus.campus_name if student.campus else None,
                    'classroom_id': student.classroom.id if student.classroom else None,
                    'classroom_name': (
                        f"{student.classroom.grade.name}-{student.classroom.section}"
                        if student.classroom else None
                    ),
                    'current_grade': student.current_grade,
                    'section': student.section,
                    'shift': student.shift,
                    'enrollment_year': student.enrollment_year,
                    'father_name': student.father_name,
                    'photo': student.photo.url if student.photo else None,
                })
            except Student.DoesNotExist:
                pass

        # Add permissions for this user's role
        # Fetch dynamic permissions from database for ALL roles (including superadmin)
        # Must be scoped to the user's organization, otherwise rows from other
        # orgs (or the global template) override the org-specific toggles.
        role_perms = RolePermission.objects.filter(role=user.role, organization=user.organization)
        permissions = {rp.permission_codename: rp.is_allowed for rp in role_perms}
        # Ensure all permission codes exist (default True for superadmin, False for others)
        default_value = user.role == 'superadmin'
        for perm_code, _ in RolePermission.PERMISSION_CHOICES:
            if perm_code not in permissions:
                permissions[perm_code] = default_value
        
        profile_data['permissions'] = permissions
        return profile_data
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    User profile management
    """
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

class UserListView(generics.ListAPIView):
    """
    List users based on role permissions, filtered by organization
    """
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role_param = self.request.query_params.get('role')

        if user.is_superadmin():
            # SuperAdmin sees all users across all organizations
            qs = User.objects.all()
            # Default filter: if no role provided, show management roles only to keep list clean
            if not role_param:
                qs = qs.filter(role__in=['admin', 'org_admin'])
        elif user.role == 'admin':
            # Reseller Admin: See users in organizations they created
            qs = User.objects.filter(organization__created_by=user)
            # Default filter: if no role provided, show org admins they manage
            if not role_param:
                qs = qs.filter(role='org_admin')
        elif user.organization:
            # Org-bound users only see users in their own organization
            qs = User.objects.filter(organization=user.organization)
        else:
            qs = User.objects.filter(id=user.id)

        if role_param:
            qs = qs.filter(role=role_param)
        return qs

class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a user.
    """
    queryset = User.objects.all()
    serializer_class = UserUpdateSerializer
    permission_classes = [IsAuthenticated, (IsSuperAdmin | IsOrgAdmin)]

    def get_queryset(self):
        user = self.request.user
        if user.is_superadmin():
            return User.objects.all()
        elif user.organization:
            return User.objects.filter(organization=user.organization)
        return User.objects.filter(id=user.id)

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_reset_password(request, pk):
    """
    Reset a user's password directly (SuperAdmin only).
    """
    try:
        user = User.objects.get(pk=pk)
        new_password = request.data.get('password')
        if not new_password:
            return Response({'error': 'password is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate strength
        try:
            validate_password_strength(new_password)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
        user.set_password(new_password)
        user.has_changed_default_password = False
        user.save()

        try:
            from attendance.models import AuditLog
            AuditLog.objects.create(
                feature=getattr(user, 'role', 'user') if getattr(user, 'role', 'user') in ('student','teacher','coordinator','principal','org_admin') else 'user',
                action='password_change',
                entity_type='User',
                entity_id=user.id,
                organization=user.organization,
                user=request.user,
                ip_address=request.META.get('REMOTE_ADDR'),
                changes={
                    'name': user.get_full_name() or user.username,
                    'email': user.email,
                    'role': user.role,
                    'changed_by': request.user.username,
                    'changed_by_role': request.user.role,
                    'source': 'admin_reset',
                },
            )
        except Exception:
            pass

        return Response({'message': 'Password reset successfully'})
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

# @api_view(['POST'])
# @permission_classes([AllowAny])
# def refresh_token_view(request):
#     """
#     Refresh JWT token
#     """
#     refresh_token = request.data.get('refresh')
#     
#     if not refresh_token:
#         return Response({'error': 'Refresh token required'}, status=status.HTTP_400_BAD_REQUEST)
#     
#     try:
#         refresh = RefreshToken(refresh_token)
#         access_token = refresh.access_token
#         
#         return Response({
#             'access': str(access_token)
#         }, status=status.HTTP_200_OK)
#     
#     except Exception as e:
#         return Response({'error': 'Invalid refresh token'}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def upload_my_photo(request):
    """
    Any authenticated user can upload their own profile photo.
    Used by accounts_officer and other roles without a separate entity model.
    """
    photo = request.FILES.get('photo')
    if not photo:
        return Response({'error': 'No photo provided'}, status=status.HTTP_400_BAD_REQUEST)
    user = request.user
    user.photo = photo
    user.save(update_fields=['photo'])
    
    # --- Sync with Role-specific entities if they exist ---
    try:
        if user.role == 'teacher':
            from teachers.models import Teacher
            teacher = Teacher.objects.filter(employee_code=user.username).first()
            if teacher:
                teacher.photo = photo
                teacher.save(update_fields=['photo'])
                
        elif user.role == 'student':
            from students.models import Student
            student = Student.objects.filter(student_id=user.username).first()
            if student:
                student.photo = photo
                student.save(update_fields=['photo'])
                
        elif user.role == 'coordinator':
            from coordinator.models import Coordinator
            coordinator = Coordinator.objects.filter(employee_code=user.username).first()
            if coordinator:
                coordinator.photo = photo
                coordinator.save(update_fields=['photo'])
                
        elif user.role == 'principal':
            from principals.models import Principal
            principal = Principal.objects.filter(employee_code=user.username).first()
            if principal:
                principal.photo = photo
                principal.save(update_fields=['photo'])
    except Exception as e:
        # Log error but return success since primary user photo was saved
        print(f"[DEBUG] Error syncing photo to entity: {str(e)}")

    photo_url = request.build_absolute_uri(user.photo.url) if user.photo else None
    return Response({
        'message': 'Photo uploaded successfully',
        'photo': photo_url
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user_profile(request):
    """
    Get current user's profile with complete role-specific data
    """
    user = request.user
    
    # Base user data
    user_data = {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'role': user.role,
        'photo': request.build_absolute_uri(user.photo.url) if getattr(user, 'photo', None) else None,
        'campus': {
            'id': user.campus.id,
            'campus_name': user.campus.campus_name,
            'campus_code': user.campus.campus_code,
        } if user.campus else None,
    }
    
    # Add role-specific data with complete profile information
    if user.role == 'teacher':
        try:
            from teachers.models import Teacher
            teacher = Teacher.objects.get(employee_code=user.username)
            # Fall back to the Teacher's own photo when the User has none (admins
            # upload staff photos onto the role record, not the User account).
            if not user_data['photo'] and getattr(teacher, 'photo', None):
                user_data['photo'] = request.build_absolute_uri(teacher.photo.url)
            # Build assigned_classrooms list (supports multi-class assignment)
            assigned_list = []
            try:
                # 1. ManyToMany assignments
                m2m_ids = set(teacher.assigned_classrooms.values_list('id', flat=True))
                # 2. FK back-references (ClassRoom.class_teacher)
                fk_ids = set(teacher.classroom_set.values_list('id', flat=True))
                # 3. Legacy FK
                legacy_id = teacher.assigned_classroom.id if teacher.assigned_classroom else None
                
                all_ids = m2m_ids | fk_ids
                if legacy_id:
                    all_ids.add(legacy_id)
                
                from classes.models import ClassRoom
                for cr in ClassRoom.objects.filter(id__in=all_ids).select_related('grade', 'grade__level'):
                    assigned_list.append({
                        'id': cr.id,
                        'name': str(cr),
                        'grade': cr.grade.name if cr.grade else None,
                        'section': cr.section,
                        'shift': cr.shift,
                        'code': cr.code,
                        'grade_id': cr.grade.id if cr.grade else None,
                        'level_id': cr.grade.level.id if cr.grade and cr.grade.level else None,
                        'level_name': cr.grade.level.name if cr.grade and cr.grade.level else None,
                    })
            except Exception as e:
                print(f"[DEBUG] Error building assigned_list: {str(e)}")
                assigned_list = []

            user_data.update({
                'teacher_id': teacher.id,
                'full_name': teacher.full_name,
                'dob': teacher.dob,
                'gender': teacher.gender,
                'contact_number': teacher.contact_number,
                'email': teacher.email,
                'cnic': teacher.cnic,
                'permanent_address': teacher.permanent_address,
                'education_level': teacher.education_level,
                'institution_name': teacher.institution_name,
                'year_of_passing': teacher.year_of_passing,
                'total_experience_years': teacher.total_experience_years,
                'profile_image': user_data['photo'],  # Unified
                'employee_code': teacher.employee_code,
                'joining_date': teacher.joining_date,
                'is_class_teacher': teacher.is_class_teacher,
                'is_currently_active': teacher.is_currently_active,
                # Prefer legacy single assignment if present; otherwise default to first in list for compatibility
                'assigned_classroom': ({
                    'id': teacher.assigned_classroom.id,
                    'name': str(teacher.assigned_classroom),
                    'grade': teacher.assigned_classroom.grade.name if teacher.assigned_classroom.grade else None,
                    'section': teacher.assigned_classroom.section,
                    'shift': teacher.assigned_classroom.shift,
                    'grade_id': teacher.assigned_classroom.grade.id if teacher.assigned_classroom.grade else None,
                    'level_id': teacher.assigned_classroom.grade.level.id if teacher.assigned_classroom.grade and teacher.assigned_classroom.grade.level else None,
                    'level_name': teacher.assigned_classroom.grade.level.name if teacher.assigned_classroom.grade and teacher.assigned_classroom.grade.level else None,
                } if teacher.assigned_classroom else (
                    assigned_list[0] if assigned_list else None
                )),
                'assigned_classrooms': assigned_list,
                'current_campus': {
                    'id': teacher.current_campus.id,
                    'campus_name': teacher.current_campus.campus_name,
                    'campus_code': teacher.current_campus.campus_code,
                    'academic_year_start_month': teacher.current_campus.academic_year_start_month,
                    'academic_year_end_month': teacher.current_campus.academic_year_end_month,
                } if teacher.current_campus else None,
                'signature': teacher.signature,
                'created_at': teacher.date_created,
                'updated_at': teacher.date_updated,
            })
        except Teacher.DoesNotExist:
            pass
    elif user.role == 'coordinator':
        try:
            from coordinator.models import Coordinator
            coordinator = Coordinator.get_for_user(user)
            if coordinator:
                if not user_data['photo'] and getattr(coordinator, 'photo', None):
                    user_data['photo'] = request.build_absolute_uri(coordinator.photo.url)
                user_data.update({
                    'coordinator_id': coordinator.id,
                    'full_name': coordinator.full_name,
                    'photo': user_data['photo'],  # Unified
                    'dob': coordinator.dob,
                    'gender': coordinator.gender,
                    'contact_number': coordinator.contact_number,
                    'email': coordinator.email,
                    'cnic': coordinator.cnic,
                    'permanent_address': coordinator.permanent_address,
                    'marital_status': coordinator.marital_status,
                    'religion': coordinator.religion,
                    'education_level': coordinator.education_level,
                    'institution_name': coordinator.institution_name,
                    'year_of_passing': coordinator.year_of_passing,
                    'total_experience_years': coordinator.total_experience_years,
                    'employee_code': coordinator.employee_code,
                    'joining_date': coordinator.joining_date,
                    'is_currently_active': coordinator.is_currently_active,
                    'can_assign_class_teachers': coordinator.can_assign_class_teachers,
                    'level': {
                        'id': coordinator.level.id,
                        'name': coordinator.level.name,
                        'code': coordinator.level.code,
                    } if coordinator.level else None,
                    'assigned_levels': [
                        {'id': l.id, 'name': l.name, 'shift': l.shift}
                        for l in coordinator.assigned_levels.all()
                    ],
                    'campus': {
                        'id': coordinator.campus.id,
                        'campus_name': coordinator.campus.campus_name,
                        'campus_code': coordinator.campus.campus_code,
                        'academic_year_start_month': coordinator.campus.academic_year_start_month,
                        'academic_year_end_month': coordinator.campus.academic_year_end_month,
                    } if coordinator.campus else None,
                    'signature': coordinator.signature,
                    'created_at': coordinator.created_at,
                    'updated_at': coordinator.updated_at,
                })
        except Exception:
            pass
    elif user.role == 'principal':
        try:
            from principals.models import Principal
            principal = Principal.objects.get(employee_code=user.username)
            if not user_data['photo'] and getattr(principal, 'photo', None):
                user_data['photo'] = request.build_absolute_uri(principal.photo.url)
            user_data.update({
                'principal_id': principal.id,
                'full_name': principal.full_name,
                'photo': user_data['photo'],  # Unified
                'dob': principal.dob,
                'gender': principal.gender,
                'contact_number': principal.contact_number,
                'email': principal.email,
                'cnic': principal.cnic,
                'permanent_address': principal.permanent_address,
                'education_level': principal.education_level,
                'degree_title': principal.degree_title,
                'institution_name': principal.institution_name,
                'year_of_passing': principal.year_of_passing,
                'total_experience_years': principal.total_experience_years,
                'specialization': principal.specialization,
                'designation': principal.designation,
                'contract_type': principal.contract_type,
                'employee_code': principal.employee_code,
                'joining_date': principal.joining_date,
                'is_currently_active': principal.is_currently_active,
                'status': principal.status,
                'shift': principal.shift,
                'campus': {
                    'id': principal.campus.id,
                    'campus_name': principal.campus.campus_name,
                    'campus_code': principal.campus.campus_code,
                    'academic_year_start_month': principal.campus.academic_year_start_month,
                    'academic_year_end_month': principal.campus.academic_year_end_month,
                } if principal.campus else None,
                'signature': principal.signature,
                'created_at': principal.created_at,
                'updated_at': principal.updated_at,
            })
        except Principal.DoesNotExist:
            pass
    elif user.role == 'student':
        try:
            from students.models import Student
            from django.db.models.query import QuerySet
            # Bypass OrganizationManager — match by student_id == username
            student = (
                QuerySet(Student)
                .select_related('campus', 'classroom', 'classroom__grade')
                .get(student_id=user.username, is_deleted=False)
            )
            if not user_data['photo'] and getattr(student, 'photo', None):
                user_data['photo'] = request.build_absolute_uri(student.photo.url)
            user_data.update({
                'student_db_id': student.id,
                'student_id': student.student_id,
                'student_code': student.student_code,
                'gr_no': student.gr_no,
                'name': student.name,
                'gender': student.gender,
                'dob': student.dob,
                'phone_number': str(student.phone_number) if student.phone_number else None,
                'address': student.address,
                'father_name': student.father_name,
                'father_contact': str(student.father_contact) if student.father_contact else None,
                'mother_name': student.mother_name,
                'guardian_name': student.guardian_name,
                'photo': user_data['photo'],  # Unified
                'current_grade': student.current_grade,
                'section': student.section,
                'shift': student.shift,
                'enrollment_year': student.enrollment_year,
                'enrollment_status': student.enrollment_status,
                'is_active': student.is_active,
                'classroom': {
                    'id': student.classroom.id,
                    'name': str(student.classroom),
                    'grade': student.classroom.grade.name if student.classroom.grade else None,
                    'section': student.classroom.section,
                } if student.classroom else None,
                'campus': {
                    'id': student.campus.id,
                    'campus_name': student.campus.campus_name,
                    'campus_code': student.campus.campus_code,
                } if student.campus else None,
            })
        except Student.DoesNotExist:
            pass
    
    elif user.role == 'accounts_officer':
        user_data.update({
            'full_name': f"{user.first_name} {user.last_name}".strip() or user.username,
            'contact_number': getattr(user, 'phone_number', None),
            'joining_date': getattr(user, 'date_joined', None),
            'photo': user_data['photo'], # Unified
        })

    # Add role-based permissions for this user
    from .models import RolePermission
    role_perms = RolePermission.objects.filter(role=user.role, organization=user.organization)
    permissions = {rp.permission_codename: rp.is_allowed for rp in role_perms}
    
    # Add any missing permissions with default values
    # Default is True for SuperAdmin, False for others
    is_sa = user.role == 'superadmin'
    for code, _ in RolePermission.PERMISSION_CHOICES:
        if code not in permissions:
            permissions[code] = is_sa
            
    user_data['permissions'] = permissions
    
    return Response(user_data)

# @api_view(['POST'])
# @permission_classes([IsAuthenticated])
# def logout_view(request):
#     """
#     Logout user (blacklist refresh token)
#     """
#     try:
#         refresh_token = request.data.get('refresh')
#         if refresh_token:
#             token = RefreshToken(refresh_token)
#             token.blacklist()
#         
#         return Response({'message': 'Successfully logged out'}, status=status.HTTP_200_OK)
#     
#     except Exception as e:
#         return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)


# Password Change OTP Endpoints

@api_view(['POST'])
@permission_classes([AllowAny])
def check_password_change_required(request):
    """
    Check if user needs to change password
    """
    try:
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(email=email)
            requires_change = not user.has_changed_default_password
            return Response({
                'requires_change': requires_change,
                'user_email': user.email
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def first_login_change_password(request):
    """
    Direct password change for first-time login users (no OTP required).
    Only works if has_changed_default_password=False.
    """
    try:
        email = request.data.get('email')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if not all([email, new_password, confirm_password]):
            return Response({'error': 'Email, new password and confirm password are required'}, status=status.HTTP_400_BAD_REQUEST)

        if new_password != confirm_password:
            return Response({'error': 'Passwords do not match'}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 8:
            return Response({'error': 'Password must be at least 8 characters'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        if user.has_changed_default_password:
            return Response({'error': 'Password has already been changed'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.has_changed_default_password = True
        user.save()

        try:
            from attendance.models import AuditLog
            AuditLog.objects.create(
                feature=getattr(user, 'role', 'user') if getattr(user, 'role', 'user') in ('student','teacher','coordinator','principal','org_admin') else 'user',
                action='password_change',
                entity_type='User',
                entity_id=user.id,
                organization=user.organization,
                user=None,
                ip_address=request.META.get('REMOTE_ADDR'),
                changes={
                    'name': user.get_full_name() or user.username,
                    'email': user.email,
                    'role': user.role,
                    'changed_by': user.username,
                    'changed_by_role': user.role,
                    'source': 'first_login',
                },
            )
        except Exception:
            pass

        return Response({'message': 'Password changed successfully'}, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def send_password_change_otp(request):
    """
    Send OTP for password change verification
    """
    try:
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(email=email)
            
            # Check if user needs password change
            if user.has_changed_default_password:
                return Response({
                    'error': 'User has already changed password'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create new OTP (invalidate any existing ones)
            PasswordChangeOTP.objects.filter(user=user, is_used=False).update(is_used=True)
            otp_obj = PasswordChangeOTP.objects.create(user=user)
            
            # Send OTP email
            success, message = EmailNotificationService.send_password_change_otp_email(
                user, otp_obj.otp_code
            )
            
            if success:
                return Response({
                    'message': 'OTP sent successfully',
                    'expires_in': 300  # 5 minutes
                }, status=status.HTTP_200_OK)
            else:
                return Response({'error': message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_password_change_otp(request):
    """
    Verify OTP code for password change
    """
    try:
        email = request.data.get('email')
        otp_code = request.data.get('otp_code')
        
        if not email or not otp_code:
            return Response({
                'error': 'Email and OTP code are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(email=email)
            
            # Find valid OTP
            otp_obj = PasswordChangeOTP.objects.filter(
                user=user,
                otp_code=otp_code,
                is_used=False
            ).first()
            
            if not otp_obj:
                return Response({
                    'valid': False,
                    'message': 'Invalid OTP code'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if otp_obj.is_expired():
                otp_obj.is_used = True
                otp_obj.save()
                return Response({
                    'valid': False,
                    'message': 'OTP has expired. Please request a new one.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Verify OTP
            if otp_obj.verify_otp(otp_code):
                return Response({
                    'valid': True,
                    'message': 'OTP verified successfully',
                    'session_token': otp_obj.session_token
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'valid': False,
                    'message': 'Invalid OTP code'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def change_password_with_otp(request):
    """
    Change password using OTP session token
    """
    try:
        session_token = request.data.get('session_token')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')
        
        if not all([session_token, new_password, confirm_password]):
            return Response({
                'error': 'Session token, new password, and confirm password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if new_password != confirm_password:
            return Response({
                'error': 'Passwords do not match'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Find OTP by session token
        try:
            otp_obj = PasswordChangeOTP.objects.get(
                session_token=session_token,
                is_used=True  # OTP should be used (verified)
            )
        except PasswordChangeOTP.DoesNotExist:
            return Response({
                'error': 'Invalid session token'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if session is still valid (not expired)
        if otp_obj.is_expired():
            return Response({
                'error': 'Session expired. Please request a new OTP.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = otp_obj.user
        
        # Validate password strength
        try:
            validate_password_strength(new_password, user)
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update password
        user.set_password(new_password)
        user.has_changed_default_password = True
        user.save()

        # Invalidate all existing OTPs for this user
        PasswordChangeOTP.objects.filter(user=user).update(is_used=True)

        try:
            from attendance.models import AuditLog
            AuditLog.objects.create(
                feature=getattr(user, 'role', 'user') if getattr(user, 'role', 'user') in ('student','teacher','coordinator','principal','org_admin') else 'user',
                action='password_change',
                entity_type='User',
                entity_id=user.id,
                organization=user.organization,
                user=user,
                ip_address=request.META.get('REMOTE_ADDR'),
                changes={
                    'name': user.get_full_name() or user.username,
                    'email': user.email,
                    'role': user.role,
                    'changed_by': user.username,
                    'changed_by_role': user.role,
                    'source': 'otp_self_change',
                },
            )
        except Exception:
            pass

        # Send notification to user about password change
        try:
            create_notification(
                recipient=user,
                actor=user,
                verb='password_changed',
                target_text='Your password has been changed successfully',
                data={'type': 'password_change', 'message': 'Your password was changed successfully. Please login with your new password.'}
            )
        except Exception as e:
            print(f"Error creating password change notification: {str(e)}")
        
        # If user is a teacher, notify their coordinators
        if user.is_teacher():
            try:
                # Get teacher profile using OneToOne relationship
                teacher = getattr(user, 'teacher_profile', None)
                
                if teacher and teacher.is_currently_active:
                    # Get all coordinators assigned to this teacher
                    coordinators = teacher.assigned_coordinators.filter(is_currently_active=True)
                    
                    # Get teacher name
                    teacher_name = teacher.full_name or user.get_full_name() or user.username
                    
                    for coordinator in coordinators:
                        # Find coordinator's user account
                        coordinator_user = None
                        try:
                            coordinator_user = User.objects.get(email=coordinator.email)
                        except User.DoesNotExist:
                            try:
                                coordinator_user = User.objects.get(username=coordinator.employee_code)
                            except User.DoesNotExist:
                                pass
                        
                        if coordinator_user:
                            create_notification(
                                recipient=coordinator_user,
                                actor=user,
                                verb='teacher_password_changed',
                                target_text=f'{teacher_name} has changed their password',
                                data={
                                    'type': 'teacher_password_change',
                                    'teacher_name': teacher_name,
                                    'teacher_id': teacher.id,
                                    'message': f'{teacher_name} has changed their password'
                                }
                            )
            except Exception as e:
                print(f"Error notifying coordinators about teacher password change: {str(e)}")
        
        return Response({
            'message': 'Password changed successfully. Please login again.'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def student_direct_password_change(request):
    """
    Direct password change for students on first login (no OTP required).
    Uses the change_session_token issued during login.
    """
    session_token = request.data.get('session_token')
    new_password = request.data.get('new_password')
    confirm_password = request.data.get('confirm_password')

    if not all([session_token, new_password, confirm_password]):
        return Response({'error': 'session_token, new_password and confirm_password are required'}, status=status.HTTP_400_BAD_REQUEST)

    if new_password != confirm_password:
        return Response({'error': 'Passwords do not match'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        otp_obj = PasswordChangeOTP.objects.get(session_token=session_token, is_used=False)
    except PasswordChangeOTP.DoesNotExist:
        return Response({'error': 'Invalid or expired session token'}, status=status.HTTP_400_BAD_REQUEST)

    if otp_obj.is_expired():
        return Response({'error': 'Session expired. Please login again.'}, status=status.HTTP_400_BAD_REQUEST)

    user = otp_obj.user
    if user.role != 'student':
        return Response({'error': 'This endpoint is for students only'}, status=status.HTTP_403_FORBIDDEN)

    try:
        validate_password_strength(new_password, user)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.has_changed_default_password = True
    user.save()

    PasswordChangeOTP.objects.filter(user=user).update(is_used=True)

    return Response({'message': 'Password changed successfully. Please login with your new password.'}, status=status.HTTP_200_OK)


# Forgot Password OTP Endpoints

@api_view(['POST'])
@permission_classes([AllowAny])
def send_forgot_password_otp(request):
    """
    Send OTP for forgot password - uses email only
    """
    try:
        email = request.data.get('email')
        
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Find user by email
            user = User.objects.get(email__iexact=email.strip())
            
            # Create new OTP (invalidate any existing ones)
            PasswordChangeOTP.objects.filter(user=user, is_used=False).update(is_used=True)
            otp_obj = PasswordChangeOTP.objects.create(user=user)
            
            # Send OTP email
            success, message = EmailNotificationService.send_password_change_otp_email(
                user, otp_obj.otp_code
            )
            
            if success:
                return Response({
                    'message': 'OTP sent successfully to your registered email',
                    'expires_in': 300  # 5 minutes
                }, status=status.HTTP_200_OK)
            else:
                return Response({'error': message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except User.DoesNotExist:
            return Response({
                'error': 'Email not found. Please verify your email address.'
            }, status=status.HTTP_404_NOT_FOUND)
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_forgot_password_otp(request):
    """
    Verify OTP for forgot password - uses email
    """
    try:
        email = request.data.get('email')
        otp_code = request.data.get('otp_code')
        
        if not email or not otp_code:
            return Response({
                'error': 'Email and OTP code are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Find user by email
            user = User.objects.get(email__iexact=email.strip())
            
            # Find valid OTP
            otp_obj = PasswordChangeOTP.objects.filter(
                user=user,
                otp_code=otp_code,
                is_used=False
            ).first()
            
            if not otp_obj:
                return Response({
                    'valid': False,
                    'message': 'Invalid OTP code'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if otp_obj.is_expired():
                otp_obj.is_used = True
                otp_obj.save()
                return Response({
                    'valid': False,
                    'message': 'OTP has expired. Please request a new one.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Verify OTP
            if otp_obj.verify_otp(otp_code):
                return Response({
                    'valid': True,
                    'message': 'OTP verified successfully',
                    'session_token': otp_obj.session_token
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'valid': False,
                    'message': 'Invalid OTP code'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except User.DoesNotExist:
            return Response({'error': 'Email not found'}, status=status.HTTP_404_NOT_FOUND)
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password_with_otp(request):
    """
    Reset password using verified OTP session
    """
    try:
        session_token = request.data.get('session_token')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')
        
        if not all([session_token, new_password, confirm_password]):
            return Response({
                'error': 'Session token, new password, and confirm password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if new_password != confirm_password:
            return Response({
                'error': 'Passwords do not match'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Find OTP by session token
        try:
            otp_obj = PasswordChangeOTP.objects.get(
                session_token=session_token,
                is_used=True  # OTP should be used (verified)
            )
        except PasswordChangeOTP.DoesNotExist:
            return Response({
                'error': 'Invalid session token'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if session is still valid (not expired)
        if otp_obj.is_expired():
            return Response({
                'error': 'Session expired. Please request a new OTP.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = otp_obj.user
        
        # Validate password strength
        try:
            validate_password_strength(new_password, user)
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update password
        user.set_password(new_password)
        user.has_changed_default_password = True
        user.save()
        
        # Invalidate all existing OTPs for this user
        PasswordChangeOTP.objects.filter(user=user).update(is_used=True)
        
        # Send notification to user about password reset
        try:
            create_notification(
                recipient=user,
                actor=user,
                verb='password_reset',
                target_text='Your password has been reset successfully',
                data={'type': 'password_reset', 'message': 'Your password was reset successfully. Please login with your new password.'}
            )
        except Exception as e:
            print(f"Error creating password reset notification: {str(e)}")
        
        # If user is a teacher, notify their coordinators
        if user.is_teacher():
            try:
                # Get teacher profile using OneToOne relationship
                teacher = getattr(user, 'teacher_profile', None)
                
                if teacher and teacher.is_currently_active:
                    # Get all coordinators assigned to this teacher
                    coordinators = teacher.assigned_coordinators.filter(is_currently_active=True)
                    
                    # Get teacher name
                    teacher_name = teacher.full_name or user.get_full_name() or user.username
                    
                    for coordinator in coordinators:
                        # Find coordinator's user account
                        coordinator_user = None
                        try:
                            coordinator_user = User.objects.get(email=coordinator.email)
                        except User.DoesNotExist:
                            try:
                                coordinator_user = User.objects.get(username=coordinator.employee_code)
                            except User.DoesNotExist:
                                pass
                        
                        if coordinator_user:
                            create_notification(
                                recipient=coordinator_user,
                                actor=user,
                                verb='teacher_password_changed',
                                target_text=f'{teacher_name} has changed their password',
                                data={
                                    'type': 'teacher_password_change',
                                    'teacher_name': teacher_name,
                                    'teacher_id': teacher.id,
                                    'message': f'{teacher_name} has changed their password'
                                }
                            )
            except Exception as e:
                print(f"Error notifying coordinators about teacher password change: {str(e)}")
        
        return Response({
            'message': 'Password reset successfully. Please login with your new password.'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ========================================
# Role Permission Management Endpoints
# ========================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_role_permissions(request):
    """
    Get permissions for a specific role or all roles.
    Query params: ?role=teacher (optional, if not provided returns all)
    Only SuperAdmin can access this.
    """
    if not (request.user.is_superadmin() or request.user.is_org_admin_role()):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    # Determine the target organization
    target_org = None
    if request.user.is_superadmin():
        org_id = request.query_params.get('org_id')
        if org_id:
            try:
                target_org = Organization.objects.get(id=org_id)
            except Organization.DoesNotExist:
                return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)
        # If no org_id, SuperAdmin might be viewing 'Global Defaults' (null org) or we force them to pick.
        # For now, let's allow viewing RolePermissions where organization=None for templates.
    else:
        # OrgAdmin can ONLY see their own organization
        target_org = request.user.organization
        if not target_org:
             return Response({'error': 'You are not assigned to an organization'}, status=status.HTTP_400_BAD_REQUEST)

    role = request.query_params.get('role')
    
    # Ensure all required Permission records exist for this Organization
    # This acts as an "On-the-fly Seeding" if management command wasn't run
    if target_org:
        roles_to_ensure = [r[0] for r in User.ROLE_CHOICES]
        for r in roles_to_ensure:
            # We don't manage superadmin per-org (it's global)
            if r == 'superadmin': continue
            
            for perm_code, _ in RolePermission.PERMISSION_CHOICES:
                RolePermission.objects.get_or_create(
                    organization=target_org,
                    role=r,
                    permission_codename=perm_code,
                    defaults={'is_allowed': False}
                )
    else:
        # SuperAdmin viewing 'System Defaults'
        for perm_code, _ in RolePermission.PERMISSION_CHOICES:
            RolePermission.objects.get_or_create(
                organization=None,
                role='superadmin',
                permission_codename=perm_code,
                defaults={'is_allowed': True}
            )

    if role:
        permissions = RolePermission.objects.filter(role=role, organization=target_org)
    else:
        permissions = RolePermission.objects.filter(organization=target_org)
    
    serializer = RolePermissionSerializer(permissions, many=True)
    return Response(serializer.data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def toggle_permission(request):
    """
    Toggle a single permission on/off.
    Body: { "role": "teacher", "permission_codename": "view_students", "is_allowed": true }
    Only SuperAdmin can access this.
    """
    if not (request.user.is_superadmin() or request.user.is_org_admin_role()):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    role = request.data.get('role')
    permission_codename = request.data.get('permission_codename')
    is_allowed = request.data.get('is_allowed')
    org_id = request.data.get('org_id') # SuperAdmin can specify org
    
    # Determine target org
    target_org = None
    if request.user.is_superadmin():
        if org_id:
            try:
                target_org = Organization.objects.get(id=org_id)
            except Organization.DoesNotExist:
                return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)
        # If no org_id, it targets global template
    else:
        target_org = request.user.organization
        if not target_org:
             return Response({'error': 'You are not assigned to an organization'}, status=status.HTTP_400_BAD_REQUEST)
    
    if not role or not permission_codename or is_allowed is None:
        return Response(
            {'error': 'role, permission_codename, and is_allowed are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Cannot modify superadmin permissions
    if role == 'superadmin':
        return Response(
            {'error': 'SuperAdmin permissions cannot be modified'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        perm, created = RolePermission.objects.get_or_create(
            organization=target_org,
            role=role,
            permission_codename=permission_codename,
            defaults={'is_allowed': is_allowed}
        )
        if not created:
            perm.is_allowed = is_allowed
            perm.save()
        
        serializer = RolePermissionSerializer(perm)
        return Response(serializer.data)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_permissions(request):
    """
    Get current user's permissions.
    Any authenticated user can call this to get their own permissions.
    """
    user = request.user
    
    # Fetch dynamic permissions from database for user's organization
    role_perms = RolePermission.objects.filter(role=user.role, organization=user.organization)
    permissions = {rp.permission_codename: rp.is_allowed for rp in role_perms}
    # Default True for superadmin (anything not yet in DB), False for others
    default_value = user.role == 'superadmin'
    for perm_code, _ in RolePermission.PERMISSION_CHOICES:
        if perm_code not in permissions:
            permissions[perm_code] = default_value
    
    return Response({
        'role': user.role,
        'permissions': permissions
    })


class SubscriptionPlanListCreateView(generics.ListCreateAPIView):
    """
    List and create subscription plans (SuperAdmin only)
    """
    permission_classes = [IsAuthenticated, (IsSuperAdmin | IsAdmin)]
    serializer_class = SubscriptionPlanSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_superadmin():
            return SubscriptionPlan.objects.filter(is_active=True).order_by('max_students')
        
        if user.role == 'admin':
            # Partner Admin: Show SuperAdmin's plans (created_by is null) AND their own
            from django.db.models import Q
            return SubscriptionPlan.objects.filter(
                Q(created_by__isnull=True) | Q(created_by=user),
                is_active=True
            ).order_by('max_students')
            
        return SubscriptionPlan.objects.filter(is_active=True).order_by('max_students')

    def perform_create(self, serializer):
        user = self.request.user
        # If SuperAdmin creates a plan, it's a System plan (created_by=None)
        created_by = None if user.is_superadmin() else user
        serializer.save(created_by=created_by)

class SubscriptionPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a subscription plan (SuperAdmin only)
    """
    permission_classes = [IsAuthenticated, (IsSuperAdmin | IsAdmin)]
    queryset = SubscriptionPlan.objects.filter(is_active=True)
    serializer_class = SubscriptionPlanSerializer

    def perform_update(self, serializer):
        """
        If a plan's quota fields are updated, propagate those changes
        to all organizations currently on this plan.
        """
        # Save the plan update first
        plan = serializer.save()
        
        # Then update all organizations using this plan
        from .models import Organization
        Organization.objects.filter(plan=plan).update(
            max_users=plan.max_users,
            max_students=plan.max_students,
            max_campuses=plan.max_campuses
        )


class OrganizationListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/organizations/       -> List all organizations (SuperAdmin only)
    POST /api/organizations/       -> Create new organization + its admin user
    """
    def get_queryset(self):
        user = self.request.user
        if user.role == 'superadmin':
            return Organization.objects.all().order_by('-created_at')
        if user.role == 'admin':
            return Organization.objects.filter(created_by=user).order_by('-created_at')
        return Organization.objects.none()

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return OrganizationCreateSerializer
        return OrganizationSerializer

    def perform_create(self, serializer):
        return serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        org = self.perform_create(serializer)
        # Return full org data after creation
        return Response(
            OrganizationSerializer(org).data,
            status=status.HTTP_201_CREATED
        )


class OrganizationDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/organizations/<id>/  -> Get organization detail
    PATCH  /api/organizations/<id>/  -> Update quotas or name
    DELETE /api/organizations/<id>/  -> Delete organization
    """
    permission_classes = [IsAuthenticated, (IsSuperAdmin | IsAdmin)]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'superadmin':
            return Organization.objects.all()
        if user.role == 'admin':
            return Organization.objects.filter(created_by=user)
        return Organization.objects.none()
    serializer_class = OrganizationSerializer

    def perform_update(self, serializer):
        """
        When a plan is assigned/changed, automatically sync the plan's quota limits
        (max_users, max_students, max_campuses) to the organization record.
        SuperAdmin can still manually override after assignment.
        """
        new_plan = serializer.validated_data.get('plan')
        if new_plan:
            # Only override quota fields if they were NOT explicitly provided in this request
            request_data = self.request.data
            if 'max_users' not in request_data:
                serializer.validated_data['max_users'] = new_plan.max_users
            if 'max_students' not in request_data:
                serializer.validated_data['max_students'] = new_plan.max_students
            if 'max_campuses' not in request_data:
                serializer.validated_data['max_campuses'] = new_plan.max_campuses
        serializer.save()


class OrganizationDashboardView(generics.RetrieveAPIView):
    """
    GET /api/organizations/my-dashboard/
    Returns the current org admin's organization quota usage for dashboard KPI cards.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = OrganizationSerializer

    def get_object(self):
        user = self.request.user
        if user.is_superadmin():
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("SuperAdmin does not belong to an organization. Use /api/organizations/ instead.")
        if not user.organization:
            from rest_framework.exceptions import NotFound
            raise NotFound("You are not assigned to any organization.")
        return user.organization

    def retrieve(self, request, *args, **kwargs):
        org = self.get_object()
        data = OrganizationSerializer(org).data

        # Add percentage used for easy frontend progress bars
        data['percent_users'] = round((data['used_users'] / data['max_users']) * 100) if data['max_users'] else 0
        data['percent_students'] = round((data['used_students'] / data['max_students']) * 100) if data['max_students'] else 0
        data['percent_campuses'] = round((data['used_campuses'] / data['max_campuses']) * 100) if data['max_campuses'] else 0

        return Response(data)
@api_view(['POST'])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_reset_password(request, pk):
    """
    Allow SuperAdmin to reset ANY user password directly.
    """
    try:
        user = User.objects.get(pk=pk)
        new_password = request.data.get('password')
        
        if not new_password:
            return Response({'error': 'Password is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate password strength
        try:
            validate_password_strength(new_password, user)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
        user.set_password(new_password)
        user.has_changed_default_password = True
        user.save()

        try:
            from attendance.models import AuditLog
            AuditLog.objects.create(
                feature=getattr(user, 'role', 'user') if getattr(user, 'role', 'user') in ('student','teacher','coordinator','principal','org_admin') else 'user',
                action='password_change',
                entity_type='User',
                entity_id=user.id,
                organization=user.organization,
                user=request.user,
                ip_address=request.META.get('REMOTE_ADDR'),
                changes={
                    'name': user.get_full_name() or user.username,
                    'email': user.email,
                    'role': user.role,
                    'changed_by': request.user.username,
                    'changed_by_role': request.user.role,
                    'source': 'superadmin_reset',
                },
            )
        except Exception:
            pass

        return Response({'message': f'Password for {user.username} has been reset successfully.'})
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    View for retrieving, updating or deleting a specific user.
    """
    queryset = User.objects.all()
    serializer_class = UserUpdateSerializer
    permission_classes = [IsAuthenticated, (IsSuperAdmin | IsOrgAdmin)]


# ─────────────────────────────────────────────────────────────────────────────
# Org-Admin: Staff List  (all non-student users in the org)
# ─────────────────────────────────────────────────────────────────────────────

class OrgStaffListView(generics.ListAPIView):
    """
    Returns all staff (non-student, non-superadmin) in the org admin's
    organization, enriched with last_login, employee_code and campus info.
    Only accessible by org_admin.
    """
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def list(self, request, *args, **kwargs):
        org = request.user.organization
        if not org:
            return Response([], status=status.HTTP_200_OK)

        users = User.objects.filter(
            organization=org,
        ).exclude(role__in=['student', 'superadmin']).select_related('campus').order_by(
            models.Case(
                models.When(role='org_admin',            then=0),
                models.When(role='principal',            then=1),
                models.When(role='coordinator',          then=2),
                models.When(role='teacher',              then=3),
                models.When(role='accounts_officer',     then=4),
                models.When(role='admissions_counselor', then=5),
                models.When(role='compliance_officer',   then=6),
                default=7,
                output_field=models.IntegerField(),
            ),
            'first_name',
        )

        results = []
        for u in users:
            employee_code = u.username
            campus_name = None
            full_name = f"{u.first_name} {u.last_name}".strip() or u.username

            # Try to get enriched data from role-specific profile
            try:
                if u.role == 'teacher':
                    from teachers.models import Teacher
                    profile = Teacher.objects.filter(employee_code=u.username).first()
                    if profile:
                        employee_code = profile.employee_code or u.username
                        campus_name = profile.current_campus.campus_name if profile.current_campus else None
                        full_name = profile.full_name or full_name

                elif u.role == 'coordinator':
                    from coordinator.models import Coordinator
                    profile = Coordinator.get_for_user(u)
                    if profile:
                        employee_code = profile.employee_code or u.username
                        campus_name = profile.campus.campus_name if profile.campus else None
                        full_name = profile.full_name or full_name

                elif u.role == 'principal':
                    from principals.models import Principal
                    profile = Principal.objects.filter(employee_code=u.username).first()
                    if profile:
                        employee_code = profile.employee_code or u.username
                        campus_name = profile.campus.campus_name if profile.campus else None
                        full_name = profile.full_name or full_name

                elif u.role == 'org_admin':
                    campus_name = None  # org admins have no campus

                # Fallback: roles without a separate entity (accounts_officer,
                # admissions_counselor, compliance_officer, donor, etc.)
                # read campus directly from the User record
                if campus_name is None and u.campus_id:
                    campus_name = u.campus.campus_name if u.campus else None

            except Exception:
                pass

            results.append({
                'id': u.id,
                'full_name': full_name,
                'email': u.email,
                'role': u.role,
                'role_display': u.get_role_display(),
                'employee_code': employee_code,
                'campus_name': campus_name,
                'is_active': u.is_active,
                'last_login': u.last_login.isoformat() if u.last_login else None,
                'last_login_ip': u.last_login_ip,
                'created_at': u.created_at.isoformat() if u.created_at else None,
            })

        return Response(results, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
# Org-Admin: Toggle User Active/Inactive
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsOrgAdmin])
def toggle_user_active(request, pk):
    """
    Toggle is_active for a staff member in the org admin's organization.
    Inactive users cannot log in. Also increments token_version to force logout.
    """
    try:
        target = User.objects.get(pk=pk, organization=request.user.organization)
    except User.DoesNotExist:
        return Response({'error': 'User not found in your organization.'}, status=status.HTTP_404_NOT_FOUND)

    if target.role in ('superadmin', 'org_admin'):
        return Response({'error': f'Cannot change active status of "{target.role}".'}, status=status.HTTP_400_BAD_REQUEST)

    if target.id == request.user.id:
        return Response({'error': 'You cannot deactivate yourself.'}, status=status.HTTP_400_BAD_REQUEST)

    target.is_active = not target.is_active
    # Force logout if deactivating
    if not target.is_active:
        target.token_version = (target.token_version or 0) + 1
    target.save(update_fields=['is_active', 'token_version'])

    try:
        from attendance.models import AuditLog
        new_status = 'activated' if target.is_active else 'deactivated'
        AuditLog.objects.create(
            feature=target.role if target.role in ('student', 'teacher', 'coordinator', 'principal', 'org_admin') else 'user',
            action='status_change',
            entity_type='User',
            entity_id=target.id,
            organization=target.organization,
            user=request.user,
            ip_address=request.META.get('REMOTE_ADDR'),
            changes={
                'name': target.get_full_name() or target.username,
                'email': target.email,
                'role': target.role,
                'status_changed_to': new_status,
                'changed_by': request.user.username,
                'changed_by_role': request.user.role,
                'field': 'is_active',
            },
            reason=f'User {new_status} by {request.user.username}',
        )
    except Exception:
        pass

    return Response({
        'message': f'User {"activated" if target.is_active else "deactivated"} successfully.',
        'is_active': target.is_active,
    }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
# Org-Admin: Switch Role
# ─────────────────────────────────────────────────────────────────────────────

# Roles that org admin is allowed to switch between
SWITCHABLE_ROLES = {
    'teacher', 'coordinator', 'principal',
    'accounts_officer', 'admissions_counselor', 'compliance_officer',
}

# Roles that are PROTECTED — cannot be switched
PROTECTED_ROLES = {'superadmin', 'org_admin', 'student', 'donor'}


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsOrgAdmin])
def switch_user_role(request, pk):
    """
    Switch the role of a staff member within the same organization.

    Request body:
      {
        "new_role":   "coordinator",          # required
        "level_id":   3,                      # required when new_role == 'coordinator'
        "campus_id":  2,                      # required when new_role == 'principal'
        "shift":      "morning"               # optional, defaults to user's current shift
      }

    Logic:
      1. Validate permissions & payload
      2. Build new employee code (same serial, updated role letter)
      3. Soft-delete old role entity
      4. Create new role entity with same personal data
      5. Update User.role + username + increment token_version
    """
    from django.db import transaction

    new_role = (request.data.get('new_role') or '').strip()
    # Support both legacy level_id (int) and new level_ids (list)
    raw_level_ids = request.data.get('level_ids')
    legacy_level_id = request.data.get('level_id')
    if raw_level_ids is not None:
        level_ids = [int(x) for x in raw_level_ids] if isinstance(raw_level_ids, list) else [int(raw_level_ids)]
    elif legacy_level_id is not None:
        level_ids = [int(legacy_level_id)]
    else:
        level_ids = []
    campus_id = request.data.get('campus_id')
    new_shift   = request.data.get('shift')
    custom_code = (request.data.get('custom_code') or '').strip()

    # ── 1. Basic validation ────────────────────────────────────────────────
    if not new_role:
        return Response({'error': 'new_role is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if new_role not in SWITCHABLE_ROLES:
        return Response(
            {'error': f'Cannot switch to role "{new_role}". Allowed: {sorted(SWITCHABLE_ROLES)}'},
            status=status.HTTP_400_BAD_REQUEST,
        )


    if new_role == 'principal' and not campus_id:
        return Response(
            {'error': 'campus_id is required when switching to principal.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── 2. Get target user ────────────────────────────────────────────────
    try:
        target_user = User.objects.get(pk=pk, organization=request.user.organization)
    except User.DoesNotExist:
        return Response({'error': 'User not found in your organization.'}, status=status.HTTP_404_NOT_FOUND)

    if target_user.role in PROTECTED_ROLES:
        return Response(
            {'error': f'Role "{target_user.role}" cannot be switched.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if target_user.role == new_role:
        return Response({'error': 'User already has this role.'}, status=status.HTTP_400_BAD_REQUEST)

    if target_user.id == request.user.id:
        return Response({'error': 'You cannot switch your own role.'}, status=status.HTTP_400_BAD_REQUEST)

    old_role = target_user.role
    old_code = target_user.username  # username == employee_code

    # ── 3. Gather old profile data for the new entity ────────────────────
    profile_data = _extract_profile_data(target_user, old_role)
    if not profile_data:
        return Response(
            {'error': 'Could not find existing profile data for this user. '
                      'Ensure the user has a complete profile before switching roles.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── 4. Resolve campus for the new entity ─────────────────────────────
    from campus.models import Campus
    if campus_id:
        try:
            campus = Campus.objects.get(pk=campus_id, organization=request.user.organization)
        except Campus.DoesNotExist:
            return Response({'error': 'Campus not found.'}, status=status.HTTP_404_NOT_FOUND)
    else:
        campus = profile_data.get('campus')
        if not campus:
            return Response(
                {'error': 'Could not determine campus. Please provide campus_id.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    # ── 4b. Check for duplicate principal on same campus ─────────────────
    if new_role == 'principal':
        from principals.models import Principal
        existing_principal = Principal.objects.filter(
            campus=campus, is_deleted=False
        ).exclude(user=target_user).first()
        if existing_principal:
            name = existing_principal.full_name or existing_principal.employee_code or 'Someone'
            return Response(
                {'error': f'This campus already has a principal ({name}). Please remove the existing principal first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    # ── 5. Resolve level(s) for coordinator ──────────────────────────────
    levels_qs = []
    level = None  # primary FK (first level, or only level) — can be assigned later via campus management
    if new_role == 'coordinator' and level_ids:
        from classes.models import Level
        levels_qs = list(Level.objects.filter(pk__in=level_ids))
        if len(levels_qs) != len(level_ids):
            return Response({'error': 'One or more levels not found.'}, status=status.HTTP_404_NOT_FOUND)
        level = levels_qs[0]  # primary level FK

    # ── 6. Build new employee code ────────────────────────────────────────
    from utils.id_generator import IDGenerator
    from teachers.models import Teacher
    from coordinator.models import Coordinator
    from principals.models import Principal

    if custom_code:
        # Validate custom code uniqueness
        code_taken = (
            Teacher.objects.with_deleted().filter(employee_code=custom_code).exists() or
            Coordinator.objects.with_deleted().filter(employee_code=custom_code).exists() or
            Principal.objects.with_deleted().filter(employee_code=custom_code).exists() or
            User.objects.exclude(pk=target_user.pk).filter(username=custom_code).exists()
        )
        if code_taken:
            return Response(
                {'error': f'Employee code "{custom_code}" is already in use. Please choose a different code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        new_code = custom_code
    else:
        new_code = IDGenerator.update_employee_code_role(old_code, new_role, new_campus=campus)

        # Collision check — fall back to brand-new code if taken
        code_taken = (
            Teacher.objects.with_deleted().filter(employee_code=new_code).exists() or
            Coordinator.objects.with_deleted().filter(employee_code=new_code).exists() or
            Principal.objects.with_deleted().filter(employee_code=new_code).exists() or
            User.objects.exclude(pk=target_user.pk).filter(username=new_code).exists()
        )
        if code_taken:
            shift_val = new_shift or profile_data.get('shift', 'morning')
            joining_year = profile_data.get('joining_year', timezone.now().year)
            new_code = IDGenerator.generate_unique_employee_code(campus, shift_val, joining_year, new_role)

    # ── 7. Apply everything atomically ───────────────────────────────────
    with transaction.atomic():
        # Soft-delete old role entity
        _soft_delete_role_entity(target_user, old_role)

        # Create new role entity
        shift_val = new_shift or profile_data.get('shift', 'morning')
        _create_role_entity(
            new_role=new_role,
            employee_code=new_code,
            campus=campus,
            level=level,
            levels_qs=levels_qs,
            shift=shift_val,
            profile_data=profile_data,
            user=target_user,
            organization=request.user.organization,
        )

        # Update User record
        target_user.role = new_role
        target_user.username = new_code
        target_user.campus = campus
        target_user.token_version = (target_user.token_version or 0) + 1
        target_user.save(update_fields=['role', 'username', 'campus', 'token_version', 'updated_at'])

    return Response({
        'message': f'Role switched from {old_role} to {new_role} successfully.',
        'new_employee_code': new_code,
        'old_employee_code': old_code,
        'new_role': new_role,
    }, status=status.HTTP_200_OK)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_profile_data(user, role):
    """Extract personal/employment info from the user's current role entity."""
    try:
        if role == 'teacher':
            from teachers.models import Teacher
            p = Teacher.objects.filter(employee_code=user.username).first()
            if not p:
                return None
            return {
                'full_name': p.full_name,
                'dob': p.dob,
                'gender': p.gender,
                'contact_number': p.contact_number,
                'email': p.email,
                'cnic': p.cnic,
                'permanent_address': p.permanent_address or '',
                'marital_status': p.marital_status,
                'education_level': p.education_level or 'Bachelor',
                'institution_name': p.institution_name or '',
                'year_of_passing': p.year_of_passing or 2020,
                'total_experience_years': p.total_experience_years or 0,
                'campus': p.current_campus,
                'shift': p.shift,
                'joining_date': p.joining_date,
                'joining_year': p.joining_date.year if p.joining_date else timezone.now().year,
            }

        elif role == 'coordinator':
            from coordinator.models import Coordinator
            p = Coordinator.get_for_user(user)
            if not p:
                return None
            return {
                'full_name': p.full_name,
                'dob': p.dob,
                'gender': p.gender,
                'contact_number': p.contact_number,
                'email': p.email,
                'cnic': p.cnic,
                'permanent_address': p.permanent_address or '',
                'marital_status': p.marital_status,
                'education_level': p.education_level or 'Bachelor',
                'institution_name': p.institution_name or '',
                'year_of_passing': p.year_of_passing or 2020,
                'total_experience_years': p.total_experience_years or 0,
                'campus': p.campus,
                'shift': p.shift,
                'joining_date': p.joining_date,
                'joining_year': p.joining_date.year if p.joining_date else timezone.now().year,
            }

        elif role == 'principal':
            from principals.models import Principal
            p = Principal.objects.filter(employee_code=user.username).first()
            if not p:
                return None
            return {
                'full_name': p.full_name,
                'dob': p.dob,
                'gender': p.gender,
                'contact_number': p.contact_number,
                'email': p.email,
                'cnic': p.cnic,
                'permanent_address': p.permanent_address or '',
                'marital_status': p.marital_status,
                'education_level': p.education_level or 'Bachelor',
                'institution_name': p.institution_name or '',
                'year_of_passing': p.year_of_passing or 2020,
                'total_experience_years': p.total_experience_years or 0,
                'campus': p.campus,
                'shift': p.shift,
                'joining_date': p.joining_date,
                'joining_year': p.joining_date.year if p.joining_date else timezone.now().year,
            }

        else:
            # accounts_officer, admissions_counselor, compliance_officer
            # These may not have a separate entity — build minimal data from User
            return {
                'full_name': f"{user.first_name} {user.last_name}".strip() or user.username,
                'dob': None,
                'gender': 'male',
                'contact_number': user.phone_number or '0000000000',
                'email': user.email,
                'cnic': '0000000000000',
                'permanent_address': '',
                'marital_status': None,
                'education_level': 'Bachelor',
                'institution_name': '',
                'year_of_passing': 2020,
                'total_experience_years': 0,
                'campus': user.campus,
                'shift': 'morning',
                'joining_date': None,
                'joining_year': timezone.now().year,
            }

    except Exception as e:
        print(f"[SWITCH ROLE] Error extracting profile data: {e}")
        return None


def _soft_delete_role_entity(user, role):
    """Soft-delete the user's current role entity."""
    try:
        if role == 'teacher':
            from teachers.models import Teacher
            Teacher.objects.filter(employee_code=user.username).update(
                is_deleted=True,
                deleted_at=timezone.now(),
            )
        elif role == 'coordinator':
            from coordinator.models import Coordinator
            coord = Coordinator.get_for_user(user)
            if coord:
                Coordinator.objects.filter(pk=coord.pk).update(
                    is_deleted=True,
                    deleted_at=timezone.now(),
                )
        elif role == 'principal':
            from principals.models import Principal
            Principal.objects.filter(employee_code=user.username).update(
                is_deleted=True,
                deleted_at=timezone.now(),
            )
        # Other roles (accounts_officer etc.) have no separate entity table
    except Exception as e:
        print(f"[SWITCH ROLE] Error soft-deleting entity: {e}")


def _create_role_entity(new_role, employee_code, campus, level, shift, profile_data, user, organization, levels_qs=None):
    """Create the new role entity with copied personal data."""
    from datetime import date
    dob = profile_data.get('dob') or date(1990, 1, 1)
    joining_date = profile_data.get('joining_date') or date.today()

    if new_role == 'teacher':
        from teachers.models import Teacher
        Teacher.objects.create(
            user=user,
            organization=organization,
            full_name=profile_data['full_name'],
            dob=dob,
            gender=profile_data['gender'],
            contact_number=profile_data['contact_number'],
            email=profile_data['email'],
            cnic=profile_data['cnic'],
            permanent_address=profile_data.get('permanent_address', ''),
            marital_status=profile_data.get('marital_status'),
            education_level=profile_data.get('education_level', 'Bachelor'),
            institution_name=profile_data.get('institution_name', ''),
            year_of_passing=profile_data.get('year_of_passing', 2020),
            total_experience_years=profile_data.get('total_experience_years', 0),
            current_campus=campus,
            shift=shift,
            joining_date=joining_date,
            employee_code=employee_code,
            teacher_id=employee_code,
            is_currently_active=True,
            save_status='final',
        )

    elif new_role == 'coordinator':
        from coordinator.models import Coordinator
        multi = levels_qs and len(levels_qs) > 1
        coord = Coordinator.objects.create(
            organization=organization,
            full_name=profile_data['full_name'],
            dob=dob,
            gender=profile_data['gender'],
            contact_number=profile_data['contact_number'],
            email=profile_data['email'],
            cnic=profile_data['cnic'],
            permanent_address=profile_data.get('permanent_address', ''),
            marital_status=profile_data.get('marital_status'),
            education_level=profile_data.get('education_level', 'Bachelor'),
            institution_name=profile_data.get('institution_name', ''),
            year_of_passing=profile_data.get('year_of_passing', 2020),
            total_experience_years=profile_data.get('total_experience_years', 0),
            campus=campus,
            level=None if multi else level,
            shift='both' if multi else shift,
            joining_date=joining_date,
            employee_code=employee_code,
            is_currently_active=True,
        )
        if multi and levels_qs:
            coord.assigned_levels.set(levels_qs)
        # Link User → Coordinator via employee_code (same as existing pattern)

    elif new_role == 'principal':
        from principals.models import Principal
        Principal.objects.create(
            user=user,
            organization=organization,
            full_name=profile_data['full_name'],
            dob=dob,
            gender=profile_data['gender'],
            contact_number=profile_data['contact_number'],
            email=profile_data['email'],
            cnic=profile_data['cnic'],
            permanent_address=profile_data.get('permanent_address', ''),
            marital_status=profile_data.get('marital_status'),
            education_level=profile_data.get('education_level', 'Bachelor'),
            institution_name=profile_data.get('institution_name', ''),
            year_of_passing=profile_data.get('year_of_passing', 2020),
            total_experience_years=profile_data.get('total_experience_years', 0),
            campus=campus,
            shift=shift,
            joining_date=joining_date,
            designation='principal',
            status='active',
            employee_code=employee_code,
            is_currently_active=True,
        )
    # For accounts_officer, admissions_counselor, compliance_officer:
    # No separate entity table exists — just the User record is enough.


@api_view(['GET'])
@permission_classes([AllowAny])
def get_current_version(request):
    """Public endpoint — returns the current system version for the login page."""
    version = SystemVersion.current()
    if not version:
        return Response({'version': None, 'build': None, 'display': None})
    return Response({
        'version': version.version,
        'build': version.build,
        'display': f"v{version.version} ({version.build})",
        'release_notes': version.release_notes,
        'created_at': version.created_at,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def release_new_version(request):
    """
    SuperAdmin endpoint to release a new version.
    Automatically increments the build number and notifies all
    superadmins, org_admins, and principals.
    """
    version_str = request.data.get('version', '').strip()
    release_notes = request.data.get('release_notes', '').strip()

    if not version_str:
        return Response({'error': 'version is required.'}, status=status.HTTP_400_BAD_REQUEST)

    build_number = SystemVersion.next_build()
    sv = SystemVersion.objects.create(
        version=version_str,
        build=build_number,
        release_notes=release_notes,
        released_by=request.user,
    )

    # Notify all superadmins, org_admins, and principals
    recipients = User.objects.filter(
        role__in=['superadmin', 'org_admin', 'principal'],
        is_active=True,
    ).exclude(id=request.user.id)

    display = f"v{sv.version} (build {sv.build})"
    notes_snippet = f" — {release_notes[:120]}" if release_notes else ""
    verb = f"System updated to {display}"
    target_text = f"Newton AMS has been updated to {display}{notes_snippet}"

    for user in recipients:
        create_notification(
            recipient=user,
            actor=request.user,
            verb=verb,
            target_text=target_text,
            data={'type': 'system_update', 'version': sv.version, 'build': sv.build},
        )

    serializer = SystemVersionSerializer(sv)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sidebar_badges(request):
    """Per-sidebar-category pending counts for the current user (role-aware).

    Returns a dict keyed by the sidebar CATEGORY name, e.g.
        { "Result Management": 3, "Transfers": 1, "Student Attendance": 2 }
    The frontend shows a badge on the matching category when count > 0.
    Each source is wrapped so one failing query never breaks the whole response.
    """
    user = request.user
    role = (getattr(user, 'role', '') or '').lower()
    counts = {}

    # ── Result Management: results awaiting this user's approval ──
    try:
        from result.models import Result
        if role == 'coordinator':
            from coordinator.models import Coordinator
            coord = Coordinator.get_for_user(user)
            if coord:
                counts['Result Management'] = Result.objects.filter(
                    coordinator=coord, status='pending_coordinator'
                ).count()
        elif role == 'principal':
            counts['Result Management'] = Result.objects.filter(
                status='pending_principal'
            ).count()
    except Exception:
        pass

    # ── Transfers: pending transfer requests awaiting this user ──
    try:
        if role == 'principal':
            from transfers.models import TransferRequest
            counts['Transfers'] = TransferRequest.objects.filter(
                receiving_principal=user, status='pending'
            ).count()
        elif role == 'coordinator':
            from django.db.models import Q
            from coordinator.models import Coordinator
            from transfers.models import ShiftTransfer
            coord = Coordinator.get_for_user(user)
            if coord:
                counts['Transfers'] = ShiftTransfer.objects.filter(
                    Q(from_shift_coordinator=coord) | Q(to_shift_coordinator=coord),
                    status__startswith='pending',
                ).count()
    except Exception:
        pass

    # ── Student Attendance: sessions awaiting this coordinator's review ──
    try:
        if role == 'coordinator':
            from coordinator.models import Coordinator
            from attendance.models import Attendance
            coord = Coordinator.get_for_user(user)
            if coord:
                level_ids = set(coord.assigned_levels.values_list('id', flat=True))
                if getattr(coord, 'level_id', None):
                    level_ids.add(coord.level_id)
                if level_ids:
                    counts['Student Attendance'] = Attendance.objects.filter(
                        status='under_review',
                        classroom__grade__level_id__in=level_ids,
                    ).count()
    except Exception:
        pass

    # Only surface positive counts (badges are for actionable items).
    return Response({k: v for k, v in counts.items() if v})
