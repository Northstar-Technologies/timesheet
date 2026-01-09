"""
User Routes

User settings and profile preferences (REQ-003).
"""

from flask import Blueprint, request, session
from ..models import User
from ..extensions import db
from ..utils.decorators import login_required
from ..utils.sms import format_phone_number

users_bp = Blueprint("users", __name__)


def _dedupe(values):
    seen = set()
    deduped = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        deduped.append(value)
    return deduped


def _normalize_emails(emails):
    if emails is None:
        return []
    if not isinstance(emails, list):
        raise ValueError("notification_emails must be a list")
    normalized = []
    for email in emails:
        if not isinstance(email, str):
            raise ValueError("notification_emails must be strings")
        cleaned = email.strip().lower()
        if not cleaned:
            continue
        if "@" not in cleaned or "." not in cleaned.split("@")[-1]:
            raise ValueError(f"Invalid email: {email}")
        normalized.append(cleaned)
    return _dedupe(normalized)


def _normalize_phones(phones):
    if phones is None:
        return []
    if not isinstance(phones, list):
        raise ValueError("notification_phones must be a list")
    normalized = []
    for phone in phones:
        if not isinstance(phone, str):
            raise ValueError("notification_phones must be strings")
        cleaned = phone.strip()
        if not cleaned:
            continue
        digits = "".join(c for c in cleaned if c.isdigit())
        if len(digits) < 10 or len(digits) > 15:
            raise ValueError(f"Invalid phone number: {phone}")
        formatted = format_phone_number(cleaned)
        if not formatted:
            raise ValueError(f"Invalid phone number: {phone}")
        normalized.append(formatted)
    return _dedupe(normalized)


@users_bp.route("/me/settings", methods=["GET"])
@login_required
def get_user_settings():
    """Get current user's notification settings."""
    user = User.query.filter_by(id=session["user"]["id"]).first()
    if not user:
        return {"error": "User not found"}, 404

    return {
        "email": user.email,
        "phone": user.phone,
        "notification_emails": user.get_notification_emails(),
        "notification_phones": user.get_notification_phones(),
        "email_opt_in": user.email_opt_in,
        "sms_opt_in": user.sms_opt_in,
        "teams_opt_in": user.teams_opt_in,
        "teams_account": user.teams_account,
    }


@users_bp.route("/me/settings", methods=["PUT"])
@login_required
def update_user_settings():
    """Update current user's notification settings."""
    user = User.query.filter_by(id=session["user"]["id"]).first()
    if not user:
        return {"error": "User not found"}, 404

    data = request.get_json() or {}

    try:
        emails = _normalize_emails(data.get("notification_emails"))
        phones = _normalize_phones(data.get("notification_phones"))
    except ValueError as exc:
        return {"error": str(exc)}, 400

    email_opt_in = bool(data.get("email_opt_in", True))
    sms_opt_in = bool(data.get("sms_opt_in", True))
    teams_opt_in = bool(data.get("teams_opt_in", True))
    teams_account = (data.get("teams_account") or "").strip().lower() or None

    if email_opt_in and not emails:
        return {"error": "Email notifications require at least one email address"}, 400
    if sms_opt_in and not phones:
        return {"error": "SMS notifications require at least one phone number"}, 400
    if teams_opt_in and not teams_account:
        return {"error": "Teams notifications require a connected account"}, 400

    user.notification_emails = emails
    user.notification_phones = phones
    user.email_opt_in = email_opt_in
    user.sms_opt_in = sms_opt_in
    user.teams_opt_in = teams_opt_in
    user.teams_account = teams_account

    user.phone = phones[0] if phones else None

    db.session.commit()

    session["user"] = user.to_dict()

    return user.to_dict()
