from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TeacherViewSet, 
    TeacherSubjectAssignmentViewSet,
    TeacherBulkUploadView,
    TeacherBulkUploadTemplateView
)

router = DefaultRouter()
router.register(r'teachers', TeacherViewSet, basename='teacher')
router.register(r'subject-assignments', TeacherSubjectAssignmentViewSet, basename='subject-assignment')

urlpatterns = [
    path('teachers/bulk-upload/', TeacherBulkUploadView.as_view(), name='teacher-bulk-upload'),
    path('teachers/bulk-upload-template/', TeacherBulkUploadTemplateView.as_view(), name='teacher-bulk-upload-template'),
    path('', include(router.urls)),
]
