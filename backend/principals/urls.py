from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PrincipalViewSet

router = DefaultRouter()
router.register(r'principals', PrincipalViewSet, basename='principal')

urlpatterns = [
    path('', include(router.urls)),
]
