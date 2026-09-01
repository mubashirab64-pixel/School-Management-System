from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count
from django.utils import timezone
from .models import Level, Grade, ClassRoom
from .serializers import LevelSerializer, GradeSerializer, ClassRoomSerializer
from notifications.services import create_notification

class LevelViewSet(viewsets.ModelViewSet):
    queryset = Level.objects.all()
    serializer_class = LevelSerializer
    
    # Filtering, search, and ordering
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['name', 'code']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']  # Default ordering
    
    def get_queryset(self):
        user = self.request.user
        queryset = Level.objects.select_related('campus')
        
        # If user is tied to a specific campus, restrict to that
        if user.campus:
            queryset = queryset.filter(campus=user.campus)
        # Otherwise, follow organizational scoping (manager handled)
        
        # Filter by campus_id if provided via parameters
        campus_id = self.request.query_params.get('campus_id')
        if campus_id:
            queryset = queryset.filter(campus_id=campus_id)
        
        return queryset
    
    def perform_create(self, serializer):
        user = self.request.user
        
        # Automatically set organization if user belongs to one
        save_kwargs = {}
        if not user.is_superadmin() and user.organization:
            save_kwargs['organization'] = user.organization
            
        # Existing logic for campus assignment
        if user.is_principal():
            campus_id = self.request.data.get('campus')
            if campus_id:
                from campus.models import Campus
                try:
                    campus = Campus.objects.get(id=campus_id)
                    save_kwargs['campus'] = campus
                except Campus.DoesNotExist:
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError({'campus': 'Invalid campus ID provided'})
            else:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'campus': 'Campus field is required for principals'})
        
        serializer.save(**save_kwargs)
    
    @action(detail=True, methods=['post'])
    def assign_coordinator(self, request, pk=None):
        """Assign a coordinator to this level"""
        level = self.get_object()
        coordinator_id = request.data.get('coordinator_id')
        
        if not coordinator_id:
            return Response(
                {'error': 'coordinator_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from coordinator.models import Coordinator
            
            # Get the coordinator
            coordinator = Coordinator.objects.get(id=coordinator_id)
            
            # Validate coordinator has a campus assigned
            if not coordinator.campus:
                return Response(
                    {'error': 'Coordinator must be assigned to a campus first'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate coordinator belongs to same campus
            if level.campus != coordinator.campus:
                return Response(
                    {'error': 'Coordinator must belong to the same campus as the level'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Always use M2M so a coordinator can manage multiple levels
            coordinator.assigned_levels.add(level)
            # Also set the FK to the most recently assigned level for backwards compatibility
            coordinator.level = level
            coordinator.save(update_fields=['level'])
            
            serializer = self.get_serializer(level)
            return Response({
                'message': 'Coordinator assigned successfully',
                'level': serializer.data
            })
            
        except Coordinator.DoesNotExist:
            return Response(
                {'error': 'Coordinator not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def unassign_coordinator(self, request, pk=None):
        """Unassign the coordinator from this level"""
        level = self.get_object()
        try:
            from coordinator.models import Coordinator
            
            # 1. Clear single FK assignment
            # Using update() to be efficient
            Coordinator.objects.filter(level=level).update(level=None)
            
            # 2. Clear M2M assignment (for 'both' shift)
            # Find coordinators who have this level in their assigned_levels
            m2m_coords = Coordinator.objects.filter(assigned_levels=level)
            for coord in m2m_coords:
                coord.assigned_levels.remove(level)
            
            serializer = self.get_serializer(level)
            return Response({
                'message': 'Coordinator unassigned successfully',
                'level': serializer.data
            })
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def unassign_teacher(self, request, pk=None):
        """Unassign the current class teacher from this classroom"""
        classroom = self.get_object()
        try:
            old_teacher = classroom.class_teacher
            if not old_teacher:
                return Response({'message': 'No teacher assigned'}, status=status.HTTP_200_OK)

            # Clear classroom assignment
            classroom.class_teacher = None
            classroom.assigned_by = request.user
            classroom.assigned_at = timezone.now()
            classroom.save()

            # Update teacher flags (respect multi-classroom setup)
            # Remove this classroom from the teacher's multi-classroom list
            try:
                old_teacher.assigned_classrooms.remove(classroom)
            except Exception:
                pass

            # Clear legacy single-class link only if it was pointing to this classroom
            if old_teacher.assigned_classroom_id == classroom.id:
                old_teacher.assigned_classroom = None

            # Recalculate is_class_teacher based on remaining classrooms
            has_other_classes = (
                old_teacher.assigned_classroom is not None
                or old_teacher.assigned_classrooms.exists()
            )
            old_teacher.is_class_teacher = has_other_classes

            old_teacher.classroom_assigned_by = None if not has_other_classes else old_teacher.classroom_assigned_by
            if not has_other_classes:
                old_teacher.classroom_assigned_at = None

            # Skip generic "profile updated" notification; we'll send a specific one
            setattr(old_teacher, '_skip_profile_notification', True)
            old_teacher.save()

            serializer = self.get_serializer(classroom)

            # Send specific unassign notification
            teacher_user = getattr(old_teacher, 'user', None)
            if not teacher_user and old_teacher.email:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                teacher_user = User.objects.filter(email__iexact=old_teacher.email).first()
            if not teacher_user and old_teacher.employee_code:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                teacher_user = User.objects.filter(username=old_teacher.employee_code).first()

            if teacher_user:
                campus_name = getattr(getattr(classroom, 'campus', None), 'campus_name', '')
                actor = request.user
                actor_name = actor.get_full_name() if hasattr(actor, 'get_full_name') else str(actor)
                grade_name = getattr(getattr(classroom, 'grade', None), 'name', None) or getattr(classroom, 'grade_name', None) or 'Class'
                section = getattr(classroom, 'section', '') or ''
                shift = getattr(classroom, 'shift', '') or ''
                class_label = f"{grade_name} - {section}"
                if shift:
                    class_label = f"{class_label} ({shift})"

                verb = "You have been unassigned as class teacher"
                target_text = (
                    f"from {class_label} "
                    f"by {actor_name}"
                    + (f" at {campus_name}" if campus_name else "")
                )
                create_notification(
                    recipient=teacher_user,
                    actor=actor,
                    verb=verb,
                    target_text=target_text,
                    data={
                        "teacher_id": old_teacher.id,
                        "classroom_id": classroom.id,
                        "class_label": class_label,
                        "action": "unassigned_class_teacher",
                    },
                )

            return Response({'message': 'Teacher unassigned successfully', 'classroom': serializer.data})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unassign_classroom_teacher(request, pk: int):
    """Unassign the current class teacher (function-based alternative)."""
    try:
        classroom = ClassRoom.objects.get(pk=pk)
        old_teacher = classroom.class_teacher
        if not old_teacher:
            return Response({'message': 'No teacher assigned'})

        classroom.class_teacher = None
        classroom.assigned_by = request.user
        classroom.assigned_at = timezone.now()
        classroom.save()

        # Mirror logic from viewset unassign
        try:
            old_teacher.assigned_classrooms.remove(classroom)
        except Exception:
            pass

        if old_teacher.assigned_classroom_id == classroom.id:
            old_teacher.assigned_classroom = None

        has_other_classes = (
            old_teacher.assigned_classroom is not None
            or old_teacher.assigned_classrooms.exists()
        )
        old_teacher.is_class_teacher = has_other_classes
        old_teacher.classroom_assigned_by = None if not has_other_classes else old_teacher.classroom_assigned_by
        if not has_other_classes:
            old_teacher.classroom_assigned_at = None

        setattr(old_teacher, '_skip_profile_notification', True)
        old_teacher.save()

        serializer = ClassRoomSerializer(classroom)
        return Response({'message': 'Teacher unassigned successfully', 'classroom': serializer.data})
    except ClassRoom.DoesNotExist:
        return Response({'error': 'Classroom not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GradeViewSet(viewsets.ModelViewSet):
    queryset = Grade.objects.all()
    serializer_class = GradeSerializer
    
    # Filtering, search, and ordering
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['name', 'code']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']  # Default ordering
    
    def get_queryset(self):
        user = self.request.user
        queryset = Grade.objects.select_related('level', 'level__campus')
        
        # Get query parameters
        level_id = self.request.query_params.get('level_id')
        campus_id = self.request.query_params.get('campus_id')
        shift = self.request.query_params.get('shift')
        unassigned = self.request.query_params.get('unassigned')
        
        # If user is tied to a specific campus, restrict to that
        if user.campus:
            queryset = queryset.filter(Q(level__campus=user.campus) | Q(campus=user.campus))
        # Otherwise, apply campus_id filter if provided
        elif campus_id:
            queryset = queryset.filter(Q(level__campus_id=campus_id) | Q(campus_id=campus_id))
            
        # Additional Filters
        if shift:
            queryset = queryset.filter(level__shift=shift)
        elif level_id:
            queryset = queryset.filter(level_id=level_id)
            
        if unassigned == 'true':
            queryset = queryset.filter(level__isnull=True)
            
        return queryset.distinct()
    
    def perform_create(self, serializer):
        # Validate that level is provided
        level_id = self.request.data.get('level')
        if not level_id:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'level': 'Level field is required'})
        
        # Validate that level exists and belongs to principal's campus
        if hasattr(self.request.user, 'role') and self.request.user.role == 'principal':
            from classes.models import Level
            try:
                level = Level.objects.get(id=level_id)
                # Check if level belongs to principal's campus
                campus_id = self.request.data.get('campus_id') or self.request.query_params.get('campus_id')
                if campus_id and level.campus.id != int(campus_id):
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError({'level': 'Level does not belong to your campus'})
            except Level.DoesNotExist:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'level': 'Invalid level ID provided'})
        
        # Automatically set organization if user belongs to one
        save_kwargs = {}
        if not self.request.user.is_superadmin() and self.request.user.organization:
            save_kwargs['organization'] = self.request.user.organization
        
        serializer.save(**save_kwargs)

class ClassRoomViewSet(viewsets.ModelViewSet):
    queryset = ClassRoom.objects.all()
    serializer_class = ClassRoomSerializer
    
    # Filtering, search, and ordering
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['code', 'section']
    ordering_fields = ['code', 'section', 'created_at']
    ordering = ['code', 'section']  # Default ordering
    
    def perform_create(self, serializer):
        user = self.request.user
        # Automatically set organization if user belongs to one
        save_kwargs = {}
        if not user.is_superadmin() and user.organization:
            save_kwargs['organization'] = user.organization
        serializer.save(**save_kwargs)
    
    def get_queryset(self):
        user = self.request.user
        queryset = ClassRoom.objects.select_related(
            'grade', 'grade__level', 'grade__level__campus', 'class_teacher'
        )
        
        # Get query parameters
        grade_id = self.request.query_params.get('grade_id')
        level_id = self.request.query_params.get('level_id')
        campus_id = self.request.query_params.get('campus_id')
        teacher_id = self.request.query_params.get('teacher_id')
        shift_filter = self.request.query_params.get('shift')
        
        # If user is tied to a specific campus, restrict to that
        if user.campus:
            queryset = queryset.filter(grade__level__campus=user.campus)
        # Otherwise, apply campus_id filter if provided
        elif campus_id:
            queryset = queryset.filter(grade__level__campus_id=campus_id)
            
        # Apply other filters
        if grade_id:
            queryset = queryset.filter(grade_id=grade_id)
        if level_id:
            queryset = queryset.filter(grade__level_id=level_id)
        if teacher_id:
            queryset = queryset.filter(class_teacher_id=teacher_id)
        
        # Handle shift filtering
        if shift_filter:
            if shift_filter in ['morning', 'afternoon', 'evening']:
                queryset = queryset.filter(shift=shift_filter)
        
        return queryset
    
    @action(detail=False, methods=['get'], url_path='campus_stats')
    def campus_stats(self, request):
        """Get campus-wise classroom distribution"""
        queryset = self.get_queryset()
        
        campus_data = queryset.values('grade__level__campus__campus_name').annotate(
            count=Count('id')
        ).order_by('-count')
        
        data = []
        for item in campus_data:
            campus_name = item['grade__level__campus__campus_name'] or 'Unknown Campus'
            data.append({
                'campus': campus_name,
                'count': item['count']
            })
        
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def available_teachers(self, request):
        """
        Get teachers who are available to be assigned as class teachers.

        Rules:
        - Must be is_class_teacher=True
        - Filter by campus if provided
        - Shift filter:
          - morning classroom → show teachers with shift=morning or shift=both
          - afternoon classroom → show teachers with shift=afternoon or shift=both
          - both/none → show all is_class_teacher teachers in campus
        - Does NOT exclude teachers who already have classes (unlimited assignments allowed)
        """
        from teachers.models import Teacher
        
        campus_id = request.query_params.get('campus_id')
        shift_param = request.query_params.get('shift')
        user = request.user
        
        teachers = Teacher.objects.filter(is_class_teacher=True)

        # Campus filter
        if campus_id:
            teachers = teachers.filter(current_campus_id=campus_id)
        elif hasattr(user, 'role') and user.role == 'principal' and getattr(user, 'campus_id', None):
            teachers = teachers.filter(current_campus_id=user.campus_id)

        # Shift filter: morning → (morning|both), afternoon → (afternoon|both), else → all
        if shift_param == 'morning':
            teachers = teachers.filter(Q(shift='morning') | Q(shift='both'))
        elif shift_param == 'afternoon':
            teachers = teachers.filter(Q(shift='afternoon') | Q(shift='both'))
        # 'both' or no filter → no shift restriction, show all campus teachers

        return Response(teachers.values('id', 'full_name', 'employee_code', 'shift', 'current_campus__campus_name'))
    
    @action(detail=False, methods=['get'])
    def unassigned_classrooms(self, request):
        """Get classrooms that don't have a class teacher"""
        unassigned = ClassRoom.objects.filter(
            class_teacher__isnull=True
        )
        serializer = self.get_serializer(unassigned, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def assign_teacher(self, request, pk=None):
        """Assign a teacher to this classroom"""
        classroom = self.get_object()
        teacher_id = request.data.get('teacher_id')
        
        if not teacher_id:
            return Response(
                {'error': 'teacher_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from teachers.models import Teacher
            
            # Get the teacher
            teacher = Teacher.objects.get(id=teacher_id)
            
            # Validate teacher belongs to same campus
            if classroom.campus != teacher.current_campus:
                return Response(
                    {'error': 'Teacher must belong to the same campus as the classroom'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate shift compatibility:
            # morning teacher → only morning classrooms
            # afternoon teacher → only afternoon classrooms
            # both teacher → any shift classroom allowed
            if teacher.shift != 'both':
                if teacher.shift != classroom.shift:
                    return Response(
                        {
                            'error': (
                                f'Shift mismatch: Teacher {teacher.full_name} works the '
                                f'{teacher.shift} shift but this classroom is in the '
                                f'{classroom.shift} shift. Please assign a teacher whose shift '
                                f'matches this classroom, or assign a "Both" shift teacher.'
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Store old teacher for cleanup
            old_teacher = classroom.class_teacher
            
            # Update classroom
            classroom.class_teacher = teacher
            classroom.assigned_by = request.user
            classroom.assigned_at = timezone.now()
            classroom.save()
            
            # Update new teacher profile
            teacher.assigned_classroom = classroom  # LEGACY single-class link (keeps last assigned)
            teacher.is_class_teacher = True
            teacher.classroom_assigned_by = request.user
            teacher.classroom_assigned_at = timezone.now()
            # Skip generic "profile updated" notification; we'll send a specific one
            setattr(teacher, '_skip_profile_notification', True)
            teacher.save()
            # Track in ManyToMany for multi-classroom support (idempotent add)
            try:
                teacher.assigned_classrooms.add(classroom)
            except Exception:
                pass
            
            # Update old teacher if exists (and is different from new teacher)
            if old_teacher and old_teacher.id != teacher.id:
                old_teacher.assigned_classroom = None
                # Remove this classroom from their multi-classroom list
                try:
                    old_teacher.assigned_classrooms.remove(classroom)
                except Exception:
                    pass
                # Recalculate is_class_teacher based on remaining classrooms
                has_other_classes = (
                    old_teacher.assigned_classroom is not None
                    or old_teacher.assigned_classrooms.exists()
                )
                old_teacher.is_class_teacher = has_other_classes
                old_teacher.classroom_assigned_by = None if not has_other_classes else old_teacher.classroom_assigned_by
                if not has_other_classes:
                    old_teacher.classroom_assigned_at = None
                # Skip generic "profile updated" notification; we'll send a specific one
                setattr(old_teacher, '_skip_profile_notification', True)
                old_teacher.save()
            
            serializer = self.get_serializer(classroom)

            # Send specific assign notification to the teacher
            teacher_user = getattr(teacher, 'user', None)
            if not teacher_user and teacher.email:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                teacher_user = User.objects.filter(email__iexact=teacher.email).first()
            if not teacher_user and teacher.employee_code:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                teacher_user = User.objects.filter(username=teacher.employee_code).first()

            if teacher_user:
                campus_name = getattr(getattr(classroom, 'campus', None), 'campus_name', '')
                actor = request.user
                actor_name = actor.get_full_name() if hasattr(actor, 'get_full_name') else str(actor)
                grade_name = getattr(getattr(classroom, 'grade', None), 'name', None) or getattr(classroom, 'grade_name', None) or 'Class'
                section = getattr(classroom, 'section', '') or ''
                shift = getattr(classroom, 'shift', '') or ''
                class_label = f"{grade_name} - {section}"
                if shift:
                    class_label = f"{class_label} ({shift})"

                verb = "You have been assigned as class teacher"
                target_text = (
                    f"for {class_label} "
                    f"by {actor_name}"
                    + (f" at {campus_name}" if campus_name else "")
                )
                create_notification(
                    recipient=teacher_user,
                    actor=actor,
                    verb=verb,
                    target_text=target_text,
                    data={
                        "teacher_id": teacher.id,
                        "classroom_id": classroom.id,
                        "class_label": class_label,
                        "action": "assigned_class_teacher",
                    },
                )

            return Response({
                'message': 'Teacher assigned successfully',
                'classroom': serializer.data
            })
            
        except Teacher.DoesNotExist:
            return Response(
                {'error': 'Teacher not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )