# urls.py
from django.urls import path
from .views import ExitRecordCreateView

urlpatterns = [
    path("terminate/", ExitRecordCreateView.as_view(), name="terminate-student"),
]
