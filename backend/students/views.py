# views.py
import os
import tempfile
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.views import APIView
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from users.permissions import IsSuperAdminOrPrincipal, IsTeacherOrAbove, IsCoordinatorOrAbove, HasDynamicPermission, IsNotDonorForWrites
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Q
from .models import Student
from .serializers import StudentSerializer
from .filters import StudentFilter
from teachers.models import Teacher

from rest_framework.decorators import api_view, permission_classes
from users.permissions import IsStudent


# Roles that may change a student's enrollment status directly (no approval).
# Everyone else reaching the change-status endpoint (i.e. teachers) files a
# request for a coordinator to approve.
DIRECT_STATUS_ROLES = {'coordinator', 'principal', 'admin', 'org_admin', 'superadmin'}
REVIEW_STATUS_ROLES = {'principal', 'admin', 'org_admin', 'superadmin'}  # can review even without a Coordinator profile


def _coordinator_users_for_student(student):
    """Users (coordinators) responsible for a student: same campus, managing the
    student's level (via assigned_levels M2M or the legacy level FK). If the
    student has no level (e.g. no classroom), all campus coordinators qualify."""
    from coordinator.models import Coordinator
    from users.models import User as UserModel

    campus = student.campus
    if not campus:
        return []
    level = student.level  # property: classroom.grade.level
    qs = Coordinator.objects.filter(campus=campus)
    if level:
        qs = qs.filter(Q(assigned_levels=level) | Q(level=level))
    users = []
    for c in qs.distinct():
        u = UserModel.objects.filter(Q(username=c.employee_code) | Q(email=c.email)).first()
        if u:
            users.append(u)
    return users


def _notify_coordinators_of_request(req, actor):
    """Notify the responsible coordinator(s) that a teacher filed a status-change request."""
    from notifications.services import create_notification
    student = req.student
    actor_name = (getattr(actor, 'get_full_name', lambda: '')() or getattr(actor, 'username', '') or 'A teacher')
    for u in _coordinator_users_for_student(student):
        create_notification(
            recipient=u, actor=actor, verb='enrollment_status_requested',
            target_text=f"{actor_name} requested to change {student.name}'s status to {req.get_requested_status_display()}",
            data={'enrollment_request_id': req.id, 'student_id': student.id},
        )

@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsStudent])
def student_upload_photo(request):
    """
    Student can upload/update their own profile photo.
    """
    from django.db.models.query import QuerySet
    try:
        student = (
            QuerySet(Student)
            .get(student_id=request.user.username, is_deleted=False)
        )
        photo = request.FILES.get('photo')
        if not photo:
            return Response({'error': 'No photo provided'}, status=status.HTTP_400_BAD_REQUEST)
        student.photo = photo
        student.save(update_fields=['photo'])
        photo_url = request.build_absolute_uri(student.photo.url) if student.photo else None
        return Response({'photo': photo_url})
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsStudent])
def student_my_profile(request):
    """
    Student can view their own profile.
    Uses raw QuerySet to bypass OrganizationManager filtering.
    """
    from django.db.models.query import QuerySet
    try:
        # Bypass OrganizationManager — student can only see their own record
        student = (
            QuerySet(Student)
            .select_related('campus', 'classroom', 'classroom__grade')
            .get(student_id=request.user.username, is_deleted=False)
        )
        serializer = StudentSerializer(student, context={'request': request})
        return Response(serializer.data)
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)


