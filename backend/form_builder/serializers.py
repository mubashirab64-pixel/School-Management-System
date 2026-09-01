from rest_framework import serializers
from .models import FormTemplate

class FormTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormTemplate
        fields = '__all__'
