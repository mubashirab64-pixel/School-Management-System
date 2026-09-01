from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q

from .models import SchoolSettings, RetestSchedule, RetestResult
from .serializers import SchoolSettingsSerializer, RetestScheduleSerializer, RetestResultSerializer
from users.permissions import IsTeacher, IsCoordinator, IsPrincipal
from teachers.models import Teacher
from coordinator.models import Coordinator
from principals.models import Principal
from students.models import Student
from result.models import Result
from notifications.services import create_notification


# ─── helpers ──────────────────────────────────────────────────────────────────

def _notify_student_and_parent(student, actor, verb, text, data=None):
    if student.user:
        create_notification(recipient=student.user, actor=actor, verb=verb,
                            target_text=text, data=data or {})
    try:
        parent = getattr(student, 'parent', None) or getattr(student, 'guardian', None)
        if parent:
            parent_user = getattr(parent, 'user', None)
            if parent_user:
                create_notification(recipient=parent_user, actor=actor, verb=verb,
                                    target_text=text, data=data or {})
    except Exception:
        pass


def _get_teacher(request):
    return get_object_or_404(Teacher, user=request.user)


def _get_coordinator(request):
    return get_object_or_404(Coordinator, email=request.user.email)


def _get_principal(request):
    from django.db.models import Q
    principal = Principal.objects.filter(
        Q(user=request.user) | 
        Q(email=request.user.email) | 
        Q(employee_code=request.user.username)
    ).first()
    if not principal:
        from django.http import Http404
        raise Http404("No Principal matches the given query.")
    return principal


# ─── School Settings ──────────────────────────────────────────────────────────

class SchoolSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        campus_id = request.query_params.get('campus_id')
        if campus_id:
            settings_obj = SchoolSettings.objects.filter(campus_id=campus_id).first()
        else:
            settings_obj = None
        if not settings_obj:
            return Response({'retest_policy': 'open'})
        return Response(SchoolSettingsSerializer(settings_obj).data)

    def post(self, request):
        campus_id = request.data.get('campus_id')
        if not campus_id:
            return Response({'error': 'campus_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        settings_obj, _ = SchoolSettings.objects.get_or_create(campus_id=campus_id)
        serializer = SchoolSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ─── Schedule Create ──────────────────────────────────────────────────────────

class RetestScheduleCreateView(APIView):
    """POST /api/retest/schedule/create"""
    permission_classes = [IsAuthenticated, IsTeacher]

    def post(self, request):
        teacher = _get_teacher(request)

        original_result_id = request.data.get('original_result_id')
        if not original_result_id:
            return Response({'error': 'original_result_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        original_result = get_object_or_404(Result, id=original_result_id)

        # Check retest policy
        campus = (
            original_result.student.campus
            or (original_result.student.classroom.grade.level.campus
                if original_result.student.classroom and
                original_result.student.classroom.grade and
                original_result.student.classroom.grade.level
                else None)
        )
        if campus:
            settings_obj = SchoolSettings.objects.filter(campus=campus).first()
            if settings_obj and settings_obj.retest_policy == 'blocked':
                return Response(
                    {'error': 'Re-tests are currently blocked for this campus.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        subject_name = request.data.get('subject_name', '').strip()
        if not subject_name:
            return Response({'error': 'subject_name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate: original result pass_status must be fail or absent
        original_sm = original_result.subject_marks.filter(subject_name=subject_name).first()
        if original_result.pass_status not in ['fail', 'absent']:
            if original_sm and original_sm.is_pass:
                return Response(
                    {'error': f'Student already passed {subject_name}. No re-test needed.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        reason = request.data.get('reason', 'fail')
        if original_result.pass_status == 'absent' or (original_sm and original_sm.obtained_marks == 0):
            reason = 'absent'

        # No duplicate schedule
        if RetestSchedule.objects.filter(
            original_result=original_result,
            subject_name=subject_name,
            status='scheduled'
        ).exists():
            return Response(
                {'error': 'A re-test is already scheduled for this student/subject/exam.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        schedule = RetestSchedule.objects.create(
            organization=request.user.organization,
            exam_type=original_result.exam_type,
            month=original_result.month,
            academic_year=original_result.academic_year,
            classroom=original_result.student.classroom,
            subject_name=subject_name,
            original_result=original_result,
            scheduled_date=request.data.get('scheduled_date'),
            scheduled_time=request.data.get('scheduled_time'),
            venue=request.data.get('venue', ''),
            reason=reason,
            created_by=teacher,
            status='scheduled',
        )

        # Create RetestResult placeholder for student
        RetestResult.objects.get_or_create(
            retest_schedule=schedule,
            student=original_result.student,
            subject_name=subject_name,
            defaults={
                'organization': request.user.organization,
                'original_result': original_result,
                'exam_type': original_result.exam_type,
                'month': original_result.month,
                'academic_year': original_result.academic_year,
                'total_marks': original_sm.get_total_marks() if original_sm else 100,
                'created_by': teacher,
                'status': 'marks_pending',
            }
        )

        # Notify student + parent
        _notify_student_and_parent(
            original_result.student, request.user, 'retest_scheduled',
            f"Re-test scheduled for {subject_name} on {schedule.scheduled_date}.",
            {'schedule_id': schedule.id}
        )

        return Response(RetestScheduleSerializer(schedule).data, status=status.HTTP_201_CREATED)


# ─── Schedule List ────────────────────────────────────────────────────────────

class RetestScheduleListView(APIView):
    """GET /api/retest/schedule/list"""
    permission_classes = [IsAuthenticated, IsTeacher]

    def get(self, request):
        teacher = _get_teacher(request)
        qs = RetestSchedule.objects.filter(created_by=teacher)

        exam_type = request.query_params.get('exam_type')
        subject = request.query_params.get('subject_name')
        classroom = request.query_params.get('classroom_id')
        sch_status = request.query_params.get('status')

        if exam_type:
            qs = qs.filter(exam_type=exam_type)
        if subject:
            qs = qs.filter(subject_name__icontains=subject)
        if classroom:
            qs = qs.filter(classroom_id=classroom)
        if sch_status:
            qs = qs.filter(status=sch_status)

        return Response(RetestScheduleSerializer(qs, many=True).data)


# ─── Schedule Update ──────────────────────────────────────────────────────────

class RetestScheduleUpdateView(APIView):
    """PUT /api/retest/schedule/update/{id}"""
    permission_classes = [IsAuthenticated, IsTeacher]

    def put(self, request, pk):
        teacher = _get_teacher(request)
        schedule = get_object_or_404(RetestSchedule, id=pk, created_by=teacher)

        if schedule.status != 'scheduled':
            return Response(
                {'error': 'Can only update a schedule that is still in scheduled status.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        for field in ['scheduled_date', 'scheduled_time', 'venue']:
            val = request.data.get(field)
            if val is not None:
                setattr(schedule, field, val)
        schedule.save()

        return Response(RetestScheduleSerializer(schedule).data)


# ─── Result Enter ─────────────────────────────────────────────────────────────

class RetestResultEnterView(APIView):
    """POST /api/retest/result/enter"""
    permission_classes = [IsAuthenticated, IsTeacher]

    def post(self, request):
        teacher = _get_teacher(request)
        retest_result_id = request.data.get('retest_result_id')
        if not retest_result_id:
            return Response({'error': 'retest_result_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        retest_result = get_object_or_404(RetestResult, id=retest_result_id)
        if retest_result.created_by and retest_result.created_by != teacher:
            return Response({'error': 'You are not the teacher who created this retest.'}, status=status.HTTP_403_FORBIDDEN)

        is_absent = request.data.get('is_absent', False)
        marks_obtained = request.data.get('marks_obtained')

        retest_result.is_absent = is_absent
        if is_absent:
            retest_result.marks_obtained = 0
        elif marks_obtained is not None:
            marks_value = float(marks_obtained)
            total = retest_result.total_marks or 0
            if marks_value < 0 or (total and marks_value > total):
                return Response(
                    {'error': f'Marks must be between 0 and {total}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            retest_result.marks_obtained = marks_value

        retest_result.status = 'draft'
        retest_result.save()  # calculate_pass_status called in save()

        return Response(RetestResultSerializer(retest_result).data)


# ─── Result Submit ────────────────────────────────────────────────────────────

class RetestResultSubmitView(APIView):
    """POST /api/retest/result/submit/{id}"""
    permission_classes = [IsAuthenticated, IsTeacher]

    def post(self, request, pk):
        teacher = _get_teacher(request)
        retest_result = get_object_or_404(RetestResult, id=pk)

        if retest_result.created_by and retest_result.created_by != teacher:
            return Response({'error': 'Not your retest result.'}, status=status.HTTP_403_FORBIDDEN)

        if retest_result.status not in ['draft', 'marks_pending']:
            return Response(
                {'error': f'Cannot submit. Current status: {retest_result.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if retest_result.exam_type == 'monthly':
            retest_result.status = 'pending_coordinator'
            # Notify coordinator
            if teacher.assigned_coordinators.exists():
                from users.models import User as UserModel
                coord = teacher.assigned_coordinators.first()
                coord_user = UserModel.objects.filter(
                    Q(username=coord.employee_code) | Q(email=coord.email)
                ).first()
                if coord_user:
                    create_notification(
                        recipient=coord_user, actor=request.user,
                        verb='retest_result_submitted',
                        target_text=f"Retest result submitted for {retest_result.student}",
                        data={'retest_result_id': retest_result.id}
                    )
        else:
            retest_result.status = 'pending_principal'
            # Notify principal
            schedule = retest_result.retest_schedule
            campus = (
                retest_result.student.campus
                or (retest_result.student.classroom.grade.level.campus
                    if retest_result.student.classroom and
                    retest_result.student.classroom.grade and
                    retest_result.student.classroom.grade.level
                    else None)
            )
            if campus:
                for p in Principal.objects.filter(campus=campus):
                    if p.user:
                        create_notification(
                            recipient=p.user, actor=request.user,
                            verb='retest_result_submitted',
                            target_text=f"Retest result submitted for {retest_result.student}",
                            data={'retest_result_id': retest_result.id}
                        )

        retest_result.save()
        return Response(RetestResultSerializer(retest_result).data)


# ─── Coordinator Approve / Reject (Monthly retest only) ───────────────────────

class RetestCoordinatorApproveView(APIView):
    """POST /api/retest/coordinator/approve/{id}"""
    permission_classes = [IsAuthenticated, IsCoordinator]

    def post(self, request, pk):
        coordinator = _get_coordinator(request)
        retest_result = get_object_or_404(RetestResult, id=pk)

        if retest_result.exam_type != 'monthly':
            return Response(
                {'error': 'Coordinator can only approve monthly retest results.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if retest_result.status != 'pending_coordinator':
            return Response(
                {'error': f'Status must be pending_coordinator. Current: {retest_result.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        retest_result.status = 'approved'
        retest_result.coordinator_approved_by = coordinator
        retest_result.coordinator_approved_at = timezone.now()
        retest_result.save()

        # Mark schedule complete
        retest_result.retest_schedule.status = 'completed'
        retest_result.retest_schedule.save()

        # Recompute the original result so list/row/stats reflect the retest outcome
        _apply_retests_to_original_result(retest_result.original_result)

        student = retest_result.student
        msg = f"Your retest for {retest_result.subject_name} has been approved."
        _notify_student_and_parent(student, request.user, 'retest_approved', msg,
                                   {'retest_result_id': retest_result.id})

        return Response({'message': 'Retest result approved.', 'pass_status': retest_result.pass_status})


class RetestCoordinatorRejectView(APIView):
    """POST /api/retest/coordinator/reject/{id}"""
    permission_classes = [IsAuthenticated, IsCoordinator]

    def post(self, request, pk):
        coordinator = _get_coordinator(request)
        retest_result = get_object_or_404(RetestResult, id=pk)

        if retest_result.exam_type != 'monthly':
            return Response({'error': 'Coordinator can only reject monthly retest results.'}, status=status.HTTP_400_BAD_REQUEST)
        if retest_result.status != 'pending_coordinator':
            return Response({'error': f'Status must be pending_coordinator. Current: {retest_result.status}'}, status=status.HTTP_400_BAD_REQUEST)

        reject_reason = request.data.get('reject_reason', '').strip()
        if not reject_reason:
            return Response({'error': 'reject_reason is required.'}, status=status.HTTP_400_BAD_REQUEST)

        retest_result.status = 'draft'
        retest_result.reject_reason = reject_reason
        retest_result.save()

        # Notify teacher
        if retest_result.created_by and retest_result.created_by.user:
            create_notification(
                recipient=retest_result.created_by.user, actor=request.user,
                verb='retest_rejected',
                target_text=f"Retest result rejected: {reject_reason}",
                data={'retest_result_id': retest_result.id, 'reason': reject_reason}
            )

        return Response({'message': 'Retest result returned to draft.'})


# ─── Principal Approve / Reject (Mid/Final retest only) ───────────────────────

class RetestPrincipalApproveView(APIView):
    """POST /api/retest/principal/approve/{id}"""
    permission_classes = [IsAuthenticated, IsPrincipal]

    def post(self, request, pk):
        principal = _get_principal(request)
        retest_result = get_object_or_404(RetestResult, id=pk)

        if retest_result.exam_type not in ['midterm', 'final']:
            return Response({'error': 'Principal can only approve mid/final retest results.'}, status=status.HTTP_400_BAD_REQUEST)
        if retest_result.status != 'pending_principal':
            return Response({'error': f'Status must be pending_principal. Current: {retest_result.status}'}, status=status.HTTP_400_BAD_REQUEST)

        retest_result.status = 'approved'
        retest_result.principal_approved_by = principal
        retest_result.principal_approved_at = timezone.now()
        retest_result.save()

        retest_result.retest_schedule.status = 'completed'
        retest_result.retest_schedule.save()

        # Recompute the original result so list/row/stats reflect the retest outcome
        _apply_retests_to_original_result(retest_result.original_result)

        student = retest_result.student
        msg = f"Your {retest_result.exam_type} retest for {retest_result.subject_name} has been approved."
        _notify_student_and_parent(student, request.user, 'retest_approved', msg,
                                   {'retest_result_id': retest_result.id})

        # If final term retest → re-check auto promotion
        if retest_result.exam_type == 'final':
            _recheck_promotion_after_retest(retest_result, request.user)

        return Response({'message': 'Retest result approved.', 'pass_status': retest_result.pass_status})


class RetestPrincipalRejectView(APIView):
    """POST /api/retest/principal/reject/{id}"""
    permission_classes = [IsAuthenticated, IsPrincipal]

    def post(self, request, pk):
        principal = _get_principal(request)
        retest_result = get_object_or_404(RetestResult, id=pk)

        if retest_result.exam_type not in ['midterm', 'final']:
            return Response({'error': 'Principal can only reject mid/final retest results.'}, status=status.HTTP_400_BAD_REQUEST)
        if retest_result.status != 'pending_principal':
            return Response({'error': f'Status must be pending_principal. Current: {retest_result.status}'}, status=status.HTTP_400_BAD_REQUEST)

        reject_reason = request.data.get('reject_reason', '').strip()
        if not reject_reason:
            return Response({'error': 'reject_reason is required.'}, status=status.HTTP_400_BAD_REQUEST)

        retest_result.status = 'draft'
        retest_result.reject_reason = reject_reason
        retest_result.save()

        if retest_result.created_by and retest_result.created_by.user:
            create_notification(
                recipient=retest_result.created_by.user, actor=request.user,
                verb='retest_rejected',
                target_text=f"Retest result rejected: {reject_reason}",
                data={'retest_result_id': retest_result.id, 'reason': reject_reason}
            )

        return Response({'message': 'Retest result returned to draft.'})


# ─── Student retest view ──────────────────────────────────────────────────────

class StudentMyRetestsView(APIView):
    """GET /api/retest/student/my-retests/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        student = None
        if hasattr(user, 'student_profile') and user.student_profile:
            student = user.student_profile
        else:
            student = Student.objects.filter(user=user).first()

        if not student:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        retest_results = RetestResult.objects.filter(student=student).select_related('retest_schedule')

        data = []
        for rr in retest_results:
            schedule = rr.retest_schedule
            data.append({
                'subject': rr.subject_name,
                'exam_type': rr.exam_type,
                'month': rr.month,
                'academic_year': rr.academic_year,
                'scheduled_date': schedule.scheduled_date,
                'scheduled_time': schedule.scheduled_time,
                'venue': schedule.venue,
                'marks_obtained': rr.marks_obtained,
                'total_marks': rr.total_marks,
                'is_absent': rr.is_absent,
                'pass_status': rr.pass_status,
                'status': rr.status,
            })

        return Response(data)


# ─── Teacher: list retests with full details ─────────────────────────────────

class TeacherRetestListView(APIView):
    """GET /api/retest/teacher/list/"""
    permission_classes = [IsAuthenticated, IsTeacher]

    def get(self, request):
        teacher = _get_teacher(request)
        schedules = RetestSchedule.objects.filter(created_by=teacher).select_related(
            'original_result', 'classroom'
        ).prefetch_related('retest_results__student')

        exam_type = request.query_params.get('exam_type')
        status_filter = request.query_params.get('status')
        if exam_type:
            schedules = schedules.filter(exam_type=exam_type)
        if status_filter:
            schedules = schedules.filter(status=status_filter)

        data = []
        for schedule in schedules:
            for rr in schedule.retest_results.all():
                data.append({
                    'schedule_id': schedule.id,
                    'retest_result_id': rr.id,
                    'student_id': rr.student.id,
                    'student_name': rr.student.name,
                    'student_code': rr.student.student_code,
                    'class_name': rr.student.classroom.grade.name if rr.student.classroom and rr.student.classroom.grade else '',
                    'subject_name': rr.subject_name,
                    'exam_type': rr.exam_type,
                    'month': rr.month,
                    'academic_year': rr.academic_year,
                    'reason': schedule.reason,
                    'scheduled_date': schedule.scheduled_date,
                    'scheduled_time': schedule.scheduled_time,
                    'venue': schedule.venue,
                    'schedule_status': schedule.status,
                    'marks_obtained': rr.marks_obtained,
                    'total_marks': rr.total_marks,
                    'is_absent': rr.is_absent,
                    'pass_status': rr.pass_status,
                    'result_status': rr.status,
                    'reject_reason': rr.reject_reason,
                })
        return Response(data)


# ─── Coordinator: list pending retest results ────────────────────────────────

class CoordinatorRetestListView(APIView):
    """GET /api/retest/coordinator/list/"""
    permission_classes = [IsAuthenticated, IsCoordinator]

    def get(self, request):
        coordinator = _get_coordinator(request)
        rr_qs = RetestResult.objects.filter(
            exam_type='monthly',
            status='pending_coordinator',
            retest_schedule__created_by__assigned_coordinators=coordinator
        ).select_related('student', 'retest_schedule', 'student__classroom__grade')

        data = []
        for rr in rr_qs:
            s = rr.retest_schedule
            data.append({
                'retest_result_id': rr.id,
                'schedule_id': s.id,
                'student_name': rr.student.name,
                'student_code': rr.student.student_code,
                'class_name': rr.student.classroom.grade.name if rr.student.classroom and rr.student.classroom.grade else '',
                'subject_name': rr.subject_name,
                'exam_type': rr.exam_type,
                'month': rr.month,
                'academic_year': rr.academic_year,
                'reason': s.reason,
                'scheduled_date': s.scheduled_date,
                'venue': s.venue,
                'marks_obtained': rr.marks_obtained,
                'total_marks': rr.total_marks,
                'is_absent': rr.is_absent,
                'pass_status': rr.pass_status,
                'status': rr.status,
            })
        return Response(data)


# ─── Principal: list pending retest results ──────────────────────────────────

class PrincipalRetestListView(APIView):
    """GET /api/retest/principal/list/"""
    permission_classes = [IsAuthenticated, IsPrincipal]

    def get(self, request):
        principal = _get_principal(request)
        rr_qs = RetestResult.objects.filter(
            exam_type__in=['midterm', 'final'],
            status='pending_principal',
            student__campus=principal.campus
        ).select_related('student', 'retest_schedule', 'student__classroom__grade')

        data = []
        for rr in rr_qs:
            s = rr.retest_schedule
            data.append({
                'retest_result_id': rr.id,
                'schedule_id': s.id,
                'student_name': rr.student.name,
                'student_code': rr.student.student_code,
                'class_name': rr.student.classroom.grade.name if rr.student.classroom and rr.student.classroom.grade else '',
                'subject_name': rr.subject_name,
                'exam_type': rr.exam_type,
                'month': rr.month,
                'academic_year': rr.academic_year,
                'reason': s.reason,
                'scheduled_date': s.scheduled_date,
                'venue': s.venue,
                'marks_obtained': rr.marks_obtained,
                'total_marks': rr.total_marks,
                'is_absent': rr.is_absent,
                'pass_status': rr.pass_status,
                'status': rr.status,
            })
        return Response(data)


# ─── Student approved retests (for report card overlay) ──────────────────────

class StudentApprovedRetestsView(APIView):
    """GET /api/retest/student/<student_id>/approved/
    Returns approved retest results for a student — usable by teachers/coordinators/principals.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        # Use _base_manager to bypass OrganizationManager tenant filtering
        # (viewer may be from same org but context var might not be set)
        rr_qs = RetestResult._base_manager.filter(
            student_id=student_id,
            status='approved'
        ).select_related('retest_schedule')

        data = []
        for rr in rr_qs:
            # Normalize month: capitalize first letter (e.g. "august" → "August")
            month_val = rr.month
            if month_val:
                month_val = month_val.strip().capitalize()
            data.append({
                'subject_name': rr.subject_name,
                'exam_type': rr.exam_type,
                'month': month_val,
                'academic_year': rr.academic_year,
                'marks_obtained': rr.marks_obtained,
                'total_marks': rr.total_marks,
                'is_absent': rr.is_absent,
                'pass_status': rr.pass_status,
                'original_result_id': rr.original_result_id,
            })
        return Response(data)


# ─── Cancel schedule ──────────────────────────────────────────────────────────

class RetestScheduleCancelView(APIView):
    """PATCH /api/retest/schedule/cancel/{id}/"""
    permission_classes = [IsAuthenticated, IsTeacher]

    def patch(self, request, pk):
        teacher = _get_teacher(request)
        schedule = get_object_or_404(RetestSchedule, id=pk, created_by=teacher)
        if schedule.status != 'scheduled':
            return Response({'error': 'Can only cancel a scheduled retest.'}, status=status.HTTP_400_BAD_REQUEST)
        schedule.status = 'cancelled'
        schedule.save()
        RetestResult.objects.filter(retest_schedule=schedule, status='marks_pending').update(status='marks_pending')
        return Response({'message': 'Retest schedule cancelled.'})


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _apply_retests_to_original_result(original_result):
    """Recompute an original Result's aggregate fields (total / obtained / percentage /
    grade / pass_status / result_status) by overlaying any APPROVED retest marks for
    its subjects.

    SubjectMark rows are intentionally left untouched so the report card can still
    show the original (failing) mark struck-through alongside the 'RT' retest mark.
    This keeps the list view, approval row, stats and report-card summary consistent
    with the retest outcome (e.g. fail -> pass) without losing the audit trail.
    """
    if not original_result:
        return

    behaviour_keywords = [
        'behaviour', 'behavior', 'response', 'observation', 'participation',
        'follow_rules', 'home_work', 'homework', 'personal_hygiene',
        'respect_others', 'follow rules', 'home work', 'personal hygiene', 'respect others'
    ]

    def is_behaviour(name):
        if not name:
            return False
        n = name.lower().replace(' ', '_')
        return any(kw in n for kw in behaviour_keywords)

    total_marks = 0
    obtained_marks = 0
    has_absent = False
    has_failed_attempt = False
    attempted_any = False

    for sm in original_result.subject_marks.all():
        if is_behaviour(sm.subject_name):
            continue

        retest = RetestResult.objects.filter(
            original_result=original_result,
            student=original_result.student,
            subject_name=sm.subject_name,
            status='approved',
        ).order_by('-created_at').first()

        if retest:
            sm_total = retest.total_marks or sm.get_total_marks()
            sm_obtained = 0 if retest.is_absent else (retest.marks_obtained or 0)
            sm_absent = retest.is_absent
            sm_pass = retest.pass_status == 'pass'
        else:
            sm_total = sm.get_total_marks()
            sm_obtained = sm.get_obtained_marks()
            sm_absent = sm.is_absent
            sm_pass = sm.is_pass

        total_marks += sm_total
        obtained_marks += sm_obtained
        if sm_absent:
            has_absent = True
        else:
            attempted_any = True
            if not sm_pass:
                has_failed_attempt = True

    percentage = (obtained_marks / total_marks * 100) if total_marks > 0 else 0
    # Monthly/Final: 40%, Mid Term: 33% — mirrors Result.calculate_totals()
    passing_threshold = 33 if original_result.exam_type == 'midterm' else 40

    if percentage >= 80:
        grade = 'A+'
    elif percentage >= 70:
        grade = 'A'
    elif percentage >= 60:
        grade = 'B'
    elif percentage >= 50:
        grade = 'C'
    elif percentage >= 40:
        grade = 'D'
    elif percentage >= passing_threshold:
        grade = 'E'
    else:
        grade = 'F'

    is_pass = attempted_any and not has_failed_attempt and not has_absent and percentage >= passing_threshold

    if has_absent and not has_failed_attempt and (not attempted_any or percentage >= passing_threshold):
        pass_status = result_status = 'absent'
        grade = 'Absent'
    elif has_failed_attempt or (attempted_any and percentage < passing_threshold) or (has_absent and has_failed_attempt):
        pass_status = result_status = 'fail'
        grade = 'F'
    elif is_pass:
        pass_status = result_status = 'pass'
    else:
        pass_status = result_status = 'fail'
        grade = 'F'

    original_result.total_marks = total_marks
    original_result.obtained_marks = obtained_marks
    original_result.percentage = percentage
    original_result.grade = grade
    original_result.pass_status = pass_status
    original_result.result_status = result_status
    original_result.save(update_fields=[
        'total_marks', 'obtained_marks', 'percentage', 'grade', 'result_status', 'pass_status'
    ])


def _recheck_promotion_after_retest(retest_result, actor):
    """
    After a final retest is approved, re-check if student now passes all subjects.
    Uses original result + approved retest results to determine overall pass.
    """
    student = retest_result.student
    original_result = retest_result.original_result
    if not original_result:
        return

    behaviour_keywords = [
        'behaviour', 'behavior', 'homework', 'hygiene',
        'observation', 'participation', 'follow_rules', 'respect'
    ]

    all_pass = True
    for sm in original_result.subject_marks.all():
        if any(kw in sm.subject_name.lower() for kw in behaviour_keywords):
            continue

        # Check if there's an approved retest that overrides
        approved_retest = RetestResult.objects.filter(
            original_result=original_result,
            student=student,
            subject_name=sm.subject_name,
            status='approved'
        ).order_by('-created_at').first()

        subject_pass = approved_retest.pass_status == 'pass' if approved_retest else sm.is_pass
        if not subject_pass:
            all_pass = False
            break

    if all_pass:
        # Re-test cleared all remaining subjects. Do NOT auto-promote — promotion
        # is a separate, deliberate step. The teacher re-submits the (now updated)
        # result through the normal approval flow, where promotion is decided.
        msg = f"{student.name} has passed the re-test. The result can now be re-submitted for approval."
        _notify_student_and_parent(student, actor, 'retest_passed', msg,
                                   {'retest_result_id': retest_result.id})
    else:
        msg = f"{student.name} did not clear the re-test. Some subjects are still not passed."
        _notify_student_and_parent(student, actor, 'retest_not_passed', msg,
                                   {'retest_result_id': retest_result.id})
        # Notify coordinator
        teacher = retest_result.created_by
        if teacher and teacher.assigned_coordinators.exists():
            from users.models import User as UserModel
            from django.db.models import Q
            coord = teacher.assigned_coordinators.first()
            coord_user = UserModel.objects.filter(
                Q(username=coord.employee_code) | Q(email=coord.email)
            ).first()
            if coord_user:
                create_notification(
                    recipient=coord_user, actor=actor,
                    verb='student_not_promoted',
                    target_text=msg,
                    data={'retest_result_id': retest_result.id}
                )
