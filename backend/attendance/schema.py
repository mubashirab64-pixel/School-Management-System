import graphene
from graphene_django import DjangoObjectType
from graphene_django.filter import DjangoFilterConnectionField
from graphene import relay
from django.contrib.auth import get_user_model
from .models import Attendance, StudentAttendance
from students.models import Student
from classes.models import ClassRoom
from teachers.models import Teacher
from coordinator.models import Coordinator
from principals.models import Principal
from django.db.models import Q
from datetime import datetime, timedelta
# import graphql_jwt  # Commented out - not compatible with Django 5.0

User = get_user_model()


# ============================
# Types
# ============================

class StudentAttendanceType(DjangoObjectType):
    """GraphQL type for StudentAttendance"""
    student_name = graphene.String()
    student_code = graphene.String()
    student_photo = graphene.String()
    is_editable = graphene.Boolean()
    
    class Meta:
        model = StudentAttendance
        fields = "__all__"
        interfaces = (relay.Node,)
        filter_fields = {
            'status': ['exact', 'in'],
            'attendance__date': ['exact', 'gte', 'lte'],
            'student__name': ['icontains'],
        }
    
    def resolve_student_name(self, info):
        return self.student.name
    
    def resolve_student_code(self, info):
        return self.student.student_code
    
    def resolve_student_photo(self, info):
        if self.student.photo:
            return info.context.build_absolute_uri(self.student.photo.url)
        return None
    
    def resolve_is_editable(self, info):
        return self.attendance.is_editable


class AttendanceType(DjangoObjectType):
    """GraphQL type for Attendance"""
    student_attendances = DjangoFilterConnectionField(StudentAttendanceType)
    classroom_name = graphene.String()
    marked_by_name = graphene.String()
    attendance_percentage = graphene.Float()
    is_editable = graphene.Boolean()
    edit_history = graphene.List(graphene.JSONString)
    
    class Meta:
        model = Attendance
        fields = "__all__"
        interfaces = (relay.Node,)
        filter_fields = {
            'classroom__id': ['exact'],
            'date': ['exact', 'gte', 'lte'],
            'marked_by__id': ['exact'],
            'is_deleted': ['exact'],
        }
    
    def resolve_classroom_name(self, info):
        return str(self.classroom)
    
    def resolve_marked_by_name(self, info):
        if self.marked_by:
            return self.marked_by.get_full_name() or self.marked_by.username
        return None
    
    def resolve_attendance_percentage(self, info):
        return self.attendance_percentage
    
    def resolve_is_editable(self, info):
        return self.is_editable
    
    def resolve_edit_history(self, info):
        return self.update_history


class AttendanceStatsType(graphene.ObjectType):
    """GraphQL type for attendance statistics"""
    total_days = graphene.Int()
    present_days = graphene.Int()
    absent_days = graphene.Int()
    late_days = graphene.Int()
    leave_days = graphene.Int()
    attendance_percentage = graphene.Float()
    consecutive_absent_days = graphene.Int()
    last_attendance_date = graphene.Date()
    monthly_stats = graphene.List(graphene.JSONString)


# ============================
# Queries
# ============================

