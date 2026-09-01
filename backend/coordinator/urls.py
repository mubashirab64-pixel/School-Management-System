from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CoordinatorViewSet

router = DefaultRouter()
router.register(r'coordinators', CoordinatorViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
