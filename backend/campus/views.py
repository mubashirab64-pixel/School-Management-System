from django.db import transaction
from rest_framework import viewsets, decorators, response, permissions, status
from rest_framework.exceptions import PermissionDenied
from users.permissions import IsNotDonorForWrites
from .models import Campus
from .serializers import CampusSerializer


def _cascade_campus_code_change(campus_pk, old_code, new_code, old_campus_id):
    """
    When campus_code changes (e.g. C01 → C04), update via raw SQL to bypass
    OrganizationManager filters:
      - campus_id (last segment replaced)
      - teacher employee_code + teacher_id + user username
      - principal employee_code + user username
      - coordinator employee_code + user username
      - student student_id + user username
    """
    from django.db import connection

    prefix_old = old_code + '-'
    prefix_new = new_code + '-'
    prefix_len = len(prefix_old)

    with connection.cursor() as cur:
        # 1. campus_id — replace last segment (format: CITY-YY-POSTAL-CODE)
        if old_campus_id and old_campus_id.endswith('-' + old_code):
            new_cid = old_campus_id[:-len(old_code)] + new_code
            cur.execute(
                "UPDATE campus_campus SET campus_id=%s WHERE id=%s",
                [new_cid, campus_pk]
            )

        # 2. Teachers
        cur.execute(
            "SELECT id, employee_code FROM teachers_teacher "
            "WHERE current_campus_id=%s AND employee_code LIKE %s",
            [campus_pk, prefix_old + '%']
        )
        for t_id, old_emp in cur.fetchall():
            new_emp = prefix_new + old_emp[prefix_len:]
            cur.execute(
                "UPDATE teachers_teacher SET employee_code=%s, teacher_id=%s WHERE id=%s",
                [new_emp, new_emp, t_id]
            )
            cur.execute(
                "UPDATE users_user SET username=%s WHERE username=%s",
                [new_emp, old_emp]
            )

        # 3. Principals
        cur.execute(
            "SELECT id, employee_code FROM principals_principal "
            "WHERE campus_id=%s AND employee_code LIKE %s",
            [campus_pk, prefix_old + '%']
        )
        for p_id, old_emp in cur.fetchall():
            new_emp = prefix_new + old_emp[prefix_len:]
            cur.execute(
                "UPDATE principals_principal SET employee_code=%s WHERE id=%s",
                [new_emp, p_id]
            )
            cur.execute(
                "UPDATE users_user SET username=%s WHERE username=%s",
                [new_emp, old_emp]
            )

        # 4. Coordinators
        cur.execute(
            "SELECT id, employee_code FROM coordinator_coordinator "
            "WHERE campus_id=%s AND employee_code LIKE %s",
            [campus_pk, prefix_old + '%']
        )
        for c_id, old_emp in cur.fetchall():
            new_emp = prefix_new + old_emp[prefix_len:]
            cur.execute(
                "UPDATE coordinator_coordinator SET employee_code=%s WHERE id=%s",
                [new_emp, c_id]
            )
            cur.execute(
                "UPDATE users_user SET username=%s WHERE username=%s",
                [new_emp, old_emp]
            )

        # 5. Students
        cur.execute(
            "SELECT id, student_id, user_id FROM students_student "
            "WHERE campus_id=%s AND student_id LIKE %s",
            [campus_pk, prefix_old + '%']
        )
        for s_id, old_sid, user_id in cur.fetchall():
            new_sid = prefix_new + old_sid[prefix_len:]
            cur.execute(
                "UPDATE students_student SET student_id=%s WHERE id=%s",
                [new_sid, s_id]
            )
            if user_id:
                cur.execute(
                    "UPDATE users_user SET username=%s WHERE id=%s",
                    [new_sid, user_id]
                )


