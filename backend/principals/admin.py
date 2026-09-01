from django.contrib import admin
from .models import Principal

@admin.register(Principal)
class PrincipalAdmin(admin.ModelAdmin):
    list_display = [
        'full_name', 
        'organization',
        'employee_code', 
        'campus', 
        'shift', 
        'email', 
        'contact_number',
        'is_currently_active',
        'created_at'
    ]
    list_filter = [
        'organization',
        'campus', 
        'shift', 
        'gender', 
        'is_currently_active',
        'created_at'
    ]
    search_fields = [
        'full_name', 
        'employee_code', 
        'email', 
        'contact_number',
        'cnic'
    ]
    readonly_fields = ['employee_code', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Personal Information', {
            'fields': (
                'full_name', 
                'dob', 
                'gender', 
                'contact_number', 
                'email', 
                'cnic', 
                'permanent_address',
                'biometric_id'
            )
        }),
        ('Professional Information', {
            'fields': (
                'education_level', 
                'institution_name', 
                'year_of_passing', 
                'total_experience_years'
            )
        }),
        ('Work Assignment', {
            'fields': (
                'campus', 
                'shift', 
                'joining_date', 
                'is_currently_active'
            )
        }),
        ('System Information', {
            'fields': (
                'employee_code', 
                'created_at', 
                'updated_at'
            ),
            'classes': ('collapse',)
        }),
    )
    
    def save_model(self, request, obj, form, change):
        if not obj.organization and not request.user.is_superuser and getattr(request.user, 'organization', None):
            obj.organization = request.user.organization
        super().save_model(request, obj, form, change)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('campus')