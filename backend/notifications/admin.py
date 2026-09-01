from django.contrib import admin
from .models import Notification, Announcement


# @admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'actor', 'verb', 'target_text', 'unread', 'timestamp')
    list_filter = ('unread',)
    search_fields = ('recipient__email', 'actor__email', 'verb', 'target_text')


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ('title', 'organization', 'campus', 'audience', 'priority', 'is_active', 'created_by', 'created_at')
    list_filter = ('priority', 'audience', 'is_active', 'campus')
    search_fields = ('title', 'body')
    autocomplete_fields = ()
