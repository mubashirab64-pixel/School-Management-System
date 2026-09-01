import json
import logging
import traceback

from django.http import JsonResponse

logger = logging.getLogger(__name__)

STATUS_CODE_MAP = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    422: "VALIDATION_ERROR",
    429: "TOO_MANY_REQUESTS",
    500: "SERVER_ERROR",
    502: "BAD_GATEWAY",
    503: "SERVICE_UNAVAILABLE",
    504: "NETWORK_ERROR",
}


def _error_response(code: str, message: str, status: int, details: dict = None) -> JsonResponse:
    return JsonResponse(
        {
            "success": False,
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
                "status": status,
            },
        },
        status=status,
    )


class JsonErrorMiddleware:
    """
    Catches all unhandled exceptions and Django error responses,
    ensuring the API never returns HTML to the frontend.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            response = self.get_response(request)
        except Exception as exc:
            return self.process_exception(request, exc)

        # Skip JSON conversion for media/static file responses (images, etc.)
        if request.path.startswith('/media/') or request.path.startswith('/static/'):
            return response

        # If response is already JSON-like, leave it alone
        content_type = response.get("Content-Type", "")
        if "application/json" in content_type:
            return response

        # Convert HTML Django error pages (4xx/5xx) to JSON
        if response.status_code >= 400:
            code = STATUS_CODE_MAP.get(response.status_code, "SERVER_ERROR")
            message = self._default_message(response.status_code)
            return _error_response(code, message, response.status_code)

        return response

    def process_exception(self, request, exception):
        from django.http import Http404
        # Http404 should return 404, not 500
        if isinstance(exception, Http404):
            return _error_response("NOT_FOUND", "The requested resource was not found.", 404)
        logger.error(
            "Unhandled exception on %s %s: %s",
            request.method,
            request.path,
            traceback.format_exc(),
        )
        return _error_response(
            "SERVER_ERROR",
            "An unexpected error occurred. Please try again later.",
            500,
        )

    @staticmethod
    def _default_message(status_code: int) -> str:
        messages = {
            400: "Bad request.",
            401: "Authentication required.",
            403: "You do not have permission to perform this action.",
            404: "The requested resource was not found.",
            405: "Method not allowed.",
            422: "Validation failed.",
            429: "Too many requests. Please slow down.",
            500: "Internal server error.",
            502: "Bad gateway.",
            503: "Service temporarily unavailable.",
            504: "Gateway timeout.",
        }
        return messages.get(status_code, "An error occurred.")
