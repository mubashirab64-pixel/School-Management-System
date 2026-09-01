from django.contrib import admin
from .models import RequestComplaint, RequestComment, RequestStatusHistory

# @admin.register(RequestComplaint)
class RequestComplaintAdmin(admin.ModelAdmin):
    list_display = ['subject', 'teacher', 'coordinator', 'category', 'status', 'priority', 'created_at']
    list_filter = ['status', 'priority', 'category', 'created_at']
    search_fields = ['subject', 'description', 'teacher__full_name', 'coordinator__full_name']
    readonly_fields = ['created_at', 'updated_at', 'reviewed_at', 'resolved_at']
    
    fieldsets = (
        ('Request Details', {
            'fields': ('teacher', 'coordinator', 'category', 'subject', 'description')
        }),
        ('Status & Priority', {
            'fields': ('status', 'priority')
        }),
        ('Coordinator Response', {
            'fields': ('coordinator_notes', 'resolution_notes')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'reviewed_at', 'resolved_at'),
            'classes': ('collapse',)
        }),
    )

# @admin.register(RequestComment)
class RequestCommentAdmin(admin.ModelAdmin):
    list_display = ['request', 'user_type', 'created_at']
    list_filter = ['user_type', 'created_at']
    search_fields = ['comment', 'request__subject']

# @admin.register(RequestStatusHistory)
class RequestStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ['request', 'old_status', 'new_status', 'changed_by', 'changed_at']
    list_filter = ['new_status', 'changed_by', 'changed_at']
    search_fields = ['request__subject', 'notes']
    readonly_fields = ['changed_at']
