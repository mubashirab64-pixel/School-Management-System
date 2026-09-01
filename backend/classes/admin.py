from django.contrib import admin
from .models import ClassRoom, Grade, Level

# ----------------------
@admin.register(Level)
class LevelAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "organization", "campus", "coordinator_name")
    list_filter = ("organization", "campus")
    search_fields = ("name", "code")
    readonly_fields = ("coordinator_name",)
    
    def coordinator_name(self, obj):
        """Display coordinator name in admin list"""
        return obj.coordinator_name or "-"
    coordinator_name.short_description = "Coordinator"

# ----------------------
# Coordinator filter for Grade
class GradeCoordinatorFilter(admin.SimpleListFilter):
    title = "Coordinator"
    parameter_name = "coordinator"

    def lookups(self, request, model_admin):
        return [(c.id, c.full_name) for c in Coordinator.objects.all()]

    def queryset(self, request, queryset):
        if self.value():
            try:
                coordinator = Coordinator.objects.get(id=self.value())
                return queryset.filter(levels=coordinator.level)
            except Coordinator.DoesNotExist:
                return queryset.none()
        return queryset


@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "organization", "level", "campus_display")
    list_filter = ("organization", "level", "level__campus")
    search_fields = ("name", "code")
    
    def campus_display(self, obj):
        return obj.level.campus.campus_name if obj.level and obj.level.campus else '-'
    campus_display.short_description = 'Campus'

# ----------------------
# Coordinator filter for ClassRoom
class ClassRoomCoordinatorFilter(admin.SimpleListFilter):
    title = "Coordinator"
    parameter_name = "coordinator"

    def lookups(self, request, model_admin):
        return [(c.id, c.full_name) for c in Coordinator.objects.all()]

    def queryset(self, request, queryset):
        if self.value():
            try:
                coordinator = Coordinator.objects.get(id=self.value())
                # Coordinator ka level nikalo
                level = coordinator.level
                # Us level ke saare grades nikalo
                grades = Grade.objects.filter(levels=level)
                # Classroom ko filter karo unhi grades ke basis par
                return queryset.filter(grade__in=grades)
            except Coordinator.DoesNotExist:
                return queryset.none()
        return queryset


@admin.register(ClassRoom)
class ClassRoomAdmin(admin.ModelAdmin):
    list_display = ("grade", "section", "organization", "class_teacher", "get_student_count", "capacity", "code", "campus_display")
    list_filter = ("organization", "grade", "class_teacher", "capacity", "grade__level__campus")
    search_fields = ("grade__name", "section", "class_teacher__full_name", "code")
    autocomplete_fields = ("class_teacher",)
    
    def campus_display(self, obj):
        return obj.grade.level.campus.campus_name if obj.grade and obj.grade.level and obj.grade.level.campus else '-'
    campus_display.short_description = 'Campus'
    
    def get_student_count(self, obj):
        """Display the number of students in this classroom"""
        from students.models import Student
        count = Student.objects.filter(classroom=obj).count()
        return f"{count} students"
    get_student_count.short_description = "Students"
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('grade', 'class_teacher', 'grade__level__campus')
