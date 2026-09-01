from rest_framework import serializers
from .models import Coordinator
from classes.models import Grade, ClassRoom, Level
from teachers.models import Teacher
from students.models import Student


class CoordinatorSerializer(serializers.ModelSerializer):
    campus_name = serializers.CharField(source="campus.campus_name", read_only=True)
    level_name = serializers.CharField(source="level.name", read_only=True)
    assigned_levels = serializers.PrimaryKeyRelatedField(
        many=True, required=False, allow_empty=True, queryset=Level.objects.all()
    )
    assigned_levels_details = serializers.SerializerMethodField(read_only=True)
    photo = serializers.ImageField(required=False, allow_null=True)
    # Coordinator has no direct FK to its login User account — resolved by
    # email/employee_code, same lookup already used for the uniqueness check
    # below. The frontend needs this to fetch the coordinator's own staff
    # attendance (StaffAttendance is keyed by User, not by Coordinator).
    user_id = serializers.SerializerMethodField(read_only=True)

    def get_user_id(self, obj):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        linked_user = (
            User.objects.filter(email__iexact=obj.email).first()
            or User.objects.filter(username=obj.employee_code).first()
        )
        return linked_user.id if linked_user else None

    class Meta:
        model = Coordinator
        fields = [
            "id",
            "organization",
            "photo",
            "full_name",
            "dob",
            "gender",
            "contact_number",
            "email",
            "cnic",
            "permanent_address",
            "marital_status",
            "religion",
            "education_level",
            "institution_name",
            "year_of_passing",
            "total_experience_years",
            "campus",
            "campus_name",
            "level",
            "assigned_levels",
            "assigned_levels_details",
            "level_name",
            "shift",
            "joining_date",
            "is_currently_active",
            "can_assign_class_teachers",
            "employee_code",
            "user_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization", "created_at", "updated_at"]

    def validate_email(self, value):
        """Check if email is already in use by another user account"""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        # If updating and email hasn't changed, skip validation
        if self.instance and self.instance.email.lower() == value.lower():
            return value

        # Exclude the linked user account (looked up by email or employee_code)
        user_qs = User.objects.filter(email__iexact=value)
        if self.instance:
            linked_user = (
                User.objects.filter(email__iexact=self.instance.email).first()
                or User.objects.filter(username=self.instance.employee_code).first()
            )
            if linked_user:
                user_qs = user_qs.exclude(pk=linked_user.pk)

        if user_qs.exists():
            raise serializers.ValidationError("This email is already in use by another user account.")
        return value

    def validate_cnic(self, value):
        """Check if CNIC is already in use by another active coordinator"""
        from .models import Coordinator
        qs = Coordinator.objects.filter(cnic=value, is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
            
        if qs.exists():
            raise serializers.ValidationError("This CNIC is already registered with another active coordinator.")
        return value

    def get_assigned_levels_details(self, obj):
        levels = getattr(obj, 'assigned_levels', None)
        if not levels:
            return []
        try:
            qs = obj.assigned_levels.all()
            return [
                {
                    'id': lvl.id,
                    'name': lvl.name,
                    'shift': lvl.shift,
                    'shift_display': lvl.get_shift_display(),
                    'code': lvl.code,
                }
                for lvl in qs
            ]
        except Exception:
            return []
