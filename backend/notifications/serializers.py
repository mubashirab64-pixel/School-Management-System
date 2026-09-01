from rest_framework import serializers
from .models import Notification, Announcement


class NotificationSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'actor', 'actor_name', 'verb', 'target_text', 'data', 'unread', 'timestamp'
        ]
        read_only_fields = ['id', 'recipient', 'actor_name', 'timestamp']

    def get_actor_name(self, obj):
        try:
            return str(obj.actor)
        except Exception:
            return None


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    campus_name = serializers.CharField(source='campus.campus_name', read_only=True)

    class Meta:
        model = Announcement
        fields = [
            'id', 'title', 'body', 'priority', 'audience',
            'campus', 'campus_name', 'is_active', 'expires_at',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
