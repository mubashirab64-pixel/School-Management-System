from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_default_handler

STATUS_CODE_MAP = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    422: "VALIDATION_ERROR",
    429: "TOO_MANY_REQUESTS",
    500: "SERVER_ERROR",
}


def _flatten_errors(detail):
    """Recursively flatten DRF validation error detail into a plain dict."""
    if isinstance(detail, list):
        return [_flatten_errors(item) for item in detail]
    if isinstance(detail, dict):
        return {key: _flatten_errors(val) for key, val in detail.items()}
    return str(detail)


def custom_exception_handler(exc, context):
    response = drf_default_handler(exc, context)

    if response is None:
        # DRF didn't handle it — let JsonErrorMiddleware deal with it
        return None

    http_status = response.status_code

    # Determine error code
    code = STATUS_CODE_MAP.get(http_status, "SERVER_ERROR")

    # Build details from DRF's structured validation errors
    details = {}
    raw = response.data

    if isinstance(raw, dict):
        # Validation errors come as field -> [error, ...] dicts
        non_field = raw.pop("non_field_errors", None)
        details = _flatten_errors(raw)
        if non_field:
            details["non_field_errors"] = _flatten_errors(non_field)
        # Common single-key patterns: {"detail": "..."} → use as message
        message = str(raw.get("detail", "")) if "detail" in raw and not details else None
    elif isinstance(raw, list):
        details = {"errors": _flatten_errors(raw)}
        message = None
    else:
        message = str(raw)

    if not message:
        message = _default_message(http_status)

    # If it was purely {"detail": "..."} with nothing else, keep details empty
    if list(details.keys()) == ["detail"]:
        message = details["detail"]
        details = {}

    response.data = {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "status": http_status,
        },
    }
    return response


def _default_message(status_code: int) -> str:
    messages = {
        400: "Bad request.",
        401: "Authentication credentials were not provided or are invalid.",
        403: "You do not have permission to perform this action.",
        404: "The requested resource was not found.",
        405: "Method not allowed.",
        422: "Validation failed. Please check the submitted data.",
        429: "Too many requests.",
        500: "Internal server error.",
    }
    return messages.get(status_code, "An error occurred.")
