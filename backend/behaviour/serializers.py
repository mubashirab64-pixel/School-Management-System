from rest_framework import serializers
from .models import StudentBehaviourRecord, StudentEventParticipation, MonthlyBehaviourRecord


class StudentEventParticipationSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentEventParticipation
        fields = ["id", "date", "name", "progress", "award"]


class StudentBehaviourRecordSerializer(serializers.ModelSerializer):
    events = StudentEventParticipationSerializer(many=True, required=False)

    class Meta:
        model = StudentBehaviourRecord
        fields = [
            "id",
            "student",
            "week_start",
            "week_end",
            "metrics",
            "notes",
            "created_at",
            "events",
        ]
        read_only_fields = ["created_at"]

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request.user, 'organization'):
            validated_data['organization'] = request.user.organization
            
        events_data = validated_data.pop("events", [])
        record = StudentBehaviourRecord.objects.create(**validated_data)
        for ev in events_data:
            StudentEventParticipation.objects.create(record=record, **ev)
        return record


class MonthlyBehaviourRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MonthlyBehaviourRecord
        fields = [
            "id",
            "student",
            "month",
            "metrics",
            "source_range_start",
            "source_range_end",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]



