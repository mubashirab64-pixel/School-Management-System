# students/serializers.py
from rest_framework import serializers
from .models import Student, EnrollmentEvent, EnrollmentStatusRequest
from campus.serializers import CampusSerializer
from classes.serializers import ClassRoomSerializer


class EnrollmentEventSerializer(serializers.ModelSerializer):
    """One row of a student's enrollment timeline (read-only)."""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, default=None)
    gap_days = serializers.IntegerField(read_only=True)

    class Meta:
        model = EnrollmentEvent
        fields = ['id', 'event_type', 'event_date', 'reason', 'reason_code', 'created_by_name', 'gap_days', 'created_at']


class EnrollmentStatusRequestSerializer(serializers.ModelSerializer):
    """A pending/decided enrollment-status change request (read-only view)."""
    student_name = serializers.CharField(source='student.name', read_only=True)
    student_code = serializers.CharField(source='student.student_id', read_only=True, default=None)
    current_status = serializers.CharField(source='student.enrollment_status', read_only=True)
    requested_status_display = serializers.CharField(source='get_requested_status_display', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True, default=None)
    reviewed_by_name = serializers.CharField(source='reviewed_by.get_full_name', read_only=True, default=None)
    campus_name = serializers.CharField(source='student.campus.campus_name', read_only=True, default=None)

    class Meta:
        model = EnrollmentStatusRequest
        fields = [
            'id', 'student', 'student_name', 'student_code', 'campus_name',
            'current_status', 'requested_status', 'requested_status_display',
            'event_date', 'reason', 'reason_code', 'status', 'requested_by_name',
            'reviewed_by_name', 'coordinator_response', 'created_at', 'reviewed_at',
        ]


def performance_label(percent):
    """Map an average behaviour percent (0-100) to a performance label/grade."""
    if percent is None:
        return None
    if percent >= 90:
        return {"percent": percent, "label": "A+ Excellent", "grade": "A+"}
    if percent >= 75:
        return {"percent": percent, "label": "A Good", "grade": "A"}
    if percent >= 60:
        return {"percent": percent, "label": "B Average", "grade": "B"}
    return {"percent": percent, "label": "C Attention Required", "grade": "C"}


