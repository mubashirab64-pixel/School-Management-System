from rest_framework import viewsets, decorators
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q
from django.utils import timezone
from users.permissions import IsSuperAdminOrPrincipal, IsNotDonorForWrites
from .models import Teacher, TeacherSubjectAssignment
from .serializers import TeacherSerializer, TeacherSubjectAssignmentSerializer
from .filters import TeacherFilter
import tempfile
import os
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser


class TeacherPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 5000


class TeacherViewSet(viewsets.ModelViewSet):
    queryset = Teacher.objects.all()
    serializer_class = TeacherSerializer
    permission_classes = [IsAuthenticated, IsNotDonorForWrites]  # All authenticated users can view; donors are read-only
    
    pagination_class = TeacherPagination

    # Filtering, search, and ordering
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = TeacherFilter
    search_fields = ['full_name', 'employee_code', 'email', 'contact_number', 'current_subjects']
    ordering_fields = ['full_name', 'joining_date', 'total_experience_years', 'employee_code', 'sort_order']
    ordering = ['sort_order', 'full_name']  # Default ordering
    
    def get_queryset(self):
        """Override to handle role-based filtering and optimize queries"""
        from django.db.models import Min, Case, When, Value, IntegerField
        from django.db.models.functions import Coalesce, Least

        queryset = Teacher.objects.select_related(
            'current_campus',
            'assigned_classroom',
        ).prefetch_related(
            'assigned_coordinators',
            'assigned_classrooms',
        ).annotate(
            m2m_grade_order=Min('assigned_classrooms__grade__order'),
            fk_grade_order=Min('classroom_set__grade__order'),
            legacy_grade_order=Min('assigned_classroom__grade__order'),
        ).annotate(
            min_grade_order=Least(
                Coalesce('m2m_grade_order', Value(999999)),
                Coalesce('fk_grade_order', Value(999999)),
                Coalesce('legacy_grade_order', Value(999999))
            )
        ).annotate(
            sort_order=Case(
                When(min_grade_order=999999, then=Value(999999)),
                default='min_grade_order',
                output_field=IntegerField()
            )
        ).all()
        
        # Role-based filtering
        user = self.request.user
        if user.is_superadmin():
            # Superadmin: Show everything
            pass
        elif user.role == 'admin':
            # Partner Admin: Only show teachers from organizations they created
            queryset = queryset.filter(organization__created_by=user)
        elif user.role == 'org_admin':
            # Org Admin: Only show teachers from their organization
            if user.organization:
                queryset = queryset.filter(organization=user.organization)
            else:
                queryset = queryset.none()
        elif user.is_principal():
            # Principal: Only show teachers from their campus (if assigned) or organization
            campus = getattr(user, 'campus', None)
            if campus:
                queryset = queryset.filter(current_campus=campus)
            elif user.organization:
                queryset = queryset.filter(organization=user.organization)
            else:
                queryset = queryset.none()
        elif user.is_coordinator():
            # Coordinator: Only show teachers assigned to them (using ManyToMany)
            from coordinator.models import Coordinator
            try:
                coordinator_obj = Coordinator.get_for_user(user)
                if coordinator_obj:
                    queryset = queryset.filter(assigned_coordinators=coordinator_obj)
                else:
                    queryset = queryset.none()
            except Exception:
                # If coordinator resolution fails, return empty queryset
                queryset = queryset.none()
        
        # Handle shift filtering
        shift_filter = self.request.query_params.get('shift')
        if shift_filter:
            if shift_filter in ['morning', 'afternoon']:
                # Filter teachers who work this specific shift or both
                queryset = queryset.filter(
                    Q(shift=shift_filter) | Q(shift='both')
                )
            elif shift_filter == 'both':
                # Show only teachers who work both shifts
                queryset = queryset.filter(shift='both')
        
        return queryset
    
    def perform_create(self, serializer):
        """Set organization before creating teacher; _actor is set in serializer.create()"""
        user = self.request.user

        save_kwargs = {}
        if not user.is_superadmin() and user.organization:
            save_kwargs['organization'] = user.organization

        teacher = serializer.save(**save_kwargs)
        try:
            from attendance.models import AuditLog
            AuditLog.objects.create(
                feature='teacher', action='create', entity_type='Teacher',
                entity_id=teacher.id,
                organization=getattr(teacher, 'organization', None),
                user=user,
                ip_address=self.request.META.get('REMOTE_ADDR'),
                changes={
                    'name': teacher.full_name,
                    'email': teacher.email,
                    'employee_code': teacher.employee_code,
                },
                reason=f'Teacher {teacher.full_name} added by {user.get_full_name() or user.username}',
            )
        except Exception:
            pass
        return teacher
    
    def perform_update(self, serializer):
        """Set actor before updating teacher"""
        instance = serializer.instance
        user = self.request.user
        if instance is not None:
            instance._actor = user
            changed_fields = []
            try:
                # Fields we care about for "profile updated" notifications
                monitored = [
                    # Personal info
                    'full_name',
                    'dob',
                    'gender',
                    'contact_number',
                    'email',
                    'permanent_address',
                    'current_address',
                    'marital_status',
                    'cnic',
                    # Education
                    'education_level',
                    'institution_name',
                    'year_of_passing',
                    'education_subjects',
                    'education_grade',
                    # Experience
                    'previous_institution_name',
                    'previous_position',
                    'experience_from_date',
                    'experience_to_date',
                    'total_experience_years',
                    # Current role
                    'joining_date',
                    'current_role_title',
                    'current_campus',
                    'shift',
                    'current_subjects',
                    'current_classes_taught',
                    'current_extra_responsibilities',
                    'role_start_date',
                    'is_currently_active',
                ]
                for field in monitored:
                    if field in serializer.validated_data:
                        old_val = getattr(instance, field, None)
                        new_val = serializer.validated_data.get(field)
                        if old_val != new_val:
                            changed_fields.append(field)
            except Exception:
                changed_fields = []
            instance._changed_fields = changed_fields
        old_is_active = getattr(instance, 'is_currently_active', None)
        teacher = serializer.save()
        try:
            from attendance.models import AuditLog
            AuditLog.objects.create(
                feature='teacher', action='update', entity_type='Teacher',
                entity_id=teacher.id,
                organization=getattr(teacher, 'organization', None),
                user=user,
                ip_address=self.request.META.get('REMOTE_ADDR'),
                changes={
                    'name': teacher.full_name,
                    'email': teacher.email,
                    'updated_fields': changed_fields,
                },
                reason=f'Teacher {teacher.full_name} updated by {user.get_full_name() or user.username}',
            )
            # Separate status_change log when is_currently_active changed
            if 'is_currently_active' in changed_fields:
                new_is_active = teacher.is_currently_active
                new_status = 'activated' if new_is_active else 'deactivated'
                AuditLog.objects.create(
                    feature='teacher', action='status_change', entity_type='Teacher',
                    entity_id=teacher.id,
                    organization=getattr(teacher, 'organization', None),
                    user=user,
                    ip_address=self.request.META.get('REMOTE_ADDR'),
                    changes={
                        'name': teacher.full_name,
                        'email': teacher.email,
                        'role': 'teacher',
                        'status_changed_to': new_status,
                        'changed_by': user.username,
                        'changed_by_role': getattr(user, 'role', ''),
                        'field': 'is_currently_active',
                    },
                    reason=f'Teacher {teacher.full_name} {new_status} by {user.get_full_name() or user.username}',
                )
        except Exception:
            pass
        return teacher
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to ensure soft delete is used - NEVER calls default delete"""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"[DESTROY] destroy() method called for DELETE request")
        
        # Get the instance
        instance = self.get_object()
        teacher_id = instance.id
        teacher_name = instance.full_name
        
        logger.info(f"[DESTROY] Got teacher instance: ID={teacher_id}, Name={teacher_name}, is_deleted={instance.is_deleted}")
        
        # Check if already deleted
        if instance.is_deleted:
            logger.warning(f"[DESTROY] Teacher {teacher_id} is already soft deleted")
            from rest_framework.exceptions import NotFound
            raise NotFound("Teacher is already deleted.")
        
        # IMPORTANT: Call perform_destroy which does soft delete
        # DO NOT call super().destroy() as it would do hard delete
        logger.info(f"[DESTROY] Calling perform_destroy() for soft delete")
        self.perform_destroy(instance)
        
        # Verify the teacher still exists in database (soft deleted, not hard deleted)
        try:
            from .models import Teacher
            # Use with_deleted() to check if teacher exists (even if soft deleted)
            still_exists = Teacher.objects.with_deleted().filter(pk=teacher_id).exists()
            if not still_exists:
                logger.error(f"[DESTROY] CRITICAL: Teacher {teacher_id} was HARD DELETED! This should not happen!")
                raise Exception(f"CRITICAL ERROR: Teacher {teacher_id} was permanently deleted instead of soft deleted!")
            else:
                # Check if it's soft deleted
                teacher_check = Teacher.objects.with_deleted().get(pk=teacher_id)
                if teacher_check.is_deleted:
                    logger.info(f"[DESTROY] SUCCESS: Teacher {teacher_id} is soft deleted (is_deleted=True)")
                else:
                    logger.error(f"[DESTROY] ERROR: Teacher {teacher_id} exists but is_deleted is False!")
        except Teacher.DoesNotExist:
            logger.error(f"[DESTROY] CRITICAL: Teacher {teacher_id} does not exist in database - was HARD DELETED!")
            raise Exception(f"CRITICAL ERROR: Teacher {teacher_id} was permanently deleted!")
        
        logger.info(f"[DESTROY] destroy() completed successfully")
        from rest_framework import status
        from rest_framework.response import Response
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    def perform_destroy(self, instance):
        """Soft delete teacher and create audit log"""
        import logging
        logger = logging.getLogger(__name__)
        
        instance._actor = self.request.user
        
        # Store teacher info before deletion for audit log
        teacher_id = instance.id
        teacher_name = instance.full_name
        teacher_campus = instance.current_campus
        
        # Get user name for audit log
        user = self.request.user
        user_name = user.get_full_name() if hasattr(user, 'get_full_name') else (user.username or 'Unknown')
        user_role = user.get_role_display() if hasattr(user, 'get_role_display') else (user.role or 'User')
        
        # Log before soft delete
        logger.info(f"[SOFT_DELETE] Starting soft delete for teacher ID: {teacher_id}, Name: {teacher_name}")
        logger.info(f"[SOFT_DELETE] Teacher is_deleted before: {instance.is_deleted}")
        
        # Soft delete the teacher (instead of hard delete)
        # This uses update() to directly modify database, does NOT call .delete()
        # This ensures no post_delete signal is triggered
        try:
            instance.soft_delete()
            logger.info(f"[SOFT_DELETE] soft_delete() method called successfully")
            
            # Verify soft delete worked
            instance.refresh_from_db()
            logger.info(f"[SOFT_DELETE] Teacher is_deleted after refresh: {instance.is_deleted}")
            
            if not instance.is_deleted:
                logger.error(f"[SOFT_DELETE] CRITICAL ERROR: Soft delete failed! Teacher {teacher_id} is_deleted is still False!")
                raise Exception(f"Soft delete failed for teacher {teacher_id} - is_deleted is still False after soft_delete() call")
            
            logger.info(f"[SOFT_DELETE] Soft delete successful for teacher {teacher_id}")
        except Exception as e:
            logger.error(f"[SOFT_DELETE] ERROR during soft_delete(): {str(e)}")
            raise
        
        # Create audit log after soft deletion
        try:
            from attendance.models import AuditLog
            AuditLog.objects.create(
                feature='teacher',
                action='delete',
                entity_type='Teacher',
                entity_id=teacher_id,
                user=user,
                ip_address=self.request.META.get('REMOTE_ADDR'),
                changes={'name': teacher_name, 'teacher_id': teacher_id, 'campus_id': teacher_campus.id if teacher_campus else None},
                reason=f'Teacher {teacher_name} deleted by {user_role} {user_name}'
            )
        except Exception as e:
            # Log error but don't fail the deletion
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create audit log for teacher deletion: {str(e)}")
    
    @decorators.action(detail=False, methods=['get'])
    def by_coordinator(self, request):
        """Get teachers assigned to a specific coordinator"""
        coordinator_id = request.query_params.get('coordinator_id')
        if not coordinator_id:
            return Response({'error': 'coordinator_id parameter is required'}, status=400)
        
        teachers = Teacher.objects.filter(
            assigned_coordinators=coordinator_id,
            is_currently_active=True
        ).select_related('current_campus').prefetch_related('assigned_coordinators')
        
        serializer = self.get_serializer(teachers, many=True)
        return Response(serializer.data)

    @decorators.action(detail=False, methods=['get'], url_path='my-classes')
    def my_classes(self, request):
        """
        Get all classrooms where the teacher is either:
        1. The Class Teacher
        2. A Subject Teacher (via TeacherSubjectAssignment)
        """
        user = request.user
        try:
            # Try to get teacher profile
            teacher = getattr(user, 'teacher_profile', None)
            if not teacher:
                # Fallback for some users who might have username as employee_code
                teacher = Teacher.objects.filter(employee_code=user.username).first()
            
            if not teacher:
                return Response({'error': 'Teacher profile not found'}, status=404)

            # 1. Class Teacher Assignments
            # Get classrooms where this teacher is assigned as class teacher
            # We check both M2M and legacy FK
            class_teacher_classrooms = list(teacher.assigned_classrooms.all())
            if teacher.assigned_classroom and teacher.assigned_classroom not in class_teacher_classrooms:
                class_teacher_classrooms.append(teacher.assigned_classroom)
            
            # Back-reference
            for cr in teacher.classroom_set.all():
                if cr not in class_teacher_classrooms:
                    class_teacher_classrooms.append(cr)

            # 2. Subject Teacher Assignments
            subject_assignments = TeacherSubjectAssignment.objects.filter(teacher=teacher).select_related('classroom', 'subject')
            
            # Grouping by classroom to keep it clean for the frontend
            classrooms_data = []
            
            # Add Class Teacher roles
            for cr in class_teacher_classrooms:
                classrooms_data.append({
                    'classroom_id': cr.id,
                    'classroom_code': cr.code,
                    'role': 'Class Teacher',
                    'subject_id': None,
                    'subject_name': 'All Subjects',
                    'grade_name': cr.grade.name,
                    'section': cr.section,
                    'shift': cr.shift
                })
            
            # Add Subject Teacher roles
            for sa in subject_assignments:
                classrooms_data.append({
                    'classroom_id': sa.classroom.id,
                    'classroom_code': sa.classroom.code,
                    'role': 'Subject Teacher',
                    'subject_id': sa.subject.id,
                    'subject_name': sa.subject.name,
                    'grade_name': sa.classroom.grade.name,
                    'section': sa.classroom.section,
                    'shift': sa.classroom.shift
                })
                
            return Response({
                'teacher_name': teacher.full_name,
                'is_class_teacher': teacher.is_class_teacher,
                'is_subject_teacher': teacher.is_subject_teacher,
                'assignments': classrooms_data
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    
    @decorators.action(detail=False, methods=['get'], url_path='total')
    def total_teachers(self, request):
        """Get total teacher count with filters applied"""
        queryset = self.filter_queryset(self.get_queryset())
        total = queryset.count()
        return Response({'totalTeachers': total})
    
    @decorators.action(detail=False, methods=['get'], url_path='gender_stats')
    def gender_stats(self, request):
        """Get gender distribution stats"""
        queryset = self.get_queryset()
        
        stats = queryset.aggregate(
            male=Count('id', filter=Q(gender='male')),
            female=Count('id', filter=Q(gender='female')),
            other=Count('id', filter=Q(gender__isnull=True) | Q(gender='other'))
        )
        
        return Response(stats)
    
    @decorators.action(detail=False, methods=['get'], url_path='campus_stats')
    def campus_stats(self, request):
        """Get campus-wise teacher distribution"""
        queryset = self.get_queryset()
        
        campus_data = queryset.values('current_campus__campus_name').annotate(
            count=Count('id')
        ).order_by('-count')
        
        data = []
        for item in campus_data:
            campus_name = item['current_campus__campus_name'] or 'Unknown Campus'
            data.append({
                'campus': campus_name,
                'count': item['count']
            })
        
        return Response(data)
    
    @decorators.action(detail=False, methods=['get'], url_path='check-email', permission_classes=[IsAuthenticated])
    def check_email(self, request):
        """Check if email already exists in Teacher or User models"""
        email = request.query_params.get('email')
        if not email:
            return Response({'exists': False})
        
        from users.models import User
        
        # Case-insensitive check in Teacher and User models
        teacher_exists = Teacher.objects.filter(email__iexact=email).exists()
        user_exists = User.objects.filter(email__iexact=email).exists()
        
        return Response({'exists': teacher_exists or user_exists})
    
    @decorators.action(detail=False, methods=['get'], url_path='check-cnic', permission_classes=[IsAuthenticated])
    def check_cnic(self, request):
        """Check if CNIC already exists"""
        cnic = request.query_params.get('cnic')
        if not cnic:
            return Response({'exists': False})
        
        # Check against both exact string (might include dashes) and cleaned digits
        clean_cnic = ''.join(filter(str.isdigit, cnic))
        formatted_cnic = f"{clean_cnic[:5]}-{clean_cnic[5:12]}-{clean_cnic[12:]}" if len(clean_cnic) == 13 else cnic
        
        exists = Teacher.objects.filter(Q(cnic=cnic) | Q(cnic=clean_cnic) | Q(cnic=formatted_cnic)).exists()
        return Response({'exists': exists})

    @decorators.action(detail=False, methods=['patch', 'put'], url_path='signature/save')
    def save_signature(self, request):
        """Save teacher's digital signature"""
        user = request.user
        try:
            teacher = getattr(user, 'teacher_profile', None)
            if not teacher:
                teacher = Teacher.objects.filter(employee_code=user.username).first()
            if not teacher:
                return Response({'error': 'Teacher profile not found'}, status=404)
            signature_data = request.data.get('signature')
            if not signature_data:
                return Response({'error': 'Signature data is required'}, status=400)
            teacher.signature = signature_data
            teacher.signature_updated_at = timezone.now()
            teacher.save(update_fields=['signature', 'signature_updated_at'])
            return Response({'message': 'Signature saved successfully', 'updated_at': teacher.signature_updated_at})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @decorators.action(detail=False, methods=['get'], url_path='signature/get')
    def get_signature(self, request):
        """Retrieve teacher's digital signature"""
        user = request.user
        try:
            teacher = getattr(user, 'teacher_profile', None)
            if not teacher:
                teacher = Teacher.objects.filter(employee_code=user.username).first()
            if not teacher:
                return Response({'error': 'Teacher profile not found'}, status=404)
            return Response({
                'signature': teacher.signature,
                'updated_at': teacher.signature_updated_at
            })
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @decorators.action(detail=False, methods=['get'], url_path='check-phone', permission_classes=[IsAuthenticated])
    def check_phone(self, request):
        """Check if Phone Number already exists"""
        phone = request.query_params.get('phone')
        if not phone:
            return Response({'exists': False})

        clean_phone = ''.join(filter(str.isdigit, phone))
        exists = Teacher.objects.filter(
            Q(contact_number=phone) |
            Q(contact_number__icontains=clean_phone)
        ).exists()
        return Response({'exists': exists})

    @decorators.action(detail=True, methods=['post'], url_path='upload-photo')
    def upload_photo(self, request, pk=None):
        """Upload or replace a teacher's profile photo (validated + re-encoded)."""
        from utils.image_upload import process_profile_photo, InvalidImageError
        teacher = self.get_object()
        try:
            safe_photo = process_profile_photo(
                request.FILES.get('photo'), filename_stem=f"teacher_{teacher.id}"
            )
        except InvalidImageError as e:
            return Response({'detail': str(e)}, status=400)
        try:
            teacher.photo = safe_photo
            teacher.save(update_fields=['photo'])
        except Exception as e:
            return Response({'detail': f'Error saving photo: {str(e)}'}, status=500)
        try:
            photo_url = request.build_absolute_uri(teacher.photo.url) if teacher.photo else ''
        except Exception:
            photo_url = teacher.photo.url if teacher.photo else ''
        return Response({'photo_url': photo_url})

    @decorators.action(detail=True, methods=['delete'], url_path='delete-photo')
    def delete_photo(self, request, pk=None):
        """Delete a teacher's profile photo from storage and clear the field."""
        teacher = self.get_object()
        if not teacher.photo:
            return Response({'detail': 'No photo found to delete.'}, status=400)
        try:
            teacher.photo.delete(save=False)
            teacher.photo = None
            teacher.save(update_fields=['photo'])
        except Exception as e:
            return Response({'detail': f'Error deleting photo: {str(e)}'}, status=500)
        return Response({'detail': 'Photo deleted'})


