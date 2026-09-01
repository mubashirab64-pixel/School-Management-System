from django.urls import path
from .views import BehaviourRecordCreateView, StudentBehaviourListView, ComputeMonthlyBehaviourView, StudentMonthlyBehaviourView

urlpatterns = [
    path('record/', BehaviourRecordCreateView.as_view(), name='behaviour-record-create'),
    path('student/<int:student_id>/', StudentBehaviourListView.as_view(), name='behaviour-student-list'),
    path('monthly/compute/', ComputeMonthlyBehaviourView.as_view(), name='behaviour-monthly-compute'),
    path('monthly/student/<int:student_id>/', StudentMonthlyBehaviourView.as_view(), name='behaviour-monthly-student'),
]


