from django.contrib import admin
from .models import ExitRecord


# @admin.register(ExitRecord)
class ExitRecordAdmin(admin.ModelAdmin):
    list_display = (
        "student",
        "exit_type",
        "reason",
        "date_of_request",
        "date_of_effect",
    )
    list_filter = ("exit_type", "reason", "date_of_request")
    search_fields = ("student__name", "reason", "exit_type")

    readonly_fields = ("date_of_request", "created_at")

    fieldsets = (
        ("Student Exit Info", {
            "fields": (
                "student",
                "exit_type",
                "reason",
                "other_reason",
                "date_of_effect",
                "notes",
            )
        }),
        ("System Info", {
            "fields": (
                "date_of_request",
                "created_at",
            ),
        }),
    )

    def has_add_permission(self, request):
        # Sirf Principal add kar sakta hai
        if request.user.groups.filter(name="Principal").exists() or request.user.is_superuser:
            return True
        return False

    def has_change_permission(self, request, obj=None):
        # Record append-only — koi change nahi
        return False

    def has_delete_permission(self, request, obj=None):
        # Delete nahi kar sakta koi
        return False