class StudentPagination(PageNumberPagination):
    """Custom pagination for students - default 25 per page"""
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 5000

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated, (IsTeacherOrAbove | IsStudent), IsNotDonorForWrites]
    pagination_class = StudentPagination
    
    # Filtering, search, and ordering
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = StudentFilter
    search_fields = ['name', 'student_code', 'gr_no', 'father_name', 'student_id']
    ordering_fields = ['name', 'created_at', 'enrollment_year', 'student_code']
    ordering = ['-created_at']  # Default ordering

    def list(self, request, *args, **kwargs):
        """List students with per-page computed metrics (attendance %, performance, fee status).

        Metrics are computed in bulk for the current page's student IDs only, so cost is a
        fixed handful of queries per page regardless of page size (no N+1).
        """
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        target = page if page is not None else list(queryset)
        student_ids = [s.id for s in target]

        context = self.get_serializer_context()
        context.update(self._compute_list_metrics(student_ids))

        serializer = self.get_serializer(target, many=True, context=context)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    def _compute_list_metrics(self, student_ids):
        """Bulk-compute attendance %, behaviour performance, and fee status for given students.

        Window: trailing 365 days (proxy for current academic year). Each source is wrapped
        defensively so a failure in one metric never breaks the student list.
        """
        result = {'attendance_stats': {}, 'performance_map': {}, 'fee_status_map': {}}
        if not student_ids:
            return result

        from datetime import timedelta
        from django.utils import timezone
        today = timezone.now().date()
        window_start = today - timedelta(days=365)

        # ── Attendance %: (present + late) / total over the window ──
        try:
            from attendance.models import StudentAttendance
            rows = (StudentAttendance.objects
                    .filter(student_id__in=student_ids, attendance__date__gte=window_start)
                    .values('student_id')
                    .annotate(total=Count('id'),
                              present=Count('id', filter=Q(status__in=['present', 'late']))))
            for r in rows:
                total = r['total'] or 0
                result['attendance_stats'][r['student_id']] = round((r['present'] / total) * 100) if total else None
        except Exception:
            pass

        # ── Performance from behaviour metrics (1-4 → 25/50/75/100), averaged ──
        try:
            from behaviour.models import StudentBehaviourRecord
            from .serializers import performance_label
            score_pct = {1: 25, 2: 50, 3: 75, 4: 100}
            keys = ['punctuality', 'obedience', 'classBehaviour', 'participation', 'homework', 'respect']
            agg = {}  # student_id -> [sum_percent, count_metrics]
            recs = (StudentBehaviourRecord.objects
                    .filter(student_id__in=student_ids, week_end__gte=window_start)
                    .values('student_id', 'metrics'))
            for r in recs:
                sid = r['student_id']
                m = r['metrics'] or {}
                s, c = agg.get(sid, (0, 0))
                for k in keys:
                    v = m.get(k)
                    try:
                        iv = int(v)
                    except (ValueError, TypeError):
                        continue
                    s += score_pct.get(iv, 0)
                    c += 1
                agg[sid] = (s, c)
            for sid, (s, c) in agg.items():
                if c:
                    result['performance_map'][sid] = performance_label(round(s / c))
        except Exception:
            pass

        # ── Fee status: zakat handled in serializer; here derive paid/pending/overdue ──
        try:
            from fees.models import StudentFee
            per = {}  # sid -> flags
            rows = (StudentFee.objects
                    .filter(student_id__in=student_ids)
                    .values('student_id', 'status', 'due_date'))
            for f in rows:
                sid = f['student_id']
                d = per.setdefault(sid, {'overdue': False, 'pending': False, 'paid': False})
                st = (f['status'] or '').lower()
                if st in ('unpaid', 'partial'):
                    if f['due_date'] and f['due_date'] < today:
                        d['overdue'] = True
                    else:
                        d['pending'] = True
                elif st == 'paid':
                    d['paid'] = True
            for sid, d in per.items():
                if d['overdue']:
                    result['fee_status_map'][sid] = 'overdue'
                elif d['pending']:
                    result['fee_status_map'][sid] = 'pending'
                elif d['paid']:
                    result['fee_status_map'][sid] = 'paid'
        except Exception:
            pass

        return result

    def get_queryset(self):
        """Override to handle role-based filtering for list views and stats actions"""
        queryset = (
            Student.objects.all().filter(is_deleted=False)
            .select_related('campus', 'classroom', 'classroom__grade', 'classroom__grade__level')
            # Prefetch the enrollment timeline so the serializer's
            # enrollment_events + gap properties don't fire a per-student query.
            .prefetch_related('enrollment_events', 'enrollment_events__created_by')
        )
        
        # For dashboard/stats actions, only count active enrolled students with a classroom
        # (excludes alumni and students without classroom assignments)
        if self.action in {
            'gender_stats', 'campus_stats', 'grade_distribution', 'enrollment_trend',
            'mother_tongue_distribution', 'religion_distribution', 'age_distribution',
            'total_students', 'new_admissions_stats', 'zakat_status', 'house_ownership',
        }:
            queryset = queryset.filter(is_active=True, classroom__isnull=False).exclude(current_grade__iexact='Alumni')

        # Default filtering for list action: Hide Alumni and Unassigned students
        # unless specifically requested via filters. This ensures the main list
        # only shows students currently enrolled and assigned to classes.
        if self.action == 'list' and self.request:
            query_params = self.request.query_params

            # Status filter (frontend sends current_state=active|inactive). Map it to
            # is_active so left/inactive students can actually be listed. Inactive
            # students have their classroom cleared, so don't require an assigned class.
            current_state = (query_params.get('current_state') or '').lower()
            if current_state == 'inactive':
                queryset = queryset.filter(is_active=False)
            elif current_state == 'active':
                queryset = queryset.filter(is_active=True)

            # Retention cohort over a window: cohort_start defines the cohort
            # (students enrolled AS OF that date); cohort_end (optional) is the
            # retention reference point — of that cohort, who is still enrolled as
            # of cohort_end (retained) vs left. Both are YYYY-MM-DD. Keeps left
            # students so the list shows retained vs left via the Status column.
            from datetime import datetime as _dt
            from .enrollment_kpis import get_status_as_of, academic_start_date, ACTIVE_STATUSES

            def _parse_date(v):
                try:
                    return _dt.strptime(v, '%Y-%m-%d').date() if v else None
                except (ValueError, TypeError):
                    return None

            start = _parse_date(query_params.get('cohort_start')) or _parse_date(query_params.get('cohort_date'))
            end = _parse_date(query_params.get('cohort_end'))
            outcome = (query_params.get('cohort_outcome') or '').lower()  # retained | left | all
            if not start and query_params.get('cohort_year'):
                start = academic_start_date(query_params.get('cohort_year'))

            if start:
                # Cohort = students who ENROLLED (joined) within the window years
                # [start.year .. end.year] — NOT everyone present at the start. So a
                # 2018-joiner does NOT show for a 2019→2020 window.
                queryset = queryset.filter(enrollment_year__gte=start.year)
                if end:
                    queryset = queryset.filter(enrollment_year__lte=end.year)

                # Outcome (retained/left) measured AS OF the end date (status history),
                # not current status — so each window gives its own correct split.
                if outcome in ('retained', 'left'):
                    def _active_at_end(s):
                        return (get_status_as_of(s, end) in ACTIVE_STATUSES) if end else bool(s.is_active)
                    want_active = (outcome == 'retained')
                    pool = [s for s in queryset.prefetch_related('enrollment_events')
                            if _active_at_end(s) == want_active]
                    queryset = queryset.filter(id__in=[s.id for s in pool])

            # If no explicit filters for special categories are provided, apply defaults
            has_special_filter = any(param in query_params for param in [
                'campus', 'classroom', 'classroom__isnull', 'current_grade', 'is_active',
                'current_state', 'cohort_year', 'cohort_date', 'cohort_start', 'cohort_end', 'cohort_outcome',
                'shift', 'section', 'level', 'search', 'is_new_admission'
            ])

            if not has_special_filter:
                # Default view: Only show active students with an assigned classroom
                queryset = queryset.filter(is_active=True, classroom__isnull=False).exclude(current_grade__iexact='Alumni')
            elif 'current_grade' in query_params and query_params.get('current_grade', '').lower() == 'alumni':
                # If they specifically asked for Alumni, show them (usually inactive)
                pass
            elif 'is_active' not in query_params and current_state != 'inactive' and not start:
                # Otherwise, if they didn't explicitly ask for inactive students, keep excluding Alumni
                queryset = queryset.exclude(current_grade__iexact='Alumni')
        
        if self.action in [
            'list',
            'retrieve',
            'update',
            'partial_update',
            'destroy',
            'gender_stats',
            'campus_stats',
            'grade_distribution',
            'enrollment_trend',
            'mother_tongue_distribution',
            'religion_distribution',
            'age_distribution',
            'total_students',
            'new_admissions_stats',
            'zakat_status',
            'house_ownership',
        ] and self.request:
            user = self.request.user
            
            if user.is_superadmin():
                return queryset
                
            if user.role == 'admin':
                # Partner Admin: Filter by organizations they created
                return queryset.filter(organization__created_by=user)

            if user.role == 'org_admin':
                # Org Admin: Filter by organization
                if user.organization:
                    return queryset.filter(organization=user.organization)
                return queryset.none()

            if user.is_principal():
                campus = None
                if hasattr(user, 'campus') and user.campus:
                    campus = user.campus
                else:
                    # Fallback to Principal profile if User campus is missing
                    try:
                        from principals.models import Principal
                        principal_obj = Principal.objects.get(employee_code=user.username)
                        campus = principal_obj.campus
                    except Principal.DoesNotExist:
                        pass
                
                if campus:
                    queryset = queryset.filter(campus=campus)
                elif user.organization:
                    # If no specific campus is assigned, allow viewing all students in the organization
                    queryset = queryset.filter(organization=user.organization)
                else:
                    # If no campus and no organization, show nothing
                    queryset = queryset.none()
            elif user.is_teacher():
                try:
                    teacher_obj = Teacher.objects.get(employee_code=user.username)
                    
                    assigned_classrooms = []
                    
                    if teacher_obj.assigned_classroom:
                        assigned_classrooms.append(teacher_obj.assigned_classroom)
                    
                    # Add classrooms assigned via ForeignKey on ClassRoom
                    assigned_classrooms.extend(list(teacher_obj.classroom_set.all()))
                    
                    # Add multiple classroom assignments (ManyToMany)
                    assigned_classrooms.extend(list(teacher_obj.assigned_classrooms.all()))
                    
                    # Remove duplicates and None values
                    assigned_classrooms = list(set([c for c in assigned_classrooms if c]))
                    
                    if assigned_classrooms:
                        # Match by current classroom, former classroom, or if 
                        # the teacher has any result assigned for this student.
                        queryset = queryset.filter(
                            Q(classroom__in=assigned_classrooms)
                            | Q(last_classroom__in=assigned_classrooms)
                            | Q(results__teacher=teacher_obj)
                        ).distinct()
                    else:
                        # If no classroom assigned, show no students
                        queryset = queryset.none()
                except Teacher.DoesNotExist:
                    # If teacher object doesn't exist, show no students
                    queryset = queryset.none()
            elif user.is_coordinator():
                # Coordinator: Show students from classrooms under their assigned level
                from coordinator.models import Coordinator
                try:
                    coordinator_obj = Coordinator.get_for_user(user)
                    if not coordinator_obj:
                        queryset = queryset.none()
                    else:
                        # Determine which levels this coordinator manages (single level or multiple assigned_levels)
                        managed_levels = []
                        if coordinator_obj.assigned_levels.exists():
                            managed_levels = list(coordinator_obj.assigned_levels.all())
                        if not managed_levels and coordinator_obj.level:
                            managed_levels = [coordinator_obj.level]

                        # If no managed levels, return empty queryset
                        if not managed_levels:
                            queryset = queryset.none()
                        else:
                            # Get all classrooms under these managed levels and the coordinator's campus
                            from classes.models import ClassRoom
                            coordinator_classrooms = list(ClassRoom.objects.filter(
                                grade__level__in=managed_levels,
                                grade__level__campus=coordinator_obj.campus
                            ).values_list('id', flat=True))

                            # Match by current classroom, former classroom, or
                            # if the coordinator has any result assigned for this student.
                            queryset = queryset.filter(
                                Q(classroom__in=coordinator_classrooms)
                                | Q(last_classroom__in=coordinator_classrooms)
                                | Q(results__coordinator=coordinator_obj)
                            ).distinct()
                except Exception:
                    # If coordinator resolution fails, return empty queryset
                    queryset = queryset.none()
            
            elif user.role in ('accounts_officer', 'admissions_counselor', 'compliance_officer'):
                # Campus-scoped office staff (Accountant / Receptionist / Auditor):
                # they only see students of the campus they are assigned to.
                campus = getattr(user, 'campus', None)
                if campus:
                    queryset = queryset.filter(campus=campus)
                elif user.organization:
                    # No specific campus assigned -> fall back to their organization.
                    queryset = queryset.filter(organization=user.organization)
                else:
                    queryset = queryset.none()

            elif user.role == 'student':
                # Student: Can only see their own record
                queryset = queryset.filter(student_id=user.username)

            # Shift filtering is now handled by StudentFilter class
            # No need for manual shift filtering here
        
        return queryset

    def get_object(self):
        """Override to handle individual student retrieval with proper permissions"""
        # For destroy action, we need to get the object even if it's soft deleted
        # So we use with_deleted() to bypass the manager's default filter
        if self.action == 'destroy':
            # Get object using with_deleted() to allow deleting already soft-deleted items if needed
            lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
            lookup_value = self.kwargs[lookup_url_kwarg]
            filter_kwargs = {self.lookup_field: lookup_value}
            obj = Student.objects.with_deleted().get(**filter_kwargs)
        else:
            # For other actions, use normal queryset (excludes deleted)
            obj = super().get_object()
        
        # Apply role-based access control for individual objects
        user = self.request.user
        
        if user.is_teacher():
            # Teacher: Check if student is in their assigned classrooms
            from teachers.models import Teacher
            try:
                teacher_obj = Teacher.objects.get(employee_code=user.username)
                
                # Get all assigned classrooms (both legacy single assignment and new multiple assignments)
                assigned_classrooms = []
                
                # Add legacy single classroom assignment
                if teacher_obj.assigned_classroom:
                    assigned_classrooms.append(teacher_obj.assigned_classroom)
                
                # Add classrooms assigned via ForeignKey on ClassRoom
                assigned_classrooms.extend(list(teacher_obj.classroom_set.all()))

                # Add multiple classroom assignments (ManyToMany)
                assigned_classrooms.extend(list(teacher_obj.assigned_classrooms.all()))
                
                # Remove duplicates and None values
                assigned_classrooms = list(set([c for c in assigned_classrooms if c]))
                
                # Allow if the teacher has authored any result for this student
                has_authored_result = obj.results.filter(teacher=teacher_obj).exists()

                # Allow the current classroom, or (for inactive/left students whose
                # classroom was cleared) their former classroom — so a teacher can
                # still act on a student they used to teach (e.g. request re-enroll).
                if (assigned_classrooms
                        and obj.classroom not in assigned_classrooms
                        and obj.last_classroom not in assigned_classrooms
                        and not has_authored_result):
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You don't have permission to view this student.")
                    
            except Teacher.DoesNotExist:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Teacher profile not found.")

        elif user.role == 'org_admin':
            # Org Admin: Check if student belongs to their organization
            if not user.organization or obj.organization != user.organization:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You don't have permission to view this student.")
                
        elif user.is_principal():
            # Principal: Check if student is from their campus or organization
            campus = getattr(user, 'campus', None)
            if campus:
                if obj.campus != campus:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You don't have permission to view this student.")
            elif user.organization:
                if obj.organization != user.organization:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You don't have permission to view this student.")
            else:
                # No campus and no organization
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You don't have permission to view this student.")
                
        elif user.is_coordinator():
            # Coordinator: Check if student is from their assigned level
            from coordinator.models import Coordinator
            try:
                coordinator_obj = Coordinator.get_for_user(user)
                if not coordinator_obj:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("Coordinator profile not found.")

                # Build managed levels similar to get_queryset
                managed_levels = []
                if coordinator_obj.assigned_levels.exists():
                    managed_levels = list(coordinator_obj.assigned_levels.all())
                if not managed_levels and coordinator_obj.level:
                    managed_levels = [coordinator_obj.level]

                # Check if the coordinator has any result assigned to them for this student
                has_assigned_result = obj.results.filter(coordinator=coordinator_obj).exists()

                # If student has a classroom, ensure its grade's level is among managed levels.
                # If they have an assigned result, they are allowed regardless of their current classroom.
                if obj.classroom and not has_assigned_result:
                    student_level = obj.classroom.grade.level
                    if not managed_levels or student_level not in managed_levels:
                        from rest_framework.exceptions import PermissionDenied
                        raise PermissionDenied("You don't have permission to view this student.")
                elif not obj.classroom and not has_assigned_result:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You don't have permission to view this student.")
            except PermissionDenied:
                raise
            except Exception:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Coordinator profile not found.")
        elif user.role in ('accounts_officer', 'admissions_counselor', 'compliance_officer'):
            # Campus-scoped office staff: can only view students of their campus.
            campus = getattr(user, 'campus', None)
            if campus:
                if obj.campus != campus:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You don't have permission to view this student.")
            elif user.organization:
                if obj.organization != user.organization:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You don't have permission to view this student.")
            else:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You don't have permission to view this student.")

        elif user.role == 'student':
            # Student: Can only view their own profile
            if obj.student_id != user.username:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You don't have permission to view this student.")

        return obj
    
    def perform_create(self, serializer):
        """Set actor and organization before creating student, with quota enforcement."""
        from rest_framework.exceptions import PermissionDenied

        user = self.request.user

        save_kwargs = {}
        if not user.is_superadmin() and user.organization:
            org = user.organization

            # ── Student Quota Enforcement ──────────────────────────────────
            current_count = Student.objects.filter(organization=org).count()
            if current_count >= org.max_students:
                raise PermissionDenied(
                    f"Student quota exceeded. Your plan allows a maximum of "
                    f"{org.max_students} student(s). You currently have {current_count}. "
                    f"Please upgrade your subscription to enroll more students."
                )
            # ──────────────────────────────────────────────────────────────

            save_kwargs['organization'] = org
        
        # Explicitly set is_draft to False for new admissions via form
        save_kwargs['is_draft'] = False

        instance = serializer.save(**save_kwargs)
        instance._actor = user
        instance.save()
        self._ensure_student_user_account(instance)
        try:
            from attendance.models import AuditLog
            AuditLog.objects.create(
                feature='student', action='create', entity_type='Student',
                entity_id=instance.id,
                organization=getattr(instance, 'organization', None),
                user=user,
                ip_address=self.request.META.get('REMOTE_ADDR'),
                changes={
                    'name': instance.name,
                    'student_id': instance.student_id,
                    'grade': instance.current_grade,
                    'section': instance.section,
                },
                reason=f'Student {instance.name} added by {user.get_full_name() or user.username}',
            )
        except Exception:
            pass

    def _ensure_student_user_account(self, student):
        """
        Auto-create a User account for the student if one does not exist yet.
        Username = student_id, default password = '12345'.
        Only runs when student_id is set (i.e., student is not a draft without an ID).
        """
        if not student.student_id:
            return
        
        from users.models import User
        
        # Determine the email to use: priority to student.email, fallback to placeholder
        actual_email = student.email if student.email else f"{student.student_id}@student.portal"
        
        user_obj = User.objects.filter(username=student.student_id).first()
        
        if user_obj:
            # If user exists, sync email if it changed or was placeholder and student now has one
            if student.email and user_obj.email != student.email:
                user_obj.email = student.email
                user_obj.save()
            return

        # Check if email is already taken by another user
        if User.objects.filter(email__iexact=actual_email).exists():
            # If the placeholder email is taken, we might have a collision, but for now we skip
            return
            
        try:
            u = User(
                username=student.student_id,
                email=actual_email,
                role='student',
                organization=student.organization,
                campus=student.campus,
                has_changed_default_password=False,
                is_verified=True,
            )
            u.set_password('12345')
            u.save()
            # Sync auto-generated email back to Student record so profile shows it
            if not student.email:
                student.__class__.objects.filter(pk=student.pk).update(email=actual_email)
                student.email = actual_email
            print(f"[STUDENT USER] Created user account for {student.student_id} with email {actual_email}")
        except Exception as e:
            print(f"[STUDENT USER] Could not create user account for {student.student_id}: {e}")

    def perform_update(self, serializer):
        """Set actor before updating student"""
        user = self.request.user
        instance = serializer.save()
        instance._actor = user
        instance.save()
        try:
            from attendance.models import AuditLog
            AuditLog.objects.create(
                feature='student', action='update', entity_type='Student',
                entity_id=instance.id,
                organization=getattr(instance, 'organization', None),
                user=user,
                ip_address=self.request.META.get('REMOTE_ADDR'),
                changes={
                    'name': instance.name,
                    'student_id': instance.student_id,
                    'grade': instance.current_grade,
                    'section': instance.section,
                },
                reason=f'Student {instance.name} updated by {user.get_full_name() or user.username}',
            )
        except Exception:
            pass
        self._ensure_student_user_account(instance)
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to ensure soft delete is used - NEVER calls default delete"""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"[DESTROY] destroy() method called for DELETE request")
        
        # Get the instance
        instance = self.get_object()
        student_id = instance.id
        student_name = instance.name
        
        logger.info(f"[DESTROY] Got student instance: ID={student_id}, Name={student_name}, is_deleted={instance.is_deleted}")
        
        # Check if already deleted
        if instance.is_deleted:
            logger.warning(f"[DESTROY] Student {student_id} is already soft deleted")
            from rest_framework.exceptions import NotFound
            raise NotFound("Student is already deleted.")
        
        # IMPORTANT: Call perform_destroy which does soft delete
        # DO NOT call super().destroy() as it would do hard delete
        logger.info(f"[DESTROY] Calling perform_destroy() for soft delete")
        self.perform_destroy(instance)
        
        # Verify the student still exists in database (soft deleted, not hard deleted)
        try:
            from .models import Student
            # Use with_deleted() to check if student exists (even if soft deleted)
            still_exists = Student.objects.with_deleted().filter(pk=student_id).exists()
            if not still_exists:
                logger.error(f"[DESTROY] CRITICAL: Student {student_id} was HARD DELETED! This should not happen!")
                raise Exception(f"CRITICAL ERROR: Student {student_id} was permanently deleted instead of soft deleted!")
            else:
                # Check if it's soft deleted
                student_check = Student.objects.with_deleted().get(pk=student_id)
                if student_check.is_deleted:
                    logger.info(f"[DESTROY] SUCCESS: Student {student_id} is soft deleted (is_deleted=True)")
                else:
                    logger.error(f"[DESTROY] ERROR: Student {student_id} exists but is_deleted is False!")
        except Student.DoesNotExist:
            logger.error(f"[DESTROY] CRITICAL: Student {student_id} does not exist in database - was HARD DELETED!")
            raise Exception(f"CRITICAL ERROR: Student {student_id} was permanently deleted!")
        
        logger.info(f"[DESTROY] destroy() completed successfully")
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    def perform_destroy(self, instance):
        """Soft delete student and create audit log"""
        # IMPORTANT: Do NOT call super().perform_destroy() as it would do hard delete
        # Store student info BEFORE soft delete (in case instance gets modified)
        student_id = instance.id
        student_name = instance.name
        student_campus = instance.campus
        
        # Get user name for audit log
        user = self.request.user
        user_name = user.get_full_name() if hasattr(user, 'get_full_name') else (user.username or 'Unknown')
        user_role = user.get_role_display() if hasattr(user, 'get_role_display') else (user.role or 'User')
        
        # Set actor for potential signal use (though soft_delete uses update() which bypasses signals)
        instance._actor = user
        
        # Log before soft delete
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[SOFT_DELETE] Starting soft delete for student ID: {student_id}, Name: {student_name}")
        logger.info(f"[SOFT_DELETE] Student is_deleted before: {instance.is_deleted}")
        
        # Soft delete the student (instead of hard delete)
        # This uses update() to directly modify database, does NOT call .delete()
        # This ensures no post_delete signal is triggered
        try:
            instance.soft_delete()
            logger.info(f"[SOFT_DELETE] soft_delete() method called successfully")
            
            # Verify soft delete worked
            instance.refresh_from_db()
            logger.info(f"[SOFT_DELETE] Student is_deleted after refresh: {instance.is_deleted}")
            
            if not instance.is_deleted:
                logger.error(f"[SOFT_DELETE] CRITICAL ERROR: Soft delete failed! Student {student_id} is_deleted is still False!")
                raise Exception(f"Soft delete failed for student {student_id} - is_deleted is still False after soft_delete() call")
            
            logger.info(f"[SOFT_DELETE] Soft delete successful for student {student_id}")
        except Exception as e:
            logger.error(f"[SOFT_DELETE] ERROR during soft_delete(): {str(e)}")
            raise
        
        # Create audit log after soft deletion
        try:
            from attendance.models import AuditLog
            AuditLog.objects.create(
                feature='student',
                action='delete',
                entity_type='Student',
                entity_id=student_id,
                user=user,
                ip_address=self.request.META.get('REMOTE_ADDR'),
                changes={'name': student_name, 'student_id': student_id, 'campus_id': student_campus.id if student_campus else None},
                reason=f'Student {student_name} deleted by {user_role} {user_name}'
            )
        except Exception as e:
            # Log error but don't fail the deletion
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create audit log for student deletion: {str(e)}")


    
    @action(detail=False, methods=["get"], url_path='enrollment_trend')
    def enrollment_trend(self, request):
        """
        Get enrollment trend by year (default) or by month (trend_mode=month&trend_year=YYYY).

        Year mode: groups by enrollment_year field (academic year).
        Month mode: groups by created_at month within the given calendar year.
        """
        from django.db.models import Count, Value
        from django.db.models.functions import Coalesce, ExtractMonth
        from django.utils import timezone

        queryset = self.filter_queryset(self.get_queryset())

        trend_mode = request.query_params.get('trend_mode', 'year')
        trend_year = request.query_params.get('trend_year')

        if trend_mode == 'month' and trend_year:
            try:
                year = int(trend_year)
            except (ValueError, TypeError):
                year = timezone.now().year

            month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

            trend_data = queryset.filter(
                created_at__year=year
            ).annotate(
                month_num=ExtractMonth('created_at')
            ).values('month_num').annotate(
                count=Count('id')
            ).order_by('month_num')

            month_counts = {item['month_num']: item['count'] for item in trend_data}

            # Show all 12 months regardless of current date
            data = [
                {"month": month_names[m - 1], "month_num": m, "count": month_counts.get(m, 0)}
                for m in range(1, 13)
            ]
            return Response(data)

        # Default: by academic enrollment_year; if NULL, fall back to created_at year
        from django.db.models.functions import ExtractYear
        trend_data = queryset.annotate(
            normalized_year=Coalesce('enrollment_year', ExtractYear('created_at'))
        ).values('normalized_year').annotate(
            count=Count('id')
        ).order_by('normalized_year')

        data = [
            {"year": str(item['normalized_year']), "count": item['count']}
            for item in trend_data
        ]

        if len(data) > 6:
            data = data[-6:]

        return Response(data)
    

    
    @action(detail=False, methods=['get'], url_path='total')
    def total_students(self, request):
        """Get total student count"""
        queryset = self.filter_queryset(self.get_queryset())
        total = queryset.count()
        return Response({'totalStudents': total})

    @action(detail=False, methods=['get'], url_path='new_admissions_stats')
    def new_admissions_stats(self, request):
        """
        New admissions analytics: counts by period, grade, section, level, gender, and daily trend.
        Query params:
          period = today | week | month | year  (default: month)
          campus = <id>  (optional, for superadmin/admin cross-campus filter)
        Role scoping is inherited from get_queryset / filter_queryset.
        """
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models.functions import TruncDay, TruncMonth

        period = request.query_params.get('period', 'month')
        now = timezone.now()

        if period == 'today':
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            trunc_fn = TruncDay
            date_label_fmt = '%b %d'
        elif period == 'week':
            start_date = now - timedelta(days=7)
            trunc_fn = TruncDay
            date_label_fmt = '%b %d'
        elif period == 'year':
            start_date = now - timedelta(days=365)
            trunc_fn = TruncMonth
            date_label_fmt = '%b %Y'
        elif period == 'all':
            start_date = None
            trunc_fn = TruncMonth
            date_label_fmt = '%b %Y'
        else:  # default: month
            start_date = now - timedelta(days=30)
            trunc_fn = TruncDay
            date_label_fmt = '%b %d'

        base_qs = self.filter_queryset(self.get_queryset())
        if start_date:
            new_qs = base_qs.filter(created_at__gte=start_date)
            # Previous period comparison
            prev_delta = now - start_date
            prev_qs = base_qs.filter(created_at__gte=start_date - prev_delta, created_at__lt=start_date)
            prev_count = prev_qs.count()
        else:
            new_qs = base_qs
            prev_count = 0

        total_new = new_qs.count()

        # By grade
        by_grade = [
            {'grade': row['current_grade'] or 'Unknown', 'count': row['count']}
            for row in new_qs.values('current_grade').annotate(count=Count('id')).order_by('-count')
        ]

        # By section
        by_section = [
            {'section': row['section'] or 'Unknown', 'count': row['count']}
            for row in new_qs.values('section').annotate(count=Count('id')).order_by('-count')
        ]

        # By level
        by_level = [
            {'level': row['classroom__grade__level__name'] or 'Unassigned', 'count': row['count']}
            for row in new_qs.values('classroom__grade__level__name').annotate(count=Count('id')).order_by('-count')
        ]

        # By gender
        gender_agg = new_qs.aggregate(
            male=Count('id', filter=Q(gender='male')),
            female=Count('id', filter=Q(gender='female')),
            unknown=Count('id', filter=Q(gender__isnull=True) | ~Q(gender__in=['male', 'female']))
        )

        # Daily/monthly trend
        trend_rows = (
            new_qs
            .annotate(bucket=trunc_fn('created_at'))
            .values('bucket')
            .annotate(count=Count('id'))
            .order_by('bucket')
        )
        trend = [
            {'date': row['bucket'].strftime(date_label_fmt) if row['bucket'] else 'Unknown', 'count': row['count']}
            for row in trend_rows
        ]

        return Response({
            'period': period,
            'total_new': total_new,
            'prev_period_count': prev_count,
            'by_grade': by_grade,
            'by_section': by_section,
            'by_level': by_level,
            'by_gender': gender_agg,
            'trend': trend,
        })
    
    @action(detail=False, methods=['post'], url_path='check_duplicate')
    def check_duplicate(self, request):
        """Check if CNIC or Email already exists for an active student within the organization."""
        cnic = request.data.get('student_cnic')
        email = request.data.get('email')
        
        user = request.user
        # For superadmin, they might check across all, or specify org. Assuming org scoping:
        org = getattr(user, 'organization', None)

        # Base queryset for active students
        queryset = Student.objects.filter(is_deleted=False)
        if org:
            queryset = queryset.filter(organization=org)

        response_data = {'cnic_exists': False, 'email_exists': False}

        if cnic:
            if queryset.filter(student_cnic=cnic).exists():
                response_data['cnic_exists'] = True
        
        if email:
            if queryset.filter(email__iexact=email).exists():
                response_data['email_exists'] = True

        return Response(response_data)
    
    @action(detail=False, methods=['get'], url_path='gender_stats')
    def gender_stats(self, request):
        """Get gender distribution stats"""
        queryset = self.filter_queryset(self.get_queryset())
        
        stats = queryset.aggregate(
            male=Count('id', filter=Q(gender='male')),
            female=Count('id', filter=Q(gender='female')),
            other=Count('id', filter=Q(gender__isnull=True) | Q(gender='other'))
        )
        
        return Response(stats)
    
    @action(detail=False, methods=['get'], url_path='campus_stats')
    def campus_stats(self, request):
        """Get campus-wise student distribution"""
        queryset = self.filter_queryset(self.get_queryset())
        
        campus_data = queryset.values('campus__campus_name').annotate(
            count=Count('id')
        ).order_by('-count')
        
        data = []
        for item in campus_data:
            campus_name = item['campus__campus_name'] or 'Unknown Campus'
            data.append({
                'campus': campus_name,
                'count': item['count']
            })
        
        return Response(data)
    
    @action(detail=False, methods=['get'], url_path='grade_distribution')
    def grade_distribution(self, request):
        """
        Get grade-wise student distribution with NORMALIZED grade labels.

        Problems we solve here:
        - Raw data can contain mixed formats like "Grade 1", "Grade I", "Grade-1",
          "KG-1", "KG-I", "KG1", etc.
        - Dashboard filters should show clean, canonical labels:
          "Nursery", "KG-I", "KG-II", "Grade 1" .. "Grade 10", "Special Class".

        We aggregate counts by a normalized label so that:
        - Filters look clean
        - Selecting "Grade 1" in the frontend still works (StudentFilter.current_grade
          already accepts both roman and numeric variations).
        """
        queryset = self.filter_queryset(self.get_queryset())

        grade_rows = queryset.values('current_grade').annotate(
            count=Count('id')
        ).order_by('current_grade')

        def normalize_grade_label(raw: str) -> str:
            if not raw:
                return "Unknown Grade"

            value = (raw or "").strip()
            lower = value.lower()

            # Direct mappings for pre-primary / special
            if 'nursery' in lower:
                return 'Nursery'
            if 'special' in lower:
                return 'Special Class'

            # Roman ↔ number helpers
            roman_to_num = {
                'i': '1', 'ii': '2', 'iii': '3', 'iv': '4', 'v': '5',
                'vi': '6', 'vii': '7', 'viii': '8', 'ix': '9', 'x': '10',
            }
            num_to_roman = {v: k.upper() for k, v in roman_to_num.items()}

            import re

            # KG grades
            if 'kg' in lower:
                match = re.search(r'kg[-_\s]?([ivx\d]+)', lower)
                if match:
                    token = match.group(1)
                    # token can be roman or number
                    if token in roman_to_num:
                        num = roman_to_num[token]
                    else:
                        num = token
                    # Canonical: KG-I, KG-II
                    if num in num_to_roman:
                        roman = num_to_roman[num]
                        return f"KG-{roman}"
                    return f"KG-{num}"
                return "KG-I"

            # Regular grades
            if 'grade' in lower:
                match = re.search(r'grade[-_\s]*([ivx\d]+)', lower)
                if match:
                    token = match.group(1)
                    if token in roman_to_num:
                        num = roman_to_num[token]
                    else:
                        num = token
                    # Canonical: Grade 1 .. Grade 10
                    return f"Grade {num}"
                # Fallback: just "Grade"
                return "Grade"

            # Fallback: keep original capitalization but trim
            return value

        # Aggregate counts per normalized label
        aggregated: dict[str, int] = {}
        for row in grade_rows:
            raw_grade = row['current_grade']
            count = row['count'] or 0
            label = normalize_grade_label(raw_grade)
            aggregated[label] = aggregated.get(label, 0) + count

        # Helper to sort grades logically
        def get_grade_order(label: str) -> int:
            s = label.lower()
            if 'nursery' in s: return 1
            if 'kg-i' in s or 'kg i' in s: return 2
            if 'kg-ii' in s or 'kg ii' in s: return 3
            if 'grade' in s:
                import re
                match = re.search(r'(\d+)', s)
                if match:
                    return 10 + int(match.group(1))
            if 'special' in s: return 50
            return 100

        # Build response sorted logically
        data = [
            {"grade": label, "count": count}
            for label, count in sorted(aggregated.items(), key=lambda x: get_grade_order(x[0]))
        ]

        return Response(data)
    
    
    @action(detail=True, methods=['get'], url_path='results')
    def get_student_results(self, request, pk=None):
        """Get all results for a specific student"""
        student = self.get_object()
        from result.models import Result
        
        results = Result.objects.filter(student=student).order_by('-created_at')
        results_data = []
        
        for result in results:
            result_data = {
                'id': result.id,
                'exam_type': result.exam_type,
                'academic_year': result.academic_year,
                'semester': result.semester,
                'status': result.status,
                'total_marks': result.total_marks,
                'obtained_marks': result.obtained_marks,
                'percentage': result.percentage,
                'grade': result.grade,
                'result_status': result.result_status,
                'created_at': result.created_at,
                'subject_marks': []
            }
            
            # Add subject marks
            for subject_mark in result.subject_marks.all():
                result_data['subject_marks'].append({
                    'subject_name': subject_mark.subject_name,
                    'total_marks': subject_mark.total_marks,
                    'obtained_marks': subject_mark.obtained_marks,
                    'has_practical': subject_mark.has_practical,
                    'practical_total': subject_mark.practical_total,
                    'practical_obtained': subject_mark.practical_obtained,
                    'is_pass': subject_mark.is_pass
                })
            
            results_data.append(result_data)
        
        return Response(results_data)
    
    @action(detail=True, methods=['post'], url_path='change-status')
    def change_enrollment_status(self, request, pk=None):
        """Change a student's enrollment status, or (for teachers) file a request
        for coordinator approval.

        Body: { "status": "left|re_enrolled|graduated|transferred",
                "event_date": "YYYY-MM-DD", "reason": "..." }
        - Coordinator / principal / admin: applied immediately (logs EnrollmentEvent).
        - Teacher: creates a pending EnrollmentStatusRequest for coordinator approval.
        created_by / requested_by come from the authenticated user, never the client.
        """
        from datetime import datetime
        from django.core.exceptions import ValidationError as DjangoValidationError
        from .models import (
            EnrollmentStatusRequest, ENROLLMENT_STATUS_CHOICES, ENROLLMENT_TRANSITIONS,
        )
        from .serializers import EnrollmentStatusRequestSerializer

        student = self.get_object()
        new_status = request.data.get('status')
        reason = (request.data.get('reason') or '').strip()
        reason_code = (request.data.get('reason_code') or '').strip() or None
        raw_date = request.data.get('event_date')

        if not new_status:
            return Response({'error': 'status is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not raw_date:
            return Response({'error': 'event_date is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            event_date = datetime.strptime(raw_date, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            return Response({'error': 'event_date must be YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

        role = getattr(request.user, 'role', None)

        # ── Coordinator / principal / admin: apply directly ──
        if role in DIRECT_STATUS_ROLES:
            try:
                student.change_status(new_status, event_date, reason=reason, reason_code=reason_code, user=request.user)
            except DjangoValidationError as e:
                detail = e.message_dict if hasattr(e, 'message_dict') else {'error': e.messages}
                return Response(detail, status=status.HTTP_400_BAD_REQUEST)
            return Response(self.get_serializer(student).data)

        # ── Teacher: file a request for coordinator approval ──
        if not reason:
            return Response({'error': 'A reason is required to request a status change.'}, status=status.HTTP_400_BAD_REQUEST)
        if new_status not in dict(ENROLLMENT_STATUS_CHOICES):
            return Response({'error': f'Invalid status: {new_status}'}, status=status.HTTP_400_BAD_REQUEST)
        if new_status == 'left' and not reason_code:
            return Response({'error': 'An exit reason (Dropout / Transferred Out / Other) is required for Left.'}, status=status.HTTP_400_BAD_REQUEST)
        # Validate the transition up-front so the teacher gets immediate feedback.
        if new_status not in ENROLLMENT_TRANSITIONS.get(student.enrollment_status, set()):
            return Response(
                {'error': f'Cannot change from "{student.enrollment_status}" to "{new_status}".'},
                status=status.HTTP_400_BAD_REQUEST)
        if EnrollmentStatusRequest.objects.filter(student=student, status='pending').exists():
            return Response(
                {'error': 'A status-change request is already pending for this student.'},
                status=status.HTTP_400_BAD_REQUEST)

        req = EnrollmentStatusRequest.objects.create(
            student=student, requested_status=new_status, event_date=event_date,
            reason=reason, reason_code=reason_code, requested_by=request.user, organization=student.organization,
        )
        _notify_coordinators_of_request(req, request.user)
        return Response(
            {'message': 'Request submitted for coordinator approval.',
             'request': EnrollmentStatusRequestSerializer(req).data},
            status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['get'], url_path='attendance')
    def get_student_attendance(self, request, pk=None):
        """Get all attendance records for a specific student"""
        student = self.get_object()
        from attendance.models import StudentAttendance
        
        attendance_records = StudentAttendance.objects.filter(
            student=student
        ).select_related('attendance').order_by('-attendance__date')
        
        attendance_data = []
        for record in attendance_records:
            attendance_data.append({
                'id': record.id,
                'status': record.status,
                'remarks': record.remarks,
                'date': record.attendance.date,
                'created_at': record.created_at,
                'attendance': {
                    'id': record.attendance.id,
                    'date': record.attendance.date,
                    'classroom': record.attendance.classroom.name if record.attendance.classroom else None
                }
            })
        
        return Response(attendance_data)
    
    @action(detail=False, methods=['get'], url_path='mother_tongue_distribution')
    def mother_tongue_distribution(self, request):
        """Get mother tongue distribution"""
        queryset = self.filter_queryset(self.get_queryset())
        
        tongue_data = queryset.values('mother_tongue').annotate(
            count=Count('id')
        ).order_by('-count')

        # Normalize first (strip + title), then merge duplicates that differ only in casing/whitespace
        merged: dict = {}
        for item in tongue_data:
            t_raw = item['mother_tongue']
            tongue = (t_raw or "").strip().title() or 'Unknown'
            merged[tongue] = merged.get(tongue, 0) + item['count']

        data = [{'name': k, 'value': v} for k, v in sorted(merged.items(), key=lambda x: -x[1])]
        return Response(data)
    
    @action(detail=False, methods=['get'], url_path='religion_distribution')
    def religion_distribution(self, request):
        """Get religion distribution"""
        queryset = self.filter_queryset(self.get_queryset())
        
        religion_data = queryset.values('religion').annotate(
            count=Count('id')
        ).order_by('-count')
        
        islam_variants = {
            'islam', 
            'brohi', 'pashto', 'pashhto', 'sindhi', 'saraiki', 
            'balochi', 'punjabi', 'urdu', 'kohistani', 'masood',
            '', 'none'
        }
        
        aggregated = {}
        
        for item in religion_data:
            r_raw = item['religion']
            count = item['count']
            
            # clean and lower case for comparison
            r_clean = (r_raw or "").strip().lower()
            
            # Determine canonical name
            if r_clean in islam_variants:
                canonical = 'Islam'
            elif r_clean in ['non muslim', 'non-muslim']:
                canonical = 'Non Muslim'
            elif r_clean == 'christianity':
                canonical = 'Christianity'
            elif r_clean == 'hinduism':
                canonical = 'Hinduism'
            else:
                # Default to title case for others
                canonical = (r_raw or "Unknown").strip().title()
            
            # Add to aggregation
            aggregated[canonical] = aggregated.get(canonical, 0) + count
            
        # Build final response list with < 10 logic
        final_data = []
        non_muslim_accumulated = aggregated.get('Non Muslim', 0)
        
        # Remove Non Muslim from dict to process it last
        if 'Non Muslim' in aggregated:
            del aggregated['Non Muslim']
            
        for name, count in aggregated.items():
            # Islam is always its own category
            if name == 'Islam':
                final_data.append({'name': name, 'value': count})
            # Check for small groups
            elif count < 10:
                non_muslim_accumulated += count
            else:
                final_data.append({'name': name, 'value': count})
                
        # Add Non Muslim category if it has any count
        if non_muslim_accumulated > 0:
            final_data.append({'name': 'Non Muslim', 'value': non_muslim_accumulated})
            
        return Response(final_data)
    
    @action(detail=False, methods=['get'], url_path='age_distribution')
    def age_distribution(self, request):
        """Get age distribution split by gender (Male/Female) for population pyramid"""
        queryset = self.filter_queryset(self.get_queryset())
        
        # Fetch data needed for calculation
        students_data = queryset.values('dob', 'current_grade', 'gender')
        
        age_counts = {}
        current_year = 2025
        
        import re
        
        # Helper to infer age from grade string
        def get_age_from_grade(grade_str):
            if not grade_str:
                return 0
            
            s = grade_str.lower().strip()
            
            # Direct text mappings
            if 'nursery' in s: return 4
            if 'prep' in s: return 5
            if 'hmz' in s: return 12  # Hifz usually older
            
            # KG check
            if 'kg' in s:
                if '2' in s or 'ii' in s: return 6
                return 5
                
            # Number extraction for classes 1-10
            # Matches "Grade 5", "Class 5", "5th", just "5", "V", etc.
            
            # Roman numerals simple check
            roman_map = {'x': 10, 'ix': 9, 'viii': 8, 'vii': 7, 'vi': 6, 'v': 5, 'iv': 4, 'iii': 3, 'ii': 2, 'i': 1}
            # explicit word check
            words = s.split()
            for w in words:
                # remove 'class' or 'grade' to find roman
                clean_w = w.replace('th','').replace('nd','').replace('rd','').replace('st','')
                if clean_w in roman_map:
                    return roman_map[clean_w] + 6 # Grade 1 = 7 years old
            
            # Digit extraction
            match = re.search(r'(\d+)', s)
            if match:
                grade_num = int(match.group(1))
                if 1 <= grade_num <= 12:
                    return grade_num + 6  # Grade 1 approx 7 years old
                    
            return 0

        for student in students_data:
            age = 0
            
            # 1. Try calculating from DOB
            if student['dob']:
                try:
                    birth_year = student['dob'].year
                    age = current_year - birth_year
                except:
                    age = 0
            
            # 2. If no valid age (missing or outlier), infer from Grade
            if age <= 2 or age > 25:
                # Try inferring
                inferred = get_age_from_grade(student['current_grade'])
                if inferred > 0:
                    age = inferred
            
            # 3. Aggregate if valid
            if age >= 3 and age <= 25:
                # Initialize age bucket if missing
                if age not in age_counts:
                    age_counts[age] = {'male': 0, 'female': 0}
                
                # Determine gender bucket
                g = (student.get('gender') or '').lower()
                if g == 'female':
                    age_counts[age]['female'] += 1
                else:
                   
                    if g == 'male':
                        age_counts[age]['male'] += 1
                    else:
                        if g in ['male', 'other', '']: 
                             age_counts[age]['male'] += 1

        # Format response
        data = [
            {'age': age, 'male': counts['male'], 'female': counts['female']}
            for age, counts in sorted(age_counts.items())
        ]
        
        return Response(data)
    
    @action(detail=True, methods=['post'], url_path='upload-photo')
    def upload_photo(self, request, pk=None):
        """Upload or replace a student's profile photo.

        Expects a multipart/form-data POST with a file field named 'photo'.
        Saves the file to the Student.photo ImageField and returns the photo URL.
        """
        from utils.image_upload import process_profile_photo, InvalidImageError
        student = self.get_object()
        try:
            photo_file = process_profile_photo(
                request.FILES.get('photo'), filename_stem=f"student_{student.id}"
            )
        except InvalidImageError as e:
            return Response({'detail': str(e)}, status=400)

        # Assign and save
        try:
            student.photo = photo_file
            student.save()
        except Exception as e:
            return Response({'detail': f'Error saving photo: {str(e)}'}, status=500)

        # Build absolute URL if possible
        try:
            photo_url = request.build_absolute_uri(student.photo.url) if student.photo else ''
        except Exception:
            photo_url = student.photo.url if student.photo else ''

        return Response({'photo_url': photo_url})

    @action(detail=True, methods=['delete'], url_path='delete-photo')
    def delete_photo(self, request, pk=None):
        """Delete a student's profile photo from storage and clear the field."""
        student = self.get_object()
        if not student.photo:
            return Response({'detail': 'No photo found to delete.'}, status=400)

        try:
            # remove file from storage
            student.photo.delete(save=False)
            # clear field and save
            student.photo = None
            student.save()
        except Exception as e:
            return Response({'detail': f'Error deleting photo: {str(e)}'}, status=500)

        return Response({'detail': 'Photo deleted'})

    @action(detail=False, methods=['post'], url_path='bulk_assign_classroom')
    def bulk_assign_classroom(self, request):
        """
        Bulk assign students to a classroom.
        Expects a POST request with:
        - student_ids (list): List of student IDs to update.
        - classroom_id (int): Target classroom ID.
        """
        student_ids = request.data.get('student_ids', [])
        classroom_id = request.data.get('classroom_id')
        
        if student_ids is None or (classroom_id is None and 'classroom_id' not in request.data):
            return Response({'error': 'Missing student_ids or classroom_id'}, status=status.HTTP_400_BAD_REQUEST)
        
        from classes.models import ClassRoom
        classroom = None
        if classroom_id and classroom_id != "none":
            try:
                classroom = ClassRoom.objects.get(id=classroom_id)
            except (ClassRoom.DoesNotExist, ValueError):
                return Response({'error': 'Classroom not found'}, status=status.HTTP_404_NOT_FOUND)
            
        from .models import ACTIVE_ENROLLMENT_STATUSES
        students = Student.objects.filter(id__in=student_ids)
        updated_count = 0
        for student in students:
            prev_classroom = student.classroom
            student.classroom = classroom
            if classroom is None:
                # "Remove Classroom (No Classroom)" = student is taken out of their
                # class → deactivate so they drop out of active counts / lists.
                # Preserve the former class so their teacher/coordinator can still
                # find them in the inactive view.
                if prev_classroom:
                    student.last_classroom = prev_classroom
                student.is_active = False
            elif student.enrollment_status in ACTIVE_ENROLLMENT_STATUSES:
                # Re-assigned to a class → reactivate (unless a terminal status
                # like left/graduated should keep them inactive).
                student.is_active = True
            student.save()
            updated_count += 1

            # Audit log
            try:
                from attendance.models import AuditLog
                org = getattr(request.user, 'organization', None)
                if classroom:
                    reason = (
                        f"[Class Assignment] {student.name}: "
                        f"{prev_classroom.grade.name + ' ' + prev_classroom.section if prev_classroom and prev_classroom.grade else 'No Class'} → "
                        f"{classroom.grade.name} - {classroom.section}"
                    )
                    to_info = {
                        'to_grade': classroom.grade.name if classroom.grade else None,
                        'to_section': classroom.section,
                        'to_classroom': f"{classroom.grade.name} - {classroom.section} ({classroom.shift})" if classroom.grade else None,
                    }
                    action = 'assign'
                else:
                    reason = (
                        f"[Without Classroom] {student.name} removed from "
                        f"{prev_classroom.grade.name + ' - ' + prev_classroom.section if prev_classroom and prev_classroom.grade else 'classroom'}"
                    )
                    to_info = {'to_classroom': 'Without Classroom', 'to_grade': None, 'to_section': None}
                    action = 'unassign'

                AuditLog.objects.create(
                    feature='transfer',
                    action=action,
                    entity_type='Student',
                    entity_id=student.id,
                    user=request.user,
                    ip_address=request.META.get('REMOTE_ADDR'),
                    organization=org,
                    changes={
                        'student_name': student.name,
                        'student_id': student.student_id,
                        'transfer_type': 'classroom_assignment' if classroom else 'without_classroom',
                        'from_grade': prev_classroom.grade.name if prev_classroom and prev_classroom.grade else None,
                        'from_section': prev_classroom.section if prev_classroom else None,
                        'from_classroom': (
                            f"{prev_classroom.grade.name} - {prev_classroom.section} ({prev_classroom.shift})"
                            if prev_classroom and prev_classroom.grade else None
                        ),
                        **to_info,
                    },
                    reason=reason,
                )
            except Exception:
                pass

        dest_name = f"{classroom.grade.name} - {classroom.section}" if classroom else "No Classroom"
        return Response({
            'message': f'Successfully moved {updated_count} students to {dest_name}'
        })

    @action(detail=False, methods=['post'], url_path='bulk_mark_alumni')
    def bulk_mark_alumni(self, request):
        """
        Bulk mark students as Alumni.
        Removes classroom assignment, sets current_grade to 'Alumni',
        and marks the student as inactive.
        Expects: student_ids (list)
        """
        student_ids = request.data.get('student_ids', [])
        if not student_ids:
            return Response({'error': 'Missing student_ids'}, status=status.HTTP_400_BAD_REQUEST)

        students = Student.objects.filter(id__in=student_ids)
        updated_count = 0
        for student in students:
            prev_classroom = student.classroom
            student.classroom = None
            student.current_grade = 'Alumni'
            student.section = None
            student.is_active = False
            student.save()
            updated_count += 1

            # Audit log
            try:
                from attendance.models import AuditLog
                org = getattr(request.user, 'organization', None)
                AuditLog.objects.create(
                    feature='transfer',
                    action='assign',
                    entity_type='Student',
                    entity_id=student.id,
                    user=request.user,
                    ip_address=request.META.get('REMOTE_ADDR'),
                    organization=org,
                    changes={
                        'student_name': student.name,
                        'student_id': student.student_id,
                        'transfer_type': 'alumni',
                        'from_grade': prev_classroom.grade.name if prev_classroom and prev_classroom.grade else None,
                        'from_section': prev_classroom.section if prev_classroom else None,
                        'from_classroom': (
                            f"{prev_classroom.grade.name} - {prev_classroom.section} ({prev_classroom.shift})"
                            if prev_classroom and prev_classroom.grade else None
                        ),
                        'to_grade': 'Alumni',
                        'to_section': None,
                        'to_classroom': 'Alumni',
                    },
                    reason=f"[Alumni] {student.name} moved to Alumni from "
                           f"{prev_classroom.grade.name + ' - ' + prev_classroom.section if prev_classroom and prev_classroom.grade else 'classroom'}",
                )
            except Exception:
                pass

        return Response({
            'message': f'Successfully marked {updated_count} student(s) as Alumni'
        })

    @action(detail=False, methods=['get'], url_path='zakat_status')
    def zakat_status(self, request):
        """Get zakat eligibility distribution"""
        queryset = self.filter_queryset(self.get_queryset())
        
        status_data = queryset.values('zakat_status').annotate(
            count=Count('id')
        ).order_by('-count')
        
        data = []
        for item in status_data:
            s_raw = item['zakat_status']
            status_label = (s_raw or "").replace('_', ' ').title() or 'Not Specified'
            data.append({
                'name': status_label,
                'value': item['count']
            })
        
        return Response(data)

    @action(detail=False, methods=['get'], url_path='house_ownership')
    def house_ownership(self, request):
        """Get house ownership distribution"""
        queryset = self.filter_queryset(self.get_queryset())
        
        # Note: Model field is house_owned ('yes'/'no')
        ownership_data = queryset.values('house_owned').annotate(
            count=Count('id')
        ).order_by('-count')
        
        data = []
        for item in ownership_data:
            o_raw = item['house_owned']
            label = 'Owned' if o_raw == 'yes' else 'Rented' if o_raw == 'no' else 'Not Specified'
            data.append({
                'name': label,
                'value': item['count']
            })
        
        return Response(data)

    @action(detail=False, methods=['get'], url_path='form_options')
    def form_options(self, request):
        """
        Returns hardcoded lists of choices for dropdowns in frontend forms.
        This provides a single source of truth for choices across the system.
        """
        from students.models import FormOption
        
        # Get active organization if multi-tenancy is active
        org = getattr(request.user, 'organization', None) if hasattr(request, 'user') else None
        
        qs = FormOption.objects.filter(is_active=True)
        if org:
            qs = qs.filter(organization=org)
        else:
            qs = qs.filter(organization__isnull=True)

        default_seeds = {
            'gender': [('male', 'Male'), ('female', 'Female')],
            'religion': [('islam', 'Islam'), ('hinduism', 'Hinduism'), ('christianity', 'Christianity'), ('other', 'Other')],
            'mother_tongue': [('brohi', 'Brohi'), ('urdu', 'Urdu'), ('sindhi', 'Sindhi'), ('balochi', 'Balochi'), ('saraiki', 'Saraiki'), ('punjabi', 'Punjabi'), ('pashhto', 'Pashhto'), ('kashmiri', 'Kashmiri'), ('bangali', 'Bangali'), ('other', 'Other')],
            'nationality': [('pakistani', 'Pakistani'), ('foreign', 'Foreign')],
            'blood_group': [('A+', 'A+'), ('A-', 'A-'), ('B+', 'B+'), ('B-', 'B-'), ('O+', 'O+'), ('O-', 'O-'), ('AB+', 'AB+'), ('AB-', 'AB-'), ('Unknown', 'Unknown')],
            'special_needs': [('none', 'None'), ('visual', 'Visual Impairment'), ('hearing', 'Hearing Impairment'), ('physical', 'Physical Disability'), ('learning', 'Learning Disability'), ('other', 'Other')],
            'emergency_relationship': [('father', 'Father'), ('mother', 'Mother'), ('guardian', 'Guardian'), ('relative', 'Other Relative')],
            'father_status': [('alive', 'Alive'), ('dead', 'Dead')],
            'mother_status': [('alive', 'Alive'), ('dead', 'Dead'), ('widowed', 'Widowed'), ('divorced', 'Divorced'), ('married', 'Married')],
            'marital_status': [('single', 'Single'), ('married', 'Married'), ('divorced', 'Divorced'), ('widowed', 'Widowed')],
            'shift': [('morning', 'Morning'), ('afternoon', 'Afternoon')],
            'section': [('A', 'A'), ('B', 'B'), ('C', 'C'), ('D', 'D'), ('E', 'E'), ('F', 'F')],
        }

        # Seed any missing categories individually so partial data never leaves gaps
        existing_categories = set(qs.values_list('category', flat=True))
        for cat, values in default_seeds.items():
            if cat not in existing_categories:
                for v, l in values:
                    FormOption.objects.get_or_create(
                        organization=org,
                        category=cat,
                        value=v,
                        defaults={'label': l, 'is_active': True}
                    )

        qs = FormOption.objects.filter(is_active=True)
        if org:
            qs = qs.filter(organization=org)
        else:
            qs = qs.filter(organization__isnull=True)

        options = {cat[0]: [] for cat in FormOption.OPTION_CATEGORIES}
        
        for opt in qs:
            options[opt.category].append({'value': opt.value, 'label': opt.label})
        return Response(options)


