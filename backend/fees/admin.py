from django.contrib import admin
from .models import FeeType, FeeStructure, FeeLineItem, StudentFee, Payment

@admin.register(FeeType)
class FeeTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'organization', 'frequency', 'is_default', 'is_active', 'created_at')
    list_filter = ('organization', 'frequency', 'is_default', 'is_active')
    search_fields = ('name',)

class FeeLineItemInline(admin.TabularInline):
    model = FeeLineItem
    extra = 1

@admin.register(FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    list_display = ('name', 'organization', 'campus', 'grade', 'get_fee_items', 'is_default', 'is_active', 'created_at')
    list_filter = ('organization', 'campus', 'is_default', 'is_active', 'grade')
    search_fields = ('name',)
    inlines = [FeeLineItemInline]

    def get_fee_items(self, obj):
        items = obj.line_items.select_related('fee_type').all()
        if not items:
            return "-"
        return " | ".join([f"{item.fee_type.name}: {item.amount}" for item in items])
    get_fee_items.short_description = "Fee Details"

@admin.register(StudentFee)
class StudentFeeAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'organization', 'student', 'month', 'year', 'total_amount', 'paid_amount', 'status', 'due_date')
    list_filter = ('organization', 'status', 'month', 'year', 'student__campus')
    search_fields = ('invoice_number', 'student__name', 'student__student_code')
    readonly_fields = ('invoice_number', 'remaining_amount')

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('receipt_number', 'get_student', 'get_organization', 'amount', 'method', 'payment_date', 'transaction_id')
    list_filter = ('student_fee__organization', 'method', 'payment_date', 'student_fee__student__campus')
    search_fields = ('receipt_number', 'transaction_id', 'student_fee__student__name', 'student_fee__student__student_code')

    def get_student(self, obj):
        return obj.student_fee.student if obj.student_fee else "-"
    get_student.short_description = "Student"

    def get_organization(self, obj):
        return obj.student_fee.organization if obj.student_fee else "-"
    get_organization.short_description = "Organization"
