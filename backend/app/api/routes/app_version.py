from fastapi import APIRouter

from app.core.config import settings
from app.services import app_release

router = APIRouter()


@router.get("/version")
def android_app_version():
    """What the mobile app checks on launch to decide whether to show an
    "Update available" (or, below min_supported_version, "Update required")
    prompt. Public — the check also runs on the login screen. Never fails:
    if GitHub can't be reached and nothing is cached, latest_version is null
    and the app simply shows no prompt.
    """
    release = app_release.latest_android_release()
    min_supported = app_release.parse_version(settings.ANDROID_MIN_SUPPORTED_VERSION)
    return {
        "platform": "android",
        "latest_version": app_release.format_version(release["version"]) if release else None,
        "download_url": release["download_url"] if release else None,
        "release_url": release["release_url"] if release else None,
        "release_name": release["release_name"] if release else None,
        "min_supported_version": app_release.format_version(min_supported) if min_supported else None,
    }
