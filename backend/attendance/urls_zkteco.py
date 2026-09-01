from django.urls import path
from . import views

urlpatterns = [
    path('', views.zkteco_push, name='zkteco_push_root'),
]
