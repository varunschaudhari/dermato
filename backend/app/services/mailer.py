import smtplib
from email.message import EmailMessage

from app.core.config import settings


def _html_wrapper(body_html: str) -> str:
    # Inline CSS only — email clients don't support external/embedded stylesheets.
    return f"""\
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px;background-color:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background-color:#0d9488;padding:20px 24px;">
                <span style="color:#ffffff;font-size:18px;font-weight:700;">Dermato</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px;color:#1f2937;font-size:15px;line-height:1.6;">
                {body_html}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;">
                This is an automated message from Dermato. If you didn't expect this email, you can safely ignore it.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def _send(subject: str, body: str, to_email: str, log_tag: str, html: str | None = None) -> None:
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
    if html:
        msg.add_alternative(html, subtype="html")

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
    html = _html_wrapper(
        "<p>We received a request to reset your Dermato password.</p>"
        f'<p style="text-align:center;margin:28px 0;">'
        f'<a href="{reset_link}" style="background-color:#0d9488;color:#ffffff;text-decoration:none;'
        f'font-weight:600;padding:12px 24px;border-radius:8px;display:inline-block;">Reset Password</a></p>'
        f"<p>This link expires in {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes.</p>"
        '<p style="color:#6b7280;font-size:13px;">If you didn\'t request this, you can safely ignore this email.</p>'
    )
    _send("Reset your Dermato password", body, to_email, "password-reset", html)


def send_recheck_reminder_email(to_email: str, patient_name: str, condition: str, link: str) -> None:
    body = (
        f"Hi {patient_name},\n\n"
        f"It's about time for your {condition} recheck — your last treatment plan "
        "recommended checking back in around now to track your progress.\n\n"
        f"Scan again here: {link}\n\n"
        "Keeping up with rechecks is what turns a one-off scan into a real progress record."
    )
    html = _html_wrapper(
        f"<p>Hi {patient_name},</p>"
        f"<p>It's about time for your <strong>{condition}</strong> recheck — your last treatment plan "
        "recommended checking back in around now to track your progress.</p>"
        f'<p style="text-align:center;margin:28px 0;">'
        f'<a href="{link}" style="background-color:#0d9488;color:#ffffff;text-decoration:none;'
        f'font-weight:600;padding:12px 24px;border-radius:8px;display:inline-block;">Scan Again</a></p>'
        '<p style="color:#6b7280;font-size:13px;">Keeping up with rechecks is what turns a one-off scan '
        "into a real progress record.</p>"
    )
    _send(f"Time for your {condition} recheck", body, to_email, "recheck-reminder", html)
