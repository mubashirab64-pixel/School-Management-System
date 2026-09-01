from rest_framework import viewsets, permissions
from .models import FormTemplate
from .serializers import FormTemplateSerializer

class FormTemplateViewSet(viewsets.ModelViewSet):
    queryset = FormTemplate.objects.all()
    serializer_class = FormTemplateSerializer
    lookup_field = 'name'
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()] # Only admins/principals can create/edit templates