class CampusViewSet(viewsets.ModelViewSet):
    queryset = Campus.objects.all()
    serializer_class = CampusSerializer
    permission_classes = [permissions.IsAuthenticated, IsNotDonorForWrites]

    def perform_update(self, serializer):
        old_code = serializer.instance.campus_code
        old_campus_id = serializer.instance.campus_id or ''
        instance = serializer.save()
        new_code = instance.campus_code
        if old_code and new_code and old_code != new_code:
            _cascade_campus_code_change(instance.pk, old_code, new_code, old_campus_id)

    def get_queryset(self):
        user = self.request.user
        queryset = Campus.objects.all()

        if user.is_superadmin():
            return queryset

        if user.organization:
            # Management roles (Admin, Principal, Coordinator) need to see all campuses 
            # in the organization for operations like campus transfers.
            if user.role in ['superadmin', 'admin', 'org_admin', 'principal', 'coordinator']:
                return queryset

            # For other roles (like teachers), restrict to their assigned campus if set.
            if user.campus:
                return queryset.filter(id=user.campus.id)
            
            return queryset
        
        # If no organization and not superadmin, show only THEIR campus if assigned (fallback)
        if user.campus:
            return queryset.filter(id=user.campus.id)

        return queryset.none()

    def perform_create(self, serializer):
        """
        Auto-assign organization AND enforce campus quota from plan.
        """
        user = self.request.user

        if not user.is_superadmin():
            org = user.organization
            if not org:
                raise PermissionDenied("You are not associated with any organization.")

            # ── Quota Enforcement ──────────────────────────────────────────
            current_count = Campus.objects.filter(organization=org).count()
            if current_count >= org.max_campuses:
                raise PermissionDenied(
                    f"Campus quota exceeded. Your plan allows a maximum of "
                    f"{org.max_campuses} campus(es). You already have {current_count}. "
                    f"Please upgrade your subscription to add more campuses."
                )
            # ──────────────────────────────────────────────────────────────

            serializer.save(organization=org)
        else:
            serializer.save()

    # ✅ Custom endpoint: campus summary
    @decorators.action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        campus = self.get_object()
        data = {
            "campus_name": campus.campus_name,
            "campus_code": campus.campus_code,
            "campus_type": campus.campus_type,
            "city": campus.city,
            "student_capacity": campus.student_capacity,
            "status": campus.status,
        }
        return response.Response(data)

    # ✅ Custom endpoint: facilities list
    @decorators.action(detail=True, methods=["get"])
    def facilities(self, request, pk=None):
        campus = self.get_object()
        data = {
            "power_backup": campus.power_backup,
            "internet_available": campus.internet_available,
            "canteen_facility": campus.canteen_facility,
            "library_available": campus.library_available,
            "teacher_transport": campus.teacher_transport,
            "student_transport": campus.student_transport,
            "meal_program": campus.meal_program,
            "sports_available": campus.sports_available,
            "num_computer_labs": campus.num_computer_labs,
            "num_science_labs": campus.num_science_labs,
            "num_biology_labs": campus.num_biology_labs,
            "num_chemistry_labs": campus.num_chemistry_labs,
            "num_physics_labs": campus.num_physics_labs,
            "washrooms": {
                "male_teachers": campus.male_teachers_washrooms,
                "female_teachers": campus.female_teachers_washrooms,
                "male_students": campus.male_student_washrooms,
                "female_students": campus.female_student_washrooms,
                "total": campus.total_washrooms,
            }
        }
        return response.Response(data)

    # ✅ Custom endpoint: per-grade totals, gender split, and attendance %
    @decorators.action(detail=True, methods=["get"], url_path="grade-breakdown")
    def grade_breakdown(self, request, pk=None):
        """One row per grade in this campus: total students, boys, girls, and the
        grade's attendance % (the single-source-of-truth formula over its
        classroom-day counters). Ordered by structural grade rank."""
        from django.db.models import Count, Q, Sum
        from students.models import Student
        from attendance.models import Attendance
        from attendance.services.metrics import attendance_percentage
        from classes.models import Grade

        campus = self.get_object()

        # Canonical "active students" definition — matches the main dashboard's
        # "Total Students" and the campus grid card: active, non-deleted, actually
        # assigned to a classroom, and not Alumni. Keeps every campus count in sync.
        active_students = Student.objects.filter(
            campus_id=campus.id, is_deleted=False, is_active=True,
            classroom__isnull=False,
        ).exclude(current_grade__iexact='Alumni')

        rows = {}
        for r in active_students.values('current_grade').annotate(
            total=Count('id'),
            boys=Count('id', filter=Q(gender__iexact='male')),
            girls=Count('id', filter=Q(gender__iexact='female')),
        ):
            g = (r['current_grade'] or '').strip()
            if not g:
                continue
            rows[g] = {'grade': g, 'total': r['total'], 'boys': r['boys'],
                       'girls': r['girls'], 'attendance_pct': 0.0}

        campus_att = Attendance.objects.filter(
            classroom__grade__level__campus_id=campus.id, is_deleted=False)
        for a in campus_att.values('classroom__grade__name').annotate(
            present=Sum('present_count'), total=Sum('total_students'),
            leave=Sum('leave_count'), excused=Sum('excused_count'),
        ):
            g = (a['classroom__grade__name'] or '').strip()
            if g in rows:
                rows[g]['attendance_pct'] = attendance_percentage(
                    a['present'] or 0, a['total'] or 0, a['leave'] or 0, a['excused'] or 0)

        # Campus-wide attendance % — aggregate every classroom-day counter once.
        tot = campus_att.aggregate(
            present=Sum('present_count'), total=Sum('total_students'),
            leave=Sum('leave_count'), excused=Sum('excused_count'))
        overall_attendance_pct = attendance_percentage(
            tot['present'] or 0, tot['total'] or 0, tot['leave'] or 0, tot['excused'] or 0)

        # Structural grade order (Grade.order); unknown grades sort last.
        order_map = {n: o for n, o in Grade._base_manager.values_list('name', 'order') if o}
        ordered = sorted(rows.values(), key=lambda x: order_map.get(x['grade'], 9999))

        # Campus-wide student summary (total, gender, shift) so the campus profile
        # can show real counts WITHOUT fetching every student in the network — the
        # old client-side approach downloaded all ~5k students and timed out.
        # Uses the same canonical active-students filter as above.
        summary = active_students.aggregate(
            total=Count('id'),
            male=Count('id', filter=Q(gender__iexact='male')),
            female=Count('id', filter=Q(gender__iexact='female')),
            morning=Count('id', filter=Q(shift__iexact='morning')),
            afternoon=Count('id', filter=Q(shift__iexact='afternoon')),
        )

        return response.Response({
            'campus_id': campus.id,
            'grades': ordered,
            'overall_attendance_pct': overall_attendance_pct,
            'overall': {
                'total': summary['total'] or 0,
                'male': summary['male'] or 0,
                'female': summary['female'] or 0,
                'morning': summary['morning'] or 0,
                'afternoon': summary['afternoon'] or 0,
            },
        })

    # ✅ Custom endpoint: head-to-head comparison stats for one campus
    @decorators.action(detail=True, methods=["get"], url_path="comparison-stats")
    def comparison_stats(self, request, pk=None):
        """Compact per-campus figures for the INTER campus-vs-campus card:
        active students, teachers, distinct subjects, and campus-wide
        attendance % (same single-source formula as grade-breakdown)."""
        from django.db.models import Sum
        from students.models import Student
        from teachers.models import Teacher
        from timetable.models import Subject
        from attendance.models import Attendance
        from attendance.services.metrics import attendance_percentage

        campus = self.get_object()

        students = Student.objects.filter(
            campus_id=campus.id, is_deleted=False, is_active=True).count()

        # Teacher.objects already excludes is_deleted rows (org-scoped manager).
        teachers = Teacher.objects.filter(current_campus_id=campus.id).count()

        # Distinct subject names offered at this campus (reused across levels).
        subjects = Subject.objects.filter(
            campus_id=campus.id, is_active=True
        ).values('name').distinct().count()

        tot = Attendance.objects.filter(
            classroom__grade__level__campus_id=campus.id, is_deleted=False
        ).aggregate(
            present=Sum('present_count'), total=Sum('total_students'),
            leave=Sum('leave_count'), excused=Sum('excused_count'))
        attendance_pct = attendance_percentage(
            tot['present'] or 0, tot['total'] or 0,
            tot['leave'] or 0, tot['excused'] or 0)

        return response.Response({
            'campus_id': campus.id,
            'campus_name': campus.campus_name,
            'students': students,
            'teachers': teachers,
            'subjects': subjects,
            'attendance_pct': attendance_pct,
        })

    # ✅ Custom endpoint: only active campuses
    @decorators.action(detail=False, methods=["get"])
    def active(self, request):
        campuses = Campus.objects.filter(status="active")
        serializer = self.get_serializer(campuses, many=True)
        return response.Response(serializer.data)