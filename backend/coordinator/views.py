from rest_framework import viewsets, decorators, response, permissions
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from .models import Coordinator
from .serializers import CoordinatorSerializer
from .filters import CoordinatorFilter
from users.permissions import IsNotDonorForWrites
from teachers.models import Teacher
from students.models import Student, FormOption
from classes.models import ClassRoom
from django.db.models import Count, Q
import logging

logger = logging.getLogger(__name__)


class CoordinatorViewSet(viewsets.ModelViewSet):
    queryset = Coordinator.objects.all()
    serializer_class = CoordinatorSerializer
    permission_classes = [permissions.IsAuthenticated, IsNotDonorForWrites]
    
    # Filtering, search, and ordering
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = CoordinatorFilter
    search_fields = ['full_name', 'employee_code', 'email']
    ordering_fields = ['full_name', 'joining_date', 'employee_code']
    ordering = ['-joining_date']  # Default ordering
    
    def get_queryset(self):
        """Override queryset to optimize queries and handle shift filtering"""
        queryset = Coordinator.objects.select_related('level', 'campus').prefetch_related('assigned_levels')
        
        # Get shift filter value from request
        shift = self.request.query_params.get('shift')
        
        if shift:
            if shift == 'both':
                # Only coordinators with assigned_levels (both shifts)
                queryset = queryset.filter(assigned_levels__isnull=False)
            else:
                # Single shift coordinators + both shift coordinators
                queryset = queryset.filter(
                    Q(level__shift=shift) |  # Single shift
                    Q(assigned_levels__isnull=False)  # Both shifts
                )
            
            queryset = queryset.distinct()
            
        return queryset
    
    def perform_create(self, serializer):
        """Set actor and organization before creating coordinator"""
        user = self.request.user
        save_kwargs = {}
        if not user.is_superadmin() and user.organization:
            save_kwargs['organization'] = user.organization
            
        instance = serializer.save(**save_kwargs)
        instance._actor = user
        instance.save()
    
    def perform_update(self, serializer):
        """Set actor before updating coordinator"""
        instance = serializer.save()
        instance._actor = self.request.user
        instance.save()
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to ensure soft delete is used - NEVER calls default delete"""
        logger.info(f"[DESTROY] destroy() method called for DELETE request")
        
        # Get the instance
        instance = self.get_object()
        coordinator_id = instance.id
        coordinator_name = instance.full_name
        
        logger.info(f"[DESTROY] Got coordinator instance: ID={coordinator_id}, Name={coordinator_name}, is_deleted={instance.is_deleted}")
        
        # Check if already deleted
        if instance.is_deleted:
            logger.warning(f"[DESTROY] Coordinator {coordinator_id} is already soft deleted")
            from rest_framework.exceptions import NotFound
            raise NotFound("Coordinator is already deleted.")
        
        # IMPORTANT: Call perform_destroy which does soft delete
        # DO NOT call super().destroy() as it would do hard delete
        logger.info(f"[DESTROY] Calling perform_destroy() for soft delete")
        self.perform_destroy(instance)
        
        # Verify the coordinator still exists in database (soft deleted, not hard deleted)
        try:
            from .models import Coordinator
            # Use with_deleted() to check if coordinator exists (even if soft deleted)
            still_exists = Coordinator.objects.with_deleted().filter(pk=coordinator_id).exists()
            if not still_exists:
                logger.error(f"[DESTROY] CRITICAL: Coordinator {coordinator_id} was HARD DELETED! This should not happen!")
                raise Exception(f"CRITICAL ERROR: Coordinator {coordinator_id} was permanently deleted instead of soft deleted!")
            else:
                # Check if it's soft deleted
                coordinator_check = Coordinator.objects.with_deleted().get(pk=coordinator_id)
                if coordinator_check.is_deleted:
                    logger.info(f"[DESTROY] SUCCESS: Coordinator {coordinator_id} is soft deleted (is_deleted=True)")
                else:
                    logger.error(f"[DESTROY] ERROR: Coordinator {coordinator_id} exists but is_deleted is False!")
        except Coordinator.DoesNotExist:
            logger.error(f"[DESTROY] CRITICAL: Coordinator {coordinator_id} does not exist in database - was HARD DELETED!")
            raise Exception(f"CRITICAL ERROR: Coordinator {coordinator_id} was permanently deleted!")
        
        logger.info(f"[DESTROY] destroy() completed successfully")
        from rest_framework import status
        from rest_framework.response import Response
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    def perform_destroy(self, instance):
        """Soft delete coordinator and create audit log"""
        import logging
        logger = logging.getLogger(__name__)
        
        instance._actor = self.request.user
        
        # Store coordinator info before deletion for audit log
        coordinator_id = instance.id
        coordinator_name = instance.full_name
        coordinator_campus = instance.campus
        
        # Get user name for audit log
        user = self.request.user
        user_name = user.get_full_name() if hasattr(user, 'get_full_name') else (user.username or 'Unknown')
        user_role = user.get_role_display() if hasattr(user, 'get_role_display') else (user.role or 'User')
        
        # Log before soft delete
        logger.info(f"[SOFT_DELETE] Starting soft delete for coordinator ID: {coordinator_id}, Name: {coordinator_name}")
        logger.info(f"[SOFT_DELETE] Coordinator is_deleted before: {instance.is_deleted}")
        
        # Soft delete the coordinator (instead of hard delete)
        # This uses update() to directly modify database, does NOT call .delete()
        # This ensures no post_delete signal is triggered
        try:
            instance.soft_delete()
            logger.info(f"[SOFT_DELETE] soft_delete() method called successfully")
            
            # Verify soft delete worked
            instance.refresh_from_db()
            logger.info(f"[SOFT_DELETE] Coordinator is_deleted after refresh: {instance.is_deleted}")
            
            if not instance.is_deleted:
                logger.error(f"[SOFT_DELETE] CRITICAL ERROR: Soft delete failed! Coordinator {coordinator_id} is_deleted is still False!")
                raise Exception(f"Soft delete failed for coordinator {coordinator_id} - is_deleted is still False after soft_delete() call")
            
            logger.info(f"[SOFT_DELETE] Soft delete successful for coordinator {coordinator_id}")
        except Exception as e:
            logger.error(f"[SOFT_DELETE] ERROR during soft_delete(): {str(e)}")
            raise
        
        # Create audit log after soft deletion
        try:
            from attendance.models import AuditLog
            AuditLog.objects.create(
                feature='coordinator',
                action='delete',
                entity_type='Coordinator',
                entity_id=coordinator_id,
                user=user,
                ip_address=self.request.META.get('REMOTE_ADDR'),
                changes={'name': coordinator_name, 'coordinator_id': coordinator_id, 'campus_id': coordinator_campus.id if coordinator_campus else None},
                reason=f'Coordinator {coordinator_name} deleted by {user_role} {user_name}'
            )
        except Exception as e:
            # Log error but don't fail the deletion
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create audit log for coordinator deletion: {str(e)}")
    
    def create(self, request, *args, **kwargs):
        """Override create method to add debug logging"""
        logger.info(f"Received coordinator data: {request.data}")
        logger.info(f"DOB field value: {request.data.get('dob')}")
        logger.info(f"DOB field type: {type(request.data.get('dob'))}")
        
        # Check for null values in required fields
        required_fields = ['full_name', 'dob', 'gender', 'contact_number', 'email', 'cnic', 
                          'permanent_address', 'education_level', 'institution_name', 
                          'year_of_passing', 'total_experience_years', 'joining_date']
        
        for field in required_fields:
            value = request.data.get(field)
            logger.info(f"Field {field}: {value} (type: {type(value)})")
            if value is None or value == '':
                logger.warning(f"Field {field} is null or empty!")
        
        try:
            return super().create(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error creating coordinator: {str(e)}")
            logger.error(f"Request data: {request.data}")
            raise
    
    def update(self, request, *args, **kwargs):
        """Override update method to add debug logging"""
        logger.info(f"Updating coordinator {kwargs.get('pk')} with data: {request.data}")
        logger.info(f"Request method: {request.method}")
        
        try:
            return super().update(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error updating coordinator: {str(e)}")
            logger.error(f"Request data: {request.data}")
            raise
    
    def partial_update(self, request, *args, **kwargs):
        """Override partial_update method to add debug logging"""
        logger.info(f"Partially updating coordinator {kwargs.get('pk')} with data: {request.data}")
        logger.info(f"Request method: {request.method}")
        
        try:
            return super().partial_update(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error partially updating coordinator: {str(e)}")
            logger.error(f"Request data: {request.data}")
            raise
    
    def get_queryset(self):
        """Override to handle role-based filtering and optimize queries"""
        queryset = Coordinator.objects.select_related('campus').all()
        
        # Role-based filtering
        user = self.request.user
        if hasattr(user, 'is_principal') and user.is_principal():
            # Principal: Only show coordinators from their campus (if assigned) or organization
            campus = getattr(user, 'campus', None)
            if campus:
                queryset = queryset.filter(campus=campus)
            elif user.organization:
                queryset = queryset.filter(organization=user.organization)
            else:
                queryset = queryset.none()
        
        # Handle shift filtering
        shift_filter = self.request.query_params.get('shift')
        if shift_filter:
            if shift_filter in ['morning', 'afternoon']:
                # Filter coordinators who work this specific shift or both
                queryset = queryset.filter(
                    Q(shift=shift_filter) | Q(shift='both')
                )
            elif shift_filter == 'both':
                # Show only coordinators who work both shifts
                queryset = queryset.filter(shift='both')
        
        return queryset

    @decorators.action(detail=True, methods=["get"])
    def teachers(self, request, pk=None):
        """Get all teachers assigned to this coordinator"""
        coordinator = self.get_object()

        # Collect teacher IDs from both sources and union them
        teacher_ids = set()

        # Source 1: direct M2M assignment
        direct_ids = Teacher.objects.filter(
            assigned_coordinators=coordinator,
            is_currently_active=True
        ).values_list('id', flat=True)
        teacher_ids.update(direct_ids)

        # Source 2: level-based (classroom class teachers under managed levels)
        managed_levels = []
        if coordinator.assigned_levels.exists():
            managed_levels = list(coordinator.assigned_levels.all())
        if not managed_levels and coordinator.level:
            managed_levels = [coordinator.level]

        if managed_levels:
            classrooms = ClassRoom.objects.filter(
                grade__level__in=managed_levels
            ).select_related('class_teacher')
            for classroom in classrooms:
                if classroom.class_teacher:
                    teacher_ids.add(classroom.class_teacher.id)

        teachers = Teacher.objects.filter(
            id__in=teacher_ids,
            is_currently_active=True
        ).select_related(
            'current_campus',
            'assigned_classroom',
            'assigned_classroom__grade__level'
        ).prefetch_related(
            'assigned_coordinators',
            'assigned_classrooms',
            'assigned_classrooms__grade__level',
            'classroom_set',
            'classroom_set__grade__level'
        )
        
        # Serialize teacher data
        teachers_data = []
        for teacher in teachers:
            # Collect all classrooms from different fields
            all_classrooms = set()
            if teacher.assigned_classroom:
                all_classrooms.add(teacher.assigned_classroom)
            
            for cr in teacher.assigned_classrooms.all():
                all_classrooms.add(cr)
            
            for cr in teacher.classroom_set.all():
                all_classrooms.add(cr)
            
            # Format classes and levels
            class_list = []
            level_list = []
            for cr in all_classrooms:
                class_list.append(f"{cr.grade.name} - {cr.section}")
                if cr.grade.level:
                    level_list.append(cr.grade.level.name)
            
            # Remove duplicates and join
            classes_str = ", ".join(sorted(list(set(class_list)))) or teacher.current_classes_taught or 'Not Assigned'
            levels_str = ", ".join(sorted(list(set(level_list)))) or 'Not Assigned'

            teachers_data.append({
                'id': teacher.id,
                'full_name': teacher.full_name,
                'photo': request.build_absolute_uri(teacher.photo.url) if teacher.photo else None,
                'employee_code': teacher.employee_code,
                'email': teacher.email,
                'contact_number': teacher.contact_number,
                'current_subjects': teacher.current_subjects,
                'current_classes_taught': classes_str,
                'levels': levels_str,
                'shift': teacher.shift,
                'is_class_teacher': teacher.is_class_teacher,
                'assigned_classroom': f"{teacher.assigned_classroom.grade.name} - {teacher.assigned_classroom.section}" if teacher.assigned_classroom else None,
                'joining_date': teacher.joining_date,
                'total_experience_years': teacher.total_experience_years,
                'is_currently_active': teacher.is_currently_active,
            })
        
        return response.Response({
            'coordinator': {
                'id': coordinator.id,
                'full_name': coordinator.full_name,
                'employee_code': coordinator.employee_code,
                'campus_name': coordinator.campus.campus_name if coordinator.campus else None,
            },
            'teachers': teachers_data,
            'total_teachers': len(teachers_data)
        })

    @decorators.action(detail=True, methods=["get"])
    def dashboard_stats(self, request, pk=None):
        """Get dashboard statistics for coordinator"""
        coordinator = self.get_object()
        
        # Get teachers count from both direct assignment and level-based assignment
        teacher_ids = set(Teacher.objects.filter(
            assigned_coordinators=coordinator,
            is_currently_active=True
        ).values_list('id', flat=True))

        managed_levels = []
        if coordinator.assigned_levels.exists():
            managed_levels = list(coordinator.assigned_levels.all())
        if not managed_levels and coordinator.level:
            managed_levels = [coordinator.level]

        if managed_levels:
            classrooms = ClassRoom.objects.filter(
                grade__level__in=managed_levels
            ).select_related('class_teacher')
            for classroom in classrooms:
                if classroom.class_teacher:
                    teacher_ids.add(classroom.class_teacher.id)

        teachers_count = len(teacher_ids)
        
        # Get students count from coordinator's managed classrooms
        students_count = 0
        if coordinator.campus:
            # Get students from classrooms under this coordinator's levels
            managed_levels = []
            if coordinator.assigned_levels.exists():
                managed_levels = list(coordinator.assigned_levels.all())
            if not managed_levels and coordinator.level:
                managed_levels = [coordinator.level]
            
            if managed_levels:
                classrooms = ClassRoom.objects.filter(
                    grade__level__in=managed_levels
                ).values_list('id', flat=True)
                
                students_count = Student.objects.filter(
                    classroom__in=classrooms,
                    is_deleted=False
                ).count()
            else:
                # Fallback to campus-wide count
                students_count = Student.objects.filter(
                    campus=coordinator.campus,
                    is_deleted=False
                ).count()
        
        # Get classes count for this coordinator's level and campus
        classes_count = 0
        if coordinator.campus:
            managed_levels = []
            if coordinator.assigned_levels.exists():
                managed_levels = list(coordinator.assigned_levels.all())
            if not managed_levels and coordinator.level:
                managed_levels = [coordinator.level]
            
            if managed_levels:
                classes_count = ClassRoom.objects.filter(
                    grade__level__in=managed_levels,
                    grade__level__campus=coordinator.campus
                ).count()
        
        # Get pending requests (if any)
        pending_requests = 0  # This would need to be implemented based on your request system
        
        # Get teacher distribution by subjects (union of both sources)
        teachers = Teacher.objects.filter(
            id__in=teacher_ids,
            is_currently_active=True
        )
        
        subject_distribution = {}
        teachers_with_subjects = 0
        
        for teacher in teachers:
            if teacher.current_subjects:
                # Split subjects by comma and clean them
                subjects = [s.strip() for s in teacher.current_subjects.split(',') if s.strip()]
                if subjects:
                    teachers_with_subjects += 1
                for subject in subjects:
                    subject_distribution[subject] = subject_distribution.get(subject, 0) + 1
        
        # Calculate total teachers for percentage calculation
        total_teachers_for_subjects = teachers_count if teachers_count > 0 else len(teachers)
        
        # Add "none" category for teachers without subjects
        teachers_without_subjects = total_teachers_for_subjects - teachers_with_subjects
        if teachers_without_subjects > 0:
            subject_distribution['none'] = teachers_without_subjects
        
        # Convert to list format for frontend with percentage
        subject_data = []
        for subject, count in subject_distribution.items():
            # Calculate percentage based on total teachers
            percentage = (count / total_teachers_for_subjects * 100) if total_teachers_for_subjects > 0 else 0
            subject_data.append({
                'name': subject,
                'value': count,
                'percentage': round(percentage, 1),  # Round to 1 decimal place
                'color': f'#{hash(subject) % 0xFFFFFF:06x}'  # Generate color based on subject name
            })
        
        return response.Response({
            'coordinator': {
                'id': coordinator.id,
                'full_name': coordinator.full_name,
                'employee_code': coordinator.employee_code,
                'campus_name': coordinator.campus.campus_name if coordinator.campus else None,
            },
            'stats': {
                'total_teachers': teachers_count,
                'total_students': students_count,
                'total_classes': classes_count,
                'pending_requests': pending_requests,
            },
            'subject_distribution': subject_data
        })
    
    @decorators.action(detail=True, methods=["get"])
    def attendance_status(self, request, pk=None):
        """Attendance marking status for the coordinator's classes on a given date.

        Returns, grouped by grade, how many class teachers have marked attendance
        (status submitted/under_review/approved) and which class teachers have
        not yet marked — with the grade/section they teach so the coordinator can
        chase them. The date defaults to today.
        Holidays are excluded from unmarked counts.
        """
        from datetime import datetime, date as date_cls
        from attendance.models import Attendance
        from attendance.services.calendar_utils import holiday_index_in_range

        coordinator = self.get_object()

        date_str = request.query_params.get('date')
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return response.Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)
        else:
            target_date = date_cls.today()

        # Collect classrooms under this coordinator's levels.
        managed_levels = []
        if coordinator.assigned_levels.exists():
            managed_levels = list(coordinator.assigned_levels.all())
        if not managed_levels and coordinator.level:
            managed_levels = [coordinator.level]

        if not managed_levels:
            return response.Response({
                'date': target_date.isoformat(),
                'grades': [],
                'total_classrooms': 0,
                'marked_count': 0,
                'unmarked_count': 0,
            })

        classrooms = ClassRoom.objects.filter(
            grade__level__in=managed_levels
        ).select_related(
            'grade__level', 'grade__level__campus', 'class_teacher'
        ).prefetch_related('class_teacher__user')

        # Holiday lookup for the target date
        holiday_idx = holiday_index_in_range(
            organization_id=request.user.organization_id if request.user.organization_id else None,
            from_date=target_date,
            to_date=target_date,
        )

        # Classrooms that already have an attendance record for the target date
        # at submitted-or-higher status (a draft counts as NOT marked).
        marked_classroom_ids = set(
            Attendance.objects.filter(
                classroom_id__in=classrooms.values_list('id', flat=True),
                date=target_date,
                status__in=['submitted', 'under_review', 'approved'],
                is_deleted=False,
            ).values_list('classroom_id', flat=True)
        )

        grades_map = {}
        total_classrooms = 0
        marked_count = 0
        unmarked_count = 0
        holiday_count = 0

        for classroom in classrooms:
            total_classrooms += 1
            grade_name = classroom.grade.name if classroom.grade else 'Ungraded'
            level_obj = classroom.grade.level if classroom.grade else None
            grade_key = (level_obj.id if level_obj else -1, grade_name)

            # Check if this classroom has a holiday
            level_id = level_obj.id if level_obj else None
            grade_id = classroom.grade.id if classroom.grade else None
            is_holiday_for_classroom = False
            holiday_reason = None
            if level_id is not None:
                holiday_dates = holiday_idx.for_classroom(level_id=level_id, grade_id=grade_id)
                if target_date in holiday_dates:
                    is_holiday_for_classroom = True
                    holiday_reason = 'Holiday'

            if grade_key not in grades_map:
                grades_map[grade_key] = {
                    'grade': grade_name,
                    'level': level_obj.name if level_obj else None,
                    'shift': classroom.shift,
                    'total_classrooms': 0,
                    'marked_count': 0,
                    'holiday_count': 0,
                    'unmarked_teachers': [],
                }

            grade_entry = grades_map[grade_key]
            grade_entry['total_classrooms'] += 1

            if is_holiday_for_classroom:
                grade_entry['holiday_count'] += 1
                holiday_count += 1
                continue

            teacher = classroom.class_teacher
            marked = classroom.id in marked_classroom_ids
            if marked:
                marked_count += 1
                grade_entry['marked_count'] += 1
            else:
                unmarked_count += 1
                teacher_data = None
                if teacher:
                    teacher_data = {
                        'teacher_id': teacher.id,
                        'full_name': teacher.full_name,
                        'employee_code': teacher.employee_code,
                        'email': teacher.email,
                        'classroom_id': classroom.id,
                        'section': classroom.section,
                        'grade': grade_name,
                        'has_user': bool(getattr(teacher, 'user_id', None)),
                    }
                else:
                    teacher_data = {
                        'teacher_id': None,
                        'full_name': 'Unassigned',
                        'employee_code': None,
                        'email': None,
                        'classroom_id': classroom.id,
                        'section': classroom.section,
                        'grade': grade_name,
                        'has_user': False,
                    }
                grade_entry['unmarked_teachers'].append(teacher_data)

        # Stable grade ordering
        def grade_sort_key(item):
            (level_id, grade_name), _ = item
            return (level_id if level_id != -1 else 9999, grade_name)

        grades = [entry for _, entry in sorted(grades_map.items(), key=grade_sort_key)]

        return response.Response({
            'date': target_date.isoformat(),
            'grades': grades,
            'total_classrooms': total_classrooms,
            'marked_count': marked_count,
            'unmarked_count': unmarked_count,
            'holiday_count': holiday_count,
        })

    @decorators.action(detail=True, methods=["post"], url_path='attendance-status/remind')
    def remind_attendance(self, request, pk=None):
        """Send a reminder to every class teacher who has not marked attendance yet.

        POST /api/coordinators/<id>/attendance-status/remind/
            { "date": "YYYY-MM-DD" (optional, defaults to today),
              "classroom_ids": [int, ...] (optional, restrict to these) }

        Reuses the same reminder notification path as the attendance review screen
        so a coordinator can nudge everyone who is behind in a single click.
        """
        from datetime import datetime, date as date_cls
        from django.contrib.auth import get_user_model
        from attendance.models import Attendance
        from notifications.services import create_notification

        coordinator = self.get_object()

        date_str = request.data.get('date')
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return response.Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)
        else:
            target_date = date_cls.today()

        managed_levels = []
        if coordinator.assigned_levels.exists():
            managed_levels = list(coordinator.assigned_levels.all())
        if not managed_levels and coordinator.level:
            managed_levels = [coordinator.level]

        if not managed_levels:
            return response.Response({'error': 'Coordinator has no assigned levels.'}, status=400)

        classrooms_qs = ClassRoom.objects.filter(
            grade__level__in=managed_levels
        ).select_related('grade', 'class_teacher')

        restrict_ids = request.data.get('classroom_ids')
        if restrict_ids:
            try:
                restrict_ids = [int(x) for x in restrict_ids]
                classrooms_qs = classrooms_qs.filter(id__in=restrict_ids)
            except (TypeError, ValueError):
                return response.Response({'error': 'classroom_ids must be a list of integers.'}, status=400)

        classrooms = list(classrooms_qs)

        marked_classroom_ids = set(
            Attendance.objects.filter(
                classroom_id__in=[c.id for c in classrooms],
                date=target_date,
                status__in=['submitted', 'under_review', 'approved'],
                is_deleted=False,
            ).values_list('classroom_id', flat=True)
        )

        User = get_user_model()
        sent = 0
        skipped = []

        for classroom in classrooms:
            if classroom.id in marked_classroom_ids:
                continue
            teacher = classroom.class_teacher
            if teacher is None:
                skipped.append({'classroom_id': classroom.id, 'reason': 'no_class_teacher'})
                continue

            teacher_user = None
            if getattr(teacher, 'user_id', None):
                teacher_user = teacher.user
            elif teacher.employee_code:
                teacher_user = User.objects.filter(username=teacher.employee_code).first()
            if teacher_user is None and teacher.email:
                teacher_user = User.objects.filter(email=teacher.email).first()

            if teacher_user is None:
                skipped.append({'classroom_id': classroom.id, 'reason': 'no_teacher_account'})
                continue

            create_notification(
                recipient=teacher_user,
                actor=request.user,
                verb='attendance_reminder',
                target_text=f"Attendance is outstanding for {classroom} on {target_date.isoformat()}.",
                data={
                    'classroom_id': classroom.id,
                    'classroom_name': str(classroom),
                    'date': target_date.isoformat(),
                    'kind': 'attendance_reminder',
                },
            )
            sent += 1

        return response.Response({
            'sent': sent,
            'skipped': len(skipped),
            'date': target_date.isoformat(),
            'details': skipped,
        })

    @decorators.action(detail=True, methods=["get"])
    def classrooms(self, request, pk=None):
        """Get all classrooms under this coordinator"""
        coordinator = self.get_object()
        
        # Get classrooms using the model method
        classrooms = coordinator.get_assigned_classrooms()
        
        # Serialize classroom data
        classroom_data = []
        for classroom in classrooms:
            # Get student count for this classroom
            student_count = Student.objects.filter(
                classroom=classroom,
                is_deleted=False
            ).count()
            
            classroom_data.append({
                'id': classroom.id,
                'name': str(classroom),  # Grade - Section
                'code': classroom.code,
                'grade': classroom.grade.name,
                'section': classroom.section,
                'shift': classroom.shift,
                'level': {
                    'id': classroom.grade.level.id,
                    'name': classroom.grade.level.name
                } if classroom.grade.level else None,
                'class_teacher': {
                    'id': classroom.class_teacher.id,
                    'full_name': classroom.class_teacher.full_name,
                    'employee_code': classroom.class_teacher.employee_code
                } if classroom.class_teacher else None,
                'student_count': student_count,
                'capacity': classroom.capacity
            })
        
        return response.Response(classroom_data)

    @decorators.action(detail=False, methods=['get'], url_path='form_options')
    def form_options(self, request):
        """
        Returns lists of choices for dropdowns in coordinator forms.
        """
        # Get active organization if multi-tenancy is active
        org = getattr(request.user, 'organization', None) if hasattr(request, 'user') else None
        
        from students.models import FormOption
        qs = FormOption.objects.filter(is_active=True)
        if org:
            qs = qs.filter(organization=org)
        else:
            qs = qs.filter(organization__isnull=True)
            
        # Optional: Seed defaults if completely empty for this org
        if not qs.exists():
            default_seeds = {
                'gender': [('male', 'Male'), ('female', 'Female')],
                'religion': [('islam', 'Islam'), ('hinduism', 'Hinduism'), ('christianity', 'Christianity'), ('other', 'Other')],
                'marital_status': [('single', 'Single'), ('married', 'Married'), ('divorced', 'Divorced'), ('widowed', 'Widowed')],
                'education_level': [('matric', 'Matric'), ('intermediate', 'Intermediate'), ('bachelors', 'Bachelors'), ('masters', 'Masters'), ('phd', 'PhD'), ('other', 'Other')],
            }
            
            for cat, values in default_seeds.items():
                for v, l in values:
                    FormOption.objects.get_or_create(
                        organization=org,
                        category=cat,
                        value=v,
                        label=l
                    )
            
            qs = FormOption.objects.filter(is_active=True)
            if org:
                qs = qs.filter(organization=org)
            else:
                qs = qs.filter(organization__isnull=True)

        # Filter categories relevant to coordinators
        relevant_categories = ['gender', 'religion', 'marital_status', 'education_level', 'shift']
        options = {cat: [] for cat in relevant_categories}
        
        for opt in qs:
            if opt.category in options:
                options[opt.category].append({'value': opt.value, 'label': opt.label})
        
        # Add static choices if not in DB
        if not options['shift']:
            options['shift'] = [
                {'value': 'morning', 'label': 'Morning'},
                {'value': 'afternoon', 'label': 'Afternoon'},
                {'value': 'both', 'label': 'Morning + Afternoon'}
            ]
            
        return response.Response(options)

    @decorators.action(detail=False, methods=['get'], url_path='check-email')
    def check_email(self, request):
        """Check if email already exists in any staff/user role"""
        email = request.query_params.get('email')
        if not email:
            return response.Response({'exists': False})
            
        from users.models import User
        from principals.models import Principal
        exists = User.objects.filter(email=email).exists() or \
                 Coordinator.objects.filter(email=email).exists() or \
                 Teacher.objects.filter(email=email).exists() or \
                 Principal.objects.filter(email=email).exists()
                 
        return response.Response({'exists': exists})

    @decorators.action(detail=False, methods=['get'], url_path='check-cnic')
    def check_cnic(self, request):
        """Check if CNIC already exists for any staff member"""
        cnic = request.query_params.get('cnic')
        if not cnic:
            return response.Response({'exists': False})
            
        # Remove dashes for comparison if needed, though they are usually stored with dashes
        from principals.models import Principal
        exists = Coordinator.objects.filter(cnic=cnic).exists() or \
                 Teacher.objects.filter(cnic=cnic).exists() or \
                 Principal.objects.filter(cnic=cnic).exists()
                 
        return response.Response({'exists': exists})

    @decorators.action(detail=False, methods=['get'], url_path='check-phone')
    def check_phone(self, request):
        """Check if phone number already exists for any staff member"""
        phone = request.query_params.get('phone')
        if not phone:
            return response.Response({'exists': False})
        exists = Coordinator.objects.filter(contact_number=phone).exists() or \
                 Teacher.objects.filter(contact_number=phone).exists()
        return response.Response({'exists': exists})

    @decorators.action(detail=False, methods=['patch', 'put'], url_path='signature/save')
    def save_signature(self, request):
        """Save coordinator's digital signature"""
        from django.utils import timezone
        user = request.user
        try:
            coordinator = Coordinator.get_for_user(user)
            if not coordinator:
                return response.Response({'error': 'Coordinator profile not found'}, status=404)
            signature_data = request.data.get('signature')
            if not signature_data:
                return response.Response({'error': 'Signature data is required'}, status=400)
            coordinator.signature = signature_data
            coordinator.signature_updated_at = timezone.now()
            coordinator.save(update_fields=['signature', 'signature_updated_at'])
            return response.Response({'message': 'Signature saved successfully', 'updated_at': coordinator.signature_updated_at})
        except Exception as e:
            return response.Response({'error': str(e)}, status=400)

    @decorators.action(detail=False, methods=['get'], url_path='signature/get')
    def get_signature(self, request):
        """Retrieve coordinator's digital signature"""
        user = request.user
        try:
            coordinator = Coordinator.get_for_user(user)
            if not coordinator:
                return response.Response({'error': 'Coordinator profile not found'}, status=404)
            return response.Response({
                'signature': coordinator.signature,
                'updated_at': coordinator.signature_updated_at
            })
        except Exception as e:
            return response.Response({'error': str(e)}, status=400)

    @decorators.action(detail=True, methods=['post'], url_path='upload-photo')
    def upload_photo(self, request, pk=None):
        """Upload or replace a coordinator's profile photo.

        Expects a multipart/form-data POST with a file field named 'photo'.
        Saves the file to Coordinator.photo and returns the photo URL.
        """
        from utils.image_upload import process_profile_photo, InvalidImageError
        coordinator = self.get_object()
        try:
            safe_photo = process_profile_photo(
                request.FILES.get('photo'), filename_stem=f"coordinator_{coordinator.id}"
            )
        except InvalidImageError as e:
            return response.Response({'detail': str(e)}, status=400)
        try:
            coordinator.photo = safe_photo
            coordinator.save(update_fields=['photo'])
        except Exception as e:
            return response.Response({'detail': f'Error saving photo: {str(e)}'}, status=500)
        try:
            photo_url = request.build_absolute_uri(coordinator.photo.url) if coordinator.photo else ''
        except Exception:
            photo_url = coordinator.photo.url if coordinator.photo else ''
        return response.Response({'photo_url': photo_url})

    @decorators.action(detail=True, methods=['delete'], url_path='delete-photo')
    def delete_photo(self, request, pk=None):
        """Delete a coordinator's profile photo from storage and clear the field."""
        coordinator = self.get_object()
        if not coordinator.photo:
            return response.Response({'detail': 'No photo found to delete.'}, status=400)
        try:
            coordinator.photo.delete(save=False)
            coordinator.photo = None
            coordinator.save(update_fields=['photo'])
        except Exception as e:
            return response.Response({'detail': f'Error deleting photo: {str(e)}'}, status=500)
        return response.Response({'detail': 'Photo deleted'})