from rest_framework import serializers
from .models import FeeType, FeeStructure, FeeLineItem, StudentFee, Payment, BankAccount, PaymentTransaction

class FeeTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeType
        fields = '__all__'

class FeeLineItemSerializer(serializers.ModelSerializer):
    fee_type_name = serializers.CharField(source='fee_type.name', read_only=True)
    # Make frequency optional so it can be inherited from FeeType in the model's save()
    frequency = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = FeeLineItem
        fields = ['id', 'fee_type', 'fee_type_name', 'amount', 'frequency']

class FeeStructureSerializer(serializers.ModelSerializer):
    line_items = FeeLineItemSerializer(many=True, read_only=False, required=False)
    campus_name = serializers.CharField(source='campus.campus_name', read_only=True)
    level_name = serializers.CharField(source='level.name', read_only=True, allow_null=True)
    grade_name = serializers.CharField(source='grade.name', read_only=True, allow_null=True)
    section_name = serializers.CharField(source='section.code', read_only=True, allow_null=True)
    
    class Meta:
        model = FeeStructure
        fields = [
            'id', 'name', 'campus', 'campus_name', 'level', 'level_name',
            'grade', 'grade_name', 'section', 'section_name', 
            'is_default', 'is_active', 'line_items', 'created_at'
        ]

    def create(self, validated_data):
        items_data = validated_data.pop('line_items', [])
        try:
            fee_structure = FeeStructure.objects.create(**validated_data)
        except Exception as e:
            print(f"FeeStructure Create Error: {e}, Data: {validated_data}")
            raise
        for item_data in items_data:
            FeeLineItem.objects.create(fee_structure=fee_structure, **item_data)
        return fee_structure

    def update(self, instance, validated_data):
        items_data = validated_data.pop('line_items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.line_items.all().delete()
            for item_data in items_data:
                FeeLineItem.objects.create(fee_structure=instance, **item_data)
        return instance

class StudentFeeSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    student_code = serializers.SerializerMethodField()
    student_class = serializers.CharField(source='student.current_grade', read_only=True)
    student_gr_no = serializers.CharField(source='student.gr_no', read_only=True)
    school_name = serializers.CharField(source='student.campus.campus_name', read_only=True)
    school_address = serializers.CharField(source='student.campus.address_full', read_only=True)
    organization_name = serializers.CharField(source='student.campus.organization.name', read_only=True)
    payment_method = serializers.SerializerMethodField()
    payment_date = serializers.SerializerMethodField()
    receipt_number = serializers.SerializerMethodField()
    received_by_name = serializers.SerializerMethodField()

    def get_student_code(self, obj):
        s = obj.student
        return s.student_code or s.student_id or s.gr_no or f"ID-{s.id}"

    def get_payment_method(self, obj):
        last = obj.payments.order_by('-payment_date').first()
        return last.method if last else None

    def get_payment_date(self, obj):
        last = obj.payments.order_by('-payment_date').first()
        return str(last.payment_date) if last else None

    def get_receipt_number(self, obj):
        last = obj.payments.order_by('-payment_date').first()
        return last.receipt_number if last else None

    def get_received_by_name(self, obj):
        last = obj.payments.order_by('-payment_date').first()
        if last and last.received_by:
            return last.received_by.get_full_name() or last.received_by.username
        return None

    class Meta:
        model = StudentFee
        fields = [
            'id', 'student', 'student_name', 'student_code', 'student_class', 'student_gr_no',
            'school_name', 'school_address', 'organization_name',
            'fee_structure',
            'month', 'year', 'invoice_number', 'total_amount',
            'paid_amount', 'remaining_amount', 'status', 'due_date',
            'late_fee', 'other_charges', 'fee_structure_details', 'created_at',
            'payment_method', 'payment_date', 'receipt_number', 'received_by_name',
        ]
        read_only_fields = ['invoice_number', 'remaining_amount', 'status']

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ['receipt_number', 'received_by']

class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = ['id', 'bank_name', 'account_title', 'account_number', 'iban', 'is_active', 'created_at']
        read_only_fields = ['created_at']


class PaymentTransactionSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    challan_number = serializers.CharField(source='challan.invoice_number', read_only=True)
    challan_month = serializers.IntegerField(source='challan.month', read_only=True)
    challan_year = serializers.IntegerField(source='challan.year', read_only=True)
    bank_name = serializers.SerializerMethodField()
    screenshot_url = serializers.SerializerMethodField()
    verified_by_name = serializers.SerializerMethodField()
    challan_total = serializers.DecimalField(source='challan.total_amount', max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = PaymentTransaction
        fields = [
            'id', 'challan', 'challan_number', 'challan_month', 'challan_year', 'challan_total',
            'student', 'student_name', 'bank_account', 'bank_name',
            'amount', 'transaction_id', 'screenshot', 'screenshot_url',
            'status', 'reject_reason', 'verified_by', 'verified_by_name',
            'verified_at', 'submitted_at',
        ]
        read_only_fields = ['status', 'verified_by', 'verified_at', 'submitted_at']

    def get_bank_name(self, obj):
        return obj.bank_account.bank_name if obj.bank_account else None

    def get_screenshot_url(self, obj):
        request = self.context.get('request')
        if obj.screenshot and request:
            return request.build_absolute_uri(obj.screenshot.url)
        return None

    def get_verified_by_name(self, obj):
        if obj.verified_by:
            return obj.verified_by.get_full_name() or obj.verified_by.username
        return None


class ChallanGenerationSerializer(serializers.Serializer):
    month = serializers.IntegerField(min_value=1, max_value=12)
    year = serializers.IntegerField()
    campus_id = serializers.IntegerField(required=False, allow_null=True)
    student_id = serializers.IntegerField(required=False, allow_null=True)
    level_id = serializers.IntegerField(required=False, allow_null=True)
    grade_id = serializers.IntegerField(required=False, allow_null=True)
    structure_id = serializers.IntegerField(required=False, allow_null=True)
    level_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_null=True
    )
    grade_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_null=True
    )
    section_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_null=True
    )
