from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()

class EmailOrUsernameModelBackend(ModelBackend):
    """
    Custom authentication backend that allows users to log in using either
    their email address or their username (Employee ID).
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        
        try:
            user = User.objects.get(Q(username__iexact=username) | Q(email__iexact=username))
            
            if user.check_password(password) and self.user_can_authenticate(user):
                return user
        except User.DoesNotExist:
            User().set_password(password)
        return None

    def get_user(self, user_id):
        try:
            user = User.objects.get(pk=user_id)
            if self.user_can_authenticate(user):
                return user
        except User.DoesNotExist:
            return None