class StudentSerializer(serializers.ModelSerializer):
    # Nested serializers for related objects
    campus_data = CampusSerializer(source='campus', read_only=True)
    classroom_data = ClassRoomSerializer(source='classroom', read_only=True)
    
    # Computed fields
    campus_name = serializers.SerializerMethodField()
    classroom_name = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    class_teacher_name = serializers.SerializerMethodField()
    class_teacher_code = serializers.SerializerMethodField()
    coordinator_name = serializers.SerializerMethodField()
    age = serializers.SerializerMethodField()
    full_name = serializers.CharField(read_only=True)
    level = serializers.SerializerMethodField()
    # Computed list metrics (populated per-page via serializer context in StudentViewSet.list)
    attendance_percentage = serializers.SerializerMethodField()
    performance = serializers.SerializerMethodField()
    fee_status = serializers.SerializerMethodField()
    # Enrollment lifecycle (read-only here — status changes go through the
    # dedicated change-status endpoint so the event log stays in sync)
    enrollment_status = serializers.CharField(read_only=True)
    enrollment_events = EnrollmentEventSerializer(many=True, read_only=True)
    current_gap_days = serializers.IntegerField(read_only=True)

    class Meta:
        model = Student
        fields = [
            'id', 'organization', 'student_id', 'student_code', 'gr_no', 'full_name', 'name', 'gender', 'dob',
            'father_name', 'section', 'shift', 'current_grade', 'campus', 'classroom',
            'enrollment_year', 'is_draft', 'is_deleted', 'is_active', 'last_class_teacher', 'last_class_passed',
            'photo', 'place_of_birth', 'religion', 'mother_tongue', 'student_cnic', 'nationality',
            'blood_group', 'special_needs_disability', 'email', 'country_code', 'phone_number', 'emergency_contact', 'emergency_relationship',
            'father_cnic', 'father_contact', 'father_profession', 'guardian_name', 'guardian_cnic',
            'guardian_profession', 'guardian_contact', 'mother_name', 'mother_cnic', 'mother_status', 'mother_contact', 'mother_profession',
            'address', 'family_income', 'house_owned', 'zakat_status', 'terminated_on', 'termination_reason',
            'old_gr_number',
            'transfer_reason', 'siblings_count', 'father_status',
            'dynamic_data', 'campus_data', 'classroom_data', 'campus_name', 'classroom_name',
            'class_name', 'class_teacher_name', 'class_teacher_code', 'coordinator_name', 'age',
            'level', 'created_at',
            'attendance_percentage', 'performance', 'fee_status',
            'enrollment_status', 'enrollment_events', 'current_gap_days',
        ]
    
    def get_campus_name(self, obj):
        """Get campus name for display"""
        return obj.campus.campus_name if obj.campus else None
    
    def get_classroom_name(self, obj):
        """Get classroom name for display"""
        if obj.classroom:
            return f"{obj.classroom.grade.name} - {obj.classroom.section}"
        return None
    
    def get_class_name(self, obj):
        """Get class name for display"""
        if obj.classroom and obj.classroom.grade:
            return f"{obj.classroom.grade.name} {obj.classroom.section}"
        return None
    
    def get_class_teacher_name(self, obj):
        """Get class teacher name - checks both direct FK and M2M relationship"""
        if not obj.classroom:
            return None
        
        # First check direct FK relationship
        if obj.classroom.class_teacher:
            return obj.classroom.class_teacher.full_name
        
        # Fallback: Check M2M relationship (for both shift teachers)
        # class_teachers is the reverse relation from Teacher.assigned_classrooms
        m2m_teachers = obj.classroom.class_teachers.all()
        if m2m_teachers.exists():
            # Return the first teacher found (should typically be one)
            return m2m_teachers.first().full_name
        
        return None
    
    def get_class_teacher_code(self, obj):
        """Get class teacher employee code - checks both direct FK and M2M relationship"""
        if not obj.classroom:
            return None
        
        # First check direct FK relationship
        if obj.classroom.class_teacher:
            return obj.classroom.class_teacher.employee_code
        
        # Fallback: Check M2M relationship (for both shift teachers)
        m2m_teachers = obj.classroom.class_teachers.all()
        if m2m_teachers.exists():
            return m2m_teachers.first().employee_code
        
        return None

    def get_coordinator_name(self, obj):
        """
        Get coordinator name based on the student's classroom level.
        This uses the Level.coordinator_name property so that the UI can
        show the coordinator for the current class/grade.
        """
        try:
            if obj.classroom and obj.classroom.grade and obj.classroom.grade.level:
                level = obj.classroom.grade.level
                # Level has a coordinator_name property that aggregates direct + M2M coordinators
                return level.coordinator_name
        except Exception:
            # Fail silently – coordinator is purely display information
            return None
        return None
    
    def get_level(self, obj):
        """Return the level {id, name} derived from classroom → grade → level."""
        try:
            if obj.classroom and obj.classroom.grade and obj.classroom.grade.level:
                lv = obj.classroom.grade.level
                return {'id': lv.id, 'name': lv.name}
        except Exception:
            pass
        return None

    def get_age(self, obj):
        """Calculate age from date of birth"""
        if obj.dob:
            from datetime import date
            today = date.today()
            return today.year - obj.dob.year - ((today.month, today.day) < (obj.dob.month, obj.dob.day))
        return None

    def get_attendance_percentage(self, obj):
        """Attendance % for current academic year — supplied per-page via context."""
        stats = (self.context or {}).get('attendance_stats') or {}
        return stats.get(obj.id)

    def get_performance(self, obj):
        """Performance derived from behaviour metrics — {percent, label, grade} or None."""
        perf = (self.context or {}).get('performance_map') or {}
        return perf.get(obj.id)

    def get_fee_status(self, obj):
        """Fee status: zakat-applicable -> scholarship, else paid/pending/overdue from StudentFee."""
        if (obj.zakat_status or '').lower() == 'applicable':
            return 'scholarship'
        fees = (self.context or {}).get('fee_status_map') or {}
        return fees.get(obj.id)
