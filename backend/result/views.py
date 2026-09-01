from rest_framework import viewsets, generics, status, serializers
import re
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.http import HttpResponse
from rest_framework.views import APIView
from django.db import transaction
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.db.models import Q, Count, Case, When, IntegerField, F
from .models import Result, SubjectMark
from .serializers import (
    ResultSerializer, ResultCreateSerializer, ResultUpdateSerializer,
    ResultSubmitSerializer, ResultApprovalSerializer, PrincipalResultApprovalSerializer,
    ResultListSerializer
)
from users.permissions import IsTeacher, IsCoordinator, IsCoordinatorOrAbove, IsPrincipal, IsStudent
from teachers.models import Teacher
from students.models import Student
from attendance.models import Attendance
from principals.models import Principal

def _get_principal(user):
    principal = Principal.objects.filter(
        Q(user=user) | 
        Q(email=user.email) | 
        Q(employee_code=user.username)
    ).first()
    if not principal:
        from django.http import Http404
        raise Http404("No Principal matches the given query.")
    return principal
from classes.models import ClassRoom
from coordinator.models import Coordinator
from notifications.services import create_notification
from django.utils import timezone


# PrincipalResultApprovalView for principal approval
class PrincipalResultApprovalView(generics.UpdateAPIView):
    queryset = Result.objects.all()
    serializer_class = PrincipalResultApprovalSerializer
    permission_classes = [IsAuthenticated, IsPrincipal]

    def get_object(self):
        principal = _get_principal(self.request.user)
        return get_object_or_404(
            Result,
            id=self.kwargs['pk'],
            student__campus=principal.campus,
            status='pending_principal'
        )
    
    def perform_update(self, serializer):
        principal = _get_principal(self.request.user)
        status_val = self.request.data.get('status', 'approved')
        
        result = serializer.save(
            status=status_val,
            approved_by_principal=principal if status_val == 'approved' else None,
            approved_by_principal_at=timezone.now() if status_val == 'approved' else None,
            principal_signature=self.request.data.get('signature') if status_val == 'approved' else None,
            principal_signed_at=timezone.now() if status_val == 'approved' else None
        )
        
        # === PROMOTION TO SECTION E ===
        # If principal approves final result AND student PASSES -> move to Section E staging
        if status_val == 'approved' and result.exam_type == 'final' and result.result_status == 'pass':
            _move_student_to_section_e(result.student)
        
        # Notify Teacher
        verb = 'result_approved' if status_val == 'approved' else 'result_rejected'
        if result.teacher and result.teacher.user:
            create_notification(
                recipient=result.teacher.user,
                actor=self.request.user,
                verb=verb,
                target_text=f"Result {status_val} for {result.student.name}",
                data={'result_id': result.id}
            )
        
        # Notify Coordinator
        if result.coordinator:
            from users.models import User
            coord_user = User.objects.filter(Q(username=result.coordinator.employee_code) | Q(email=result.coordinator.email)).first()
            if coord_user:
                create_notification(
                    recipient=coord_user,
                    actor=self.request.user,
                    verb=verb,
                    target_text=f"Result {status_val} for {result.student.name}",
                    data={'result_id': result.id}
                )


def _move_student_to_section_e(student):
    """
    Helper: Move a student to Section E of their current grade (promotion staging area).
    Only called when:
      - Final Term result is APPROVED by both coordinator AND principal
      - result_status == 'pass'
    Students who FAIL stay in their current class (this function is NOT called for fail).
    """
    from classes.models import ClassRoom
    current_class = student.classroom
    if not current_class:
        return None

    # Find or create the Section E classroom for the same grade + shift.
    # NOTE: the DB unique constraint on (grade, section, shift) is org-agnostic,
    # but ClassRoom.objects is org-scoped — a pre-existing Section E tagged to a
    # different organization (or org=None) is invisible to the scoped manager, so
    # a plain create() would collide with the constraint and raise IntegrityError
    # (500). Use the base manager + get_or_create so the lookup sees every row and
    # the create is race-safe.
    section_e_class, _ = ClassRoom._base_manager.get_or_create(
        grade=current_class.grade,
        section='E',
        shift=current_class.shift,
        defaults={
            'capacity': 100,
            'organization': getattr(current_class, 'organization', None),
        },
    )
    
    if section_e_class:
        # Save previous class info before moving
        student.last_class_passed = f"{current_class.grade.name} - {current_class.section}"
        if current_class.class_teacher:
            student.last_class_teacher = current_class.class_teacher.full_name
        
        # Move student to Section E
        student.classroom = section_e_class
        student.section = 'E'
        student.save()
        return section_e_class
    return None


class PrincipalResultStatsView(APIView):
    """
    Get stats for Principal's dashboard:
    - Grouped by Class
    - Pass/Fail counts
    - Pending Principal counts
    """
    permission_classes = [IsAuthenticated, IsPrincipal]

    def get(self, request):
        try:
            principal = _get_principal(request.user)
            if not principal.campus:
                 return Response({'error': 'Principal has no assigned campus'}, status=status.HTTP_400_BAD_REQUEST)

            # Get all classrooms in the campus
            classrooms = ClassRoom.objects.filter(
                grade__level__campus=principal.campus
            ).select_related('grade')
            
            stats_data = []
            
            # Global KPI counters
            total_pending = 0
            total_students_with_results = 0
            global_pass_count = 0
            global_fail_count = 0
            performance_scores = []

            for classroom in classrooms:
                exam_type = request.query_params.get('exam_type')
                
                # Base query for stats
                base_qs = Result.objects.filter(student__classroom=classroom).exclude(status='draft')
                if exam_type:
                    base_qs = base_qs.filter(exam_type=exam_type)
                
                month = request.query_params.get('month')
                if month:
                    base_qs = base_qs.filter(month=month)
                
                pending_count = base_qs.filter(status='pending_principal').count()
                
                total_results = base_qs.count()
                pass_count = base_qs.filter(pass_status='pass').count()
                fail_count = base_qs.filter(pass_status='fail').count()
                absent_count = base_qs.filter(pass_status='absent').count()
                approved_count = base_qs.filter(status='approved').count()
                
                # Calculate class percentage (now using average of student percentages)
                from django.db.models import Avg
                class_percentage_avg = base_qs.aggregate(Avg('percentage'))['percentage__avg'] or 0
                
                # Accumulate for Global KPIs
                total_pending += pending_count
                total_students_with_results += total_results
                global_pass_count += pass_count
                global_fail_count += fail_count
                if total_results > 0:
                    performance_scores.append(class_percentage_avg)

                stats_data.append({
                    'classroom_id': classroom.id,
                    'grade_name': classroom.grade.name,
                    'section_name': classroom.section,
                    'display_name': f"{classroom.grade.name} - {classroom.section}",
                    'pending_approval_count': pending_count,
                    'total_results': total_results,
                    'pass_count': pass_count,
                    'fail_count': fail_count,
                    'absent_count': absent_count,
                    'approved_count': approved_count,
                    'overall_percentage': round(class_percentage_avg, 1)
                })
            
            # Finalize Global KPIs
            global_performance = (sum(performance_scores) / len(performance_scores)) if performance_scores else 0
            
            response_data = {
                'kpis': {
                    'total_pending': total_pending,
                    'total_results': total_students_with_results,
                    'pass_rate': round((global_pass_count / total_students_with_results * 100), 1) if total_students_with_results > 0 else 0,
                    'average_performance': round(global_performance, 1),
                    'fail_count': global_fail_count
                },
                'classes_stats': stats_data
            }
            
            return Response(response_data)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Relations the nested ResultSerializer / StudentSerializer touch for every row.
# Applying these to any Result list queryset collapses per-row N+1 queries into a
# handful of JOINs + prefetches — this is what prevents the Result-list 504 timeouts.
RESULT_LIST_SELECT_RELATED = (
    'student',
    'student__campus',
    'student__classroom',
    'student__classroom__grade',
    'student__classroom__grade__level',
    'student__classroom__grade__level__campus',
    'student__classroom__class_teacher',
    'teacher',
    'teacher__current_campus',
    'coordinator',
    'coordinator__campus',
)
RESULT_LIST_PREFETCH_RELATED = (
    'subject_marks',
    'student__classroom__class_teachers',
    # Level.coordinator_name property reads these two relations per student —
    # prefetch them too or get_coordinator_name re-introduces a 2×N query fan-out.
    'student__classroom__grade__level__coordinator_set',
    'student__classroom__grade__level__assigned_coordinators',
    # Nested TeacherSerializer expands subject_assignments → subject per row.
    'teacher__subject_assignments__subject',
)


def with_result_relations(qs):
    """Eager-load every relation the Result list serializers read per row."""
    return qs.select_related(*RESULT_LIST_SELECT_RELATED).prefetch_related(*RESULT_LIST_PREFETCH_RELATED)


