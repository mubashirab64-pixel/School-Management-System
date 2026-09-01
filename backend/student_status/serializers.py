# serializers.py
from rest_framework import serializers
from .models import ExitRecord

class ExitRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.name", read_only=True)
    recorded_by_name = serializers.CharField(source="recorded_by.username", read_only=True)

    class Meta:
        model = ExitRecord
        fields = [
            "id",
            "student",
            "student_name",
            "reason",
            "date_of_exit",
            "recorded_by",
            "recorded_by_name",
            "certificate",
        ]
        read_only_fields = ["certificate"]
