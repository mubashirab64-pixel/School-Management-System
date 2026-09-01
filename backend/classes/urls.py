from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'levels', views.LevelViewSet)
router.register(r'grades', views.GradeViewSet)
router.register(r'classrooms', views.ClassRoomViewSet)

urlpatterns = [
    path('', include(router.urls)),
    # Explicit routes to avoid router registration issues
    path('levels/<int:pk>/unassign_coordinator/', views.LevelViewSet.as_view({'post': 'unassign_coordinator'}), name='level-unassign-coordinator'),
    path('classrooms/<int:pk>/unassign_teacher/', views.unassign_classroom_teacher, name='classroom-unassign-teacher'),
]