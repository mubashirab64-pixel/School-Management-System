from rest_framework import serializers
from .models import SchoolSettings, RetestSchedule, RetestResult


class SchoolSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolSettings
        fields = ['id', 'campus', 'retest_policy', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class RetestScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = RetestSchedule
        fields = [
            'id', 'exam_type', 'month', 'academic_year', 'classroom', 'subject_name',
            'subject', 'original_result', 'scheduled_date', 'scheduled_time', 'venue',
            'reason', 'created_by', 'status', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'status', 'created_at', 'updated_at']


class RetestResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = RetestResult
        fields = [
            'id', 'retest_schedule', 'original_result', 'student', 'subject_name',
            'exam_type', 'month', 'academic_year', 'marks_obtained', 'total_marks',
            'is_absent', 'pass_status', 'status', 'created_by',
            'coordinator_approved_by', 'principal_approved_by',
            'coordinator_approved_at', 'principal_approved_at',
            'reject_reason', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'pass_status', 'status', 'created_by',
            'coordinator_approved_by', 'principal_approved_by',
            'coordinator_approved_at', 'principal_approved_at',
            'created_at', 'updated_at',
        ]
