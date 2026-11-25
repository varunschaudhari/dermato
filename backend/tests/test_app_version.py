import pytest

from app.core.config import settings
from app.services import app_release


def _release(tag, apk=True, draft=False, prerelease=False):
    assets = [{"name": "notes.txt", "browser_download_url": f"https://example.test/{tag}/notes.txt"}]
    if apk:
        assets.append({"name": f"dermato-{tag}.apk", "browser_download_url": f"https://example.test/{tag}/dermato.apk"})
    return {
        "tag_name": tag,
        "name": f"Dermato {tag}",
        "html_url": f"https://example.test/releases/{tag}",
        "published_at": "2026-11-25T05:00:00Z",
        "draft": draft,
        "prerelease": prerelease,
        "assets": assets,
    }


@pytest.fixture(autouse=True)
def _fresh_cache():
    app_release.reset_cache()
    yield
    app_release.reset_cache()


@pytest.mark.parametrize(
    "text,expected",
    [("v1.2", (1, 2, 0)), ("1.3.1", (1, 3, 1)), (" v10.0.2 ", (10, 0, 2)), ("latest", None), ("v1", None), ("", None), (None, None)],
)
def test_parse_version(text, expected):
    assert app_release.parse_version(text) == expected


def test_pick_latest_skips_drafts_prereleases_and_apk_less_releases():
    releases = [
        _release("v2.0.0", draft=True),
        _release("v1.9.0", prerelease=True),
        _release("v1.8.0", apk=False),
        _release("not-a-version"),
        _release("v1.2"),
        _release("v1.3.0"),
    ]
    picked = app_release.pick_latest_apk_release(releases)
    assert picked["version"] == (1, 3, 0)
    assert picked["download_url"] == "https://example.test/v1.3.0/dermato.apk"


def test_pick_latest_compares_versions_numerically_not_by_list_order():
    picked = app_release.pick_latest_apk_release([_release("v1.9.0"), _release("v1.10.0"), _release("v1.2")])
    assert picked["version"] == (1, 10, 0)


def test_pick_latest_with_no_usable_release():
    assert app_release.pick_latest_apk_release([]) is None
    assert app_release.pick_latest_apk_release([_release("v1.0", apk=False)]) is None


def test_version_endpoint_reports_latest_release(client, monkeypatch):
    monkeypatch.setattr(app_release, "_fetch_releases", lambda: [_release("v1.2"), _release("v1.3.0")])
    monkeypatch.setattr(settings, "ANDROID_MIN_SUPPORTED_VERSION", "")
    res = client.get("/api/app/version")  # no auth header: must be public
    assert res.status_code == 200
    assert res.json() == {
        "platform": "android",
        "latest_version": "1.3.0",
        "download_url": "https://example.test/v1.3.0/dermato.apk",
        "release_url": "https://example.test/releases/v1.3.0",
        "release_name": "Dermato v1.3.0",
        "min_supported_version": None,
    }


def test_version_endpoint_reports_min_supported_version(client, monkeypatch):
    monkeypatch.setattr(app_release, "_fetch_releases", lambda: [_release("v1.3.0")])
    monkeypatch.setattr(settings, "ANDROID_MIN_SUPPORTED_VERSION", "1.3")
    assert client.get("/api/app/version").json()["min_supported_version"] == "1.3.0"


def test_version_endpoint_caches_github_lookups(client, monkeypatch):
    calls = []

    def fake_fetch():
        calls.append(1)
        return [_release("v1.3.0")]

    monkeypatch.setattr(app_release, "_fetch_releases", fake_fetch)
    client.get("/api/app/version")
    client.get("/api/app/version")
    assert len(calls) == 1


def test_version_endpoint_survives_github_outage(client, monkeypatch):
    def boom():
        raise OSError("network down")

    monkeypatch.setattr(app_release, "_fetch_releases", boom)
    res = client.get("/api/app/version")
    assert res.status_code == 200
    assert res.json()["latest_version"] is None


def test_github_outage_keeps_serving_last_known_release(client, monkeypatch):
    monkeypatch.setattr(app_release, "_fetch_releases", lambda: [_release("v1.3.0")])
    assert client.get("/api/app/version").json()["latest_version"] == "1.3.0"

    # Expire the cache, then make GitHub fail: the last good answer is kept.
    monkeypatch.setattr(settings, "APP_RELEASE_CACHE_SECONDS", 0)

    def boom():
        raise OSError("network down")

    monkeypatch.setattr(app_release, "_fetch_releases", boom)
    assert client.get("/api/app/version").json()["latest_version"] == "1.3.0"