class StudentBulkUploadView(APIView):
    """Upload a CSV file to create multiple students at once."""
    permission_classes = [IsAuthenticated, IsSuperAdminOrPrincipal | HasDynamicPermission]
    required_permission = 'add_student'
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        from .services.student_csv_import import import_students_from_csv

        upload = request.FILES.get('file')
        if not upload:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.csv')
        try:
            for chunk in upload.chunks():
                tmp.write(chunk)
            tmp.flush()
            tmp.close()
            reports = import_students_from_csv(tmp.name, request.user)

            # Audit log — one summary entry for the entire bulk upload
            try:
                from attendance.models import AuditLog
                created_count = sum(1 for r in reports if r.get('status') == 'ok')
                failed_count = sum(1 for r in reports if r.get('status') == 'error')
                skipped_count = sum(1 for r in reports if r.get('status') == 'skipped')
                created_names = [r['name'] for r in reports if r.get('status') == 'ok']
                AuditLog.objects.create(
                    feature='student',
                    action='create',
                    entity_type='Bulk Upload',
                    entity_id=-1,
                    organization=getattr(request.user, 'organization', None),
                    user=request.user,
                    ip_address=request.META.get('REMOTE_ADDR'),
                    changes={
                        'bulk_upload': True,
                        'created': created_count,
                        'failed': failed_count,
                        'skipped': skipped_count,
                        'students': created_names[:50],
                    },
                    reason=f'Bulk upload: {created_count} students added, {failed_count} failed, {skipped_count} skipped by {request.user.get_full_name() or request.user.username}',
                )
            except Exception:
                pass

            return Response({'reports': reports}, status=status.HTTP_200_OK)
        finally:
            try:
                os.unlink(tmp.name)
            except Exception:
                pass


