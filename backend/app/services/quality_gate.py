import cv2
import numpy as np
from fastapi import HTTPException

from app.core.config import settings


def assess(image: np.ndarray) -> None:
    """Reject photos that are too low-res, blurry, or poorly lit for reliable analysis."""
    if image.shape[0] < 480 or image.shape[1] < 480:
        raise HTTPException(
            status_code=422,
            detail={
                "reason": "low_resolution",
                "message": "This photo's resolution is too low for accurate analysis. Please use a higher-quality photo.",
            },
        )

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    resized = _resize_to_width(gray, 640)

    blur_variance = cv2.Laplacian(resized, cv2.CV_64F).var()
    if blur_variance < settings.MIN_BLUR_VARIANCE:
        raise HTTPException(
            status_code=422,
            detail={
                "reason": "blurry",
                "message": "This photo looks a bit blurry. Hold the camera steady and try again.",
            },
        )

    brightness = float(resized.mean())
    if brightness < settings.MIN_BRIGHTNESS:
        raise HTTPException(
            status_code=422,
            detail={
                "reason": "too_dark",
                "message": "This photo is too dark. Move to a brighter, well-lit area and try again.",
            },
        )
    if brightness > settings.MAX_BRIGHTNESS:
        raise HTTPException(
            status_code=422,
            detail={
                "reason": "too_bright",
                "message": "This photo is overexposed. Reduce direct flash or bright light and try again.",
            },
        )

    if _skin_pixel_pct(image) < settings.MIN_SKIN_PIXEL_PCT:
        raise HTTPException(
            status_code=422,
            detail={
                "reason": "no_skin_detected",
                "message": "We couldn't detect skin in this photo. Make sure the area you want analyzed is clearly visible and try again.",
            },
        )


def _resize_to_width(gray: np.ndarray, width: int) -> np.ndarray:
    """Resize a grayscale image to a fixed width, preserving aspect ratio."""
    height = int(gray.shape[0] * (width / gray.shape[1]))
    return cv2.resize(gray, (width, height))


def _skin_pixel_pct(image: np.ndarray) -> float:
    """% of pixels in the broad YCrCb skin-tone band — a coarse sanity check that
    *some* skin is in frame, not a segmentation. Deliberately tone-inclusive: Cr/Cb
    chrominance is far less sensitive to darkness/lightness than to hue."""
    ycrcb = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)
    mask = cv2.inRange(ycrcb, (0, 140, 85), (255, 175, 125))
    return float(mask.mean()) / 255 * 100
