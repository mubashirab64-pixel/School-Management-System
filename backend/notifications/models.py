from django.conf import settings
from django.db import models
from users.managers import OrganizationManager
from django.utils import timezone


class Notification(models.Model):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications'
    )
    
    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='notifications'
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='actor_notifications'
    )
    verb = models.CharField(max_length=255)
    target_text = models.CharField(max_length=255, blank=True)
    data = models.JSONField(default=dict, blank=True)
    unread = models.BooleanField(default=True)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Notification(to={self.recipient}, verb={self.verb})"

    def mark_read(self):
        self.unread = False
        self.save()


class Announcement(models.Model):
    """Broadcast announcements created top-down (org admin → organization,
    principal → their campus) and read by everyone in scope."""

    PRIORITY_CHOICES = [
        ('normal', 'Normal'),
        ('important', 'Important'),
        ('urgent', 'Urgent'),
    ]
    AUDIENCE_CHOICES = [
        ('all', 'Everyone'),
        ('principals', 'Principals'),
        ('coordinators', 'Coordinators'),
        ('teachers', 'Teachers'),
        ('students', 'Students'),
    ]

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE, null=True, blank=True,
        related_name='announcements'
    )
    # Null campus = organization-wide; a campus = campus-specific
    campus = models.ForeignKey(
        'campus.Campus', on_delete=models.CASCADE, null=True, blank=True,
        related_name='announcements'
    )
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='normal')
    audience = models.CharField(max_length=20, choices=AUDIENCE_CHOICES, default='all')
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='created_announcements'
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Announcement({self.title})"


class PushSubscription(models.Model):
    """A browser Web Push subscription for a user/device. Lets the backend
    deliver OS-level notifications even when the app/tab is closed."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='push_subscriptions'
    )
    endpoint = models.TextField(unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    user_agent = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"PushSubscription(user={self.user_id})"
