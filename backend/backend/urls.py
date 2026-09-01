# backend/backend/urls.py
"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    http://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

# Monkeypatch AdminSite to customize app list order
def get_app_list(self, request, app_label=None):
    """
    Override the default get_app_list to provide a custom sort order as requested.
    """
    app_dict = self._build_app_dict(request, app_label)
    
    # Define custom order (app_label: priority)
    order = {
        "users": 1,
        "students": 2,
        "teachers": 3,
        "coordinator": 4,
        "principals": 5,
        "campus": 6,
        "classes": 7,
        "attendance": 8,
        "fees": 9,
        "result": 10,
        "timetable": 11,
        "form_builder": 12,
    }
    
    app_list = sorted(app_dict.values(), key=lambda x: order.get(x['app_label'], 999))
    
    # Sort models within each app alphabetically for a cleaner look
    for app in app_list:
        app['models'].sort(key=lambda x: x['name'])
        
    return app_list

admin.AdminSite.get_app_list = get_app_list
from django.conf import settings
from django.conf.urls.static import static
from graphene_django.views import GraphQLView
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse

from users.views import SubscriptionPlanListCreateView, SubscriptionPlanDetailView


def health_check(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("api/health/", health_check, name="health_check"),
    path('sms-admin/', admin.site.urls),
    path("api/plans/", SubscriptionPlanListCreateView.as_view(), name='plan_list_create'),
    path("api/plans/<int:pk>/", SubscriptionPlanDetailView.as_view(), name='plan_detail'),
    path("api/", include("users.urls")),
    path("api/", include("students.urls")),
    path("api/", include("campus.urls")),
    path("api/", include("teachers.urls")),
    path("api/", include("notifications.urls")),
    path("api/", include("coordinator.urls")),
    path("api/", include("principals.urls")),
    path("api/attendance/", include("attendance.urls")),
    path("api/requests/", include("requests.urls")),
    path("api/result/", include("result.urls")),
    # Also provide plural path for legacy/frontend expectations
    path("api/results/", include("result.urls")),
    path('api/', include('classes.urls')),
    path("api/transfers/", include("transfers.urls")),
    path("api/behaviour/", include("behaviour.urls")),
    path("api/timetable/", include("timetable.urls")),
    path("api/form-builder/", include("form_builder.urls")),
    path("api/fees/", include("fees.urls")),
    path("api/retest/", include("retest.urls")),
    path("api/ai/", include("ai_chat.urls")),
    # GraphQL endpoint (enable GraphiQL only in DEBUG)
    path("graphql/", csrf_exempt(GraphQLView.as_view(graphiql=settings.DEBUG))),

    # ZKTeco Universal ADMS Paths (Root level access for machine default paths)
    path('iclock/cdata', include('attendance.urls_zkteco')),
    path('iclock/getrequest', include('attendance.urls_zkteco')),
    path('iclock/registry', include('attendance.urls_zkteco')),
    path('iclock/push', include('attendance.urls_zkteco')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)