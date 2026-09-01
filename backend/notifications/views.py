from rest_framework import viewsets, permissions, decorators, response, status
from django.db.models import Q
from django.utils import timezone
from .models import Notification, Announcement, PushSubscription
from .serializers import NotificationSerializer, AnnouncementSerializer


class NotificationViewSet(viewsets.ModelViewSet):
    @decorators.action(detail=False, methods=['post'])
    def delete_all(self, request):
        qs = self.get_queryset()
        count = qs.count()
        qs.delete()
        return response.Response({'deleted': count}, status=status.HTTP_200_OK)
    @decorators.action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        qs = self.get_queryset().filter(unread=True)
        count = qs.count()
        qs.update(unread=False)
        return response.Response({'marked': count}, status=status.HTTP_200_OK)
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    def perform_create(self, serializer):
        # force recipient to be the provided user (server-side creation)
        serializer.save()

    @decorators.action(detail=False, methods=['get'])
    def unread(self, request):
        qs = self.get_queryset().filter(unread=True)
        data = self.get_serializer(qs, many=True).data
        return response.Response(data)

    @decorators.action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return response.Response(status=status.HTTP_404_NOT_FOUND)
        obj.mark_read()
        return response.Response(self.get_serializer(obj).data)


class AnnouncementViewSet(viewsets.ModelViewSet):
    """Announcements: org_admin / superadmin (organization-wide) and
    principal (their campus) can create/edit; everyone in scope reads."""
    serializer_class = AnnouncementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _can_manage(self, user):
        return bool(
            user.is_superadmin() or user.is_org_admin_role() or user.is_principal()
        )

    def get_queryset(self):
        user = self.request.user
        qs = Announcement.objects.filter(is_active=True).select_related('campus', 'created_by')

        # Organization scope (superadmin sees all)
        if not user.is_superadmin() and getattr(user, 'organization_id', None):
            qs = qs.filter(Q(organization=user.organization) | Q(organization__isnull=True))

        # Hide expired
        qs = qs.filter(Q(expires_at__isnull=True) | Q(expires_at__gte=timezone.now()))

        # Org admin / superadmin: everything in their org (org-wide + all campuses)
        if user.is_superadmin() or user.is_org_admin_role():
            return qs

        campus_id = getattr(user, 'campus_id', None)

        # Principal: org-wide + their own campus
        if user.is_principal():
            return qs.filter(Q(campus__isnull=True) | Q(campus_id=campus_id))

        # Coordinators / teachers / students: org-wide + their campus, filtered by audience
        qs = qs.filter(Q(campus__isnull=True) | Q(campus_id=campus_id))
        audience_map = {
            'coordinator': 'coordinators',
            'teacher': 'teachers',
            'student': 'students',
            'principal': 'principals',
        }
        aud = audience_map.get(getattr(user, 'role', ''))
        if aud:
            return qs.filter(Q(audience='all') | Q(audience=aud))
        return qs.filter(audience='all')

    def create(self, request, *args, **kwargs):
        if not self._can_manage(request.user):
            return response.Response(
                {'detail': 'You do not have permission to create announcements.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = self.request.user
        kwargs = {'created_by': user}
        if getattr(user, 'organization_id', None):
            kwargs['organization_id'] = user.organization_id
        # A principal can only post to their own campus
        if user.is_principal() and getattr(user, 'campus_id', None):
            kwargs['campus_id'] = user.campus_id
        announcement = serializer.save(**kwargs)
        self._fan_out_notifications(announcement, actor=user)

    def _fan_out_notifications(self, announcement, actor):
        """Create an in-app notification (+ live WebSocket push via the bell)
        for every user the announcement targets."""
        from django.contrib.auth import get_user_model
        from .services import create_notification
        User = get_user_model()

        recipients = User.objects.filter(is_active=True)
        if announcement.organization_id:
            recipients = recipients.filter(organization_id=announcement.organization_id)
        # Null campus = whole org; specific campus = only that campus
        if announcement.campus_id:
            recipients = recipients.filter(campus_id=announcement.campus_id)
        # Audience targeting
        role_map = {
            'principals': 'principal',
            'coordinators': 'coordinator',
            'teachers': 'teacher',
            'students': 'student',
        }
        target_role = role_map.get(announcement.audience)
        if target_role:
            recipients = recipients.filter(role=target_role)
        # Don't notify the author of their own post
        recipients = recipients.exclude(id=actor.id)

        for r in recipients.iterator():
            try:
                create_notification(
                    recipient=r,
                    actor=actor,
                    verb=f"Announcement: {announcement.title}",
                    target_text=(announcement.body or '')[:255],
                    data={
                        'type': 'announcement',
                        'announcement_id': announcement.id,
                        'priority': announcement.priority,
                    },
                )
            except Exception:
                # never let one bad recipient break the publish
                continue

    def update(self, request, *args, **kwargs):
        if not self._can_manage(request.user):
            return response.Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not self._can_manage(request.user):
            return response.Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._can_manage(request.user):
            return response.Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


# ---------------------------------------------------------------------------
# Web Push subscription endpoints
# ---------------------------------------------------------------------------
@decorators.api_view(['GET'])
@decorators.permission_classes([permissions.AllowAny])
def vapid_public_key(request):
    from django.conf import settings
    return response.Response({'publicKey': getattr(settings, 'VAPID_PUBLIC_KEY', '')})


@decorators.api_view(['POST'])
@decorators.permission_classes([permissions.IsAuthenticated])
def push_subscribe(request):
    data = request.data or {}
    endpoint = data.get('endpoint')
    keys = data.get('keys') or {}
    p256dh = keys.get('p256dh')
    auth = keys.get('auth')
    if not endpoint or not p256dh or not auth:
        return response.Response({'detail': 'Invalid subscription'}, status=status.HTTP_400_BAD_REQUEST)
    PushSubscription.objects.update_or_create(
        endpoint=endpoint,
        defaults={
            'user': request.user,
            'p256dh': p256dh,
            'auth': auth,
            'user_agent': (request.META.get('HTTP_USER_AGENT') or '')[:300],
        },
    )
    return response.Response({'ok': True})


@decorators.api_view(['POST'])
@decorators.permission_classes([permissions.IsAuthenticated])
def push_unsubscribe(request):
    endpoint = (request.data or {}).get('endpoint')
    if endpoint:
        PushSubscription.objects.filter(endpoint=endpoint).delete()
    return response.Response({'ok': True})
