from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.exceptions import AuthenticationFailed


class TokenVersionJWTAuthentication(JWTAuthentication):
    """
    Custom JWT authentication that validates token_version.
    When a user's role is switched, token_version increments and
    all existing tokens become invalid, forcing re-login.
    """

    def get_validated_token(self, raw_token):
        validated_token = super().get_validated_token(raw_token)
        return validated_token

    def get_user(self, validated_token):
        user = super().get_user(validated_token)

        # Check token_version if present in token payload
        token_version_in_token = validated_token.get('token_version')
        if token_version_in_token is not None:
            if user.token_version != token_version_in_token:
                raise AuthenticationFailed(
                    'Session expired due to role change. Please log in again.',
                    code='token_version_mismatch'
                )

        return user
