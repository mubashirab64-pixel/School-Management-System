"""Shared test helpers for the attendance suite."""
from django.test import Client
from rest_framework_simplejwt.tokens import RefreshToken

from users.middleware import _organization_var, _user_var


class TenantContext:
    """Set the request-scoped user that OrganizationManager reads.

    Most models here use OrganizationManager, which filters every queryset by
    the current user's organization and returns nothing at all when no user is
    set (users/managers.py). OrganizationMiddleware supplies that on a real
    request; test setup and direct service calls have to supply it themselves.

    Two things bite without it, and neither raises:
      - a service called outside a request sees an empty queryset
      - `Model.objects.filter(...).update(...)` matches zero rows and silently
        does nothing, even though `Model.objects.create(...)` worked, because
        create() does not go through get_queryset()

    Usage:
        with TenantContext(user):
            ClassRoom.objects.filter(pk=pk).update(created_at=day)
    """

    def __init__(self, user, organization=None):
        self.user = user
        self.organization = organization or getattr(user, 'organization', None)

    def __enter__(self):
        self._user_token = _user_var.set(self.user)
        self._org_token = _organization_var.set(self.organization)
        return self

    def __exit__(self, *exc_info):
        _user_var.reset(self._user_token)
        _organization_var.reset(self._org_token)
        return False


def authenticated_client(user):
    """A Django test client carrying a real JWT for *user*.

    DRF's APIClient cannot be imported in this project: it ships a Django app
    called `requests` (backend/requests/) which shadows the pip `requests`
    library, and rest_framework.test imports that library at module load. Going
    through a real Bearer token exercises the actual auth path anyway.
    """
    token = RefreshToken.for_user(user).access_token
    client = Client()
    client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'
    return client
