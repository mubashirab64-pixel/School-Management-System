from rest_framework import serializers
from .models import Teacher, TeacherSubjectAssignment
from classes.models import ClassRoom
from campus.serializers import CampusSerializer
from coordinator.serializers import CoordinatorSerializer
from classes.serializers import ClassRoomSerializer
from timetable.serializers import SubjectSerializer


class TeacherSubjectAssignmentSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    classroom_name = serializers.CharField(source='classroom.code', read_only=True)
    
    class Meta:
        model = TeacherSubjectAssignment
        fields = ['id', 'teacher', 'classroom', 'subject', 'subject_name', 'classroom_name']


class TeacherSerializer(serializers.ModelSerializer):
    # Nested serializers for related objects
    campus_data = CampusSerializer(source='current_campus', read_only=True)
    coordinators_data = CoordinatorSerializer(source='assigned_coordinators', many=True, read_only=True)
    classroom_data = ClassRoomSerializer(source='assigned_classroom', read_only=True)
    subject_assignments = TeacherSubjectAssignmentSerializer(many=True, read_only=True)
    
    campus_name = serializers.SerializerMethodField()
    coordinator_names = serializers.SerializerMethodField()
    classroom_name = serializers.SerializerMethodField()
    experience_display = serializers.SerializerMethodField()
    assigned_classrooms_display = serializers.SerializerMethodField()
    assigned_classrooms_details = ClassRoomSerializer(source='assigned_classrooms', many=True, read_only=True)
    
    class Meta:
        model = Teacher
        fields = "__all__"
        extra_fields = [
            'dynamic_data',
            'campus_data',
            'coordinators_data',
            'classroom_data',
            'campus_name',
            'coordinator_names',
            'classroom_name',
            'experience_display',
            'assigned_classrooms_display',
            'assigned_classrooms_details',
            'subject_assignments',
        ]

    def validate_email(self, value):
        """Check if email is already in use by another user account"""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Check if email exists for another user
        user_qs = User.objects.filter(email__iexact=value)
        
        if self.instance:
            # If teacher already has a linked user, exclude that user from conflict check
            if self.instance.user:
                user_qs = user_qs.exclude(pk=self.instance.user.pk)
            # If no user linked yet, but the email is NOT being changed,
            # we should allow it as it likely belongs to this teacher's (unlinked) user.
            elif self.instance.email.lower() == value.lower():
                return value
            
        if user_qs.exists():
            raise serializers.ValidationError("This email is already in use by another user account.")
        return value

    def validate_cnic(self, value):
        """Check if CNIC is already in use by another active teacher"""
        from .models import Teacher
        qs = Teacher.objects.filter(cnic=value, is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
            
        if qs.exists():
            raise serializers.ValidationError("This CNIC is already registered with another active teacher.")
        return value
    
    def _sync_classroom_assignments(self, teacher: Teacher, classroom_ids: list[int]):
        """Ensure ClassRoom.class_teacher matches provided assigned_classrooms."""
        # Normalize ids
        ids = [int(x) for x in classroom_ids if str(x).isdigit()]
        # Update M2M set first
        teacher.assigned_classrooms.set(ids)
        
        # Mark listed classrooms with this teacher
        for cid in ids:
            try:
                cr = ClassRoom.objects.get(pk=cid)
                if cr.class_teacher_id != teacher.id:
                    cr.class_teacher = teacher
                    cr.save(update_fields=['class_teacher'])
            except ClassRoom.DoesNotExist:
                continue
        
        # Clear teacher from classrooms no longer in list
        ClassRoom.objects.filter(class_teacher=teacher).exclude(pk__in=ids).update(class_teacher=None)
        
        # Force update is_class_teacher based on the new assignments
        has_classes = bool(ids) or teacher.assigned_classroom_id is not None or ClassRoom.objects.filter(class_teacher=teacher).exists()
        Teacher.objects.filter(pk=teacher.pk).update(is_class_teacher=has_classes)
        teacher.is_class_teacher = has_classes
    
    def _sync_subject_assignments(self, teacher, raw_assignments):
        """Save TeacherSubjectAssignment records from [{classroom_id, subject_id}] list."""
        from .models import TeacherSubjectAssignment
        if not isinstance(raw_assignments, list):
            return
        TeacherSubjectAssignment.objects.filter(teacher=teacher).delete()
        for item in raw_assignments:
            classroom_id = item.get('classroom_id') or item.get('classroom')
            subject_id = item.get('subject_id') or item.get('subject')
            if classroom_id and subject_id:
                try:
                    TeacherSubjectAssignment.objects.get_or_create(
                        teacher=teacher,
                        classroom_id=int(classroom_id),
                        subject_id=int(subject_id),
                        defaults={'organization': teacher.organization}
                    )
                except Exception:
                    pass

    def create(self, validated_data):
        from rest_framework.utils import model_meta

        request = self.context.get('request')
        classroom_ids = []
        subject_assignments_raw = []
        if request is not None:
            classroom_ids = request.data.get('assigned_classrooms') or []
            if isinstance(classroom_ids, str):
                classroom_ids = [s for s in classroom_ids.split(',') if s]
            subject_assignments_raw = request.data.get('subject_teacher_assignments') or []

        # If is_class_teacher is False, clear classroom assignments to avoid inconsistencies
        is_class_teacher_val = validated_data.get('is_class_teacher')
        if is_class_teacher_val is False or (request is not None and request.data.get('is_class_teacher') in [False, 'false']):
            classroom_ids = []
            validated_data['assigned_classroom'] = None

        # Extract M2M fields so we can set them after save
        info = model_meta.get_field_info(Teacher)
        many_to_many = {}
        for field_name, relation_info in info.relations.items():
            if relation_info.to_many and field_name in validated_data:
                many_to_many[field_name] = validated_data.pop(field_name)

        # Instantiate without saving so we can set _actor BEFORE save,
        # ensuring post_save signals receive the correct actor.
        teacher = Teacher(**validated_data)
        if request:
            teacher._actor = request.user
        teacher.save()

        # Restore M2M relationships
        for field_name, value in many_to_many.items():
            getattr(teacher, field_name).set(value)

        if classroom_ids:
            self._sync_classroom_assignments(teacher, classroom_ids)
        else:
            # If not class teacher, clear M2M assigned_classrooms explicitly
            teacher.assigned_classrooms.clear()

        if subject_assignments_raw:
            self._sync_subject_assignments(teacher, subject_assignments_raw)

        # Re-run auto-assignments AFTER all M2M fields are saved
        if teacher.assigned_classroom and teacher.current_campus:
            teacher._assign_coordinators_from_classroom()
        elif teacher.assigned_classrooms.exists() and teacher.current_campus:
            teacher._assign_coordinators_from_classrooms()
        elif teacher.current_campus and teacher.current_classes_taught:
            teacher._assign_coordinators_from_classes()

        return teacher

    def update(self, instance, validated_data):
        request = self.context.get('request')
        classroom_ids = None
        subject_assignments_raw = None
        if request is not None:
            classroom_ids = request.data.get('assigned_classrooms')
            if isinstance(classroom_ids, str):
                classroom_ids = [s for s in classroom_ids.split(',') if s]
            subject_assignments_raw = request.data.get('subject_teacher_assignments')

        # If is_class_teacher is False, clear classroom assignments to avoid inconsistencies
        is_class_teacher_val = validated_data.get('is_class_teacher')
        if is_class_teacher_val is False or (request is not None and request.data.get('is_class_teacher') in [False, 'false']):
            classroom_ids = []
            validated_data['assigned_classroom'] = None

        teacher = super().update(instance, validated_data)
        if classroom_ids is not None:
            self._sync_classroom_assignments(teacher, classroom_ids)
        else:
            # If not class teacher, clear M2M assigned_classrooms explicitly
            teacher.assigned_classrooms.clear()

        if subject_assignments_raw is not None:
            self._sync_subject_assignments(teacher, subject_assignments_raw)

        # Re-run auto-assignments AFTER all M2M fields are saved
        if teacher.assigned_classroom and teacher.current_campus:
            teacher._assign_coordinators_from_classroom()
        elif teacher.assigned_classrooms.exists() and teacher.current_campus:
            teacher._assign_coordinators_from_classrooms()
        elif teacher.current_campus and teacher.current_classes_taught:
            teacher._assign_coordinators_from_classes()

        return teacher
    
    def get_campus_name(self, obj):
        """Get campus name for display"""
        return obj.current_campus.campus_name if obj.current_campus else None
    
    def get_coordinator_names(self, obj):
        """Get coordinator names for display"""
        return [coord.full_name for coord in obj.assigned_coordinators.all()]
    
    def get_classroom_name(self, obj):
        """Get classroom name for display"""
        if obj.assigned_classroom:
            return f"{obj.assigned_classroom.grade.name} - {obj.assigned_classroom.section}"
        return None

    def get_assigned_classrooms_display(self, obj):
        """
        Unified display of all assigned classrooms:
        - Prefer the ManyToMany `assigned_classrooms` (for both shifts)
        - Fallback to legacy `assigned_classroom`
        """
        try:
            # 1. Check ManyToMany (assigned_classrooms)
            m2m_qs = getattr(obj, 'assigned_classrooms', None)
            m2m_list = list(m2m_qs.all()) if m2m_qs else []

            # 2. Check ForeignKey back-reference (ClassRoom.class_teacher)
            fk_list = list(obj.classroom_set.all())

            # 3. Check Legacy (assigned_classroom)
            legacy = getattr(obj, 'assigned_classroom', None)

            # Combine and unique
            all_classrooms = list(set([c for c in (m2m_list + fk_list + ([legacy] if legacy else [])) if c]))

            if all_classrooms:
                labels = []
                for c in all_classrooms:
                    try:
                        grade_name = getattr(getattr(c, 'grade', None), 'name', None) or getattr(c, 'grade_name', None) or 'Grade'
                        section = getattr(c, 'section', '') or ''
                        shift = getattr(c, 'shift', '') or ''
                        label = f"{grade_name} - {section}"
                        if shift:
                            label = f"{label.title()} ({shift.title()})"
                        labels.append(label)
                    except Exception:
                        labels.append(str(c))
                return ", ".join(labels) if labels else "-"

            # Fallback: single legacy assignment
            c = getattr(obj, 'assigned_classroom', None)
            if c:
                try:
                    grade_name = getattr(getattr(c, 'grade', None), 'name', None) or getattr(c, 'grade_name', None) or 'Grade'
                    section = getattr(c, 'section', '') or ''
                    shift = getattr(c, 'shift', '') or ''
                    label = f"{grade_name} - {section}"
                    if shift:
                        label = f"{label} ({shift})"
                    return label
                except Exception:
                    return str(c)

            return "-"
        except Exception:
            return "-"
    
    def get_experience_display(self, obj):
        """Get formatted experience display"""
        if obj.total_experience_years:
            return f"{obj.total_experience_years} years"
        return "Not specified"

    def to_representation(self, instance):
        """Override to ensure is_class_teacher reflects all sources"""
        data = super().to_representation(instance)
        
        # Check all sources for classrooms
        has_classrooms = (
            instance.assigned_classroom or 
            (instance.pk and (instance.assigned_classrooms.exists() or instance.classroom_set.exists()))
        )
        
        # Force the field to True/False based on actual data
        data['is_class_teacher'] = bool(has_classrooms)
        
        # Update assigned_classroom for simple display in frontend if missing
        if not data.get('assigned_classroom') and has_classrooms:
            # Pick first available classroom for legacy UI components
            first_c = instance.classroom_set.first() or instance.assigned_classrooms.first()
            if first_c:
                data['assigned_classroom'] = first_c.id
                data['classroom_name'] = f"{first_c.grade.name} - {first_c.section}"
                
        return data
