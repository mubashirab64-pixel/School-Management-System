from django.contrib import admin
from .models import Campus

@admin.register(Campus)
class CampusAdmin(admin.ModelAdmin):
    list_display = ('campus_name', 'campus_code', 'organization', 'city', 'status', 'shift_available')
    list_filter = ('organization', 'status', 'city', 'shift_available')
    search_fields = ('campus_name', 'campus_code', 'city')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('campus_photo', 'campus_id', 'campus_name', 'campus_code', 'status', 'governing_body', 'registration_number', 'established_year')
        }),
        ('Location', {
            'fields': ('city', 'postal_code', 'district', 'address_full')
        }),
        ('Academic', {
            'fields': ('shift_available', 'instruction_language', 'academic_year_start_month', 'academic_year_end_month')
        }),
        ('Infrastructure - Rooms', {
            'fields': ('total_classrooms', 'total_staff_rooms', 'has_computer_lab', 'has_science_lab', 'has_biology_lab', 'has_chemistry_lab', 'has_physics_lab', 'total_rooms', 'library_available')
        }),

        ('Facilities', {
            'fields': ('power_backup', 'internet_available', 'teacher_transport', 'student_transport', 'canteen_facility', 'meal_program')
        }),
        ('Grades', {
            'fields': ('grades_data',),
            'classes': ('collapse',)
        }),
        ('Sports', {
            'fields': ('sports_available',)
        }),
        ('Contact', {
            'fields': ('primary_phone', 'secondary_phone', 'official_email')
        }),
        ('Campus Head', {
            'fields': ('campus_head_name', 'campus_head_phone', 'campus_head_email')
        }),
        ('System', {
            'fields': ('created_at', 'updated_at', 'is_draft'),
            'classes': ('collapse',)
        })
    )

    readonly_fields = ('campus_id', 'total_rooms', 'created_at', 'updated_at')
    list_editable = ('status',)
