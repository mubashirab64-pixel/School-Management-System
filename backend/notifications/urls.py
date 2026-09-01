from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    NotificationViewSet, AnnouncementViewSet,
    vapid_public_key, push_subscribe, push_unsubscribe,
)

router = DefaultRouter()
router.register(r'notifications', NotificationViewSet, basename='notifications')
router.register(r'announcements', AnnouncementViewSet, basename='announcements')

# Register router at package root so project `include("notifications.urls")`
# mounted at `/api/` yields `/api/notifications/...` (avoid double `api/api/`)
urlpatterns = [
    path('', include(router.urls)),
    path('push/vapid-public-key/', vapid_public_key),
    path('push/subscribe/', push_subscribe),
    path('push/unsubscribe/', push_unsubscribe),
]
