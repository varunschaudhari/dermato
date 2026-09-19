import smtplib
from email.message import EmailMessage

from app.core.config import settings


def _send(subject: str, body: str, to_email: str, log_tag: str) -> None:
    if not settings.SMTP_HOST:
        # No SMTP configured yet — log instead of sending so the flow is
        # testable in dev without real mail infra. Set SMTP_HOST (+
        # SMTP_USER/PASSWORD) in .env to send real emails.
        print(f"[{log_tag}] SMTP not configured. Would email {to_email}:\n{body}")
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    msg.set_content(body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    body = (
        "We received a request to reset your Dermato password.\n\n"
        f"Reset it here (this link expires in {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes):\n"
        f"{reset_link}\n\n"
        "If you didn't request this, you can safely ignore this email."
    )
    _send("Reset your Dermato password", body, to_email, "password-reset")


def send_recheck_reminder_email(to_email: str, patient_name: str, condition: str, link: str) -> None:
    body = (
        f"Hi {patient_name},\n\n"
        f"It's about time for your {condition} recheck — your last treatment plan "
        "recommended checking back in around now to track your progress.\n\n"
        f"Scan again here: {link}\n\n"
        "Keeping up with rechecks is what turns a one-off scan into a real progress record."
    )
    _send(f"Time for your {condition} recheck", body, to_email, "recheck-reminder")
