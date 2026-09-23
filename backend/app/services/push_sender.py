from app.core.config import settings

_app = None


def _ensure_initialized():
    """Lazy, once-only firebase_admin.initialize_app() -- deferred so importing
    this module never touches the filesystem/network when push isn't configured
    (e.g. in tests, or a dev box with no Firebase credentials at all)."""
    global _app
    if _app is not None:
        return
    import firebase_admin
    from firebase_admin import credentials

    cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
    _app = firebase_admin.initialize_app(cred)


def send_push(token: str, title: str, body: str, link: str = "") -> None:
    if not settings.FIREBASE_CREDENTIALS_PATH:
        # No Firebase project configured yet -- log instead of sending so the
        # flow is testable without real push infra. Set FIREBASE_CREDENTIALS_PATH
        # in .env to send real pushes (see the mobile push-notifications plan for
        # how to obtain the service-account JSON this points at).
        print(f"[push] Firebase not configured. Would push to {token}: {title} - {body}")
        return

    from firebase_admin import messaging

    _ensure_initialized()
    messaging.send(
        messaging.Message(
            token=token,
            notification=messaging.Notification(title=title, body=body),
            data={"link": link or ""},
        )
    )
