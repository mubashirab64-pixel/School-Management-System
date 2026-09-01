from rest_framework import viewsets, decorators, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from django.contrib.auth import get_user_model
from users.permissions import IsSuperAdmin, IsNotDonorForWrites
from .models import Principal
from .serializers import PrincipalSerializer

User = get_user_model()


class PrincipalViewSet(viewsets.ModelViewSet):
    queryset = Principal.objects.all()
    serializer_class = PrincipalSerializer
    permission_classes = [IsAuthenticated, IsNotDonorForWrites]
    
    # Filtering, search, and ordering
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['campus', 'shift', 'is_currently_active']
    search_fields = ['full_name', 'employee_code', 'email', 'contact_number', 'cnic']
    ordering_fields = ['full_name', 'joining_date', 'created_at']
    ordering = ['-created_at']  # Default ordering
    
    def get_queryset(self):
        """Override to optimize queries and handle filtering"""
        user = self.request.user
        # Use with_deleted() to get all records, then filter by is_deleted=False
        queryset = Principal.objects.with_deleted().filter(is_deleted=False).select_related('campus', 'user')
        
        if user.is_superadmin():
            return queryset
            
        if user.role == 'org_admin':
            # Filter by organization if user belongs to one
            if user.organization:
                return queryset.filter(organization=user.organization)
            return queryset.none()
            
        if user.is_principal():
            # Principal: Only show principals from their campus (if assigned) or organization
            campus = getattr(user, 'campus', None)
            if campus:
                queryset = queryset.filter(campus=campus)
            elif user.organization:
                queryset = queryset.filter(organization=user.organization)
            else:
                queryset = queryset.none()
            return queryset
        
        return queryset
    
    def perform_create(self, serializer):
        """Create principal and auto-generate user account"""
        user = self.request.user
        # Automatically set organization if user belongs to one
        save_kwargs = {}
        if not user.is_superadmin() and user.organization:
            save_kwargs['organization'] = user.organization
            
        # Check for existing principal on the same campus + shift
        campus_id = serializer.validated_data.get('campus')
        shift = serializer.validated_data.get('shift')
        
        if campus_id and shift:
            existing_principal = Principal.objects.filter(campus=campus_id, shift=shift).first()
            if existing_principal:
                from rest_framework.exceptions import ValidationError
                shift_display = existing_principal.get_shift_display()
                raise ValidationError({
                    'shift': f'This campus already has a principal for {shift_display} shift: {existing_principal.full_name}'
                })
        
        # Save the principal (triggers post_save signal)
        principal = serializer.save(**save_kwargs)
        
        # Pass actor and save again to trigger notification signals with correct context
        principal._actor = user
        principal.save()
    
    def perform_update(self, serializer):
        """Update principal and sync user account via signals"""
        instance = serializer.instance
        
        # Capture old values to check for code regeneration needs
        old_campus = instance.campus
        old_shift = instance.shift
        old_joining_date = instance.joining_date
        
        # Save the principal (triggers post_save signal)
        principal: Principal = serializer.save()
        
        # Pass actor and save again to trigger notification signals with correct context
        principal._actor = self.request.user
        principal.save()
        
        # Regenerate employee code if campus/shift/joining_date changed
        regenerate_code = (
            old_campus != principal.campus or
            old_shift != principal.shift or
            old_joining_date != principal.joining_date
        )
        if regenerate_code:
            principal.save(regenerate_code=True)
            
        # User account synchronization (email, name, campus) is handled by the 
        # 'sync_principal_to_user' signal in principals/signals.py, which 
        # includes safety checks for unique email constraints.
    
    def perform_destroy(self, instance):
        """Soft delete principal and create audit log"""
        instance._actor = self.request.user
        
        # Store principal info before deletion for audit log
        principal_id = instance.id
        principal_name = instance.full_name
        principal_campus = instance.campus
        
        # Get user name for audit log
        user = self.request.user
        user_name = user.get_full_name() if hasattr(user, 'get_full_name') else (user.username or 'Unknown')
        user_role = user.get_role_display() if hasattr(user, 'get_role_display') else (user.role or 'User')
        
        # Soft delete the principal (instead of hard delete)
        instance.soft_delete()
        
        # Create audit log after soft deletion
        try:
            from attendance.models import AuditLog
            AuditLog.objects.create(
                feature='principal',
                action='delete',
                entity_type='Principal',
                entity_id=principal_id,
                user=user,
                ip_address=self.request.META.get('REMOTE_ADDR'),
                changes={'name': principal_name, 'principal_id': principal_id, 'campus_id': principal_campus.id if principal_campus else None},
                reason=f'Principal {principal_name} deleted by {user_role} {user_name}'
            )
        except Exception as e:
            # Log error but don't fail the deletion
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create audit log for principal deletion: {str(e)}")
    
    @decorators.action(detail=False, methods=['get'])
    def stats(self, request):
        """Get principal statistics"""
        total = self.get_queryset().count()
        active = self.get_queryset().filter(is_currently_active=True).count()
        inactive = total - active
        
        return Response({
            'total': total,
        })

    @decorators.action(detail=False, methods=['get'], url_path='form_options')
    def form_options(self, request):
        """
        Returns lists of choices for dropdowns in principal forms.
        """
        org = getattr(request.user, 'organization', None) if hasattr(request, 'user') else None

        from students.models import FormOption
        qs = FormOption.objects.filter(is_active=True)
        if org:
            qs = qs.filter(organization=org)
        else:
            qs = qs.filter(organization__isnull=True)

        # Seed defaults for new orgs that have no FormOption records yet
        if not qs.exists():
            default_seeds = {
                'gender': [('male', 'Male'), ('female', 'Female'), ('other', 'Other')],
                'religion': [('islam', 'Islam'), ('hinduism', 'Hinduism'), ('christianity', 'Christianity'), ('other', 'Other')],
                'marital_status': [('single', 'Single'), ('married', 'Married'), ('divorced', 'Divorced'), ('widowed', 'Widowed')],
                'shift': [('morning', 'Morning'), ('afternoon', 'Afternoon'), ('both', 'Both'), ('all', 'All Shifts')],
            }
            for cat, values in default_seeds.items():
                for v, l in values:
                    FormOption.objects.create(organization=org, category=cat, value=v, label=l)
            qs = FormOption.objects.filter(is_active=True)
            if org:
                qs = qs.filter(organization=org)
            else:
                qs = qs.filter(organization__isnull=True)

        relevant_categories = ['gender', 'religion', 'marital_status', 'education_level', 'shift']
        options = {cat: [] for cat in relevant_categories}

        for opt in qs:
            if opt.category in options:
                options[opt.category].append({'value': opt.value, 'label': opt.label})

        if not options['shift']:
            options['shift'] = [
                {'value': 'morning', 'label': 'Morning'},
                {'value': 'afternoon', 'label': 'Afternoon'},
                {'value': 'both', 'label': 'Both'},
                {'value': 'all', 'label': 'All Shifts'}
            ]

        return Response(options)

    @decorators.action(detail=False, methods=['patch', 'put'], url_path='signature/save')
    def save_signature(self, request):
        """Save principal's digital signature"""
        from django.utils import timezone
        user = request.user
        try:
            principal = Principal.get_for_user(user)
            if not principal:
                return Response({'error': 'Principal profile not found'}, status=404)
            signature_data = request.data.get('signature')
            if not signature_data:
                return Response({'error': 'Signature data is required'}, status=400)
            principal.signature = signature_data
            principal.signature_updated_at = timezone.now()
            principal.save(update_fields=['signature', 'signature_updated_at'])
            return Response({'message': 'Signature saved successfully', 'updated_at': principal.signature_updated_at})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @decorators.action(detail=False, methods=['get'], url_path='signature/get')
    def get_signature(self, request):
        """Retrieve principal's digital signature"""
        user = request.user
        try:
            principal = Principal.get_for_user(user)
            if not principal:
                return Response({'error': 'Principal profile not found'}, status=404)
            return Response({
                'signature': principal.signature,
                'updated_at': principal.signature_updated_at
            })
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @decorators.action(detail=True, methods=['post'], url_path='upload-photo')
    def upload_photo(self, request, pk=None):
        """Upload or replace a principal's profile photo.

        Expects a multipart/form-data POST with a file field named 'photo'.
        Saves the file to Principal.photo and returns the photo URL.
        """
        from utils.image_upload import process_profile_photo, InvalidImageError
        principal = self.get_object()
        try:
            safe_photo = process_profile_photo(
                request.FILES.get('photo'), filename_stem=f"principal_{principal.id}"
            )
        except InvalidImageError as e:
            return Response({'detail': str(e)}, status=400)
        try:
            principal.photo = safe_photo
            principal.save(update_fields=['photo'])
        except Exception as e:
            return Response({'detail': f'Error saving photo: {str(e)}'}, status=500)
        try:
            photo_url = request.build_absolute_uri(principal.photo.url) if principal.photo else ''
        except Exception:
            photo_url = principal.photo.url if principal.photo else ''
        return Response({'photo_url': photo_url})

    @decorators.action(detail=True, methods=['delete'], url_path='delete-photo')
    def delete_photo(self, request, pk=None):
        """Delete a principal's profile photo from storage and clear the field."""
        principal = self.get_object()
        if not principal.photo:
            return Response({'detail': 'No photo found to delete.'}, status=400)
        try:
            principal.photo.delete(save=False)
            principal.photo = None
            principal.save(update_fields=['photo'])
        except Exception as e:
            return Response({'detail': f'Error deleting photo: {str(e)}'}, status=500)
        return Response({'detail': 'Photo deleted'})

