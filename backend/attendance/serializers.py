from rest_framework import serializers
from .models import Attendance, StudentAttendance, Weekend, AuditLog, ZKTecoDevice, ZKTecoEmployeeMapping, StaffAttendance, EmployeeShiftTiming
from students.models import Student
from classes.models import ClassRoom
from teachers.models import Teacher


class DeleteLogSerializer(serializers.ModelSerializer):
    """Serializer for delete audit logs"""
    user_name = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()
    entity_name = serializers.SerializerMethodField()
    feature_display = serializers.CharField(source='get_feature_display', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    
    def get_user_name(self, obj):
        """Get user full name with role"""
        if not obj.user:
            return "System"
        role_display = obj.user.get_role_display() if hasattr(obj.user, 'get_role_display') else (obj.user.role or 'User')
        full_name = obj.user.get_full_name() if hasattr(obj.user, 'get_full_name') else (obj.user.username or 'Unknown')
        return f"{role_display} {full_name}"
    
    def get_user_role(self, obj):
        """Get user role display"""
        if not obj.user:
            return None
        return obj.user.get_role_display() if hasattr(obj.user, 'get_role_display') else (obj.user.role or 'User')
    
    def get_entity_name(self, obj):
        """Get entity name based on feature and entity_id"""
        try:
            entity_type = obj.entity_type.lower()
            entity_id = obj.entity_id
            
            if obj.feature == 'student':
                from students.models import Student
                # First, try to get from database (including soft-deleted)
                try:
                    # Use with_deleted() to include soft-deleted students
                    student = Student.objects.with_deleted().get(id=entity_id)
                    return student.name
                except Student.DoesNotExist:
                    # If student is deleted, try to get name from changes field
                    if obj.changes and isinstance(obj.changes, dict):
                        # Check various possible keys where name might be stored
                        name = obj.changes.get('name') or obj.changes.get('student_name') or obj.changes.get('Name')
                        if name:
                            return name
                    # Check reason field for name
                    if obj.reason:
                        # Try to extract name from reason (e.g., "Deleted student: John Doe")
                        import re
                        match = re.search(r'(?:student|name)[:\s]+([A-Za-z\s]+)', obj.reason, re.IGNORECASE)
                        if match:
                            return match.group(1).strip()
                    return f"Student (ID: {entity_id})"
            
            elif obj.feature == 'teacher':
                from teachers.models import Teacher
                try:
                    teacher = Teacher.objects.get(id=entity_id)
                    return teacher.full_name
                except Teacher.DoesNotExist:
                    # Try to get from changes field
                    if obj.changes and isinstance(obj.changes, dict):
                        name = obj.changes.get('full_name') or obj.changes.get('name') or obj.changes.get('teacher_name')
                        if name:
                            return name
                    return f"Teacher (ID: {entity_id})"
            
            elif obj.feature == 'coordinator':
                from coordinator.models import Coordinator
                try:
                    coordinator = Coordinator.objects.get(id=entity_id)
                    return coordinator.full_name
                except Coordinator.DoesNotExist:
                    # Try to get from changes field
                    if obj.changes and isinstance(obj.changes, dict):
                        name = obj.changes.get('full_name') or obj.changes.get('name') or obj.changes.get('coordinator_name')
                        if name:
                            return name
                    return f"Coordinator (ID: {entity_id})"
            
            elif obj.feature == 'principal':
                from principals.models import Principal
                try:
                    principal = Principal.objects.get(id=entity_id)
                    return principal.full_name
                except Principal.DoesNotExist:
                    # Try to get from changes field
                    if obj.changes and isinstance(obj.changes, dict):
                        name = obj.changes.get('full_name') or obj.changes.get('name') or obj.changes.get('principal_name')
                        if name:
                            return name
                    return f"Principal (ID: {entity_id})"
            
            elif obj.feature == 'classroom':
                from classes.models import ClassRoom
                try:
                    classroom = ClassRoom.objects.get(id=entity_id)
                    return str(classroom)  # Returns "Grade - Section"
                except ClassRoom.DoesNotExist:
                    # Try to get from changes field
                    if obj.changes and isinstance(obj.changes, dict):
                        name = obj.changes.get('name') or obj.changes.get('classroom_name')
                        if name:
                            return name
                    return f"Classroom (ID: {entity_id})"
            
            elif obj.feature == 'grade':
                from classes.models import Grade
                try:
                    grade = Grade.objects.get(id=entity_id)
                    return grade.name
                except Grade.DoesNotExist:
                    # Try to get from changes field
                    if obj.changes and isinstance(obj.changes, dict):
                        name = obj.changes.get('name') or obj.changes.get('grade_name')
                        if name:
                            return name
                    return f"Grade (ID: {entity_id})"
            
            elif obj.feature == 'level':
                from classes.models import Level
                try:
                    level = Level.objects.get(id=entity_id)
                    return level.name
                except Level.DoesNotExist:
                    # Try to get from changes field
                    if obj.changes and isinstance(obj.changes, dict):
                        name = obj.changes.get('name') or obj.changes.get('level_name')
                        if name:
                            return name
                    return f"Level (ID: {entity_id})"
            
            elif obj.feature == 'campus':
                from campus.models import Campus
                try:
                    campus = Campus.objects.get(id=entity_id)
                    return campus.campus_name
                except Campus.DoesNotExist:
                    # Try to get from changes field
                    if obj.changes and isinstance(obj.changes, dict):
                        name = obj.changes.get('campus_name') or obj.changes.get('name')
                        if name:
                            return name
                    return f"Campus (ID: {entity_id})"
            
            elif obj.feature == 'user':
                from django.contrib.auth import get_user_model
                User = get_user_model()
                try:
                    user = User.objects.get(id=entity_id)
                    return user.get_full_name() if hasattr(user, 'get_full_name') else user.username
                except User.DoesNotExist:
                    return f"User (ID: {entity_id})"
            
            elif obj.feature == 'attendance':
                from .models import Attendance
                try:
                    attendance = Attendance.objects.get(id=entity_id)
                    return str(attendance)
                except Attendance.DoesNotExist:
                    return f"Attendance (ID: {entity_id})"

            elif obj.feature == 'result':
                from result.models import Result
                try:
                    result = Result.objects.with_deleted().get(id=entity_id)
                    return f"{result.student.name} - {result.get_exam_type_display()} ({result.academic_year})"
                except Exception:
                    if obj.changes and isinstance(obj.changes, dict):
                        name = obj.changes.get('student_name') or obj.changes.get('name')
                        if name:
                            return name
                    return f"Result (ID: {entity_id})"

            elif obj.feature == 'transfer':
                # entity_id is student.id; build label from changes snapshot
                if obj.changes and isinstance(obj.changes, dict):
                    student_name = obj.changes.get('student_name')
                    if student_name:
                        return student_name
                # Fallback: try live DB
                try:
                    from students.models import Student
                    student = Student.objects.with_deleted().get(id=entity_id)
                    return student.name
                except Exception:
                    pass
                return f"Student (ID: {entity_id})"

            # Fallback to entity_type and ID if feature not recognized
            return f"{obj.entity_type} (ID: {entity_id})"
            
        except Exception as e:
            # If any error occurs, return fallback
            return f"{obj.entity_type} (ID: {entity_id})"
    
    class Meta:
        model = AuditLog
        fields = [
            'id',
            'feature',
            'feature_display',
            'action',
            'action_display',
            'entity_type',
            'entity_id',
            'entity_name',
            'user',
            'user_name',
            'user_role',
            'timestamp',
            'ip_address',
            'changes',
            'reason',
            'is_recovered',
        ]
        read_only_fields = ['id', 'timestamp']


class StudentAttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    student_father_name = serializers.CharField(source='student.father_name', read_only=True)
    student_code = serializers.SerializerMethodField()  # Use method to get the best available ID
    student_gender = serializers.CharField(source='student.gender', read_only=True)
    student_photo = serializers.ImageField(source='student.photo', read_only=True)
    attendance_date = serializers.DateField(source='attendance.date', read_only=True)
    
    def get_student_code(self, obj):
        # Return the best available student identifier
        return obj.student.student_code or obj.student.student_id or obj.student.gr_no or f"ID-{obj.student.id}"
    
    class Meta:
        model = StudentAttendance
        fields = [
            'id', 'student', 'student_name', 'student_father_name', 'student_code', 'student_gender', 'student_photo',
            'status', 'remarks', 'attendance_date', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AttendanceSerializer(serializers.ModelSerializer):
    classroom_name = serializers.CharField(source='classroom.__str__', read_only=True)
    classroom_code = serializers.CharField(source='classroom.code', read_only=True)
    marked_by_name = serializers.SerializerMethodField()
    student_attendance = StudentAttendanceSerializer(source='student_attendances', many=True, read_only=True)
    is_weekend = serializers.SerializerMethodField()
    is_holiday = serializers.SerializerMethodField()
    display_status = serializers.SerializerMethodField()
    
    # Both were missing: excused_count is a real counter on the model, and
    # attendance_percentage is the model property that owns the formula. Callers
    # reading `attendance_percentage` off this payload were getting undefined and
    # falling back to 0, so the coordinator's register always showed 0%.
    attendance_percentage = serializers.FloatField(read_only=True)

    class Meta:
        model = Attendance
        fields = [
            'id', 'classroom', 'classroom_name', 'classroom_code',
            'date', 'marked_by', 'marked_by_name',
            'total_students', 'present_count', 'absent_count', 'late_count',
            'leave_count', 'excused_count', 'attendance_percentage',
            # Workflow timestamps: the coordinator's register shows when a
            # teacher handed the class in, and these are the only source for it.
            'submitted_at', 'reviewed_at', 'finalized_at',
            'student_attendance', 'created_at', 'updated_at', 'status', 'display_status',
            'is_weekend', 'is_holiday'
        ]
        read_only_fields = [
            'id', 'total_students', 'present_count', 'absent_count', 'late_count',
            'created_at', 'updated_at'
        ]
    
    def get_marked_by_name(self, obj):
        if obj.marked_by:
            return obj.marked_by.get_full_name()
        return None
    
    def get_is_weekend(self, obj):
        """Check if the date is a Sunday (weekend)"""
        return obj.date.weekday() == 6  # Sunday is 6 in Python's weekday()
    
    def get_is_holiday(self, obj):
        """Check if the date is a holiday for this level"""
        try:
            from .models import Holiday
            level = obj.classroom.grade.level
            return Holiday.objects.filter(
                date=obj.date,
                level=level
            ).exists()
        except:
            return False
    
    def get_display_status(self, obj):
        """Return display status based on user role"""
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            # Default to showing actual status if no user context
            return obj.status
        
        user = request.user
        
        # Map status to display labels based on user role
        if obj.status == 'approved':
            return 'Approved'
        elif obj.status == 'under_review':
            if user.is_teacher():
                return 'Marked (Under Review)'
            elif user.is_coordinator() or user.is_principal() or user.is_superadmin():
                return 'Marked'
            else:
                return 'Under Review'
        elif obj.status == 'submitted':
            # Legacy support
            if user.is_teacher():
                return 'Submitted'
            else:
                return 'Marked'
        elif obj.status == 'draft':
            # Legacy support
            return 'Draft'
        else:
            return obj.status
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        return data


class AttendanceMarkingSerializer(serializers.Serializer):
    """
    Serializer for marking attendance
    """
    classroom_id = serializers.IntegerField()
    date = serializers.DateField()
    student_attendance = serializers.ListField(
        child=serializers.DictField(),
        help_text="List of student attendance records"
    )
    
    def validate_classroom_id(self, value):
        try:
            ClassRoom.objects.get(id=value)
        except ClassRoom.DoesNotExist:
            raise serializers.ValidationError("Classroom does not exist")
        return value
    
    def validate_student_attendance(self, value):
        required_fields = ['student_id', 'status']
        for record in value:
            for field in required_fields:
                if field not in record:
                    raise serializers.ValidationError(f"Missing required field: {field}")
            
            if record['status'] not in ['present', 'absent', 'late', 'excused']:
                raise serializers.ValidationError("Invalid status value")
        
        return value


class AttendanceSummarySerializer(serializers.Serializer):
    """
    Serializer for attendance summary statistics
    """
    classroom_id = serializers.IntegerField()
    classroom_name = serializers.CharField()
    date = serializers.DateField()
    total_students = serializers.IntegerField()
    present_count = serializers.IntegerField()
    absent_count = serializers.IntegerField()
    late_count = serializers.IntegerField()
    attendance_percentage = serializers.FloatField()



class StaffAttendanceSerializer(serializers.ModelSerializer):
    staff_name     = serializers.CharField(source='user.get_full_name', read_only=True)
    staff_role     = serializers.CharField(source='user.role', read_only=True)
    staff_photo    = serializers.ImageField(source='user.photo', read_only=True)
    employee_code  = serializers.CharField(source='user.employee_code', read_only=True)
    campus_name    = serializers.SerializerMethodField()
    marked_by_name = serializers.SerializerMethodField()
    working_hours_display = serializers.SerializerMethodField()

    class Meta:
        model = StaffAttendance
        fields = [
            'id', 'user', 'staff_name', 'staff_role', 'staff_photo', 'employee_code',
            'campus', 'campus_name', 'date',
            'check_in_time', 'check_out_time', 'working_hours', 'working_hours_display',
            'status', 'late_minutes', 'late_formatted', 'source', 'device',
            'marked_by', 'marked_by_name', 'remarks',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'working_hours']

    def get_campus_name(self, obj):
        return obj.campus.campus_name if obj.campus else None

    def get_marked_by_name(self, obj):
        if obj.marked_by:
            return obj.marked_by.get_full_name() or obj.marked_by.username
        return None

    def get_working_hours_display(self, obj):
        if not obj.working_hours:
            return None
        total = int(obj.working_hours.total_seconds())
        h, m = divmod(total // 60, 60)
        return f"{h}h {m}m"


class ZKTecoDeviceSerializer(serializers.ModelSerializer):
    campus_name = serializers.SerializerMethodField()
    mapping_count = serializers.SerializerMethodField()

    class Meta:
        model = ZKTecoDevice
        fields = [
            'id', 'name', 'ip_address', 'port', 'serial_number',
            'device_model', 'campus', 'campus_name', 'is_active',
            'last_sync', 'created_at', 'mapping_count',
        ]
        read_only_fields = ['id', 'created_at', 'last_sync']

    def get_campus_name(self, obj):
        return obj.campus.campus_name if obj.campus else None

    def get_mapping_count(self, obj):
        return obj.employee_mappings.filter(is_active=True).count()


class ZKTecoMappingSerializer(serializers.ModelSerializer):
    staff_name   = serializers.SerializerMethodField()
    staff_role   = serializers.SerializerMethodField()
    device_name  = serializers.SerializerMethodField()
    employee_code = serializers.SerializerMethodField()

    class Meta:
        model = ZKTecoEmployeeMapping
        fields = [
            'id', 'device', 'device_name', 'device_user_id', 'device_user_name',
            'user', 'staff_name', 'staff_role', 'employee_code', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'employee_code']

    def get_staff_name(self, obj):
        return obj.user.get_full_name() if obj.user else (obj.teacher.full_name if obj.teacher else None)

    def get_staff_role(self, obj):
        return obj.user.get_role_display() if obj.user else "Teacher"

    def get_device_name(self, obj):
        return obj.device.name if obj.device else None

    def get_employee_code(self, obj):
        if obj.employee_code:
            return obj.employee_code
        if obj.user:
            return obj.user.employee_code
        if obj.teacher:
            return obj.teacher.employee_code
        return ""

    def validate(self, data):
        teacher = data.get('teacher')
        if teacher:
            data['employee_code'] = teacher.employee_code or ''
        return data




class EmployeeShiftTimingSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)
    employee_code = serializers.CharField(source='teacher.employee_code', read_only=True)

    class Meta:
        model = EmployeeShiftTiming
        fields = ['id', 'teacher', 'teacher_name', 'employee_code', 'check_in_time', 'check_out_time', 'grace_minutes', 'is_active']
