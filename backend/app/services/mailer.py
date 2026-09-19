import smtplib
from email.message import EmailMessage

from app.core.config import settings


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    subject = "Reset your Dermato password"
    body = (
        "We received a request to reset your Dermato password.\n\n"
        f"Reset it here (this link expires in {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes):\n"
        f"{reset_link}\n\n"
        "If you didn't request this, you can safely ignore this email."
    )

    if not settings.SMTP_HOST:
        # No SMTP configured yet — log the link so the flow is testable in dev
        # without real mail infra. Set SMTP_HOST (+ SMTP_USER/PASSWORD) in .env
        # to send real emails.
        print(f"[password-reset] SMTP not configured. Reset link for {to_email}: {reset_link}")
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