class StudentBulkUploadTemplateView(APIView):
    """Return a CSV template for bulk student upload."""
    permission_classes = [IsAuthenticated, IsSuperAdminOrPrincipal | HasDynamicPermission]
    required_permission = 'add_student'

    def get(self, request):
        from .services.student_csv_import import TEMPLATE_HEADERS, SAMPLE_ROW
        from django.http import HttpResponse

        # Build an Excel-friendly HTML table template
        html = ['<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"/></head><body>']
        html.append('<table border="1"><tr>')
        
        # Header Row
        for h in TEMPLATE_HEADERS:
            html.append(f'<th style="background-color: #f2f2f2; font-weight: bold;">{h}</th>')
        html.append('</tr>')

        # Sample Row for guidance
        html.append('<tr>')
        for h in TEMPLATE_HEADERS:
            val = SAMPLE_ROW.get(h, '')
            html.append(f'<td>{val}</td>')
        html.append('</tr>')

        # Empty row for user to start
        html.append('<tr>')
        for _ in TEMPLATE_HEADERS:
            html.append('<td></td>')
        html.append('</tr>')
        
        html.append('</table></body></html>')
        content = ''.join(html)

        response = HttpResponse(content, content_type='application/vnd.ms-excel; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="student_bulk_upload_template.xls"'
        return response


# ─── Enrollment-status coordinator-approval workflow ──────────────────────────

class TeacherEnrollmentRequestListView(APIView):
    """GET /api/students/enrollment-requests/mine/ — the current user's own
    enrollment-status change requests (any status), newest first."""
    permission_classes = [IsAuthenticated, IsTeacherOrAbove]

    def get(self, request):
        from .models import EnrollmentStatusRequest
        from .serializers import EnrollmentStatusRequestSerializer
        qs = EnrollmentStatusRequest.objects.filter(
            requested_by=request.user
        ).select_related('student', 'student__campus', 'requested_by', 'reviewed_by')
        return Response(EnrollmentStatusRequestSerializer(qs, many=True).data)


class CoordinatorEnrollmentRequestListView(APIView):
    """GET /api/students/enrollment-requests/pending/ — pending requests for the
    coordinator's campus + managed levels. `?all=1` includes decided ones too."""
    permission_classes = [IsAuthenticated, IsCoordinatorOrAbove]

    def get(self, request):
        from coordinator.models import Coordinator
        from .models import EnrollmentStatusRequest
        from .serializers import EnrollmentStatusRequestSerializer

        coord = Coordinator.get_for_user(request.user)
        if not coord or not coord.campus:
            # Principal / admin without a coordinator profile: scope by nothing extra here.
            if getattr(request.user, 'role', None) in REVIEW_STATUS_ROLES:
                qs = EnrollmentStatusRequest.objects.all()
            else:
                return Response({'error': 'No coordinator profile / campus.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            managed = [l for l in (list(coord.assigned_levels.all()) or ([coord.level] if coord.level else [])) if l]
            qs = EnrollmentStatusRequest.objects.filter(student__campus=coord.campus)
            if managed:
                # Match by the student's current classroom level, OR (for left/
                # inactive students whose classroom was cleared — e.g. a re-enroll
                # request) their former classroom level; otherwise those requests
                # would silently drop out of the queue.
                qs = qs.filter(
                    Q(student__classroom__grade__level__in=managed)
                    | Q(student__last_classroom__grade__level__in=managed)
                )

        if request.query_params.get('all') not in ('1', 'true', 'True'):
            qs = qs.filter(status='pending')
        qs = qs.select_related('student', 'student__campus', 'requested_by', 'reviewed_by').distinct()
        return Response(EnrollmentStatusRequestSerializer(qs, many=True).data)


class CoordinatorEnrollmentRequestApproveView(APIView):
    """POST /api/students/enrollment-requests/<pk>/approve/ (body: response?) —
    applies the requested change via Student.change_status()."""
    permission_classes = [IsAuthenticated, IsCoordinatorOrAbove]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404
        from django.utils import timezone
        from django.core.exceptions import ValidationError as DjangoValidationError
        from coordinator.models import Coordinator
        from notifications.services import create_notification
        from .models import EnrollmentStatusRequest
        from .serializers import EnrollmentStatusRequestSerializer

        req = get_object_or_404(EnrollmentStatusRequest, id=pk)
        coord = Coordinator.get_for_user(request.user)
        role = getattr(request.user, 'role', None)
        if not coord and role not in REVIEW_STATUS_ROLES:
            return Response({'error': 'Only a coordinator or above can review requests.'}, status=status.HTTP_403_FORBIDDEN)
        # A coordinator may only act within their own campus.
        if coord and req.student.campus_id != coord.campus_id:
            return Response({'error': 'This request is outside your campus.'}, status=status.HTTP_403_FORBIDDEN)
        if req.status != 'pending':
            return Response({'error': f'Request already {req.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            req.student.change_status(req.requested_status, req.event_date, reason=req.reason, reason_code=req.reason_code, user=request.user)
        except DjangoValidationError as e:
            detail = e.message_dict if hasattr(e, 'message_dict') else {'error': e.messages}
            return Response(detail, status=status.HTTP_400_BAD_REQUEST)

        req.status = 'approved'
        req.reviewed_by = request.user
        req.coordinator_response = (request.data.get('response') or '').strip() or None
        req.reviewed_at = timezone.now()
        req.save(update_fields=['status', 'reviewed_by', 'coordinator_response', 'reviewed_at'])

        if req.requested_by:
            create_notification(
                recipient=req.requested_by, actor=request.user,
                verb='enrollment_status_approved',
                target_text=f"Status change approved — {req.student.name} is now {req.get_requested_status_display()}.",
                data={'enrollment_request_id': req.id, 'student_id': req.student.id},
            )
        return Response(EnrollmentStatusRequestSerializer(req).data)


class CoordinatorEnrollmentRequestRejectView(APIView):
    """POST /api/students/enrollment-requests/<pk>/reject/ (body: response) —
    rejects the request (a reason is required)."""
    permission_classes = [IsAuthenticated, IsCoordinatorOrAbove]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404
        from django.utils import timezone
        from coordinator.models import Coordinator
        from notifications.services import create_notification
        from .models import EnrollmentStatusRequest
        from .serializers import EnrollmentStatusRequestSerializer

        req = get_object_or_404(EnrollmentStatusRequest, id=pk)
        coord = Coordinator.get_for_user(request.user)
        role = getattr(request.user, 'role', None)
        if not coord and role not in REVIEW_STATUS_ROLES:
            return Response({'error': 'Only a coordinator or above can review requests.'}, status=status.HTTP_403_FORBIDDEN)
        if coord and req.student.campus_id != coord.campus_id:
            return Response({'error': 'This request is outside your campus.'}, status=status.HTTP_403_FORBIDDEN)
        if req.status != 'pending':
            return Response({'error': f'Request already {req.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        response_reason = (request.data.get('response') or '').strip()
        if not response_reason:
            return Response({'error': 'A reason is required to reject the request.'}, status=status.HTTP_400_BAD_REQUEST)

        req.status = 'rejected'
        req.reviewed_by = request.user
        req.coordinator_response = response_reason
        req.reviewed_at = timezone.now()
        req.save(update_fields=['status', 'reviewed_by', 'coordinator_response', 'reviewed_at'])

        if req.requested_by:
            create_notification(
                recipient=req.requested_by, actor=request.user,
                verb='enrollment_status_rejected',
                target_text=f"Status change rejected for {req.student.name}: {response_reason}",
                data={'enrollment_request_id': req.id, 'student_id': req.student.id, 'reason': response_reason},
            )
        return Response(EnrollmentStatusRequestSerializer(req).data)


class EnrollmentKPIView(APIView):
    """Enrollment KPIs (currently Retention Rate) built on the status history.

    GET ?academic_year=2026-27[&campus_id=]
      - No campus_id  → whole org (org-scoped) — Org Admin view.
      - campus_id     → that campus only — Principal / campus view.
    Retention = % of the previous year's cohort still enrolled this year.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .enrollment_kpis import (
            calculate_retention_rate, calculate_leavers, calculate_dropout_rate,
            calculate_progression_rate,
        )
        academic_year = request.query_params.get('academic_year')
        campus_id = request.query_params.get('campus_id')

        # Latest academic year from data if not provided.
        if not academic_year:
            from result.models import Result
            years = sorted(set(Result.objects.values_list('academic_year', flat=True)), reverse=True)
            academic_year = years[0] if years else '2026-27'

        # A principal without an explicit campus_id is scoped to their own campus.
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

        students = Student.objects.filter(
            is_deleted=False, is_draft=False
        ).prefetch_related('enrollment_events')
        if campus_id:
            students = students.filter(campus_id=campus_id)

        # A coordinator sees only their assigned levels — not the whole org.
        # Without this a coordinator hitting the endpoint would get org-wide
        # numbers, the same over-broad scope the attendance module closes.
        level_ids = None
        if request.user.is_coordinator():
            try:
                from coordinator.models import Coordinator
                coord = Coordinator.get_for_user(request.user)
                if coord:
                    if coord.assigned_levels.exists():
                        level_ids = list(coord.assigned_levels.values_list('id', flat=True))
                    elif coord.level_id:
                        level_ids = [coord.level_id]
            except Exception:
                level_ids = None
            if level_ids:
                students = students.filter(classroom__grade__level_id__in=level_ids)
            else:
                students = students.none()

        # Each campus is measured on ITS OWN configured academic year (Jan–Dec,
        # Oct–Sep, …). Org-wide numbers are the SUM of the per-campus results — a
        # single shared window would drop exits that fall inside one campus's year
        # but outside another's (the cause of "left students not showing").
        from .enrollment_kpis import start_month_num
        from campus.models import Campus
        from collections import defaultdict
        campus_months = {}
        try:
            for cid, m in Campus.objects.exclude(
                academic_year_start_month__isnull=True
            ).exclude(academic_year_start_month='').values_list('id', 'academic_year_start_month'):
                campus_months[cid] = start_month_num(m)
        except Exception:
            campus_months = {}

        students_list = list(students)
        by_campus = defaultdict(list)
        for s in students_list:
            by_campus[s.campus_id].append(s)

        retention = {'academic_year': academic_year, 'cohort_size': 0, 'retained': 0,
                     'left': 0, 'transferred': 0, 'graduated': 0, 'total_exits': 0,
                     'exits_by_gender': {'male': {'cohort': 0, 'exits': 0},
                                         'female': {'cohort': 0, 'exits': 0}},
                     'retention_rate': 0, 'has_data': False}
        leavers = {'left': 0, 'transferred': 0, 'graduated': 0, 'total_exits': 0}
        dropout = {'male': {'enrolled': 0, 'dropouts': 0},
                   'female': {'enrolled': 0, 'dropouts': 0}}
        for cid, studs in by_campus.items():
            m = campus_months.get(cid, 4)
            r = calculate_retention_rate(studs, academic_year, m)
            for k in ('cohort_size', 'retained', 'left', 'transferred', 'graduated'):
                retention[k] += r[k]
            for g in ('male', 'female'):
                retention['exits_by_gender'][g]['cohort'] += r['exits_by_gender'][g]['cohort']
                retention['exits_by_gender'][g]['exits'] += r['exits_by_gender'][g]['exits']
            lv = calculate_leavers(studs, academic_year, m)
            for k in ('left', 'transferred', 'graduated'):
                leavers[k] += lv[k]
            dp = calculate_dropout_rate(studs, academic_year, m)
            for g in ('male', 'female'):
                dropout[g]['enrolled'] += dp[g]['enrolled']
                dropout[g]['dropouts'] += dp[g]['dropouts']

        retention['retention_rate'] = round(
            retention['retained'] / retention['cohort_size'] * 100, 1) if retention['cohort_size'] else 0
        retention['has_data'] = retention['cohort_size'] > 0
        retention['total_exits'] = retention['left'] + retention['transferred'] + retention['graduated']
        for g in ('male', 'female'):
            b = retention['exits_by_gender'][g]
            b['rate'] = round(b['exits'] / b['cohort'] * 100, 1) if b['cohort'] else 0
        leavers['total_exits'] = leavers['left'] + leavers['transferred'] + leavers['graduated']
        for g in ('male', 'female'):
            b = dropout[g]
            b['dropout_rate'] = round(b['dropouts'] / b['enrolled'] * 100, 1) if b['enrolled'] else 0
        dropout['total_dropouts'] = dropout['male']['dropouts'] + dropout['female']['dropouts']

        progression = calculate_progression_rate(students_list, academic_year)
        return Response({
            'academic_year': academic_year,
            'campus_id': int(campus_id) if campus_id else None,
            'retention': retention,
            'leavers': leavers,
            'dropout': dropout,
            'progression': progression,
        })

