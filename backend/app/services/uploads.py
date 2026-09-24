import os
import uuid

from fastapi import HTTPException, UploadFile

from app.core.config import settings


async def validate_image(file: UploadFile) -> bytes:
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    contents = await file.read()
    max_bytes = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Image exceeds the {settings.MAX_IMAGE_SIZE_MB}MB limit")
    return contents


def save_upload(contents: bytes, original_filename: str) -> str:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(original_filename or "")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(settings.UPLOAD_DIR, filename), "wb") as f:
        f.write(contents)
    return filename
