"""
Finds the newest Android build published as a GitHub release, for the mobile
app's "Update available" prompt (app/api/routes/app_version.py).

The release workflow is: bump DermatoMobile/package.json "version", build the
APK, publish a GitHub release tagged vX.Y.Z with the .apk attached. Nothing on
the server has to change; this module picks the release up on its next
refresh (APP_RELEASE_CACHE_SECONDS).
"""
import json
import re
import threading
import time
import urllib.request
from typing import Optional

from app.core.config import settings

Version = tuple[int, int, int]

# Retry a failed GitHub lookup after this long instead of on every request.
_FAILURE_RETRY_SECONDS = 60

_lock = threading.Lock()
_cache: dict = {"fetched": False, "at": 0.0, "value": None}


def parse_version(text: Optional[str]) -> Optional[Version]:
    """'v1.2' -> (1, 2, 0); 'v1.3.1' -> (1, 3, 1); anything else -> None."""
    match = re.fullmatch(r"v?(\d+)\.(\d+)(?:\.(\d+))?", (text or "").strip())
    if not match:
        return None
    major, minor, patch = match.groups()
    return int(major), int(minor), int(patch or 0)


def format_version(version: Version) -> str:
    return ".".join(str(part) for part in version)


def pick_latest_apk_release(releases: list[dict]) -> Optional[dict]:
    """The highest-versioned published (not draft/prerelease) release that has
    an .apk asset. Releases without a parseable vX.Y[.Z] tag or without an
    APK (e.g. a backend-only release) are ignored."""
    best = None
    for release in releases:
        if release.get("draft") or release.get("prerelease"):
            continue
        version = parse_version(release.get("tag_name"))
        apk = next(
            (a for a in release.get("assets") or [] if str(a.get("name", "")).lower().endswith(".apk")),
            None,
        )
        if version is None or apk is None:
            continue
        if best is None or version > best["version"]:
            best = {
                "version": version,
                "download_url": apk.get("browser_download_url"),
                "release_url": release.get("html_url"),
                "release_name": release.get("name") or release.get("tag_name"),
                "published_at": release.get("published_at"),
            }
    return best


def _fetch_releases() -> list[dict]:
    url = f"https://api.github.com/repos/{settings.APP_RELEASES_REPO}/releases?per_page=30"
    request = urllib.request.Request(
        url, headers={"Accept": "application/vnd.github+json", "User-Agent": "dermato-backend"}
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.load(response)


def latest_android_release() -> Optional[dict]:
    """Cached lookup. If GitHub is unreachable, keeps serving the last known
    release (or None if there never was one) rather than failing the request."""
    now = time.monotonic()
    with _lock:
        if _cache["fetched"] and now - _cache["at"] < settings.APP_RELEASE_CACHE_SECONDS:
            return _cache["value"]

    try:
        value = pick_latest_apk_release(_fetch_releases())
    except Exception as exc:  # network error, rate limit, bad JSON...
        print(f"GitHub release lookup failed, keeping last known app release: {exc}")
        with _lock:
            _cache["fetched"] = True
            _cache["at"] = now - settings.APP_RELEASE_CACHE_SECONDS + _FAILURE_RETRY_SECONDS
            return _cache["value"]

    with _lock:
        _cache.update(fetched=True, at=now, value=value)
    return value


def reset_cache() -> None:
    """For tests."""
    with _lock:
        _cache.update(fetched=False, at=0.0, value=None)
