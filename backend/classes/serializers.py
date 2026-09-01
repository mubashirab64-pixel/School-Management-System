from rest_framework import serializers
from .models import Level, Grade, ClassRoom

class LevelSerializer(serializers.ModelSerializer):
    campus_name = serializers.CharField(source='campus.campus_name', read_only=True)
    coordinator_name = serializers.SerializerMethodField()
    coordinator_code = serializers.SerializerMethodField()
    shift_display = serializers.CharField(source='get_shift_display', read_only=True)
    grade_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        help_text="Optional list of grade IDs to assign to this level"
    )
    new_grade_names = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
        help_text="Optional list of new grade names to create and assign to this level"
    )
    
    class Meta:
        model = Level
        fields = [
            'id', 'organization', 'name', 'shift', 'shift_display', 'code', 'campus', 'campus_name', 
            'coordinator_name', 'coordinator_code', 'grade_ids', 'new_grade_names', 'grade_set'
        ]
        read_only_fields = ['id', 'organization', 'code', 'grade_set']
    
    def get_coordinator_name(self, obj):
        """Get coordinator name using the property"""
        return obj.coordinator_name
    
    def get_coordinator_code(self, obj):
        """Get coordinator code"""
        coord = obj.coordinator
        return coord.employee_code if coord else None

    def create(self, validated_data):
        grade_ids = validated_data.pop('grade_ids', [])
        new_names = validated_data.pop('new_grade_names', [])
        level = super().create(validated_data)
        
        # 1) Handle existing grades
        if grade_ids:
            Grade.objects.filter(id__in=grade_ids).update(level=level)
            for grade in Grade.objects.filter(id__in=grade_ids):
                grade.save()

        # 2) Create new grades
        for name in new_names:
            Grade.objects.create(name=name, level=level)
            
        return level

    def update(self, instance, validated_data):
        grade_ids = validated_data.pop('grade_ids', None)
        new_names = validated_data.pop('new_grade_names', [])
        level = super().update(instance, validated_data)
        
        # 1) Handle existing grades
        if grade_ids is not None:
            Grade.objects.filter(id__in=grade_ids).update(level=level)
            for grade in Grade.objects.filter(id__in=grade_ids):
                grade.save()

        # 2) Create new grades
        for name in new_names:
            Grade.objects.create(name=name, level=level)
            
        return level

class GradeSerializer(serializers.ModelSerializer):
    level_name = serializers.CharField(source='level.name', read_only=True, required=False, allow_null=True)
    level_code = serializers.CharField(source='level.code', read_only=True, required=False, allow_null=True)
    level_shift = serializers.CharField(source='level.shift', read_only=True, required=False, allow_null=True)
    campus_name = serializers.CharField(source='campus.campus_name', read_only=True, required=False, allow_null=True)
    
    class Meta:
        model = Grade
        fields = [
            'id', 'organization', 'name', 'code', 'level', 'level_name', 
            'level_code', 'level_shift', 'shift', 'campus', 'campus_name'
        ]
        read_only_fields = ['id', 'organization', 'code', 'shift', 'campus_name']

class ClassRoomSerializer(serializers.ModelSerializer):
    grade_name = serializers.CharField(source='grade.name', read_only=True)
    grade_code = serializers.CharField(source='grade.code', read_only=True)
    level_name = serializers.CharField(source='grade.level.name', read_only=True)
    level_code = serializers.CharField(source='grade.level.code', read_only=True)
    campus_name = serializers.CharField(source='grade.level.campus.campus_name', read_only=True)
    class_teacher_name = serializers.CharField(source='class_teacher.full_name', read_only=True)
    class_teacher_code = serializers.CharField(source='class_teacher.employee_code', read_only=True)
    assigned_by_name = serializers.CharField(source='assigned_by.username', read_only=True)
    campus_id = serializers.IntegerField(source='grade.level.campus.id', read_only=True)
    
    class Meta:
        model = ClassRoom
        fields = [
            'id', 'organization', 'grade', 'grade_name', 'grade_code', 'section', 'shift', 'class_teacher', 
            'class_teacher_name', 'class_teacher_code', 'capacity', 'code', 
            'level_name', 'level_code', 'campus_id', 'campus_name', 'assigned_by', 'assigned_by_name', 
            'assigned_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'organization', 'code', 'assigned_by', 'assigned_at', 'created_at', 'updated_at']
