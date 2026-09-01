from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FeeTypeViewSet, FeeStructureViewSet,
    StudentFeeViewSet, PaymentViewSet,
    GenerateChallansView, FeeReportCollectionView,
    BankAccountViewSet, PaymentTransactionViewSet,
    CashPaymentView,
)

router = DefaultRouter()
router.register(r'fee-types', FeeTypeViewSet, basename='fee-type')
router.register(r'structures', FeeStructureViewSet, basename='fee-structure')
router.register(r'student-fees', StudentFeeViewSet, basename='student-fee')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'banks', BankAccountViewSet, basename='bank-account')
router.register(r'payment-transactions', PaymentTransactionViewSet, basename='payment-transaction')

urlpatterns = [
    path('', include(router.urls)),
    path('generate/', GenerateChallansView.as_view(), name='generate-fees'),
    path('reports/collection/', FeeReportCollectionView.as_view(), name='fee-collection-report'),
    path('cash/record/', CashPaymentView.as_view(), name='cash-payment-record'),
]
