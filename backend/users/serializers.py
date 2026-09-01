from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, RolePermission, Organization, SubscriptionPlan, SystemVersion
from campus.models import Campus


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    """
    Serializer for SubscriptionPlan model
    """
    class Meta:
        model = SubscriptionPlan
        fields = [
            'id', 'name', 'max_users', 'max_students', 'max_campuses', 
            'description', 'price_per_student', 'price_per_user', 'base_price', 'is_enterprise', 'is_active', 'created_by'
        ]


class OrganizationSerializer(serializers.ModelSerializer):
    """
    Organization serializer for CRUD operations
    """
    used_users = serializers.SerializerMethodField()
    used_students = serializers.SerializerMethodField()
    used_campuses = serializers.SerializerMethodField()
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    plan_details = SubscriptionPlanSerializer(source='plan', read_only=True)
    
    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'subdomain', 'plan', 'plan_name', 'plan_details',
            'max_users', 'max_students', 'max_campuses',
            'is_active', 'enabled_features', 'created_by', 'created_at', 'updated_at',
            'used_users', 'used_students', 'used_campuses',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']
    
    def get_used_users(self, obj):
        return obj.organization_users.exclude(role='student').count()
    
    def get_used_students(self, obj):
        return obj.students.count()
    
    def get_used_campuses(self, obj):
        return obj.campuses.count()


class OrganizationCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating an Organization + its first admin user
    """
    admin_email = serializers.EmailField(write_only=True)
    admin_password = serializers.CharField(write_only=True)
    admin_full_name = serializers.CharField(write_only=True, required=False, default='')
    
    class Meta:
        model = Organization
        fields = [
            'name', 'subdomain', 'plan', 'max_users', 'max_students', 'max_campuses',
            'admin_email', 'admin_password', 'admin_full_name', 'enabled_features'
        ]
    
    def create(self, validated_data):
        admin_email = validated_data.pop('admin_email')
        admin_password = validated_data.pop('admin_password')
        admin_full_name = validated_data.pop('admin_full_name', '')
        
        # If a plan is provided, set quotas from plan
        plan = validated_data.get('plan')
        if plan:
            validated_data['max_users'] = plan.max_users
            validated_data['max_students'] = plan.max_students
            validated_data['max_campuses'] = plan.max_campuses
        
        # Set creator from request context
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user

        # Create the organization
        org = Organization.objects.create(**validated_data)
        
        # Create the org admin user
        name_parts = admin_full_name.split(' ', 1) if admin_full_name else ['', '']
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ''
        
        user = User.objects.create_user(
            username=admin_email,
            email=admin_email,
            password=admin_password,
            first_name=first_name,
            last_name=last_name,
            role='org_admin',
            is_org_admin=True,
            organization=org,
            has_changed_default_password=True,
        )
        
        return org

class CampusSerializer(serializers.ModelSerializer):
    """
    Campus serializer for nested serialization
    """
    class Meta:
        model = Campus
        fields = ['id', 'campus_name', 'campus_code']

class UserSerializer(serializers.ModelSerializer):
    """
    User serializer for general use
    """
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    campus_name = serializers.CharField(source='campus.name', read_only=True)
    campus = CampusSerializer(read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    organization_data = OrganizationSerializer(source='organization', read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'role_display', 'campus', 'campus_name',
            'organization', 'organization_name', 'organization_data',
            'phone_number', 'photo', 'is_verified', 'is_active',
            'last_login', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'last_login', 'created_at', 'updated_at']

class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    User registration serializer
    """
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'first_name', 'last_name',
            'role', 'campus', 'organization', 'phone_number', 'is_active', 'password', 'password_confirm'
        ]
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs
    
    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User with this email already exists")
        return value
    
    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("User with this username already exists")
        return value
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        
        from utils.id_generator import IDGenerator
        
        # Auto-set flags based on role
        if validated_data.get('role') == 'org_admin':
            validated_data['is_org_admin'] = True
            validated_data['has_changed_default_password'] = True
            # Generate OA- code
            if not validated_data.get('username') or '@' in validated_data.get('username', ''):
                try:
                    validated_data['username'] = IDGenerator.generate_orgadmin_code()
                except:
                    pass
        
        elif validated_data.get('role') == 'admin':
            validated_data['has_changed_default_password'] = True
            # Generate AD- code
            if not validated_data.get('username') or '@' in validated_data.get('username', ''):
                try:
                    validated_data['username'] = IDGenerator.generate_admin_code()
                except:
                    pass
            
        user = User.objects.create_user(password=password, **validated_data)
        return user

class UserLoginSerializer(serializers.Serializer):
    """
    User login serializer
    """
    email = serializers.CharField()  # Changed from EmailField to CharField
    password = serializers.CharField()
    
    def validate_email(self, value):
        # Check if user exists with either email or username (employee code) - Case Insensitive
        if not User.objects.filter(email__iexact=value).exists() and not User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("User with this email or employee code does not exist")
        return value

class UserUpdateSerializer(serializers.ModelSerializer):
    """
    User update serializer
    """
    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'email', 'username', 'phone_number',
            'organization', 'campus', 'is_active', 'is_verified', 'photo'
        ]
    
    def validate_campus(self, value):
        user = self.context['request'].user
        
        # Allow SuperAdmin and Principal to change campus for any user
        if not (user.is_superadmin() or user.is_principal()) and value != user.campus:
            raise serializers.ValidationError("You don't have permission to change campus")
        
        return value

class ChangePasswordSerializer(serializers.Serializer):
    """
    Change password serializer
    """
    old_password = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])
    new_password_confirm = serializers.CharField()
    
    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect")
        return value
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError("New passwords don't match")
        return attrs
    
    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class RolePermissionSerializer(serializers.ModelSerializer):
    """
    Serializer for RolePermission model
    """
    permission_label = serializers.CharField(source='get_permission_codename_display', read_only=True)
    role_label = serializers.CharField(source='get_role_display', read_only=True)
    
    class Meta:
        model = RolePermission
        fields = ['id', 'organization', 'role', 'role_label', 'permission_codename', 'permission_label', 'is_allowed', 'updated_at']
        read_only_fields = ['id', 'updated_at']


class SystemVersionSerializer(serializers.ModelSerializer):
    released_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SystemVersion
        fields = ['id', 'version', 'build', 'release_notes', 'released_by', 'released_by_name', 'created_at']
        read_only_fields = ['id', 'build', 'released_by', 'created_at']

    def get_released_by_name(self, obj):
        if obj.released_by:
            return obj.released_by.get_full_name() or str(obj.released_by)
        return None


