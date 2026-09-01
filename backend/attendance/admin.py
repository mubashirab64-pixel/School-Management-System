from django.contrib import admin
from django.utils.html import format_html
from .models import Attendance, StudentAttendance, Weekend, Holiday, ZKTecoDevice, ZKTecoEmployeeMapping, StaffAttendance, EmployeeShiftTiming


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = [
        'classroom', 'organization', 'date', 'get_status_display_colored', 'marked_by', 'total_students', 
        'present_count', 'absent_count', 'leave_count', 'created_at'
    ]
    
    def get_status_display_colored(self, obj):
        """Display status with color coding"""
        status_colors = {
            'draft': '#808080',  # gray
            'submitted': '#0066CC',  # blue
            'under_review': '#FF8C00',  # orange
            'approved': '#008000',  # green
        }
        color = status_colors.get(obj.status, '#808080')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    get_status_display_colored.short_description = 'Status'
    get_status_display_colored.admin_order_field = 'status'
    
    list_filter = ['organization', 'status', 'date', 'classroom__grade__level__campus', 'classroom__grade', 'marked_by']
    search_fields = ['classroom__code', 'marked_by__full_name']
    readonly_fields = ['total_students', 'present_count', 'absent_count', 'leave_count', 'created_at', 'updated_at']
    date_hierarchy = 'date'
    ordering = ['-date', 'classroom']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('classroom', 'date', 'marked_by', 'status')
        }),
        ('Attendance Summary', {
            'fields': ('total_students', 'present_count', 'absent_count', 'leave_count'),
            'classes': ('collapse',)
        }),
        ('Status Details', {
            'fields': ('submitted_at', 'submitted_by', 'reviewed_at', 'reviewed_by', 'finalized_at', 'finalized_by'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(StudentAttendance)
class StudentAttendanceAdmin(admin.ModelAdmin):
    list_display = [
        'student', 'organization', 'attendance', 'status', 'remarks', 'created_at'
    ]
    list_filter = ['organization', 'status', 'attendance__date', 'attendance__classroom']
    search_fields = ['student__name', 'student__student_code', 'remarks']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['attendance__date', 'student__name']
    
    fieldsets = (
        ('Student Information', {
            'fields': ('student', 'attendance')
        }),
        ('Attendance Details', {
            'fields': ('status', 'remarks')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('student', 'attendance', 'attendance__classroom')


@admin.register(Weekend)
class WeekendAdmin(admin.ModelAdmin):
    list_display = ['date', 'organization', 'level', 'created_by', 'created_at']
    list_filter = ['organization', 'level__campus', 'level', 'date']
    search_fields = ['level__name']
    date_hierarchy = 'date'
    ordering = ['-date', 'level']
    readonly_fields = ['created_at']


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ['date', 'organization', 'reason', 'level', 'created_by', 'created_at', 'updated_at']
    list_filter = ['organization', 'level__campus', 'level', 'date', 'created_at']
    search_fields = ['reason', 'level__name']
    date_hierarchy = 'date'
    ordering = ['-date', 'level']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Holiday Information', {
            'fields': ('date', 'reason', 'level')
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(StaffAttendance)
class StaffAttendanceAdmin(admin.ModelAdmin):
    list_display = ['user', 'date', 'status', 'source', 'check_in_time', 'check_out_time', 'late_minutes', 'marked_by', 'organization']
    list_filter  = ['organization', 'status', 'source', 'date', 'campus']
    search_fields = ['user__first_name', 'user__last_name', 'user__username']
    date_hierarchy = 'date'
    ordering = ['-date', 'user__first_name']
    readonly_fields = ['working_hours', 'created_at', 'updated_at']


@admin.register(ZKTecoDevice)
class ZKTecoDeviceAdmin(admin.ModelAdmin):
    list_display = ['name', 'ip_address', 'serial_number', 'device_model', 'campus', 'organization', 'is_active', 'last_sync', 'created_at']
    list_filter = ['organization', 'campus', 'is_active']
    search_fields = ['name', 'ip_address', 'serial_number', 'device_model']
    readonly_fields = ['created_at', 'updated_at', 'last_sync']
    ordering = ['name']

    fieldsets = (
        ('Device Info', {
            'fields': ('name', 'ip_address', 'port', 'serial_number', 'device_model')
        }),
        ('Assignment', {
            'fields': ('organization', 'campus', 'is_active')
        }),
        ('Timestamps', {
            'fields': ('last_sync', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ZKTecoEmployeeMapping)
class ZKTecoEmployeeMappingAdmin(admin.ModelAdmin):
    list_display = ['device_user_id', 'device_user_name', 'device', 'user', 'employee_code', 'organization', 'is_active', 'created_at']
    list_filter = ['organization', 'device', 'is_active']
    search_fields = ['device_user_id', 'device_user_name', 'employee_code', 'user__first_name']
    readonly_fields = ['created_at', 'updated_at', 'employee_code']
    ordering = ['device', 'device_user_id']

    fieldsets = (
        ('Device User', {
            'fields': ('device', 'device_user_id', 'device_user_name')
        }),
        ('Linked Staff', {
            'fields': ('user', 'employee_code')
        }),
        ('Meta', {
            'fields': ('organization', 'is_active', 'created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )



@admin.register(EmployeeShiftTiming)
class EmployeeShiftTimingAdmin(admin.ModelAdmin):
    list_display = ['user', 'check_in_time', 'check_out_time', 'grace_minutes', 'organization', 'is_active']
    list_filter = ['organization', 'is_active']
    search_fields = ['user__first_name', 'user__last_name']
    readonly_fields = ['created_at', 'updated_at']

