from rest_framework import serializers
from .models import Principal
from campus.serializers import CampusSerializer


class PrincipalSerializer(serializers.ModelSerializer):
    # Nested serializers for related objects
    campus_data = CampusSerializer(source='campus', read_only=True)

    # Computed fields
    campus_name  = serializers.CharField(source='campus.campus_name', read_only=True)
    shift_display = serializers.CharField(source='get_shift_display', read_only=True)

    class Meta:
        model = Principal
        fields = [
            'id', 'user', 'organization', 'photo', 'full_name', 'father_name', 'dob', 'gender',
            'contact_number', 'emergency_contact', 'email', 'cnic', 'nationality', 'religion',
            'permanent_address', 'marital_status', 'education_level', 'degree_title',
            'institution_name', 'year_of_passing', 'total_experience_years', 'specialization',
            'previous_organization', 'previous_designation', 'license_number', 'designation',
            'campus', 'campus_data', 'campus_name', 'shift', 'shift_display',
            'contract_type', 'contract_end_date', 'joining_date',
            'status', 'is_currently_active', 'employee_code',
            'signature', 'signature_updated_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'organization', 'created_at', 'updated_at']

    def validate_email(self, value):
        """Check if email is already in use by another user account"""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Check if email exists for another user
        user_qs = User.objects.filter(email__iexact=value)
        if self.instance:
            if self.instance.user:
                user_qs = user_qs.exclude(pk=self.instance.user.pk)
            elif self.instance.email.lower() == value.lower():
                return value
            
        if user_qs.exists():
            raise serializers.ValidationError("This email is already in use by another user account.")
        return value

    def validate_cnic(self, value):
        """Check if CNIC is already in use by another active principal"""
        from .models import Principal
        from django.db.models import Q
        
        qs = Principal.objects.filter(cnic=value, is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
            
        if qs.exists():
            raise serializers.ValidationError("This CNIC is already registered with another active principal.")
        return value

    def validate_employee_code(self, value):
        """Check if employee code is already in use"""
        if not value:
            return value
            
        from .models import Principal
        qs = Principal.objects.filter(employee_code=value, is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
            
        if qs.exists():
            raise serializers.ValidationError("This employee code is already in use.")
        return value

    def to_representation(self, instance):
        """Convert photo to absolute URL in every response (GET, PATCH, PUT)."""
        rep = super().to_representation(instance)
        request = self.context.get('request')
        if instance.photo:
            url = instance.photo.url
            rep['photo'] = request.build_absolute_uri(url) if request else url
        else:
            rep['photo'] = None
        return rep
