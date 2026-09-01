import time
import json
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

class MonitoringMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.channel_layer = get_channel_layer()

    def __call__(self, request):
        # Only log API and admin requests
        if not (request.path.startswith('/api/') or request.path.startswith('/sms-admin/')):
            return self.get_response(request)

        start_time = time.time()
        response = self.get_response(request)
        duration = time.time() - start_time

        # Prepare log data
        user = "Anonymous"
        if hasattr(request, 'user') and request.user.is_authenticated:
            user = request.user.email or request.user.username

        # Get organization info if available
        org_id = None
        org_owner_id = None
        if hasattr(request, 'user') and request.user.is_authenticated:
            if hasattr(request.user, 'organization') and request.user.organization:
                org_id = request.user.organization.id
                if hasattr(request.user.organization, 'created_by') and request.user.organization.created_by:
                    org_owner_id = request.user.organization.created_by.id

        log_data = {
            'service': 'backend',
            'timestamp': timezone.now().strftime('%H:%M:%S'),
            'method': request.method,
            'path': request.path,
            'status': response.status_code,
            'duration': f"{int(duration * 1000)}ms",
            'user': user,
            'ip': request.META.get('REMOTE_ADDR', 'unknown'),
            'organization_id': org_id,
            'org_owner_id': org_owner_id
        }

        # Broadcast log to the system_monitoring group
        try:
            async_to_sync(self.channel_layer.group_send)(
                "system_monitoring",
                {
                    "type": "log_message",
                    "log": log_data
                }
            )
        except Exception:
            # Don't let logging break the request
            pass

        return response
