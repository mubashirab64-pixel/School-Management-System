from django.contrib import admin
from .models import Result, SubjectMark, MonthlyResult, MidTermResult, FinalTermResult

class SubjectMarkInline(admin.TabularInline):
    model = SubjectMark
    extra = 0
    fields = ('subject_name', 'variant', 'total_marks', 'obtained_marks', 'has_practical', 'practical_total', 'practical_obtained', 'is_pass')
    readonly_fields = ('is_pass',)

class BaseResultAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'get_student_code', 'student', 'organization', 'exam_type', 'month', 
        'status', 'obtained_marks', 'total_marks', 'percentage', 
        'grade', 'result_status', 'edit_count', 'created_at'
    )
    list_filter = (
        'organization', 'exam_type', 'status', 'result_status', 'grade', 
        'created_at', 'academic_year', 'month'
    )
    search_fields = (
        'student__name', 'student__student_code', 
        'teacher__full_name', 'teacher__email'
    )
    raw_id_fields = ('student', 'teacher', 'coordinator')
    date_hierarchy = 'created_at'
    readonly_fields = (
        'total_marks', 'obtained_marks', 'percentage', 
        'grade', 'result_status', 'created_at', 'updated_at'
    )
    inlines = [SubjectMarkInline]
    ordering = ('-created_at',)

    def get_queryset(self, request):
        return self.model.all_objects.get_queryset()

    def get_student_code(self, obj):
        return obj.student.student_code
    get_student_code.short_description = 'Code'

@admin.register(Result)
class ResultAdmin(BaseResultAdmin):
    list_display = (
        'id', 'get_student_code', 'student', 'organization', 'exam_type', 'month', 
        'status', 'pass_status', 'obtained_marks', 'total_marks', 'percentage', 
        'grade', 'result_status', 'edit_count', 'created_at'
    )
    list_filter = BaseResultAdmin.list_filter + ('pass_status',)

@admin.register(SubjectMark)
class SubjectMarkAdmin(admin.ModelAdmin):
    list_display = ('id', 'result', 'subject_name', 'total_marks', 'obtained_marks', 'is_pass', 'is_absent')
    list_filter = ('is_pass', 'is_absent', 'subject_name')
    search_fields = ('subject_name', 'result__student__name')

@admin.register(MonthlyResult)
class MonthlyResultAdmin(BaseResultAdmin):
    def get_queryset(self, request):
        return super().get_queryset(request).filter(exam_type='monthly')

@admin.register(MidTermResult)
class MidTermResultAdmin(BaseResultAdmin):
    def get_queryset(self, request):
        return super().get_queryset(request).filter(exam_type='midterm')

@admin.register(FinalTermResult)
class FinalTermResultAdmin(BaseResultAdmin):
    def get_queryset(self, request):
        return super().get_queryset(request).filter(exam_type='final')