class Query(graphene.ObjectType):
    """Attendance GraphQL Queries"""
    
    # Attendance queries
    all_attendances = DjangoFilterConnectionField(AttendanceType)
    attendance = relay.Node.Field(AttendanceType)
    classroom_attendances = DjangoFilterConnectionField(
        AttendanceType,
        classroom_id=graphene.Int(required=True),
        start_date=graphene.Date(),
        end_date=graphene.Date()
    )
    
    # Student attendance queries
    all_student_attendances = DjangoFilterConnectionField(StudentAttendanceType)
    student_attendance = relay.Node.Field(StudentAttendanceType)
    student_attendances = DjangoFilterConnectionField(
        StudentAttendanceType,
        student_id=graphene.Int(required=True),
        start_date=graphene.Date(),
        end_date=graphene.Date()
    )
    
    # Statistics queries
    attendance_stats = graphene.Field(
        AttendanceStatsType,
        classroom_id=graphene.Int(),
        student_id=graphene.Int(),
        start_date=graphene.Date(),
        end_date=graphene.Date()
    )
    
    # Teacher's classes for attendance
    teacher_classes = graphene.List(graphene.JSONString)
    
    def resolve_all_attendances(self, info, **kwargs):
        """Get all attendances with role-based filtering"""
        user = info.context.user
        if not user.is_authenticated:
            return Attendance.objects.none()
        
        queryset = Attendance.objects.filter(is_deleted=False)
        
        # Role-based filtering
        if user.is_superuser:
            return queryset
        
        # Teacher: only their classroom
        if hasattr(user, 'teacher') and user.teacher.assigned_classroom:
            return queryset.filter(classroom=user.teacher.assigned_classroom)
        
        # Coordinator: classrooms in their level
        if hasattr(user, 'coordinator') and user.coordinator.is_currently_active:
            return queryset.filter(
                classroom__grade__level=user.coordinator.level,
                classroom__campus=user.coordinator.campus
            )
        
        # Principal: classrooms in their campus
        if hasattr(user, 'principal') and user.principal.is_currently_active:
            return queryset.filter(classroom__campus=user.principal.campus)
        
        return Attendance.objects.none()
    
    def resolve_classroom_attendances(self, info, classroom_id, start_date=None, end_date=None, **kwargs):
        """Get attendances for a specific classroom"""
        user = info.context.user
        if not user.is_authenticated:
            return Attendance.objects.none()
        
        queryset = Attendance.objects.filter(
            classroom_id=classroom_id,
            is_deleted=False
        )
        
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)
        
        # Check permissions
        classroom = ClassRoom.objects.get(id=classroom_id)
        
        if user.is_superuser:
            return queryset
        
        # Teacher: only their classroom
        if hasattr(user, 'teacher') and user.teacher.assigned_classroom == classroom:
            return queryset
        
        # Coordinator: classrooms in their level
        if (hasattr(user, 'coordinator') and user.coordinator.is_currently_active and 
            user.coordinator.level == classroom.grade.level):
            return queryset
        
        # Principal: classrooms in their campus
        if (hasattr(user, 'principal') and user.principal.is_currently_active and 
            user.principal.campus == classroom.campus):
            return queryset
        
        return Attendance.objects.none()
    
    def resolve_student_attendances(self, info, student_id, start_date=None, end_date=None, **kwargs):
        """Get attendances for a specific student"""
        user = info.context.user
        if not user.is_authenticated:
            return StudentAttendance.objects.none()
        
        queryset = StudentAttendance.objects.filter(
            student_id=student_id,
            is_deleted=False
        )
        
        if start_date:
            queryset = queryset.filter(attendance__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(attendance__date__lte=end_date)
        
        # Check permissions
        student = Student.objects.get(id=student_id)
        
        if user.is_superuser:
            return queryset
        
        # Teacher: only their classroom's students
        if (hasattr(user, 'teacher') and user.teacher.assigned_classroom and 
            student.classroom == user.teacher.assigned_classroom):
            return queryset
        
        # Coordinator: students in their level
        if (hasattr(user, 'coordinator') and user.coordinator.is_currently_active and 
            student.classroom.grade.level == user.coordinator.level):
            return queryset
        
        # Principal: students in their campus
        if (hasattr(user, 'principal') and user.principal.is_currently_active and 
            student.classroom.campus == user.principal.campus):
            return queryset
        
        return StudentAttendance.objects.none()
    
    def resolve_attendance_stats(self, info, classroom_id=None, student_id=None, start_date=None, end_date=None, **kwargs):
        """Get attendance statistics"""
        user = info.context.user
        if not user.is_authenticated:
            return None
        
        # Set default date range if not provided
        if not start_date:
            start_date = datetime.now().date() - timedelta(days=30)
        if not end_date:
            end_date = datetime.now().date()
        
        if student_id:
            # Student statistics
            student = Student.objects.get(id=student_id)
            attendances = StudentAttendance.objects.filter(
                student=student,
                attendance__date__range=[start_date, end_date],
                is_deleted=False
            )
            
            total_days = attendances.count()
            present_days = attendances.filter(status='present').count()
            absent_days = attendances.filter(status='absent').count()
            late_days = attendances.filter(status='late').count()
            leave_days = attendances.filter(status='leave').count()
            
            # Calculate consecutive absent days
            consecutive_absent = 0
            for attendance in attendances.filter(status='absent').order_by('-attendance__date'):
                if attendance.attendance.date == (datetime.now().date() - timedelta(days=consecutive_absent)):
                    consecutive_absent += 1
                else:
                    break
            
            # Get last attendance date
            last_attendance = attendances.order_by('-attendance__date').first()
            last_attendance_date = last_attendance.attendance.date if last_attendance else None
            
            attendance_percentage = (present_days / total_days * 100) if total_days > 0 else 0
            
            return AttendanceStatsType(
                total_days=total_days,
                present_days=present_days,
                absent_days=absent_days,
                late_days=late_days,
                leave_days=leave_days,
                attendance_percentage=round(attendance_percentage, 2),
                consecutive_absent_days=consecutive_absent,
                last_attendance_date=last_attendance_date,
                monthly_stats=[]
            )
        
        elif classroom_id:
            # Classroom statistics
            classroom = ClassRoom.objects.get(id=classroom_id)
            attendances = Attendance.objects.filter(
                classroom=classroom,
                date__range=[start_date, end_date],
                is_deleted=False
            )
            
            total_days = attendances.count()
            total_present = sum(att.present_count for att in attendances)
            total_absent = sum(att.absent_count for att in attendances)
            total_late = sum(att.late_count for att in attendances)
            total_leave = sum(att.leave_count for att in attendances)
            
            attendance_percentage = (total_present / (total_present + total_absent) * 100) if (total_present + total_absent) > 0 else 0
            
            return AttendanceStatsType(
                total_days=total_days,
                present_days=total_present,
                absent_days=total_absent,
                late_days=total_late,
                leave_days=total_leave,
                attendance_percentage=round(attendance_percentage, 2),
                consecutive_absent_days=0,
                last_attendance_date=None,
                monthly_stats=[]
            )
        
        return None
    
    def resolve_teacher_classes(self, info):
        """Get classes assigned to the current teacher with students"""
        user = info.context.user
        if not user.is_authenticated or not hasattr(user, 'teacher'):
            return []
        
        teacher = user.teacher
        if not teacher.assigned_classroom:
            return []
        
        classroom = teacher.assigned_classroom
        students = Student.objects.filter(classroom=classroom, is_deleted=False)
        
        return [{
            'id': classroom.id,
            'name': str(classroom),
            'code': classroom.code,
            'grade': classroom.grade.name,
            'section': classroom.section,
            'shift': classroom.shift,
            'campus': classroom.campus.campus_name if classroom.campus else None,
            'students': [
                {
                    'id': s.id,
                    'name': s.name,
                    'student_code': s.student_code,
                    'gr_no': s.gr_no,
                    'photo': info.context.build_absolute_uri(s.photo.url) if s.photo else None,
                    'gender': s.gender
                }
                for s in students
            ]
        }]


# ============================
# Mutations
# ============================

class MarkAttendanceInput(graphene.InputObjectType):
    """Input for marking attendance"""
    classroom_id = graphene.Int(required=True)
    date = graphene.Date(required=True)
    student_attendance = graphene.List(graphene.JSONString, required=True)


class EditAttendanceInput(graphene.InputObjectType):
    """Input for editing attendance"""
    attendance_id = graphene.Int(required=True)
    student_attendance = graphene.List(graphene.JSONString, required=True)
    reason = graphene.String()


class MarkAttendance(graphene.Mutation):
    """Mutation for marking attendance"""
    
    class Arguments:
        input = MarkAttendanceInput(required=True)
    
    success = graphene.Boolean()
    message = graphene.String()
    attendance = graphene.Field(AttendanceType)
    
    def mutate(self, info, input):
        user = info.context.user
        if not user.is_authenticated:
            return MarkAttendance(success=False, message="Authentication required")
        
        try:
            # Validate classroom exists
            try:
                classroom = ClassRoom.objects.get(id=input.classroom_id)
            except ClassRoom.DoesNotExist:
                return MarkAttendance(success=False, message=f"Classroom with ID {input.classroom_id} not found")
            
            # Check permissions
            if not self._can_mark_attendance(user, classroom):
                return MarkAttendance(success=False, message="Permission denied: You don't have access to mark attendance for this classroom")
            
            # Validate date (not in future)
            from datetime import date
            if input.date > date.today():
                return MarkAttendance(success=False, message="Cannot mark attendance for future dates")
            
            # Validate student data
            if not input.student_attendance or len(input.student_attendance) == 0:
                return MarkAttendance(success=False, message="At least one student attendance record is required")
            
            # Validate all students exist and belong to this classroom
            from django.db import transaction
            with transaction.atomic():
                # Create or get attendance record
                attendance, created = Attendance.objects.get_or_create(
                    classroom=classroom,
                    date=input.date,
                    defaults={
                        'marked_by': user,
                        'created_by': user
                    }
                )
                
                if not created:
                    # Update existing record
                    attendance.marked_by = user
                    attendance.updated_by = user
                    attendance.save()
                
                # Clear existing student attendance records
                attendance.student_attendances.all().delete()
                
                # Create new student attendance records
                for student_data in input.student_attendance:
                    try:
                        student = Student.objects.get(id=student_data['student_id'])
                        
                        # Validate student belongs to this classroom
                        if student.classroom != classroom:
                            raise ValueError(f"Student {student.name} does not belong to this classroom")
                        
                        StudentAttendance.objects.create(
                            attendance=attendance,
                            student=student,
                            status=student_data['status'],
                            remarks=student_data.get('remarks', ''),
                            created_by=user
                        )
                    except Student.DoesNotExist:
                        raise ValueError(f"Student with ID {student_data['student_id']} not found")
                
                # Update attendance summary
                attendance.update_counts()
            
            return MarkAttendance(
                success=True,
                message="Attendance marked successfully",
                attendance=attendance
            )
            
        except ValueError as ve:
            return MarkAttendance(success=False, message=str(ve))
        except Exception as e:
            return MarkAttendance(success=False, message=f"An error occurred: {str(e)}")
    
    def _can_mark_attendance(self, user, classroom):
        """Check if user can mark attendance for this classroom"""
        if user.is_superuser:
            return True
        
        # Teacher: only their classroom
        if hasattr(user, 'teacher') and user.teacher.assigned_classroom == classroom:
            return True
        
        # Coordinator: classrooms in their level
        if (hasattr(user, 'coordinator') and user.coordinator.is_currently_active and 
            user.coordinator.level == classroom.grade.level):
            return True
        
        # Principal: classrooms in their campus
        if (hasattr(user, 'principal') and user.principal.is_currently_active and 
            user.principal.campus == classroom.campus):
            return True
        
        return False


class EditAttendance(graphene.Mutation):
    """Mutation for editing attendance"""
    
    class Arguments:
        input = EditAttendanceInput(required=True)
    
    success = graphene.Boolean()
    message = graphene.String()
    attendance = graphene.Field(AttendanceType)
    
    def mutate(self, info, input):
        user = info.context.user
        if not user.is_authenticated:
            return EditAttendance(success=False, message="Authentication required")
        
        try:
            attendance = Attendance.objects.get(id=input.attendance_id)
            
            # Check permissions
            if not self._can_edit_attendance(user, attendance):
                return EditAttendance(success=False, message="Permission denied")
            
            # Check if editable
            if not attendance.is_editable and not self._can_edit_old_attendance(user, attendance):
                return EditAttendance(success=False, message="Attendance cannot be edited after 7 days")
            
            # Store old data for history
            old_data = {
                'present_count': attendance.present_count,
                'absent_count': attendance.absent_count,
                'late_count': attendance.late_count,
                'leave_count': attendance.leave_count
            }
            
            # Clear existing student attendance records
            attendance.student_attendances.all().delete()
            
            # Create new student attendance records
            for student_data in input.student_attendance:
                StudentAttendance.objects.create(
                    attendance=attendance,
                    student_id=student_data['student_id'],
                    status=student_data['status'],
                    remarks=student_data.get('remarks', ''),
                    created_by=user
                )
            
            # Update attendance summary
            attendance.update_counts()
            
            # Add edit history
            attendance.add_edit_history(
                user, 
                'edited', 
                input.reason,
                {'old_data': old_data, 'new_data': input.student_attendance}
            )
            
            return EditAttendance(
                success=True,
                message="Attendance updated successfully",
                attendance=attendance
            )
            
        except Exception as e:
            return EditAttendance(success=False, message=str(e))
    
    def _can_edit_attendance(self, user, attendance):
        """Check if user can edit this attendance"""
        if user.is_superuser:
            return True
        
        # Teacher: only their classroom
        if (hasattr(user, 'teacher') and user.teacher.assigned_classroom == 
            attendance.classroom):
            return True
        
        # Coordinator: classrooms in their level
        if (hasattr(user, 'coordinator') and user.coordinator.is_currently_active and 
            user.coordinator.level == attendance.classroom.grade.level):
            return True
        
        # Principal: classrooms in their campus
        if (hasattr(user, 'principal') and user.principal.is_currently_active and 
            user.principal.campus == attendance.classroom.campus):
            return True
        
        return False
    
    def _can_edit_old_attendance(self, user, attendance):
        """Check if user can edit old attendance (coordinator+)"""
        if user.is_superuser:
            return True
        
        # Coordinator: classrooms in their level
        if (hasattr(user, 'coordinator') and user.coordinator.is_currently_active and 
            user.coordinator.level == attendance.classroom.grade.level):
            return True
        
        # Principal: classrooms in their campus
        if (hasattr(user, 'principal') and user.principal.is_currently_active and 
            user.principal.campus == attendance.classroom.campus):
            return True
        
        return False


class DeleteAttendance(graphene.Mutation):
    """Mutation for deleting attendance"""
    
    class Arguments:
        attendance_id = graphene.Int(required=True)
        reason = graphene.String(required=True)
    
    success = graphene.Boolean()
    message = graphene.String()
    
    def mutate(self, info, attendance_id, reason):
        user = info.context.user
        if not user.is_authenticated:
            return DeleteAttendance(success=False, message="Authentication required")
        
        try:
            attendance = Attendance.objects.get(id=attendance_id)
            
            # Check permissions
            if not self._can_delete_attendance(user, attendance):
                return DeleteAttendance(success=False, message="Permission denied")
            
            # Soft delete
            attendance.soft_delete(user, reason)
            
            return DeleteAttendance(
                success=True,
                message="Attendance deleted successfully"
            )
            
        except Exception as e:
            return DeleteAttendance(success=False, message=str(e))
    
    def _can_delete_attendance(self, user, attendance):
        """Check if user can delete this attendance"""
        if user.is_superuser:
            return True
        
        # Coordinator: classrooms in their level
        if (hasattr(user, 'coordinator') and user.coordinator.is_currently_active and 
            user.coordinator.level == attendance.classroom.grade.level):
            return True
        
        # Principal: classrooms in their campus
        if (hasattr(user, 'principal') and user.principal.is_currently_active and 
            user.principal.campus == attendance.classroom.campus):
            return True
        
        return False


class Mutation(graphene.ObjectType):
    """Attendance GraphQL Mutations"""
    mark_attendance = MarkAttendance.Field()
    edit_attendance = EditAttendance.Field()
    delete_attendance = DeleteAttendance.Field()