class ResultViewSet(viewsets.ModelViewSet):
    queryset = Result.objects.all()
    serializer_class = ResultSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'exam_type', 'student', 'student__classroom', 'month']
    search_fields = ['student__name', 'student__student_code']
    ordering_fields = ['created_at', 'percentage']

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return with_result_relations(Result.objects.all())
        elif user.is_teacher():
            teacher = get_object_or_404(Teacher, email=user.email)
            return with_result_relations(Result.objects.filter(teacher=teacher))
        elif user.is_coordinator():
            coordinator = get_object_or_404(Coordinator, email=user.email)
            return with_result_relations(Result.objects.filter(coordinator=coordinator))
        elif user.is_principal():
            try:
                principal = _get_principal(user)
                return with_result_relations(Result.objects.filter(student__campus=principal.campus))
            except Exception:
                return Result.objects.none()
        return Result.objects.none()

    def get_serializer_class(self):
        if self.action == 'create':
            return ResultCreateSerializer
        elif self.action == 'update' or self.action == 'partial_update':
            return ResultUpdateSerializer
        elif self.action == 'list':
            # Lean serializer for lists: the full ResultSerializer's nested
            # StudentSerializer fires per-row DB queries (attendance / performance
            # / coordinator_name …) → 2000+ queries and a 504 on a 72-row class.
            # ResultListSerializer carries the same scalar + subject_marks data
            # with trimmed nested objects that with_result_relations eager-loads.
            return ResultListSerializer
        return ResultSerializer

    def perform_create(self, serializer):
        # Check if final term can be created (mid-term must exist and be approved)
        exam_type = serializer.validated_data.get('exam_type')
        student = serializer.validated_data.get('student')
        
        if exam_type == 'final':
            midterm_exists = Result.objects.filter(
                student=student,
                exam_type='midterm',
                status='approved'
            ).exists()
            
            if not midterm_exists:
                raise serializers.ValidationError("Mid-term result must be approved before creating final-term result")
        
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        student_name = instance.student.name if instance.student else 'Unknown'
        exam_type = instance.exam_type
        academic_year = instance.academic_year
        entity_id = instance.id
        org = getattr(instance, 'organization', None)

        instance.soft_delete()

        try:
            from attendance.models import AuditLog
            AuditLog.objects.create(
                feature='result',
                action='delete',
                entity_type='Result',
                entity_id=entity_id,
                organization=org,
                user=user,
                ip_address=self.request.META.get('REMOTE_ADDR'),
                changes={
                    'student_name': student_name,
                    'exam_type': exam_type,
                    'academic_year': academic_year,
                    'student_id': instance.student_id,
                },
                reason=f'Result for {student_name} ({exam_type}) deleted by {user.get_full_name() or user.username}'
            )
        except Exception:
            pass

    @action(detail=False, methods=['post'], url_path='forward-class')
    def forward_class_results(self, request):
        """
        Forward all student results for a class to the coordinator.
        Ensures all students in the class have results for the given exam type.
        """
        teacher = get_object_or_404(Teacher, email=request.user.email)
        classroom_id = request.data.get('classroom_id')
        exam_type = request.data.get('exam_type')
        month = request.data.get('month') # Optional for mid/final

        if not classroom_id or not exam_type:
            return Response({'error': 'classroom_id and exam_type are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Get all active students in this classroom
        students_in_class = Student.objects.filter(classroom_id=classroom_id, is_active=True)
        student_count = students_in_class.count()

        if student_count == 0:
            return Response({'error': 'No students found in this classroom'}, status=status.HTTP_404_NOT_FOUND)

        # Find existing results for these students
        result_query = Result.objects.filter(
            student__in=students_in_class,
            exam_type=exam_type
        )
        if month:
            result_query = result_query.filter(month=month)

        results_count = result_query.count()

        # Check if all students have results
        if results_count < student_count:
            missing_count = student_count - results_count
            return Response({
                'error': f'Incomplete results. {missing_count} student(s) still missing results.',
                'total_students': student_count,
                'current_results': results_count
            }, status=status.HTTP_400_BAD_REQUEST)

        # Verify teacher has assigned coordinator
        if not teacher.assigned_coordinators.exists():
            return Response({'error': 'No coordinator assigned to you'}, status=status.HTTP_400_BAD_REQUEST)
        
        coordinator = teacher.assigned_coordinators.first()

        # Update all results to pending_coordinator
        # Only update results currently in 'draft' or 'rejected' status
        with transaction.atomic():
            updated_count = result_query.filter(
                status__in=['draft', 'rejected']
            ).update(
                status='pending_coordinator',
                coordinator=coordinator
            )
        
        # Notify Coordinator
        if updated_count > 0:
            from users.models import User
            coord_user = User.objects.filter(Q(username=coordinator.employee_code) | Q(email=coordinator.email)).first()
            if coord_user:
                create_notification(
                    recipient=coord_user,
                    actor=request.user,
                    verb='bulk_results_submitted',
                    target_text=f"{updated_count} results submitted by {teacher.full_name}",
                    data={'count': updated_count, 'exam_type': exam_type}
                )

        return Response({
            'message': f'Successfully forwarded {updated_count} results to coordinator',
            'updated_count': updated_count
        })

class TeacherResultListView(generics.ListCreateAPIView):
    serializer_class = ResultSerializer
    permission_classes = [IsAuthenticated, IsTeacher]
    pagination_class = None  # Return all results without pagination

    def get_serializer_class(self):
        # Lean serializer for the list (GET) — avoids the heavy nested
        # StudentSerializer that fanned out into per-result N+1 queries and timed
        # out the teacher Result page. Create serializer for POST.
        if self.request.method == 'GET':
            return ResultListSerializer
        return ResultCreateSerializer

    def get_queryset(self):
        teacher = get_object_or_404(Teacher, email=self.request.user.email)
        qs = with_result_relations(Result.objects.filter(teacher=teacher)).order_by('-created_at')
        classroom_id = self.request.query_params.get('classroom')
        if classroom_id:
            qs = qs.filter(student__classroom_id=classroom_id)
        return qs

    def perform_create(self, serializer):
        teacher = get_object_or_404(Teacher, email=self.request.user.email)

        # Check if final term can be created
        exam_type = serializer.validated_data.get('exam_type')
        student = serializer.validated_data.get('student')
        
        if exam_type == 'final':
            midterm_exists = Result.objects.filter(
                student=student,
                exam_type='midterm',
                status='approved'
            ).exists()
            
            if not midterm_exists:
                raise serializers.ValidationError("Mid-term result must be approved before creating final-term result")
        
        # Verify teacher has assigned coordinator (but don't assign yet)
        if not teacher.assigned_coordinators.exists():
            raise serializers.ValidationError("No coordinator assigned to this teacher")
        
        # Save result in draft status without coordinator
        # Coordinator will be assigned when teacher submits the result
        serializer.save(teacher=teacher, status='draft')

class CoordinatorResultListView(generics.ListAPIView):
    """Get all results assigned to coordinator for review"""
    serializer_class = ResultListSerializer
    permission_classes = [IsAuthenticated, IsCoordinator]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['student__name', 'student__student_code', 'teacher__full_name']
    ordering_fields = ['created_at', 'status', 'student__name']
    ordering = ['-created_at']
    pagination_class = None  # Disable pagination to return direct array

    def get_queryset(self):
        coordinator = Coordinator.get_for_user(self.request.user)
        if not coordinator:
            return Result.objects.none()

        # Eager-load related rows so serializing the list does not fan out into
        # per-result N+1 queries — the cause of the coordinator Result Management
        # 504 timeouts.
        return with_result_relations(Result.objects.filter(coordinator=coordinator))

class CheckMidTermView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated, IsTeacher]

    def get(self, request, student_id):
        try:
            student = Student.objects.get(id=student_id)
            midterm_exists = Result.objects.filter(
                student=student,
                exam_type='midterm',
                status='approved'
            ).exists()
            
            return Response({
                'student_id': student_id,
                'student_name': student.name,
                'mid_term_exists': midterm_exists,
                'mid_term_approved': midterm_exists
            })
        except Student.DoesNotExist:
            return Response(
                {'error': 'Student not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

class ResultSubmitView(generics.UpdateAPIView):
    queryset = Result.objects.all()
    serializer_class = ResultSubmitSerializer
    permission_classes = [IsAuthenticated, IsTeacher]

    def get_object(self):
        teacher = get_object_or_404(Teacher, email=self.request.user.email)
        return get_object_or_404(Result, id=self.kwargs['pk'], teacher=teacher)

    def perform_update(self, serializer):
        result = self.get_object()

        # Individual result submission no longer requires the entire class to be complete.
        # This allows for flexible workflows and individual student result processing.
        # Completeness is still enforced in the bulk 'forward-class' endpoint.
        result = serializer.save()

        from users.models import User as UserModel
        # All exam types now go to coordinator first — notify coordinator
        if result.coordinator:
            coord_user = UserModel.objects.filter(
                Q(username=result.coordinator.employee_code) | Q(email=result.coordinator.email)
            ).first()
            if coord_user:
                create_notification(
                    recipient=coord_user,
                    actor=self.request.user,
                    verb='result_submitted',
                    target_text=f"{result.get_exam_type_display()} result submitted for {result.student.name}",
                    data={'result_id': result.id, 'exam_type': result.exam_type}
                )


# ─── Task 3: Coordinator approve / reject (Monthly only) ──────────────────────

class CoordinatorApproveResultView(APIView):
    permission_classes = [IsAuthenticated, IsCoordinator]

    def post(self, request, pk):
        coordinator = get_object_or_404(Coordinator, email=request.user.email)
        result = get_object_or_404(Result, id=pk)

        if result.exam_type != 'monthly':
            return Response(
                {'error': 'Coordinator can only approve Monthly Test results.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if result.status != 'pending_coordinator':
            return Response(
                {'error': f'Result must be in pending_coordinator status. Current: {result.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if result.coordinator and result.coordinator != coordinator:
            return Response({'error': 'This result is not assigned to you.'}, status=status.HTTP_403_FORBIDDEN)

        result.status = 'approved'
        result.approved_by_coordinator = coordinator
        result.approved_by_coordinator_at = timezone.now()
        result.coordinator_comments = request.data.get('comments', result.coordinator_comments)
        signature = request.data.get('signature') or coordinator.signature
        if signature:
            result.coordinator_signature = signature
            result.coordinator_signed_at = timezone.now()
            # Auto-save to coordinator profile on first use
            if not coordinator.signature:
                coordinator.signature = signature
                coordinator.signature_updated_at = timezone.now()
                coordinator.save(update_fields=['signature', 'signature_updated_at'])
        result.save()

        from users.models import User as UserModel
        # Notify teacher
        if result.teacher and result.teacher.user:
            create_notification(
                recipient=result.teacher.user,
                actor=request.user,
                verb='result_approved',
                target_text=f"Monthly result approved for {result.student.name}",
                data={'result_id': result.id}
            )
        # Notify student
        _notify_student(result.student, request.user, 'result_approved',
                        f"Your monthly result has been approved.", {'result_id': result.id})

        return Response({'message': 'Result approved successfully.', 'status': result.status})


class CoordinatorRejectResultView(APIView):
    permission_classes = [IsAuthenticated, IsCoordinator]

    def post(self, request, pk):
        coordinator = get_object_or_404(Coordinator, email=request.user.email)
        result = get_object_or_404(Result, id=pk)

        if result.exam_type != 'monthly':
            return Response(
                {'error': 'Coordinator can only reject Monthly Test results.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if result.status != 'pending_coordinator':
            return Response(
                {'error': f'Result must be in pending_coordinator status. Current: {result.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if result.coordinator and result.coordinator != coordinator:
            return Response({'error': 'This result is not assigned to you.'}, status=status.HTTP_403_FORBIDDEN)

        reject_reason = request.data.get('reject_reason', '').strip()
        if not reject_reason:
            return Response({'error': 'reject_reason is required.'}, status=status.HTTP_400_BAD_REQUEST)

        result.status = 'draft'
        result.coordinator_comments = reject_reason
        result.save()

        # Notify teacher
        if result.teacher and result.teacher.user:
            create_notification(
                recipient=result.teacher.user,
                actor=request.user,
                verb='result_rejected',
                target_text=f"Monthly result rejected for {result.student.name}: {reject_reason}",
                data={'result_id': result.id, 'reason': reject_reason}
            )

        return Response({'message': 'Result rejected and returned to draft.', 'status': result.status})


# ─── Edit-request workflow (re-open an APPROVED result with coordinator's permission) ──

class TeacherResultEditRequestView(APIView):
    """Teacher-facing edit requests for approved results.

    POST  /api/result/edit-request/         -> create a request (body: result, reason)
    GET   /api/result/edit-request/         -> list this teacher's own requests
    """
    permission_classes = [IsAuthenticated, IsTeacher]

    def get(self, request):
        from .models import ResultEditRequest
        from .serializers import ResultEditRequestSerializer
        teacher = get_object_or_404(Teacher, email=request.user.email)
        qs = ResultEditRequest.objects.filter(teacher=teacher).select_related('result', 'result__student')
        return Response(ResultEditRequestSerializer(qs, many=True).data)

    def post(self, request):
        from .models import ResultEditRequest
        from .serializers import ResultEditRequestSerializer
        teacher = get_object_or_404(Teacher, email=request.user.email)
        result_id = request.data.get('result')
        reason = (request.data.get('reason') or '').strip()

        if not result_id:
            return Response({'error': 'result is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not reason:
            return Response({'error': 'A reason is required to request an edit.'}, status=status.HTTP_400_BAD_REQUEST)

        result = get_object_or_404(Result, id=result_id)
        if result.teacher_id != teacher.id:
            return Response({'error': 'You can only request edits for your own results.'}, status=status.HTTP_403_FORBIDDEN)
        if result.status != 'approved':
            return Response({'error': 'Edit requests are only for approved results.'}, status=status.HTTP_400_BAD_REQUEST)

        # Block duplicate pending requests for the same result
        if ResultEditRequest.objects.filter(result=result, status='pending').exists():
            return Response({'error': 'An edit request is already pending for this result.'}, status=status.HTTP_400_BAD_REQUEST)

        edit_request = ResultEditRequest.objects.create(
            result=result,
            teacher=teacher,
            reason=reason,
            organization=result.organization,
        )

        # Notify the coordinator responsible for this result
        coordinator = result.approved_by_coordinator or result.coordinator
        if not coordinator and teacher.assigned_coordinators.exists():
            coordinator = teacher.assigned_coordinators.first()
        if coordinator:
            from users.models import User as UserModel
            coord_user = UserModel.objects.filter(
                Q(username=coordinator.employee_code) | Q(email=coordinator.email)
            ).first()
            if coord_user:
                create_notification(
                    recipient=coord_user,
                    actor=request.user,
                    verb='result_edit_requested',
                    target_text=f"{teacher.full_name} requested to edit {result.student.name}'s result",
                    data={'edit_request_id': edit_request.id, 'result_id': result.id}
                )

        return Response(ResultEditRequestSerializer(edit_request).data, status=status.HTTP_201_CREATED)


class CoordinatorEditRequestListView(APIView):
    """GET /api/result/coordinator/edit-requests/ -> pending edit requests for this coordinator."""
    permission_classes = [IsAuthenticated, IsCoordinator]

    def get(self, request):
        from .models import ResultEditRequest
        from .serializers import ResultEditRequestSerializer
        coordinator = get_object_or_404(Coordinator, email=request.user.email)
        qs = ResultEditRequest.objects.filter(
            status='pending'
        ).filter(
            Q(result__approved_by_coordinator=coordinator)
            | Q(result__coordinator=coordinator)
            | Q(teacher__assigned_coordinators=coordinator)
        ).distinct().select_related('result', 'result__student', 'teacher')
        return Response(ResultEditRequestSerializer(qs, many=True).data)


class CoordinatorEditRequestApproveView(APIView):
    """POST /api/result/coordinator/edit-requests/<pk>/approve/ -> unlock result for editing."""
    permission_classes = [IsAuthenticated, IsCoordinator]

    def post(self, request, pk):
        from .models import ResultEditRequest
        coordinator = get_object_or_404(Coordinator, email=request.user.email)
        edit_request = get_object_or_404(ResultEditRequest, id=pk)

        if edit_request.status != 'pending':
            return Response({'error': f'Request already {edit_request.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        result = edit_request.result
        # Unlock: send the approved result back to the teacher as a draft so they can
        # edit and re-submit for a fresh approval.
        result.status = 'draft'
        result.edit_count = 0
        result.save(update_fields=['status', 'edit_count'])

        edit_request.status = 'approved'
        edit_request.coordinator = coordinator
        edit_request.coordinator_response = (request.data.get('response') or '').strip() or None
        edit_request.reviewed_at = timezone.now()
        edit_request.save(update_fields=['status', 'coordinator', 'coordinator_response', 'reviewed_at'])

        # Audit trail
        try:
            from attendance.models import AuditLog
            AuditLog.objects.create(
                feature='result', action='update', entity_type='Result', entity_id=result.id,
                organization=result.organization, user=request.user,
                ip_address=request.META.get('REMOTE_ADDR'),
                changes={'event': 'edit_request_approved', 'student_name': result.student.name,
                         'reason': edit_request.reason},
                reason=f'Edit request approved for {result.student.name}; result re-opened for editing.'
            )
        except Exception:
            pass

        if result.teacher and result.teacher.user:
            create_notification(
                recipient=result.teacher.user, actor=request.user,
                verb='result_edit_approved',
                target_text=f"Edit request approved — {result.student.name}'s result is editable again.",
                data={'edit_request_id': edit_request.id, 'result_id': result.id}
            )

        return Response({'message': 'Edit request approved. Result re-opened for editing.'})


class CoordinatorEditRequestRejectView(APIView):
    """POST /api/result/coordinator/edit-requests/<pk>/reject/ (body: response)."""
    permission_classes = [IsAuthenticated, IsCoordinator]

    def post(self, request, pk):
        from .models import ResultEditRequest
        coordinator = get_object_or_404(Coordinator, email=request.user.email)
        edit_request = get_object_or_404(ResultEditRequest, id=pk)

        if edit_request.status != 'pending':
            return Response({'error': f'Request already {edit_request.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        response_reason = (request.data.get('response') or '').strip()
        if not response_reason:
            return Response({'error': 'A reason is required to reject the request.'}, status=status.HTTP_400_BAD_REQUEST)

        edit_request.status = 'rejected'
        edit_request.coordinator = coordinator
        edit_request.coordinator_response = response_reason
        edit_request.reviewed_at = timezone.now()
        edit_request.save(update_fields=['status', 'coordinator', 'coordinator_response', 'reviewed_at'])

        result = edit_request.result
        if result.teacher and result.teacher.user:
            create_notification(
                recipient=result.teacher.user, actor=request.user,
                verb='result_edit_rejected',
                target_text=f"Edit request rejected for {result.student.name}: {response_reason}",
                data={'edit_request_id': edit_request.id, 'result_id': result.id, 'reason': response_reason}
            )

        return Response({'message': 'Edit request rejected.'})


# ─── Task 4: Principal approve / reject (Mid / Final only) ────────────────────

class PrincipalApproveResultView(APIView):
    permission_classes = [IsAuthenticated, IsPrincipal]

    def post(self, request, pk):
        principal = _get_principal(request.user)
        result = get_object_or_404(Result, id=pk)

        if result.exam_type not in ['midterm', 'final']:
            return Response(
                {'error': 'Principal can only approve Mid Term or Final Term results.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if result.status != 'pending_principal':
            return Response(
                {'error': f'Result must be in pending_principal status. Current: {result.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        result.status = 'approved'
        result.approved_by_principal = principal
        result.approved_by_principal_at = timezone.now()
        result.principal_comments = request.data.get('comments', result.principal_comments)
        signature = request.data.get('signature')
        if signature:
            result.principal_signature = signature
            result.principal_signed_at = timezone.now()
            # Auto-save to principal's profile on first use
            if not principal.signature:
                principal.signature = signature
                principal.signature_updated_at = timezone.now()
                principal.save(update_fields=['signature', 'signature_updated_at'])
        result.save()

        # Notify teacher
        if result.teacher and result.teacher.user:
            create_notification(
                recipient=result.teacher.user,
                actor=request.user,
                verb='result_approved',
                target_text=f"{result.get_exam_type_display()} result approved for {result.student.name}",
                data={'result_id': result.id}
            )
        # Notify student
        _notify_student(result.student, request.user, 'result_approved',
                        f"Your {result.get_exam_type_display()} result has been approved.",
                        {'result_id': result.id})

        # Task 5: Auto-promotion for final term
        if result.exam_type == 'final':
            _handle_final_promotion(result, request.user)

        return Response({'message': 'Result approved successfully.', 'status': result.status})


class PrincipalRejectResultView(APIView):
    permission_classes = [IsAuthenticated, IsPrincipal]

    def post(self, request, pk):
        principal = _get_principal(request.user)
        result = get_object_or_404(Result, id=pk)

        if result.exam_type not in ['midterm', 'final']:
            return Response(
                {'error': 'Principal can only reject Mid Term or Final Term results.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if result.status != 'pending_principal':
            return Response(
                {'error': f'Result must be in pending_principal status. Current: {result.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reject_reason = request.data.get('reject_reason', '').strip()
        if not reject_reason:
            return Response({'error': 'reject_reason is required.'}, status=status.HTTP_400_BAD_REQUEST)

        result.status = 'draft'
        result.principal_comments = reject_reason
        result.save()

        # Notify teacher
        if result.teacher and result.teacher.user:
            create_notification(
                recipient=result.teacher.user,
                actor=request.user,
                verb='result_rejected',
                target_text=f"{result.get_exam_type_display()} result rejected for {result.student.name}: {reject_reason}",
                data={'result_id': result.id, 'reason': reject_reason}
            )

        return Response({'message': 'Result rejected and returned to draft.', 'status': result.status})


# ─── Task 5 helpers ───────────────────────────────────────────────────────────

def _notify_student(student, actor, verb, text, data=None):
    """Send notification to student user account if it exists."""
    if student.user:
        create_notification(recipient=student.user, actor=actor, verb=verb, target_text=text, data=data or {})


def _notify_parent(student, actor, verb, text, data=None):
    """Send notification to student's parent/guardian if linked."""
    try:
        # Try common parent FK names used in this project
        parent = getattr(student, 'parent', None) or getattr(student, 'guardian', None)
        if parent:
            parent_user = getattr(parent, 'user', None)
            if parent_user:
                create_notification(recipient=parent_user, actor=actor, verb=verb, target_text=text, data=data or {})
    except Exception:
        pass


def _handle_final_promotion(result, actor):
    """
    After principal approves a final result:
    - Get ALL final approved subject pass statuses for this student
    - If ALL pass → promote to Section E, notify student + parent
    - If ANY fail/absent → no promotion, notify student + parent + coordinator
    """
    student = result.student

    # Check all subjects of this result
    non_behaviour_marks = [
        sm for sm in result.subject_marks.all()
        if not any(kw in sm.subject_name.lower() for kw in [
            'behaviour', 'behavior', 'homework', 'hygiene', 'observation',
            'participation', 'follow_rules', 'respect'
        ])
    ]

    promoted = all(sm.is_pass for sm in non_behaviour_marks) if non_behaviour_marks else False

    if promoted and result.pass_status == 'pass':
        section_e = _move_student_to_section_e(student)
        msg = f"Congratulations! {student.name} has been promoted to next class."
        _notify_student(student, actor, 'student_promoted', msg, {'result_id': result.id})
        _notify_parent(student, actor, 'student_promoted', msg, {'result_id': result.id})
    else:
        msg = f"{student.name} was not promoted. Please review the final term result."
        _notify_student(student, actor, 'student_not_promoted', msg, {'result_id': result.id})
        _notify_parent(student, actor, 'student_not_promoted', msg, {'result_id': result.id})
        # Notify coordinator
        if result.coordinator and result.coordinator.user if hasattr(result.coordinator, 'user') else False:
            create_notification(
                recipient=result.coordinator.user,
                actor=actor,
                verb='student_not_promoted',
                target_text=msg,
                data={'result_id': result.id}
            )
        else:
            # Try to find coordinator via teacher assignment
            teacher = result.teacher
            if teacher.assigned_coordinators.exists():
                from users.models import User as UserModel
                coord = teacher.assigned_coordinators.first()
                coord_user = UserModel.objects.filter(
                    Q(username=coord.employee_code) | Q(email=coord.email)
                ).first()
                if coord_user:
                    create_notification(
                        recipient=coord_user,
                        actor=actor,
                        verb='student_not_promoted',
                        target_text=msg,
                        data={'result_id': result.id}
                    )


# ─── Task 7: Student portal ───────────────────────────────────────────────────

class StudentMyResultsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Resolve student — either direct role or linked profile
        from students.models import Student as StudentModel
        student = None
        if hasattr(user, 'student_profile') and user.student_profile:
            student = user.student_profile
        else:
            student = StudentModel.objects.filter(user=user).first()

        if not student:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        exam_type = request.query_params.get('exam_type')
        month = request.query_params.get('month')
        academic_year = request.query_params.get('academic_year')

        qs = Result.objects.filter(student=student, status='approved')
        if exam_type:
            qs = qs.filter(exam_type=exam_type)
        if month:
            qs = qs.filter(month=month)
        if academic_year:
            qs = qs.filter(academic_year=academic_year)

        results = []
        for result in qs.prefetch_related('subject_marks').order_by('-created_at'):
            subject_marks = []
            
            for sm in result.subject_marks.all():
                # Check for retest
                from retest.models import RetestResult
                retest = RetestResult.objects.filter(
                    original_result=result,
                    subject_name=sm.subject_name,
                    status='approved'
                ).order_by('-created_at').first()

                retest_scheduled = RetestResult.objects.filter(
                    original_result=result,
                    subject_name=sm.subject_name,
                    status__in=['marks_pending', 'draft', 'pending_coordinator', 'pending_principal']
                ).exists()

                final_marks = retest.marks_obtained if retest else sm.get_obtained_marks()
                
                # Grading for this specific subject final marks
                pct = (final_marks / sm.get_total_marks() * 100) if sm.get_total_marks() > 0 else 0
                final_grade = self._grade_from_percentage(pct)

                subject_marks.append({
                    "subject_name": sm.subject_name,
                    "total_marks": sm.get_total_marks(),
                    "obtained_marks": final_marks,
                    "original_marks": None if result.is_absent else sm.get_obtained_marks(),
                    "is_absent": result.is_absent,
                    "original_status": result.pass_status if not retest else "fail",
                    "retest_scheduled": retest_scheduled,
                    "retest_date": retest.retest_schedule.scheduled_date if retest else None,
                    "retest_time": retest.retest_schedule.scheduled_time if retest else None,
                    "retest_venue": retest.retest_schedule.venue if retest else None,
                    "retest_marks": retest.marks_obtained if retest else None,
                    "retest_status": retest.pass_status if retest else None,
                    "retest_approved": retest.status == 'approved' if retest else False,
                    "grade": final_grade,
                    "retest_badge": True if retest else False
                })

            overall = {
                "exam_type": result.exam_type,
                "month": result.month,
                "academic_year": result.academic_year,
                "total_marks": result.total_marks,
                "obtained_marks": result.obtained_marks,
                "percentage": round(result.percentage, 1),
                "grade": result.grade,
                "pass_status": result.pass_status,
                "status": result.pass_status,
                "position": result.position,
                "has_pending_retest": RetestResult.objects.filter(student=result.student, status__in=['marks_pending', 'draft', 'pending_coordinator', 'pending_principal']).exists(),
                "approved_by": (result.approved_by_principal.full_name if result.approved_by_principal else 
                               (result.approved_by_coordinator.full_name if result.approved_by_coordinator else "N/A")),
                "approved_at": result.approved_by_principal_at or result.approved_by_coordinator_at,
                "teacher_remarks": result.teacher_remarks,
                "teacher_name": result.teacher.full_name if result.teacher else "Class Teacher",
                "teacher_photo": request.build_absolute_uri(result.teacher.photo.url) if result.teacher and result.teacher.photo else None,
                "campus_name": student.campus.campus_name if student.campus else "N/A",
                "organization_name": student.organization.name if student.organization else "IAK School System",
                "promotion_status": "promoted" if student.section == 'E' and result.exam_type == 'final' else "not promoted"
            }
            results.append({'overall': overall, 'subject_marks': subject_marks})

        return Response(results)

    def _grade_from_percentage(self, pct):
        if pct >= 80: return 'A+'
        if pct >= 70: return 'A'
        if pct >= 60: return 'B'
        if pct >= 50: return 'C'
        if pct >= 40: return 'D'
        return 'F'


    def _build_subjects(self, result):
        from retest.models import RetestSchedule, RetestResult
        subjects = []
        behaviour_keywords = [
            'behaviour', 'behavior', 'homework', 'hygiene',
            'observation', 'participation', 'follow_rules', 'respect'
        ]

        for sm in result.subject_marks.all():
            is_behaviour = any(kw in sm.subject_name.lower() for kw in behaviour_keywords)
            if is_behaviour:
                subjects.append({
                    'subject': sm.subject_name,
                    'grade': sm.grade or '-',
                    'is_behaviour': True,
                })
                continue

            # Check retest
            retest_schedule = RetestSchedule.objects.filter(
                original_result=result,
                subject_id=None,  # subject matched by name below
            ).filter(
                retestresult__student=result.student,
                retestresult__subject_name=sm.subject_name,
            ).first() if hasattr(RetestSchedule, 'retestresult_set') else None

            retest_result = None
            retest_schedule_obj = None
            try:
                retest_result = RetestResult.objects.filter(
                    original_result=result,
                    student=result.student,
                    subject_name=sm.subject_name,
                    status='approved'
                ).order_by('-created_at').first()

                retest_schedule_obj = RetestSchedule.objects.filter(
                    original_result=result,
                    subject_name=sm.subject_name,
                    status__in=['scheduled', 'completed']
                ).order_by('-scheduled_date').first()
            except Exception:
                pass

            final_marks = sm.get_obtained_marks()
            final_grade = self._grade_from_percentage(
                (final_marks / sm.get_total_marks() * 100) if sm.get_total_marks() > 0 else 0
            )
            retest_approved = False
            retest_marks = None
            retest_status = None
            retest_badge = False

            if retest_result:
                retest_approved = True
                retest_marks = retest_result.marks_obtained
                retest_status = retest_result.pass_status
                retest_badge = True
                if retest_marks is not None and sm.get_total_marks() > 0:
                    final_marks = retest_marks
                    final_grade = self._grade_from_percentage(retest_marks / sm.get_total_marks() * 100)

            subjects.append({
                'subject': sm.subject_name,
                'total_marks': sm.get_total_marks(),
                'original_marks': None if result.is_absent else sm.get_obtained_marks(),
                'is_absent': result.is_absent or sm.obtained_marks == 0,
                'original_status': result.pass_status if result.is_absent else ('pass' if sm.is_pass else 'fail'),
                'retest_scheduled': retest_schedule_obj is not None,
                'retest_date': retest_schedule_obj.scheduled_date.isoformat() if retest_schedule_obj and retest_schedule_obj.scheduled_date else None,
                'retest_time': str(retest_schedule_obj.scheduled_time) if retest_schedule_obj and retest_schedule_obj.scheduled_time else None,
                'retest_venue': retest_schedule_obj.venue if retest_schedule_obj else None,
                'retest_marks': retest_marks,
                'retest_status': retest_status,
                'retest_approved': retest_approved,
                'final_marks': final_marks,
                'final_grade': final_grade,
                'retest_badge': retest_badge,
                'is_behaviour': False,
            })
        return subjects

    def _build_overall(self, result):
        approved_by_name = None
        if result.approved_by_principal:
            approved_by_name = getattr(result.approved_by_principal, 'full_name', None)
        elif result.approved_by_coordinator:
            approved_by_name = getattr(result.approved_by_coordinator, 'full_name', None)

        promotion_status = None
        if result.exam_type == 'final' and result.status == 'approved':
            if result.pass_status == 'pass':
                promotion_status = 'promoted'
            elif result.pass_status == 'absent':
                promotion_status = 'absent'
            else:
                promotion_status = 'not_promoted'

        # Check pending retest
        has_pending_retest = False
        try:
            from retest.models import RetestSchedule
            has_pending_retest = RetestSchedule.objects.filter(
                original_result=result,
                status='scheduled'
            ).exists()
        except Exception:
            pass

        approved_at = result.approved_by_principal_at or result.approved_by_coordinator_at

        return {
            'result_id': result.id,
            'exam_type': result.exam_type,
            'exam_type_display': result.get_exam_type_display(),
            'month': result.month,
            'academic_year': result.academic_year,
            'total_marks': result.total_marks,
            'marks_obtained': result.obtained_marks,
            'percentage': round(result.percentage, 1),
            'grade': result.grade,
            'pass_status': result.pass_status,
            'position': result.position,
            'has_pending_retest': has_pending_retest,
            'approved_by': approved_by_name,
            'approved_at': approved_at.date().isoformat() if approved_at else None,
            'promotion_status': promotion_status,
        }


class ResultApprovalView(generics.UpdateAPIView):
    queryset = Result.objects.all()
    serializer_class = ResultApprovalSerializer
    permission_classes = [IsAuthenticated, IsCoordinator]

    def get_object(self):
        coordinator = get_object_or_404(Coordinator, email=self.request.user.email)
        return get_object_or_404(
            Result, 
            id=self.kwargs['pk'], 
            coordinator=coordinator
        )
        
    def perform_update(self, serializer):
        instance = serializer.instance
        new_status = serializer.validated_data.get('status')

        if new_status == 'approved':
            coordinator = get_object_or_404(Coordinator, email=self.request.user.email)
            sig = self.request.data.get('signature') or coordinator.signature
            if instance.exam_type in ['midterm', 'final']:
                serializer.save(
                    status='pending_principal',
                    approved_by_coordinator=coordinator,
                    approved_by_coordinator_at=timezone.now(),
                    coordinator_signature=sig,
                    coordinator_signed_at=timezone.now()
                )
                # Notify Principal(s) of that campus
                campus = instance.student.classroom.campus if instance.student.classroom else None
                if campus:
                    for p in Principal.objects.filter(campus=campus):
                        create_notification(
                            recipient=p.user,
                            actor=self.request.user,
                            verb='result_pending_approval',
                            target_text=f"Result pending approval for {instance.student.name}",
                            data={'result_id': instance.id}
                        )
            else:
                # Monthly tests are fully approved by coordinator
                serializer.save(
                    status='approved',
                    approved_by_coordinator=coordinator,
                    approved_by_coordinator_at=timezone.now(),
                    coordinator_signature=sig,
                    coordinator_signed_at=timezone.now()
                )
                # Notify Teacher
                create_notification(
                    recipient=instance.teacher.user,
                    actor=self.request.user,
                    verb='result_approved',
                    target_text=f"Result approved for {instance.student.name}",
                    data={'result_id': instance.id}
                )
        else:
            serializer.save()

class CalculatePositionsView(APIView):
    """Calculate and store class positions for a given classroom + exam type."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        classroom_id = request.data.get('classroom_id')
        exam_type = request.data.get('exam_type')
        month = request.data.get('month')

        if not classroom_id:
            return Response({'error': 'Classroom ID is required'}, status=status.HTTP_400_BAD_REQUEST)

        if not exam_type:
            return Response({'error': 'exam_type is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            qs = Result.objects.filter(
                student__classroom_id=classroom_id,
                exam_type=exam_type,
            ).exclude(is_absent=True)

            if exam_type == 'monthly':
                if not month:
                    return Response({'error': 'month is required for monthly exam'}, status=status.HTTP_400_BAD_REQUEST)
                qs = qs.filter(month=month)

            all_results = list(qs)

            # Only students who passed are eligible for a position.
            # Failed (or absent) students must not be ranked, and any
            # previously assigned position must be cleared.
            ranked_results = [r for r in all_results if r.pass_status == 'pass']
            unranked_results = [r for r in all_results if r.pass_status != 'pass']

            # Sort descending by percentage, then obtained_marks as tiebreaker
            ranked_results.sort(key=lambda r: (r.percentage, r.obtained_marks), reverse=True)

            # Assign ordinal ranks — ties get the same rank
            def ordinal(n):
                if 11 <= (n % 100) <= 13:
                    return f"{n}th"
                return f"{n}{['th','st','nd','rd','th','th','th','th','th','th'][n % 10]}"

            rank = 1
            for i, result in enumerate(ranked_results):
                if i > 0 and (result.percentage, result.obtained_marks) < (ranked_results[i-1].percentage, ranked_results[i-1].obtained_marks):
                    rank = i + 1
                result.position = ordinal(rank)

            for result in unranked_results:
                result.position = None

            Result.objects.bulk_update(ranked_results + unranked_results, ['position'])

            return Response({
                'message': f'Positions calculated for {len(ranked_results)} passing results',
                'updated': len(ranked_results),
                'skipped_failed': len(unranked_results),
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class BulkApproveView(APIView):
    permission_classes = [IsAuthenticated, IsCoordinatorOrAbove]
    
    def post(self, request):
        user = request.user
        result_ids = request.data.get('result_ids', [])
        comments = request.data.get('comments', '')
        
        if not result_ids:
            return Response({'error': 'No result IDs provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Build query based on user role
        if user.is_coordinator():
            coordinator = get_object_or_404(Coordinator, email=user.email)
            results = Result.objects.filter(
                id__in=result_ids,
                coordinator=coordinator,
                status__in=['pending_coordinator', 'pending', 'submitted', 'under_review']
            )
        elif user.is_principal():
            try:
                principal = _get_principal(user)
                # Principals can approve any result in their campus that is pending principal
                results = Result.objects.filter(
                    id__in=result_ids,
                    student__campus=principal.campus,
                    status='pending_principal'
                )
            except Principal.DoesNotExist:
                return Response({'error': 'Principal profile not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        updated_count = 0
        promoted_students = []
        
        # Resolve signature: use provided or fall back to saved profile signature
        req_sig = request.data.get('signature')
        if user.is_coordinator():
            bulk_sig = req_sig or coordinator.signature
            # Auto-save to coordinator profile on first use
            if req_sig and not coordinator.signature:
                coordinator.signature = req_sig
                coordinator.signature_updated_at = timezone.now()
                coordinator.save(update_fields=['signature', 'signature_updated_at'])
        elif user.is_principal():
            bulk_sig = req_sig or principal.signature
            # Auto-save to principal profile on first use
            if req_sig and not principal.signature:
                principal.signature = req_sig
                principal.signature_updated_at = timezone.now()
                principal.save(update_fields=['signature', 'signature_updated_at'])
        else:
            bulk_sig = req_sig

        with transaction.atomic():
            for result in results:
                # If Coordinator approves Mid/Final -> pending_principal
                # If Principal approves -> approved
                # If Monthly -> directly approved by coordinator

                if result.exam_type in ['midterm', 'final']:
                    if user.is_coordinator():
                        # Coordinator Action
                        result.status = 'pending_principal'
                        result.coordinator_comments = comments
                        result.approved_by_coordinator = coordinator
                        result.approved_by_coordinator_at = timezone.now()
                        if bulk_sig:
                            result.coordinator_signature = bulk_sig
                            result.coordinator_signed_at = timezone.now()
                        result.save()

                        campus = result.student.campus
                        if campus:
                            principals = Principal.objects.filter(campus=campus)
                            for p in principals:
                                create_notification(
                                    recipient=p.user,
                                    actor=user,
                                    verb='result_pending_approval',
                                    target_text=f"Result pending approval for {result.student.name}",
                                    data={'result_id': result.id}
                                )

                    elif user.is_principal():
                        # Principal Action
                        result.status = 'approved'
                        result.principal_comments = comments
                        result.approved_by_principal = principal
                        result.approved_by_principal_at = timezone.now()
                        if bulk_sig:
                            result.principal_signature = bulk_sig
                            result.principal_signed_at = timezone.now()
                        result.save()

                        # Notify Teacher
                        if result.teacher and result.teacher.user:
                            create_notification(
                                recipient=result.teacher.user,
                                actor=user,
                                verb='result_approved',
                                target_text=f"Result approved for {result.student.name}",
                                data={'result_id': result.id}
                            )
                        # Notify Coordinator
                        if result.coordinator:
                            from users.models import User
                            coord_user = User.objects.filter(Q(username=result.coordinator.employee_code) | Q(email=result.coordinator.email)).first()
                            if coord_user:
                                create_notification(
                                    recipient=coord_user,
                                    actor=user,
                                    verb='result_approved',
                                    target_text=f"Result approved for {result.student.name}",
                                    data={'result_id': result.id}
                                )

                else:
                    # Monthly Test logic — only coordinator can approve monthly results
                    if not user.is_coordinator():
                        continue
                    result.status = 'approved'
                    result.coordinator_comments = comments
                    result.approved_by_coordinator = coordinator
                    result.approved_by_coordinator_at = timezone.now()
                    if bulk_sig:
                        result.coordinator_signature = bulk_sig
                        result.coordinator_signed_at = timezone.now()
                    result.save()

                    # Notify Teacher
                    if result.teacher and result.teacher.user:
                        create_notification(
                            recipient=result.teacher.user,
                            actor=user,
                            verb='result_approved',
                            target_text=f"Result approved for {result.student.name}",
                            data={'result_id': result.id}
                        )

                updated_count += 1
                
                # === PROMOTION TO SECTION E (Pass + Approved by both coordinator AND principal) ===
                # ONLY move to Section E if:
                #   1. result is now 'approved' (both coordinator AND principal approved)
                #   2. exam_type is 'final'
                #   3. result_status is 'pass' (student passed all subjects)
                # Students who FAIL remain in their current class - DO NOT move them to Section E
                if result.status == 'approved' and result.exam_type == 'final' and result.result_status == 'pass':
                    section_e = _move_student_to_section_e(result.student)
                    if section_e:
                        promoted_students.append(f"{result.student.name} moved to Section E - {section_e.grade.name} (Ready for Promotion)")
                    else:
                        promoted_students.append(f"Could not move {result.student.name} - Section E creation failed")
                elif result.status == 'approved' and result.exam_type == 'final' and result.result_status == 'fail':
                    # Fail student stays in current class - just log it
                    promoted_students.append(f"{result.student.name} - FAILED, remains in current class")

        return Response({
            'message': f'Successfully processed {updated_count} results',
            'updated_count': updated_count,
            'promoted_students': promoted_students
        })
    
    def get_next_class(self, current_class):
        current_grade_name = current_class.grade.name
        import re
        match = re.search(r'(\d+)', current_grade_name)
        if match:
            curr_num = int(match.group(1))
            next_num = curr_num + 1
            next_grade_name_queries = [f"Grade {next_num}", f"Grade-{next_num}", f"Class {next_num}"]
        else:
            mapping = {
                'Nursery': ['KG-I', 'KG 1', 'KG1'],
                'KG-I': ['KG-II', 'KG 2', 'KG2'],
                'KG 1': ['KG-II', 'KG 2', 'KG2'],
                'KG-II': ['Grade 1', 'Grade-1'],
                'KG 2': ['Grade 1', 'Grade-1'],
            }
            next_grade_name_queries = mapping.get(current_grade_name, [])
        
        if not next_grade_name_queries: return None
        from classes.models import Grade, ClassRoom
        grade_query = Q()
        for name in next_grade_name_queries:
            grade_query |= Q(name__iexact=name)
        
        next_grade = Grade.objects.filter(grade_query, level__campus=current_class.campus).first()
        if not next_grade: return None
        return ClassRoom.objects.filter(grade=next_grade, section=current_class.section, shift=current_class.shift).first()


class PromoteStudentsView(APIView):
    """
    API to bulk promote students from Section E (or any class) to a new target class.
    Expected data: { 'student_ids': [1, 2, 3], 'target_classroom_id': 55 }
    """
    permission_classes = [IsAuthenticated, IsCoordinatorOrAbove]

    def post(self, request):
        student_ids = request.data.get('student_ids', [])
        target_classroom_id = request.data.get('target_classroom_id')
        
        if not student_ids or not target_classroom_id:
            return Response({'error': 'student_ids and target_classroom_id are required'}, status=status.HTTP_400_BAD_REQUEST)

        from classes.models import ClassRoom
        target_classroom = get_object_or_404(ClassRoom, id=target_classroom_id)
        
        # Verify permissions: Principal can only promote to their campus classes (conceptually)
        # Assuming IsPrincipalOrCoordinator permission class handles basic role check.
        # We can add extra check if needed.
        
        updated_count = 0
        
        with transaction.atomic():
            students = Student.objects.filter(id__in=student_ids)
            for student in students:
                old_classroom_name = student.classroom.grade.name if student.classroom else "None"

                # Record the grade for BOTH sides of the promotion so year-over-year
                # Grade Progression lines up:
                #   • FROM grade → the year the student just COMPLETED (end_of_year)
                #   • TO grade   → the year they are ENTERING (start_of_year)
                # The completed year comes from the final result that earned this
                # promotion (robust), not date.today() — promoting in the new session
                # would otherwise stamp the old grade under the current year.
                from_grade = student.current_grade
                try:
                    from students.models import EnrollmentSnapshot
                    from datetime import date as _date
                    last_final = (
                        Result.objects.filter(
                            student=student, exam_type='final', status='approved')
                        .order_by('-academic_year').first()
                    )
                    if last_final and last_final.academic_year:
                        completed_ay = last_final.academic_year
                    else:
                        _t = _date.today()
                        _s = _t.year if _t.month >= 4 else _t.year - 1
                        # promoting in a session implies the FROM grade year just ended
                        completed_ay = f"{_s - 1}-{str(_s)[-2:]}"
                    _cs = int(completed_ay.split('-')[0])
                    entering_ay = f"{_cs + 1}-{str(_cs + 2)[-2:]}"

                    EnrollmentSnapshot.all_objects.update_or_create(
                        student=student, academic_year=completed_ay, snapshot_type='end_of_year',
                        defaults={
                            'snapshot_date': _date(_cs + 1, 3, 31), 'campus': student.campus,
                            'classroom': student.classroom, 'grade': from_grade,
                            'section': student.section, 'status': student.enrollment_status,
                            'gender': student.gender, 'organization': student.organization,
                        },
                    )
                except Exception:
                    entering_ay = None

                # Update Student
                student.classroom = target_classroom
                student.current_grade = target_classroom.grade.name
                student.section = target_classroom.section
                student.shift = target_classroom.shift

                # Also update campus if moving campuses (unlikely but possible)
                if target_classroom.grade.campus:
                     student.campus = target_classroom.grade.campus
                elif target_classroom.grade.level and target_classroom.grade.level.campus:
                     student.campus = target_classroom.grade.level.campus

                student.save()

                # TO grade → the year the student is entering (start_of_year).
                if entering_ay:
                    try:
                        from datetime import date as _date
                        EnrollmentSnapshot.all_objects.update_or_create(
                            student=student, academic_year=entering_ay, snapshot_type='start_of_year',
                            defaults={
                                'snapshot_date': _date(int(entering_ay.split('-')[0]), 4, 1),
                                'campus': student.campus, 'classroom': student.classroom,
                                'grade': student.current_grade, 'section': student.section,
                                'status': student.enrollment_status, 'gender': student.gender,
                                'organization': student.organization,
                            },
                        )
                    except Exception:
                        pass
                updated_count += 1
                
                # Log audit? (Optional)
        
        return Response({
            'message': f'Successfully promoted {updated_count} students to {target_classroom.grade.name} - {target_classroom.section}',
            'updated_count': updated_count
        })

class BulkRejectView(APIView):
    permission_classes = [IsAuthenticated, IsCoordinatorOrAbove]
    
    def post(self, request):
        user = request.user
        result_ids = request.data.get('result_ids', [])
        comments = request.data.get('comments', '')
        
        if not result_ids:
            return Response({'error': 'No result IDs provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        query = Q(id__in=result_ids)
        if user.is_coordinator():
            coordinator = get_object_or_404(Coordinator, email=user.email)
            query &= Q(coordinator=coordinator)
        elif user.is_principal():
            principal = _get_principal(user)
            query &= Q(student__classroom__campus=principal.campus)
        
        updated_count = Result.objects.filter(query).update(
            status='rejected',
            coordinator_comments=comments
        )
        
        return Response({
            'message': f'Successfully rejected {updated_count} results',
            'updated_count': updated_count
        })


from rest_framework.parsers import MultiPartParser, FormParser
from django.http import FileResponse
import tempfile
import os
from .services.result_csv_import import import_results_from_csv


class ResultsBulkUploadView(APIView):
    """Accepts a multipart file upload (CSV) and imports results using the existing service."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        overwrite = request.data.get('overwrite') in ['1', 'true', 'True', True]

        # file field may be 'file' or 'csv'
        upload = request.FILES.get('file') or request.FILES.get('csv')
        if not upload:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        # SECURITY: Always use the logged-in teacher's identity.
        # Completely ignore any teacher_id passed from frontend or present in the CSV.
        teacher = Teacher.objects.filter(email=request.user.email).first()
        if not teacher:
            return Response(
                {'error': 'No teacher profile found for the logged-in user. Only teachers can upload results.'},
                status=status.HTTP_403_FORBIDDEN
            )
        t_id = teacher.id

        # save to temp file
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.csv')
        try:
            for chunk in upload.chunks():
                tmp.write(chunk)
            tmp.flush()
            tmp.close()

            reports = import_results_from_csv(tmp.name, teacher_id=t_id, overwrite=overwrite)
            return Response({'reports': reports}, status=status.HTTP_200_OK)
        finally:
            try:
                os.unlink(tmp.name)
            except Exception:
                pass


class SampleTemplateView(APIView):
    # Allow public access to the sample CSV template so teachers can download it without authenticating
    permission_classes = [AllowAny]

    def get(self, request):
        sample_path = os.path.join(os.path.dirname(__file__), 'sample_results.csv')
        # If CSV exists, read header row to build an Excel-friendly HTML table.
        headers = [
            'student_identifier','student_identifier_type','exam_type','academic_year','month',
            'subject_name','total_marks','obtained_marks','grade','teacher_id','remarks'
        ]
        if os.path.exists(sample_path):
            try:
                with open(sample_path, 'r', encoding='utf-8-sig') as f:
                    first = f.readline().strip()
                    if first:
                        parts = [p.strip() for p in first.split(',') if p.strip()]
                        if parts:
                            headers = parts
            except Exception:
                pass

        # Build a minimal HTML table; Excel will open this as a spreadsheet when served with the excel content-type.
        html = ['<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"/></head><body>']
        html.append('<table border="1"><tr>')
        for h in headers:
            html.append(f'<th>{h}</th>')
        html.append('</tr>')
        # empty row for user to start filling
        html.append('<tr>')
        for _ in headers:
            html.append('<td></td>')
        html.append('</tr>')
        html.append('</table></body></html>')
        content = ''.join(html)

        # Return a raw HttpResponse to ensure the content-type isn't overridden by DRF renderers
        resp = HttpResponse(content, content_type='application/vnd.ms-excel; charset=utf-8')
        resp['Content-Disposition'] = 'attachment; filename="sample_results.xls"'
        return resp


class TemplateDataMixin:
    def get_template_data(self, request):
        classroom_id = request.query_params.get('classroom_id')
        teacher_id = request.query_params.get('teacher_id') or ''
        month = request.query_params.get('month') or ''
        
        subjects = []
        students = []
        
        if classroom_id:
            try:
                from classes.models import ClassRoom
                from students.models import Student
                from timetable.models import Subject
                
                classroom = ClassRoom.objects.get(pk=classroom_id)
                students = list(Student.objects.filter(classroom=classroom, is_active=True).order_by('id'))

                campus = classroom.campus
                level = classroom.level

                # Resolve subjects exactly like AvailableSubjectsView so the
                # downloaded template matches the subjects shown in the manual UI.
                base_qs = Subject.objects.filter(campus=campus, is_active=True)
                if level:
                    # Strictly return subjects for this level only
                    level_subjects = base_qs.filter(level=level)
                    if level_subjects.exists():
                        subj_qs = level_subjects
                    else:
                        # No subjects tagged to this level — fall back to campus-wide (untagged) subjects
                        subj_qs = base_qs.filter(level__isnull=True)
                else:
                    # Level unknown — only show untagged (campus-wide) subjects to avoid cross-level leakage
                    subj_qs = base_qs.filter(level__isnull=True)
                subjects = [s.name for s in subj_qs.order_by('name')]

            except Exception as e:
                print("Error getting template data:", e)
        
        # fallback to campus subjects if no classroom
        if not subjects:
            try:
                teacher = None
                if hasattr(request.user, 'teacher_profile') and request.user.teacher_profile:
                    teacher = request.user.teacher_profile
                else:
                    from hr.models import Teacher
                    teacher = Teacher.objects.filter(user=request.user).first()
                    
                if teacher and teacher.current_campus:
                    from timetable.models import Subject
                    qs = Subject.objects.filter(campus=teacher.current_campus, is_active=True).order_by('name')
                    subjects = [s.name for s in qs]
            except Exception:
                pass
                
        # Remove duplicates while preserving order
        unique_subjects = []
        for s in subjects:
            if s not in unique_subjects:
                unique_subjects.append(s)
                
        return unique_subjects, students, teacher_id, month
class SampleMonthlyTemplateView(TemplateDataMixin, APIView):
    # Require authentication so we can return teacher-specific subject hints
    permission_classes = [IsAuthenticated]

    def get(self, request):
        subjects, students, teacher_id, month = self.get_template_data(request)
        subject_labels = subjects  # show all available subjects, no cap

        # Monthly template: headers + subject1..subjectN columns
        # `total_marks` is the per-subject maximum for this row — pass/fail,
        # percentage and grade are computed from whatever value is entered here.
        headers = [
            'student_name', 'student_identifier', 'student_identifier_type', 'exam_type', 'month', 'teacher_id', 'total_marks'
        ]

        # Build HTML table
        html = ['<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"/></head><body>']
        html.append('<table border="1"><tr>')
        # write non-subject headers
        for h in headers:
            html.append(f'<th>{h}</th>')
        # write subject headers (labels)
        for label in subject_labels:
            html.append(f'<th>{label}</th>')
        # remarks stays as the last column
        html.append('<th>remarks</th>')
        html.append('</tr>')

        # Generate data rows for students
        if students:
            for st in students:
                # Determine best identifier and its type
                sid_value = st.student_code or st.student_id or st.gr_no or str(st.id)
                if st.student_code:
                    sid_type = 'student_code'
                elif st.student_id:
                    sid_type = 'student_id'
                elif st.gr_no:
                    sid_type = 'gr_no'
                else:
                    sid_type = 'id'

                html.append('<tr>')
                html.append(f'<td>{st.name}</td>')
                html.append(f'<td>{sid_value}</td>')
                html.append(f'<td>{sid_type}</td>')
                html.append('<td>monthly</td>')
                html.append(f'<td>{month}</td>')
                html.append(f'<td>{teacher_id}</td>')
                html.append('<td>25</td>') # total_marks (per-subject max; edit as needed)
                for _ in subject_labels:
                    html.append('<td></td>') # empty subjects
                html.append('<td></td>') # remarks (last column)
                html.append('</tr>')
        else:
            # empty data row for user to start filling
            html.append('<tr>')
            for _ in range(len(headers) + len(subject_labels) + 1):
                html.append('<td></td>')
            html.append('</tr>')
            
        html.append('</table></body></html>')
        content = ''.join(html)
        resp = HttpResponse(content, content_type='application/vnd.ms-excel; charset=utf-8')
        resp['Content-Disposition'] = 'attachment; filename="sample_results_monthly.xls"'
        return resp


class SampleMidTemplateView(TemplateDataMixin, APIView):
    # require auth for teacher-specific subject hints
    permission_classes = [IsAuthenticated]

    def get(self, request):
        subjects, students, teacher_id, _ = self.get_template_data(request)
        subject_labels = subjects  # show all available subjects, no cap

        # Mid-term template: headers + academic_year + subject_1..subject_10 (no behavior columns)
        headers = [
            'student_name', 'student_identifier', 'student_identifier_type', 'exam_type', 'academic_year', 'teacher_id'
        ]

        html = ['<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"/></head><body>']
        html.append('<table border="1"><tr>')
        # write non-subject headers
        for h in headers:
            html.append(f'<th>{h}</th>')
        # write subject headers (labels)
        for label in subject_labels:
            html.append(f'<th>{label}</th>')
        # remarks stays as the last column
        html.append('<th>remarks</th>')
        html.append('</tr>')

        # Generate data rows for students
        if students:
            from result.services.result_csv_import import _get_academic_year_from_date
            ac_year = _get_academic_year_from_date()
            for st in students:
                # Determine best identifier and its type
                sid_value = st.student_code or st.student_id or st.gr_no or str(st.id)
                if st.student_code:
                    sid_type = 'student_code'
                elif st.student_id:
                    sid_type = 'student_id'
                elif st.gr_no:
                    sid_type = 'gr_no'
                else:
                    sid_type = 'id'

                html.append('<tr>')
                html.append(f'<td>{st.name}</td>')
                html.append(f'<td>{sid_value}</td>')
                html.append(f'<td>{sid_type}</td>')
                html.append('<td>midterm</td>')
                html.append(f'<td>{ac_year}</td>')
                html.append(f'<td>{teacher_id}</td>')
                for _ in subject_labels:
                    html.append('<td></td>') # empty subjects
                html.append('<td></td>') # remarks (last column)
                html.append('</tr>')
        else:
            # empty data row for user to start filling
            html.append('<tr>')
            for _ in range(len(headers) + len(subject_labels) + 1):
                html.append('<td></td>')
            html.append('</tr>')
            
        html.append('</table></body></html>')
        content = ''.join(html)
        resp = HttpResponse(content, content_type='application/vnd.ms-excel; charset=utf-8')
        resp['Content-Disposition'] = 'attachment; filename="sample_results_mid.xls"'
        return resp


class SampleFinalTemplateView(TemplateDataMixin, APIView):
    # Require authentication for teacher-specific subject hints
    permission_classes = [IsAuthenticated]

    def get(self, request):
        subjects, students, teacher_id, _ = self.get_template_data(request)
        subject_labels = subjects  # show all available subjects, no cap

        # Final-term template: include academic_year + behavior cols + subject columns
        headers = [
            'student_name', 'student_identifier', 'student_identifier_type', 'exam_type', 'academic_year', 'teacher_id'
        ]
        behaviour_cols = ['behaviour_response','behaviour_observation','behaviour_participation','behaviour_follow_rules','behaviour_home_work','behaviour_personal_hygiene','behaviour_respect_others']
        headers.extend(behaviour_cols)

        html = ['<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"/></head><body>']
        html.append('<table border="1"><tr>')
        # Write non-subject headers
        for h in headers:
            html.append(f'<th>{h}</th>')
        # Write subject headers (labels)
        for label in subject_labels:
            html.append(f'<th>{label}</th>')
        # remarks stays as the last column
        html.append('<th>remarks</th>')
        html.append('</tr>')

        # Generate data rows for students
        if students:
            from result.services.result_csv_import import _get_academic_year_from_date
            ac_year = _get_academic_year_from_date()
            for st in students:
                # Determine best identifier and its type
                sid_value = st.student_code or st.student_id or st.gr_no or str(st.id)
                if st.student_code:
                    sid_type = 'student_code'
                elif st.student_id:
                    sid_type = 'student_id'
                elif st.gr_no:
                    sid_type = 'gr_no'
                else:
                    sid_type = 'id'

                html.append('<tr>')
                html.append(f'<td>{st.name}</td>')
                html.append(f'<td>{sid_value}</td>')
                html.append(f'<td>{sid_type}</td>')
                html.append('<td>final</td>')
                html.append(f'<td>{ac_year}</td>')
                html.append(f'<td>{teacher_id}</td>')
                for _ in behaviour_cols:
                    html.append('<td></td>') # empty behavior cols
                for _ in subject_labels:
                    html.append('<td></td>') # empty subjects
                html.append('<td></td>') # remarks (last column)
                html.append('</tr>')
        else:
            # empty data row for user to start filling
            html.append('<tr>')
            for _ in range(len(headers) + len(subject_labels) + 1):
                html.append('<td></td>')
            html.append('</tr>')
            
        html.append('</table></body></html>')
        content = ''.join(html)
        resp = HttpResponse(content, content_type='application/vnd.ms-excel; charset=utf-8')
        resp['Content-Disposition'] = 'attachment; filename="sample_results_final.xls"'
        return resp


class AvailableSubjectsView(APIView):
    """Return list of active subjects for a given student or classroom.

    Query params:
    - student_id (optional) : ID of student
    - classroom_id (optional): ID of classroom (fallback)
    If both missing, returns empty list.

    LEVEL FILTERING LOGIC:
    - If student/classroom has a level → return subjects for THAT level only
    - If no level-specific subjects exist → fall back to campus-wide (level=NULL) subjects
    - NEVER mix subjects from different levels
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        student_id = request.query_params.get('student_id')
        classroom_id = request.query_params.get('classroom_id')

        try:
            from timetable.models import Subject
        except Exception:
            return Response({'subjects': []})

        campus = None
        level = None

        if student_id:
            try:
                student = Student.objects.select_related(
                    'classroom__grade__level', 'campus'
                ).get(id=student_id)
                campus = (
                    student.classroom.campus if student.classroom
                    else student.campus
                )
                # Resolve level from classroom → grade → level chain
                level = (
                    student.classroom.grade.level
                    if student.classroom and student.classroom.grade
                    else None
                )
            except Student.DoesNotExist:
                return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

        if not campus and classroom_id:
            try:
                from classes.models import ClassRoom
                classroom = ClassRoom.objects.select_related('grade__level', 'campus').get(id=classroom_id)
                campus = classroom.campus
                level = classroom.grade.level if classroom.grade else None
            except Exception:
                pass

        if not campus:
            return Response({'subjects': []})

        base_qs = Subject.objects.filter(campus=campus, is_active=True)

        if level:
            # Strictly return subjects for this level only
            level_subjects = base_qs.filter(level=level)
            if level_subjects.exists():
                subjects_qs = level_subjects
            else:
                # No subjects tagged to this level — fall back to campus-wide (untagged) subjects
                subjects_qs = base_qs.filter(level__isnull=True)
        else:
            # Level unknown — only show untagged (campus-wide) subjects to avoid cross-level leakage
            subjects_qs = base_qs.filter(level__isnull=True)

        data = [{'id': s.id, 'name': s.name, 'code': s.code} for s in subjects_qs.order_by('name')]
        return Response({'subjects': data})


class TeacherSubjectsDebugView(APIView):
    """Debug: return resolved teacher info and subject lists for the current user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            resolved = {
                'resolved_teacher': None,
                'current_subjects_raw': None,
                'subjects_from_timetable': [],
                'campus_subjects': [],
                'final_hints': []
            }

            teacher = None
            if hasattr(request.user, 'teacher_profile') and request.user.teacher_profile:
                teacher = request.user.teacher_profile
            else:
                teacher = Teacher.objects.filter(user=request.user).first()
                if not teacher:
                    teacher = Teacher.objects.filter(employee_code=getattr(request.user, 'username', '')).first()
                if not teacher:
                    teacher = Teacher.objects.filter(email=getattr(request.user, 'email', '')).first()

            if teacher:
                resolved['resolved_teacher'] = {
                    'id': teacher.id,
                    'full_name': teacher.full_name,
                    'email': teacher.email,
                    'employee_code': teacher.employee_code,
                }
                resolved['current_subjects_raw'] = teacher.current_subjects

                # timetable subjects
                try:
                    from timetable.models import Subject
                    qs = Subject.objects.filter(teacher_periods__teacher=teacher, is_active=True).distinct().order_by('name')
                    resolved['subjects_from_timetable'] = [s.name for s in qs]
                except Exception:
                    resolved['subjects_from_timetable'] = []

                # campus subjects fallback
                try:
                    if teacher.current_campus:
                        from timetable.models import Subject
                        qs2 = Subject.objects.filter(campus=teacher.current_campus, is_active=True).order_by('name')
                        resolved['campus_subjects'] = [s.name for s in qs2]
                except Exception:
                    resolved['campus_subjects'] = []
                hints = []
                if teacher.current_subjects:
                    import re
                    parts = [s.strip() for s in re.split('[,;]', teacher.current_subjects) if s.strip()]
                    hints = parts[:10]

                if len(hints) < 10:
                    for s in resolved.get('subjects_from_timetable', []):
                        if len(hints) >= 10:
                            break
                        if s not in hints:
                            hints.append(s)

                if len(hints) < 10:
                    for s in resolved.get('campus_subjects', []):
                        if len(hints) >= 10:
                            break
                        if s not in hints:
                            hints.append(s)

                # As a final fallback, ensure we have placeholder names up to 10
                if len(hints) < 10:
                    for i in range(len(hints) + 1, 11):
                        hints.append(f'subject_{i}')

                resolved['final_hints'] = hints

            return Response(resolved)
        except Exception as e:
            return Response({'error': str(e)}, status=500)



# ─── Org Admin Global Network Performance Dashboard ──────────────────────────
class OrgPerformanceDashboardView(APIView):
    """Aggregated performance metrics for the org-admin Global Network Dashboard.

    INTER mode (no `campus`): network KPIs, per-campus leaderboard, grade
    distribution, campus×subject heatmap. INTRA mode (`campus=<id>`): adds a
    per-branch block (class-wise pass rates, subject performance, monthly trend).
    Only APPROVED results are counted. Filter by academic_year + exam_type.
    """
    permission_classes = [IsAuthenticated]

    CRITICAL_THRESHOLD = 60  # pass rate % below this = "critical" campus
    BEHAVIOUR_KEYWORDS = [
        'behaviour', 'behavior', 'homework', 'home_work', 'hygiene', 'observation',
        'participation', 'response', 'follow_rules', 'respect_others', 'personal_hygiene',
    ]
    MONTH_ORDER = [
        'April', 'May', 'June', 'July', 'August', 'September', 'October',
        'November', 'December', 'January', 'February', 'March',
    ]

    def _academic_months(self, start, end):
        """Ordered month names from a campus's academic-year start → end month
        (wraps across the year, e.g. April → March)."""
        order = self.MONTH_ORDER
        if not start or not end or start not in order or end not in order:
            return []
        si, ei = order.index(start), order.index(end)
        return order[si:ei + 1] if si <= ei else order[si:] + order[:ei + 1]

    def _campus_months(self, campuses):
        """Union of academic months across the given campuses, in academic order."""
        found = set()
        for c in campuses:
            for m in self._academic_months(c.academic_year_start_month, c.academic_year_end_month):
                found.add(m)
        return [m for m in self.MONTH_ORDER if m in found]

    def _is_behaviour(self, name):
        n = (name or '').lower().replace(' ', '_')
        return not name or any(k in n for k in self.BEHAVIOUR_KEYWORDS)

    @staticmethod
    def _rate(passed, failed):
        ev = (passed or 0) + (failed or 0)
        return round((passed or 0) / ev * 100, 1) if ev else 0

    @staticmethod
    def _prev_academic_year(year):
        """'2026-27' → '2025-26'. Returns None if the format isn't parseable."""
        try:
            start = int(str(year).split('-')[0])
            return f"{start - 1}-{str(start)[-2:]}"
        except (ValueError, IndexError, TypeError):
            return None

    def _campus_year_comparison(self, exam_type, academic_year, month):
        """Per-campus pass rate for the selected year vs the previous academic
        year (same exam_type/month). Powers the 'This Year vs Last Year' chart."""
        prev = self._prev_academic_year(academic_year)

        def per_campus(yr):
            out = {}
            if not yr:
                return out
            qs = Result.objects.filter(
                status='approved', is_deleted=False, exam_type=exam_type, academic_year=yr)
            if exam_type == 'monthly' and month:
                qs = qs.filter(month=month)
            for r in qs.values('student__campus', 'student__campus__campus_name').annotate(
                    passed=Count('id', filter=Q(pass_status='pass')),
                    failed=Count('id', filter=Q(pass_status='fail'))):
                if not r['student__campus']:
                    continue
                out[r['student__campus']] = {
                    'campus': r['student__campus__campus_name'] or 'Unknown',
                    'rate': self._rate(r['passed'], r['failed']),
                }
            return out

        cur, old = per_campus(academic_year), per_campus(prev)
        rows = [
            {'campus': d['campus'], 'this_year': d['rate'],
             'last_year': old.get(cid, {}).get('rate')}
            for cid, d in cur.items()
        ]
        rows.sort(key=lambda x: x['this_year'], reverse=True)
        return {
            'this_year': academic_year, 'last_year': prev,
            'rows': rows, 'has_last_year': bool(old),
        }

    def get(self, request):
        from django.db.models import Avg
        from campus.models import Campus

        exam_type = request.query_params.get('exam_type', 'final')
        academic_year = request.query_params.get('academic_year')
        month = request.query_params.get('month')
        campus_id = request.query_params.get('campus')

        years = sorted(set(Result.objects.values_list('academic_year', flat=True)), reverse=True)
        if not academic_year:
            academic_year = years[0] if years else '2024-25'

        base = Result.objects.filter(
            status='approved', is_deleted=False,
            exam_type=exam_type, academic_year=academic_year,
        )
        if exam_type == 'monthly' and month:
            base = base.filter(month=month)

        # ── Per-campus leaderboard + system pass rate ──
        campus_rows = base.values('student__campus', 'student__campus__campus_name').annotate(
            passed=Count('id', filter=Q(pass_status='pass')),
            failed=Count('id', filter=Q(pass_status='fail')),
            avg_pct=Avg('percentage'),
        )
        leaderboard, total_passed, total_failed = [], 0, 0
        for r in campus_rows:
            if not r['student__campus']:
                continue
            total_passed += r['passed']; total_failed += r['failed']
            rate = self._rate(r['passed'], r['failed'])
            leaderboard.append({
                'campus_id': r['student__campus'],
                'campus': r['student__campus__campus_name'] or 'Unknown',
                'pass_rate': rate,
                'avg_percentage': round(r['avg_pct'] or 0, 1),
                'evaluated': r['passed'] + r['failed'],
                'critical': rate < self.CRITICAL_THRESHOLD,
            })
        leaderboard.sort(key=lambda x: x['pass_rate'], reverse=True)
        for i, item in enumerate(leaderboard):
            item['rank'] = i + 1
        critical = [l for l in leaderboard if l['critical']]

        kpis = {
            'total_enrollment': Student.objects.filter(is_active=True, is_deleted=False).count(),
            'system_pass_rate': self._rate(total_passed, total_failed),
            'total_branches': len(leaderboard),
            'critical_count': len(critical),
            'critical_campuses': [{'campus': c['campus'], 'pass_rate': c['pass_rate']} for c in critical],
        }

        # ── Grade distribution ──
        grade_order = ['A+', 'A', 'B', 'C', 'D', 'E', 'F']
        grade_counts = dict(base.exclude(grade='Absent').values_list('grade').annotate(c=Count('id')))
        grade_distribution = [{'grade': g, 'count': grade_counts.get(g, 0)} for g in grade_order]

        # ── Subject heatmap (campus × subject pass %) ──
        sm_base = SubjectMark.objects.filter(
            result__status='approved', result__is_deleted=False,
            result__exam_type=exam_type, result__academic_year=academic_year,
        )
        if exam_type == 'monthly' and month:
            sm_base = sm_base.filter(result__month=month)
        heatmap, subjects_set = {}, set()
        for r in sm_base.values('result__student__campus__campus_name', 'subject_name').annotate(
            total=Count('id'), passed=Count('id', filter=Q(is_pass=True)),
        ):
            subj = r['subject_name']
            if self._is_behaviour(subj):
                continue
            camp = r['result__student__campus__campus_name'] or 'Unknown'
            heatmap.setdefault(camp, {})[subj] = round(r['passed'] / r['total'] * 100, 1) if r['total'] else 0
            subjects_set.add(subj)
        subject_heatmap = [{'campus': c, 'subjects': s} for c, s in heatmap.items()]

        # Months from campus academic-year config; fall back to months present in data.
        months = self._campus_months(Campus.objects.all())
        if not months:
            present = set(Result.objects.filter(
                exam_type='monthly', academic_year=academic_year).values_list('month', flat=True))
            months = [m for m in self.MONTH_ORDER if m in present]

        payload = {
            'filters': {
                'academic_year': academic_year,
                'exam_type': exam_type,
                'available_years': years,
                'available_exam_types': ['monthly', 'midterm', 'final'],
                'subjects': sorted(subjects_set),
                'campuses': [{'id': l['campus_id'], 'name': l['campus']} for l in leaderboard],
                'months': months,
            },
            'kpis': kpis,
            'leaderboard': leaderboard,
            'grade_distribution': grade_distribution,
            'subject_heatmap': subject_heatmap,
            'year_comparison': self._campus_year_comparison(exam_type, academic_year, month),
        }

        # ── INTRA (single branch drill-down) ──
        # campus='all' → aggregate every campus (the "All Campus" picker option);
        # a specific id → that campus only.
        if campus_id:
            all_campuses = str(campus_id).lower() == 'all'
            intra_base = base if all_campuses else base.filter(student__campus_id=campus_id)
            agg = intra_base.aggregate(
                passed=Count('id', filter=Q(pass_status='pass')),
                failed=Count('id', filter=Q(pass_status='fail')),
                avg_pct=Avg('percentage'),
            )
            class_pass_rates = sorted([
                {'grade': r['student__current_grade'],
                 'pass_rate': self._rate(r['passed'], r['failed'])}
                for r in intra_base.values('student__current_grade').annotate(
                    passed=Count('id', filter=Q(pass_status='pass')),
                    failed=Count('id', filter=Q(pass_status='fail')),
                ) if r['student__current_grade']
            ], key=lambda x: x['grade'])

            sp_base = sm_base if all_campuses else sm_base.filter(result__student__campus_id=campus_id)
            subject_performance = sorted([
                {'subject': r['subject_name'],
                 'pass_rate': round(r['passed'] / r['total'] * 100, 1) if r['total'] else 0}
                for r in sp_base.values('subject_name').annotate(
                    total=Count('id'), passed=Count('id', filter=Q(is_pass=True)))
                if not self._is_behaviour(r['subject_name'])
            ], key=lambda x: x['pass_rate'], reverse=True)

            trend_qs = Result.objects.filter(
                status='approved', is_deleted=False, exam_type='monthly',
                academic_year=academic_year)
            if not all_campuses:
                trend_qs = trend_qs.filter(student__campus_id=campus_id)
            trend_map = {
                r['month']: r for r in trend_qs.values('month').annotate(
                    passed=Count('id', filter=Q(pass_status='pass')),
                    failed=Count('id', filter=Q(pass_status='fail')),
                    avg_pct=Avg('percentage'),
                ) if r['month']
            }
            trend = []
            for m in self.MONTH_ORDER:
                if m in trend_map:
                    r = trend_map[m]
                    p = self._rate(r['passed'], r['failed'])
                    trend.append({'period': m, 'pass': p, 'fail': round(100 - p, 1),
                                  'average': round(r['avg_pct'] or 0, 1)})

            enroll_qs = Student.objects.filter(is_active=True, is_deleted=False)
            if not all_campuses:
                enroll_qs = enroll_qs.filter(campus_id=campus_id)
            payload['intra'] = {
                'kpis': {
                    'branch_enrollment': enroll_qs.count(),
                    'pass_rate': self._rate(agg['passed'], agg['failed']),
                    'avg_percentage': round(agg['avg_pct'] or 0, 1),
                },
                'class_pass_rates': class_pass_rates,
                'subject_performance': subject_performance,
                'trend': trend,
            }

        return Response(payload)


# ─── Principal Dashboard (own campus internals + network ranking) ─────────────
class PrincipalPerformanceDashboardView(OrgPerformanceDashboardView):
    """INTRA: the principal's own campus internals (class/subject/top/failing).
    INTER: how the principal's campus ranks against the network (aggregate only —
    no other campus's student-level detail). Approved results only.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Avg, Sum

        principal = _get_principal(request.user)
        if not principal or not principal.campus:
            return Response({'error': 'No campus assigned to principal.'}, status=status.HTTP_400_BAD_REQUEST)
        campus = principal.campus

        exam_type = request.query_params.get('exam_type', 'final')
        academic_year = request.query_params.get('academic_year')
        month = request.query_params.get('month')
        level_param = request.query_params.get('level')
        classroom_id = request.query_params.get('classroom')

        years = sorted(set(Result.objects.values_list('academic_year', flat=True)), reverse=True)
        if not academic_year:
            academic_year = years[0] if years else '2024-25'

        # Network-wide base (all campuses) and own-campus base
        net_base = Result.objects.filter(
            status='approved', is_deleted=False, exam_type=exam_type, academic_year=academic_year)
        if exam_type == 'monthly' and month:
            net_base = net_base.filter(month=month)
        base = net_base.filter(student__campus=campus)
        if level_param:
            base = base.filter(student__classroom__grade__level__name=level_param)

        # ── INTRA KPIs ──
        agg = base.aggregate(
            passed=Count('id', filter=Q(pass_status='pass')),
            failed=Count('id', filter=Q(pass_status='fail')),
        )
        pass_rate = self._rate(agg['passed'], agg['failed'])
        intra_kpis = {
            'total_enrollment': Student.objects.filter(
                campus=campus, is_active=True, is_deleted=False).count(),
            'pass_rate': pass_rate,
            'fail_rate': round(100 - pass_rate, 1) if (agg['passed'] + agg['failed']) else 0,
        }

        # ── Class-wise pass/fail ──
        class_pass_fail = []
        for r in base.values('student__current_grade', 'student__section').annotate(
                passed=Count('id', filter=Q(pass_status='pass')),
                failed=Count('id', filter=Q(pass_status='fail'))):
            grade = r['student__current_grade'] or ''
            sec = r['student__section'] or ''
            label = f"{grade}-{sec}" if sec else (grade or 'Unknown')
            class_pass_fail.append({'class': label, 'pass': r['passed'], 'fail': r['failed']})
        class_pass_fail.sort(key=lambda x: x['class'])

        # ── Subject performance (weighted average %) ──
        sm_base = SubjectMark.objects.filter(
            result__status='approved', result__is_deleted=False,
            result__exam_type=exam_type, result__academic_year=academic_year,
            result__student__campus=campus)
        if exam_type == 'monthly' and month:
            sm_base = sm_base.filter(result__month=month)
        if level_param:
            sm_base = sm_base.filter(result__student__classroom__grade__level__name=level_param)
        subject_performance = []
        for r in sm_base.values('subject_name').annotate(
                tot=Sum('total_marks'), obt=Sum('obtained_marks')):
            if self._is_behaviour(r['subject_name']):
                continue
            subject_performance.append({
                'subject': r['subject_name'],
                'avg_pct': round((r['obt'] or 0) / r['tot'] * 100, 1) if r['tot'] else 0,
            })
        subject_performance.sort(key=lambda x: x['avg_pct'], reverse=True)

        # ── Top / failing students (optionally class-filtered) ──
        student_base = base.filter(student__classroom_id=classroom_id) if classroom_id else base
        top_students = [
            {'id': r.student.id, 'name': r.student.name, 'grade': r.student.current_grade,
             'section': r.student.section, 'percentage': round(r.percentage or 0, 1)}
            for r in student_base.filter(pass_status='pass').select_related('student').order_by('-percentage')[:150]
        ]
        failing_students = [
            {'id': r.student.id, 'name': r.student.name, 'grade': r.student.current_grade,
             'section': r.student.section, 'percentage': round(r.percentage or 0, 1)}
            for r in student_base.filter(pass_status='fail').select_related('student').order_by('percentage')[:150]
        ]
        classrooms, seen = [], set()
        for r in base.values('student__classroom', 'student__current_grade', 'student__section'):
            cid = r['student__classroom']
            if not cid or cid in seen:
                continue
            seen.add(cid)
            classrooms.append({'id': cid, 'name': f"{r['student__current_grade'] or ''}-{r['student__section'] or ''}"})

        # ── INTER: leaderboard + rank + network baseline ──
        leaderboard, total_p, total_f = [], 0, 0
        for r in net_base.values('student__campus', 'student__campus__campus_name').annotate(
                passed=Count('id', filter=Q(pass_status='pass')),
                failed=Count('id', filter=Q(pass_status='fail'))):
            if not r['student__campus']:
                continue
            total_p += r['passed']; total_f += r['failed']
            leaderboard.append({
                'campus_id': r['student__campus'],
                'campus': r['student__campus__campus_name'] or 'Unknown',
                'pass_rate': self._rate(r['passed'], r['failed']),
                'is_own': r['student__campus'] == campus.id,
            })
        leaderboard.sort(key=lambda x: x['pass_rate'], reverse=True)
        for i, l in enumerate(leaderboard):
            l['rank'] = i + 1
        own = next((l for l in leaderboard if l['is_own']), None)
        inter_kpis = {
            'network_rank': own['rank'] if own else None,
            'total_campuses': len(leaderboard),
            'campus_pass_rate': own['pass_rate'] if own else pass_rate,
            'network_avg_baseline': self._rate(total_p, total_f),
        }

        # ── Subject radar: own campus vs network avg (pass %) ──
        net_sm = SubjectMark.objects.filter(
            result__status='approved', result__is_deleted=False,
            result__exam_type=exam_type, result__academic_year=academic_year)
        if exam_type == 'monthly' and month:
            net_sm = net_sm.filter(result__month=month)

        def _subject_pass(qs):
            out = {}
            for r in qs.values('subject_name').annotate(
                    total=Count('id'), passed=Count('id', filter=Q(is_pass=True))):
                if self._is_behaviour(r['subject_name']):
                    continue
                out[r['subject_name']] = round(r['passed'] / r['total'] * 100, 1) if r['total'] else 0
            return out

        own_subj = _subject_pass(sm_base)
        net_subj = _subject_pass(net_sm)
        radar_subjects = sorted(own_subj.keys())[:8]
        subject_radar = [
            {'subject': s, 'own_pct': own_subj.get(s, 0), 'network_avg_pct': net_subj.get(s, 0)}
            for s in radar_subjects
        ]

        # ── Grade Level Benchmark: per campus × grade pass rate ──
        grade_map = {}
        for r in net_base.values('student__campus__campus_name', 'student__current_grade').annotate(
                passed=Count('id', filter=Q(pass_status='pass')),
                failed=Count('id', filter=Q(pass_status='fail'))):
            camp = r['student__campus__campus_name'] or 'Unknown'
            grade = r['student__current_grade']
            if not grade:
                continue
            grade_map.setdefault(camp, {})[grade] = self._rate(r['passed'], r['failed'])
        grade_benchmark = [{'campus': c, 'grades': g} for c, g in grade_map.items()]

        return Response({
            'filters': {
                'academic_year': academic_year, 'exam_type': exam_type,
                'available_years': years, 'campus': campus.campus_name,
                'classrooms': classrooms,
                'months': self._academic_months(
                    campus.academic_year_start_month, campus.academic_year_end_month
                ) or [m for m in self.MONTH_ORDER if m in set(
                    Result.objects.filter(exam_type='monthly', academic_year=academic_year,
                                           student__campus=campus).values_list('month', flat=True))],
            },
            'intra': {
                'kpis': intra_kpis,
                'class_pass_fail': class_pass_fail,
                'subject_performance': subject_performance,
                'top_students': top_students,
                'failing_students': failing_students,
            },
            'inter': {
                'kpis': inter_kpis,
                'leaderboard': leaderboard,
                'subject_radar': subject_radar,
                'grade_benchmark': grade_benchmark,
            },
        })


# ─── Coordinator Dashboard (own wing/level internals + wing vs campus) ────────
class CoordinatorPerformanceDashboardView(OrgPerformanceDashboardView):
    """INTRA: the coordinator's own wing (level) internals — section standings,
    subject performance, top/failing students. COMPARE: the wing vs the whole
    campus baseline (NOT other campuses — a coordinator never sees the network).
    Approved results only.
    """
    permission_classes = [IsAuthenticated]

    def _subject_pass(self, qs):
        out = {}
        for r in qs.values('subject_name').annotate(
                total=Count('id'), passed=Count('id', filter=Q(is_pass=True))):
            if self._is_behaviour(r['subject_name']):
                continue
            out[r['subject_name']] = round(r['passed'] / r['total'] * 100, 1) if r['total'] else 0
        return out

    def get(self, request):
        from django.db.models import Avg, Sum
        from coordinator.models import Coordinator

        coord = Coordinator.get_for_user(request.user)
        if not coord or not coord.campus:
            return Response({'error': 'No coordinator profile / campus.'}, status=status.HTTP_400_BAD_REQUEST)
        campus = coord.campus
        managed = [l for l in (list(coord.assigned_levels.all()) or ([coord.level] if coord.level else [])) if l]
        if not managed:
            return Response({'error': 'No wing/level assigned to this coordinator.'}, status=status.HTTP_400_BAD_REQUEST)

        exam_type = request.query_params.get('exam_type', 'final')
        academic_year = request.query_params.get('academic_year')
        month = request.query_params.get('month')
        level_id = request.query_params.get('level')
        classroom_id = request.query_params.get('classroom')

        selected = next((l for l in managed if str(l.id) == str(level_id)), managed[0])

        years = sorted(set(Result.objects.values_list('academic_year', flat=True)), reverse=True)
        if not academic_year:
            academic_year = years[0] if years else '2024-25'

        year_base = Result.objects.filter(
            status='approved', is_deleted=False, exam_type=exam_type, academic_year=academic_year)
        if exam_type == 'monthly' and month:
            year_base = year_base.filter(month=month)
        campus_base = year_base.filter(student__campus=campus)                       # whole campus (baseline)
        wing_base = campus_base.filter(student__classroom__grade__level=selected)     # the coordinator's wing

        # ── INTRA (wing) ──
        wagg = wing_base.aggregate(
            passed=Count('id', filter=Q(pass_status='pass')),
            failed=Count('id', filter=Q(pass_status='fail')), avg=Avg('percentage'))
        wing_pass = self._rate(wagg['passed'], wagg['failed'])
        intra_kpis = {
            'wing_enrollment': Student.objects.filter(
                campus=campus, classroom__grade__level=selected, is_active=True, is_deleted=False).count(),
            'pass_rate': wing_pass,
            'fail_rate': round(100 - wing_pass, 1) if (wagg['passed'] + wagg['failed']) else 0,
        }

        section_standings = sorted([
            {'section': (f"{r['student__current_grade'] or ''}-{r['student__section'] or ''}"),
             'pass_rate': self._rate(r['passed'], r['failed'])}
            for r in wing_base.values('student__current_grade', 'student__section').annotate(
                passed=Count('id', filter=Q(pass_status='pass')),
                failed=Count('id', filter=Q(pass_status='fail')))
        ], key=lambda x: x['section'])

        wing_sm = SubjectMark.objects.filter(
            result__status='approved', result__is_deleted=False,
            result__exam_type=exam_type, result__academic_year=academic_year,
            result__student__campus=campus, result__student__classroom__grade__level=selected)
        if exam_type == 'monthly' and month:
            wing_sm = wing_sm.filter(result__month=month)
        subject_performance = sorted([
            {'subject': r['subject_name'],
             'avg_pct': round((r['obt'] or 0) / r['tot'] * 100, 1) if r['tot'] else 0}
            for r in wing_sm.values('subject_name').annotate(tot=Sum('total_marks'), obt=Sum('obtained_marks'))
            if not self._is_behaviour(r['subject_name'])
        ], key=lambda x: x['avg_pct'], reverse=True)

        student_base = wing_base.filter(student__classroom_id=classroom_id) if classroom_id else wing_base
        top_students = [
            {'id': r.student.id, 'name': r.student.name, 'grade': r.student.current_grade, 'section': r.student.section,
             'percentage': round(r.percentage or 0, 1)}
            for r in student_base.filter(pass_status='pass').select_related('student').order_by('-percentage')[:150]]
        failing_students = [
            {'id': r.student.id, 'name': r.student.name, 'grade': r.student.current_grade, 'section': r.student.section,
             'percentage': round(r.percentage or 0, 1)}
            for r in student_base.filter(pass_status='fail').select_related('student').order_by('percentage')[:150]]
        classrooms, seen = [], set()
        for r in wing_base.values('student__classroom', 'student__current_grade', 'student__section'):
            cid = r['student__classroom']
            if not cid or cid in seen:
                continue
            seen.add(cid)
            classrooms.append({'id': cid, 'name': f"{r['student__current_grade'] or ''}-{r['student__section'] or ''}"})

        # ── COMPARE (wing vs campus) ──
        cagg = campus_base.aggregate(
            passed=Count('id', filter=Q(pass_status='pass')),
            failed=Count('id', filter=Q(pass_status='fail')), avg=Avg('percentage'))
        campus_pass = self._rate(cagg['passed'], cagg['failed'])
        campus_sm = SubjectMark.objects.filter(
            result__status='approved', result__is_deleted=False,
            result__exam_type=exam_type, result__academic_year=academic_year, result__student__campus=campus)
        if exam_type == 'monthly' and month:
            campus_sm = campus_sm.filter(result__month=month)
        wing_subj, campus_subj = self._subject_pass(wing_sm), self._subject_pass(campus_sm)
        compare_subjects = sorted(set(wing_subj) | set(campus_subj))[:8]
        subject_comparison = [
            {'subject': s, 'wing_pct': wing_subj.get(s, 0), 'campus_pct': campus_subj.get(s, 0)}
            for s in compare_subjects]

        months = self._academic_months(
            campus.academic_year_start_month, campus.academic_year_end_month
        ) or [m for m in self.MONTH_ORDER if m in set(
            Result.objects.filter(exam_type='monthly', academic_year=academic_year,
                                   student__campus=campus).values_list('month', flat=True))]

        return Response({
            'filters': {
                'academic_year': academic_year, 'exam_type': exam_type, 'available_years': years,
                'campus': campus.campus_name, 'wing': selected.name,
                'levels': [{'id': l.id, 'name': l.name} for l in managed],
                'classrooms': classrooms, 'months': months,
            },
            'intra': {
                'kpis': intra_kpis,
                'section_standings': section_standings,
                'subject_performance': subject_performance,
                'top_students': top_students,
                'failing_students': failing_students,
            },
            'compare': {
                'kpis': {
                    'wing_pass_rate': wing_pass, 'campus_pass_rate': campus_pass,
                    'wing_avg': round(wagg['avg'] or 0, 1), 'campus_avg': round(cagg['avg'] or 0, 1),
                },
                'subject_comparison': subject_comparison,
            },
        })


# ─── Class Teacher Dashboard (own classroom internals + class vs campus) ──────
class ClassTeacherPerformanceDashboardView(OrgPerformanceDashboardView):
    """INTRA: the class teacher's own classroom — student roster, student×subject
    heatmap, subject performance. COMPARE: the class vs the campus baseline
    (Hidden — no other classes / campuses). Approved results only.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Avg, Sum, Q as _Q
        from classes.models import ClassRoom

        teacher = Teacher.objects.filter(email=request.user.email).first()
        if not teacher:
            return Response({'error': 'No teacher profile.'}, status=status.HTTP_400_BAD_REQUEST)
        my_classes = ClassRoom.objects.filter(
            _Q(class_teacher=teacher) | _Q(class_teachers=teacher)
        ).select_related('grade__level__campus').distinct()
        if not my_classes.exists():
            return Response({'error': 'You are not assigned as class teacher of any classroom.'},
                            status=status.HTTP_400_BAD_REQUEST)

        exam_type = request.query_params.get('exam_type', 'final')
        academic_year = request.query_params.get('academic_year')
        month = request.query_params.get('month')
        classroom_id = request.query_params.get('classroom')

        selected = next((c for c in my_classes if str(c.id) == str(classroom_id)), my_classes.first())
        # ClassRoom has no direct campus FK — it comes via grade → level → campus.
        campus = getattr(getattr(getattr(selected, 'grade', None), 'level', None), 'campus', None)

        years = sorted(set(Result.objects.values_list('academic_year', flat=True)), reverse=True)
        if not academic_year:
            academic_year = years[0] if years else '2024-25'

        year_base = Result.objects.filter(
            status='approved', is_deleted=False, exam_type=exam_type, academic_year=academic_year)
        if exam_type == 'monthly' and month:
            year_base = year_base.filter(month=month)
        campus_base = year_base.filter(student__campus=campus)
        class_base = year_base.filter(student__classroom=selected)

        # ── INTRA (my class) ──
        cagg = class_base.aggregate(
            passed=Count('id', filter=Q(pass_status='pass')),
            failed=Count('id', filter=Q(pass_status='fail')), avg=Avg('percentage'))
        class_pass = self._rate(cagg['passed'], cagg['failed'])
        intra_kpis = {
            'class_enrollment': Student.objects.filter(
                classroom=selected, is_active=True, is_deleted=False).count(),
            'pass_rate': class_pass,
            'fail_rate': round(100 - class_pass, 1) if (cagg['passed'] + cagg['failed']) else 0,
        }

        # student roster + student×subject heatmap
        roster, heatmap, subjects_set = [], [], set()
        for r in class_base.select_related('student').prefetch_related('subject_marks').order_by('-percentage'):
            roster.append({
                'id': r.student.id, 'name': r.student.name, 'grade': r.student.current_grade,
                'percentage': round(r.percentage or 0, 1), 'status': r.pass_status,
            })
            row = {'id': r.student.id, 'student': r.student.name, 'subjects': {}}
            for sm in r.subject_marks.all():
                if self._is_behaviour(sm.subject_name):
                    continue
                tot = sm.get_total_marks()
                row['subjects'][sm.subject_name] = round(sm.get_obtained_marks() / tot * 100, 1) if tot else 0
                subjects_set.add(sm.subject_name)
            heatmap.append(row)

        class_sm = SubjectMark.objects.filter(
            result__status='approved', result__is_deleted=False,
            result__exam_type=exam_type, result__academic_year=academic_year,
            result__student__classroom=selected)
        if exam_type == 'monthly' and month:
            class_sm = class_sm.filter(result__month=month)
        subject_performance = sorted([
            {'subject': r['subject_name'],
             'avg_pct': round((r['obt'] or 0) / r['tot'] * 100, 1) if r['tot'] else 0}
            for r in class_sm.values('subject_name').annotate(tot=Sum('total_marks'), obt=Sum('obtained_marks'))
            if not self._is_behaviour(r['subject_name'])
        ], key=lambda x: x['avg_pct'], reverse=True)

        # ── COMPARE (class vs campus baseline) ──
        cmp_agg = campus_base.aggregate(
            passed=Count('id', filter=Q(pass_status='pass')),
            failed=Count('id', filter=Q(pass_status='fail')), avg=Avg('percentage'))
        campus_pass = self._rate(cmp_agg['passed'], cmp_agg['failed'])
        campus_sm = SubjectMark.objects.filter(
            result__status='approved', result__is_deleted=False,
            result__exam_type=exam_type, result__academic_year=academic_year, result__student__campus=campus)
        if exam_type == 'monthly' and month:
            campus_sm = campus_sm.filter(result__month=month)

        def _subject_pass(qs):
            out = {}
            for r in qs.values('subject_name').annotate(
                    total=Count('id'), passed=Count('id', filter=Q(is_pass=True))):
                if self._is_behaviour(r['subject_name']):
                    continue
                out[r['subject_name']] = round(r['passed'] / r['total'] * 100, 1) if r['total'] else 0
            return out

        class_subj, campus_subj = _subject_pass(class_sm), _subject_pass(campus_sm)
        cmp_subjects = sorted(set(class_subj) | set(campus_subj))[:8]
        subject_comparison = [
            {'subject': s, 'class_pct': class_subj.get(s, 0), 'campus_pct': campus_subj.get(s, 0)}
            for s in cmp_subjects]

        months = self._academic_months(
            campus.academic_year_start_month, campus.academic_year_end_month
        ) or [m for m in self.MONTH_ORDER if m in set(
            Result.objects.filter(exam_type='monthly', academic_year=academic_year,
                                   student__campus=campus).values_list('month', flat=True))]

        return Response({
            'filters': {
                'academic_year': academic_year, 'exam_type': exam_type, 'available_years': years,
                'campus': campus.campus_name if campus else None,
                'classroom': str(selected),
                'classrooms': [{'id': c.id, 'name': str(c)} for c in my_classes],
                'subjects': sorted(subjects_set), 'months': months,
            },
            'intra': {
                'kpis': intra_kpis,
                'student_roster': roster,
                'student_heatmap': heatmap,
                'subject_performance': subject_performance,
            },
            'compare': {
                'kpis': {
                    'class_pass_rate': class_pass, 'campus_pass_rate': campus_pass,
                    'class_avg': round(cagg['avg'] or 0, 1), 'campus_avg': round(cmp_agg['avg'] or 0, 1),
                },
                'subject_comparison': subject_comparison,
            },
        })


# ─── Donor Dashboard (sponsored-network impact + single-campus drill-down) ─────
class DonorPerformanceDashboardView(OrgPerformanceDashboardView):
    """Donor Impact & Performance Dashboard (read-only, org-scoped).

    INTER: whole sponsored network — sponsored lives, avg success rate,
    inter-campus leaderboard, network grade-level progression (pass % per
    level band, per campus). INTRA (`campus=<id>`): one campus — branch
    enrollment, localized pass rate, campus avg %, subject core competencies,
    grade distribution. Approved results only. Filter by academic_year +
    exam_type (+ month for monthly).
    """
    permission_classes = [IsAuthenticated]

    # Academic progression order; unknown levels fall to the end (alphabetical).
    LEVEL_ORDER = ['Pre-Primary', 'Pre Primary', 'Foundation', 'Primary',
                   'Middle', 'Elementary', 'Secondary', 'Higher Secondary']

    def _level_key(self, name):
        n = (name or '').strip()
        for i, lvl in enumerate(self.LEVEL_ORDER):
            if lvl.lower() == n.lower():
                return (i, n)
        return (len(self.LEVEL_ORDER), n)

    def get(self, request):
        from django.db.models import Avg
        from campus.models import Campus

        exam_type = request.query_params.get('exam_type', 'final')
        academic_year = request.query_params.get('academic_year')
        month = request.query_params.get('month')
        campus_id = request.query_params.get('campus')

        years = sorted(set(Result.objects.values_list('academic_year', flat=True)), reverse=True)
        if not academic_year:
            academic_year = years[0] if years else '2024-25'

        net_base = Result.objects.filter(
            status='approved', is_deleted=False,
            exam_type=exam_type, academic_year=academic_year)
        if exam_type == 'monthly' and month:
            net_base = net_base.filter(month=month)

        # ── INTER: per-campus leaderboard + network KPIs ──
        leaderboard, total_p, total_f = [], 0, 0
        for r in net_base.values('student__campus', 'student__campus__campus_name').annotate(
                passed=Count('id', filter=Q(pass_status='pass')),
                failed=Count('id', filter=Q(pass_status='fail')),
                avg_pct=Avg('percentage')):
            if not r['student__campus']:
                continue
            total_p += r['passed']; total_f += r['failed']
            leaderboard.append({
                'campus_id': r['student__campus'],
                'campus': r['student__campus__campus_name'] or 'Unknown',
                'pass_rate': self._rate(r['passed'], r['failed']),
                'avg_percentage': round(r['avg_pct'] or 0, 1),
            })
        leaderboard.sort(key=lambda x: x['pass_rate'], reverse=True)
        for i, l in enumerate(leaderboard):
            l['rank'] = i + 1

        inter_kpis = {
            # Match the main dashboard's "Total Students": active, non-deleted,
            # actually assigned to a classroom, excluding Alumni. Without these
            # filters this over-counts unassigned/alumni students.
            'sponsored_lives': Student.objects.filter(
                is_active=True, is_deleted=False, classroom__isnull=False,
            ).exclude(current_grade__iexact='Alumni').count(),
            'avg_success_rate': self._rate(total_p, total_f),
            'sponsored_campuses': Campus.objects.count(),
        }

        # ── Aggregate academic charts for the donor: age bands + enrolment trend.
        # Computed here, server-side, as counts only — the raw student rows never
        # reach a donor's browser, so this stays inside the anonymised design.
        from datetime import date as _date
        AGE_BANDS = [(0, 5, '≤5'), (6, 8, '6–8'), (9, 11, '9–11'),
                     (12, 14, '12–14'), (15, 17, '15–17'), (18, 200, '18+')]
        age_counts = {label: 0 for *_bounds, label in AGE_BANDS}
        today = _date.today()
        for (dob,) in Student.objects.filter(
            is_active=True, is_deleted=False,
        ).values_list('dob'):
            if not dob:
                continue
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            for low, high, label in AGE_BANDS:
                if low <= age <= high:
                    age_counts[label] += 1
                    break

        age_distribution = [
            {'ageGroup': label, 'count': age_counts[label]}
            for *_b, label in AGE_BANDS if age_counts[label] > 0
        ]

        # ── Network grade-level progression (pass % per level band, per campus) ──
        prog_map, levels_found = {}, set()
        for r in net_base.values(
                'student__campus__campus_name',
                'student__classroom__grade__level__name').annotate(
                passed=Count('id', filter=Q(pass_status='pass')),
                failed=Count('id', filter=Q(pass_status='fail'))):
            lvl = r['student__classroom__grade__level__name']
            if not lvl:
                continue
            camp = r['student__campus__campus_name'] or 'Unknown'
            prog_map.setdefault(camp, {})[lvl] = self._rate(r['passed'], r['failed'])
            levels_found.add(lvl)
        ordered_levels = sorted(levels_found, key=self._level_key)
        grade_progression = []
        for lvl in ordered_levels:
            row = {'level': lvl}
            for camp, rates in prog_map.items():
                row[camp] = rates.get(lvl)
            grade_progression.append(row)

        # Months from campus academic-year config; fall back to months present in data.
        months = self._campus_months(Campus.objects.all())
        if not months:
            present = set(Result.objects.filter(
                exam_type='monthly', academic_year=academic_year).values_list('month', flat=True))
            months = [m for m in self.MONTH_ORDER if m in present]

        payload = {
            'filters': {
                'academic_year': academic_year, 'exam_type': exam_type,
                'available_years': years,
                'available_exam_types': ['monthly', 'midterm', 'final'],
                'campuses': [{'id': c.id, 'name': c.campus_name}
                             for c in Campus.objects.all().order_by('campus_name')],
                'months': months,
            },
            'inter': {
                'kpis': inter_kpis,
                'leaderboard': leaderboard,
                'grade_progression': grade_progression,
                'progression_campuses': list(prog_map.keys()),
                'year_comparison': self._campus_year_comparison(exam_type, academic_year, month),
                'age_distribution': age_distribution,
            },
        }

        # ── INTRA: one sponsored campus drill-down, OR campus='all' = every campus
        #    aggregated (the "All Campus" option in the school picker) ──
        if campus_id:
            all_campuses = str(campus_id).lower() == 'all'
            intra_base = net_base if all_campuses else net_base.filter(student__campus_id=campus_id)
            agg = intra_base.aggregate(
                passed=Count('id', filter=Q(pass_status='pass')),
                failed=Count('id', filter=Q(pass_status='fail')),
                avg_pct=Avg('percentage'))

            sm_base = SubjectMark.objects.filter(
                result__status='approved', result__is_deleted=False,
                result__exam_type=exam_type, result__academic_year=academic_year)
            if not all_campuses:
                sm_base = sm_base.filter(result__student__campus_id=campus_id)
            if exam_type == 'monthly' and month:
                sm_base = sm_base.filter(result__month=month)
            subject_performance = sorted([
                {'subject': r['subject_name'],
                 'pass_rate': round(r['passed'] / r['total'] * 100, 1) if r['total'] else 0}
                for r in sm_base.values('subject_name').annotate(
                    total=Count('id'), passed=Count('id', filter=Q(is_pass=True)))
                if not self._is_behaviour(r['subject_name'])
            ], key=lambda x: x['pass_rate'], reverse=True)

            grade_order = ['A+', 'A', 'B', 'C', 'D', 'E', 'F']
            gc = dict(intra_base.exclude(grade='Absent').values_list('grade').annotate(c=Count('id')))
            grade_distribution = [{'grade': g, 'count': gc.get(g, 0)} for g in grade_order]

            if all_campuses:
                campus_label = 'All Campuses'
                enrollment = Student.objects.filter(is_active=True, is_deleted=False).count()
            else:
                selected = next((c for c in payload['filters']['campuses'] if c['id'] == int(campus_id)), None)
                campus_label = selected['name'] if selected else None
                enrollment = Student.objects.filter(
                    campus_id=campus_id, is_active=True, is_deleted=False).count()
            payload['intra'] = {
                'campus': campus_label,
                'kpis': {
                    'branch_enrollment': enrollment,
                    'pass_rate': self._rate(agg['passed'], agg['failed']),
                    'avg_percentage': round(agg['avg_pct'] or 0, 1),
                },
                'subject_performance': subject_performance,
                'grade_distribution': grade_distribution,
            }

        return Response(payload)


# ─── Monthly Test per-month total-marks config ───────────────────────────────
class MonthlyMarkConfigView(APIView):
    """Per-month total marks for Monthly Test results (uniform across subjects).

    GET  ?classroom=&academic_year=  → { "December": 35, "April": 25, ... }
         (only months that have been configured; unlisted months use default 25)
    POST { classroom, academic_year, month, total_marks }  → upsert one month.
    """
    permission_classes = [IsAuthenticated, IsTeacher | IsCoordinatorOrAbove]

    def get(self, request):
        from .models import MonthlyMarkConfig
        classroom = request.query_params.get('classroom')
        academic_year = request.query_params.get('academic_year')
        if not classroom or not academic_year:
            return Response({'error': 'classroom and academic_year are required.'},
                            status=status.HTTP_400_BAD_REQUEST)
        rows = MonthlyMarkConfig.objects.filter(
            classroom_id=classroom, academic_year=academic_year)
        return Response({r.month: r.total_marks for r in rows})

    def post(self, request):
        from .models import MonthlyMarkConfig
        from classes.models import ClassRoom
        classroom = request.data.get('classroom')
        academic_year = request.data.get('academic_year')
        month = request.data.get('month')
        raw_total = request.data.get('total_marks')

        if not classroom or not academic_year or not month or raw_total in (None, ''):
            return Response({'error': 'classroom, academic_year, month and total_marks are required.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            total = float(raw_total)
        except (ValueError, TypeError):
            return Response({'error': 'total_marks must be a number.'}, status=status.HTTP_400_BAD_REQUEST)
        if total <= 0:
            return Response({'error': 'total_marks must be greater than 0.'}, status=status.HTTP_400_BAD_REQUEST)

        cr = get_object_or_404(ClassRoom, id=classroom)
        org = getattr(cr, 'organization', None) or getattr(request.user, 'organization', None)
        obj, created = MonthlyMarkConfig.objects.update_or_create(
            classroom_id=classroom, academic_year=academic_year, month=month,
            defaults={'total_marks': total, 'organization': org},
        )
        return Response({'month': obj.month, 'total_marks': obj.total_marks, 'created': created})


class RegionalVarianceView(APIView):
    """Regional Score Variance — the school's own subject averages vs external
    regional benchmarks (RegionalBenchmark), per subject.

    GET ?academic_year=&exam_type=&campus_id=&grade=
      - No campus_id  → whole org (Org Admin / Donor).
      - campus_id     → that campus (Principal auto-scoped to their own campus).
      - grade         → narrow to one grade.
    Returns only subjects that exist on BOTH sides (a variance needs both).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from result.services.regional_variance import subject_variance

        academic_year = request.query_params.get('academic_year')
        exam_type = request.query_params.get('exam_type') or None
        campus_id = request.query_params.get('campus_id')
        grade = request.query_params.get('grade') or None

        if not academic_year:
            years = sorted(set(Result.objects.values_list('academic_year', flat=True)), reverse=True)
            academic_year = years[0] if years else None
        if not academic_year:
            return Response({'has_data': False, 'subjects': [], 'matched_subjects': 0,
                             'avg_variance': 0, 'academic_year': None})

        # Principal without an explicit campus is scoped to their own campus.
        if not campus_id and request.user.is_principal():
            campus = getattr(request.user, 'campus', None)
            if not campus:
                try:
                    from principals.models import Principal
                    campus = Principal.objects.get(employee_code=request.user.username).campus
                except Exception:
                    campus = None
            if campus:
                campus_id = campus.id

        org_id = getattr(request.user, 'organization_id', None)
        cid = int(campus_id) if campus_id else None
        data = subject_variance(
            organization_id=org_id,
            academic_year=academic_year,
            exam_type=exam_type,
            campus_id=cid,
            grade=grade,
        )
        data['campus_id'] = cid
        # Dynamic label for the "own" side of the comparison: a specific campus
        # when scoped to one, else the whole org (all campuses aggregated).
        scope_label = "All Campuses"
        if cid:
            try:
                from campus.models import Campus
                c = Campus.objects.filter(id=cid).first()
                scope_label = (c.campus_name if c and c.campus_name else f"Campus {cid}")
            except Exception:
                scope_label = f"Campus {cid}"
        data['scope_label'] = scope_label
        return Response(data)