class TeacherBulkUploadView(APIView):
    """Upload a CSV file to create multiple teachers at once."""
    permission_classes = [IsAuthenticated, IsSuperAdminOrPrincipal]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        from .services.teacher_csv_import import import_teachers_from_csv

        upload = request.FILES.get('file')
        if not upload:
            return Response({'error': 'No file provided'}, status=400)

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.csv')
        try:
            for chunk in upload.chunks():
                tmp.write(chunk)
            tmp.flush()
            tmp.close()
            reports = import_teachers_from_csv(tmp.name, request.user)
            return Response({'reports': reports}, status=200)
        finally:
            try:
                os.unlink(tmp.name)
            except Exception:
                pass


class TeacherBulkUploadTemplateView(APIView):
    """Return an Excel-friendly template for bulk teacher upload."""
    permission_classes = [IsAuthenticated, IsSuperAdminOrPrincipal]

    def get(self, request):
        from .services.teacher_csv_import import TEMPLATE_HEADERS, SAMPLE_ROW
        from django.http import HttpResponse

        # Build an Excel-friendly HTML table template
        html = ['<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"/></head><body>']
        html.append('<table border="1"><tr>')
        
        # Header Row
        for h in TEMPLATE_HEADERS:
            html.append(f'<th style="background-color: #f2f2f2; font-weight: bold;">{h}</th>')
        html.append('</tr>')

        # Sample Row
        html.append('<tr>')
        for h in TEMPLATE_HEADERS:
            val = SAMPLE_ROW.get(h, '')
            html.append(f'<td>{val}</td>')
        html.append('</tr>')

        # Empty rows
        for _ in range(5):
            html.append('<tr>')
            for _ in TEMPLATE_HEADERS:
                html.append('<td></td>')
            html.append('</tr>')
        
        html.append('</table></body></html>')
        content = ''.join(html)

        response = HttpResponse(content, content_type='application/vnd.ms-excel; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="teacher_bulk_upload_template.xls"'
        return response


class TeacherSubjectAssignmentViewSet(viewsets.ModelViewSet):
    queryset = TeacherSubjectAssignment.objects.all()
    serializer_class = TeacherSubjectAssignmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superadmin():
            return self.queryset
        if hasattr(user, 'organization'):
            return self.queryset.filter(organization=user.organization)
        return self.queryset.none()