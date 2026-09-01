from django.contrib import admin
from .models import SchoolSettings, RetestSchedule, RetestResult


@admin.register(SchoolSettings)
class SchoolSettingsAdmin(admin.ModelAdmin):
    list_display = ['campus', 'retest_policy', 'updated_at']
    list_filter = ['retest_policy']


@admin.register(RetestSchedule)
class RetestScheduleAdmin(admin.ModelAdmin):
    list_display = ['subject_name', 'exam_type', 'scheduled_date', 'reason', 'status', 'created_by']
    list_filter = ['exam_type', 'status', 'reason']
    search_fields = ['subject_name']


@admin.register(RetestResult)
class RetestResultAdmin(admin.ModelAdmin):
    list_display = ['student', 'subject_name', 'exam_type', 'marks_obtained', 'pass_status', 'status']
    list_filter = ['exam_type', 'pass_status', 'status']
    search_fields = ['student__name', 'subject_name']
