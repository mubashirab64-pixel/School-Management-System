from django.urls import path
from .views import AIChatView, AIChatHistoryView, AIChatConversationsView

urlpatterns = [
    path("chat/", AIChatView.as_view(), name="ai_chat"),
    path("chat/history/", AIChatHistoryView.as_view(), name="ai_chat_history"),
    path("chat/conversations/", AIChatConversationsView.as_view(), name="ai_chat_conversations"),
]
