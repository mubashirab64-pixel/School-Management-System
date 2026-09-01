from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FormTemplateViewSet

router = DefaultRouter()
router.register(r'templates', FormTemplateViewSet, basename='form-template')

urlpatterns = [
    path('', include(router.urls)),
]
