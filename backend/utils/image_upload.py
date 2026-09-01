"""
Safe profile-photo processing for uploads.

Adapted (monolith-style, no microservice/Celery) from the ideas in the copied
`file-service`: instead of trusting and storing the raw upload, we RE-ENCODE it
with Pillow. This is what keeps the server safe without a separate service:

  * rejects anything over a hard size cap (before doing any work),
  * rejects non-image / corrupt / fake files (Pillow can't open them),
  * strips any embedded payload by decoding then re-encoding the pixels,
  * caps dimensions + compresses, so stored files stay small.

Every entity's `upload-photo` endpoint should route the incoming file through
`process_profile_photo()` and save the returned ContentFile onto its ImageField.
"""
import io

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

# Defend against "decompression bombs": a tiny (≤2 MB) file can encode enormous
# pixel dimensions that blow up RAM when decoded (e.g. 30000×30000). Pillow
# raises DecompressionBombError once a decode exceeds this pixel count, so we
# reject such images BEFORE allocating gigabytes. 40 MP ≈ 120 MB RGB — safe on
# a small VPS while comfortably allowing any real phone/camera photo.
Image.MAX_IMAGE_PIXELS = 40_000_000  # 40 megapixels

# Hard cap on the INCOMING file — checked before any decoding work is done.
MAX_UPLOAD_BYTES = 2 * 1024 * 1024  # 2 MB
# Longest side (px) after resizing. Profile pics don't need to be large.
MAX_DIMENSION = 800
# Output is always a compressed JPEG regardless of what was uploaded.
OUTPUT_QUALITY = 85
# Best-effort content-type allowlist (browsers send this; not fully trusted —
# the real guarantee is that Pillow must be able to decode the pixels).
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}


class InvalidImageError(Exception):
    """Raised when the upload is missing, too large, or not a real image."""


def process_profile_photo(uploaded_file, *, filename_stem: str) -> ContentFile:
    """Validate + normalize an uploaded profile photo.

    Args:
        uploaded_file: the Django UploadedFile from request.FILES.
        filename_stem: base name for the stored file (e.g. "coordinator_12").

    Returns:
        A ContentFile (compressed JPEG) ready to assign to an ImageField.

    Raises:
        InvalidImageError: file missing / too large / not a decodable image.
    """
    if uploaded_file is None:
        raise InvalidImageError("No photo file provided.")

    # 1) Size cap FIRST — refuse huge files before spending any CPU/memory.
    size = getattr(uploaded_file, "size", None)
    if size is not None and size > MAX_UPLOAD_BYTES:
        mb = MAX_UPLOAD_BYTES // (1024 * 1024)
        raise InvalidImageError(f"Image too large. Maximum size is {mb} MB.")

    # 2) Best-effort content-type check (cheap early reject).
    content_type = (getattr(uploaded_file, "content_type", "") or "").lower()
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise InvalidImageError("Unsupported image type. Use JPG, PNG, WebP or GIF.")

    # 3) Verify it is actually a decodable image (verify() catches corrupt/fake).
    try:
        uploaded_file.seek(0)
        Image.open(uploaded_file).verify()
    except Image.DecompressionBombError:
        raise InvalidImageError("Image dimensions are too large.")
    except (UnidentifiedImageError, OSError, ValueError):
        raise InvalidImageError("File is not a valid image.")

    # 4) Re-open (verify() leaves the image unusable), normalize + resize + re-encode.
    try:
        uploaded_file.seek(0)
        img = Image.open(uploaded_file)
        img = ImageOps.exif_transpose(img)          # honor camera orientation
        img = img.convert("RGB")                      # drop alpha/palette → JPEG-safe
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))  # cap size, keep aspect ratio
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=OUTPUT_QUALITY, optimize=True)
        buffer.seek(0)
    except Image.DecompressionBombError:
        raise InvalidImageError("Image dimensions are too large.")
    except (UnidentifiedImageError, OSError, ValueError):
        raise InvalidImageError("Could not process the image. Try a different file.")

    return ContentFile(buffer.read(), name=f"{filename_stem}.jpg")
