"""
SMS Utility

Twilio SMS integration for sending notifications.
Supports both real Twilio API and dev mode logging.
"""

from datetime import datetime
from flask import current_app


def is_twilio_configured():
    """Check if Twilio credentials are properly configured."""
    account_sid = current_app.config.get("TWILIO_ACCOUNT_SID", "")
    auth_token = current_app.config.get("TWILIO_AUTH_TOKEN", "")
    phone_number = current_app.config.get("TWILIO_PHONE_NUMBER", "")

    # Check for placeholder values (not empty string - that's caught by 'all' check above)
    placeholders = ["your-", "xxx", "placeholder"]

    if not all([account_sid, auth_token, phone_number]):
        return False

    for placeholder in placeholders:
        if placeholder in account_sid.lower() or placeholder in auth_token.lower():
            return False

    # Twilio Account SIDs always start with "AC"
    if not account_sid.startswith("AC"):
        return False

    return True


def send_sms(to_phone, message):
    """
    Send an SMS message via Twilio.

    In dev mode (no Twilio credentials), logs the message instead of sending.

    Args:
        to_phone: Recipient phone number in E.164 format (+15551234567)
        message: SMS message text

    Returns:
        dict: Result with 'success', 'message_sid' (if real), 'error' (if failed)
    """
    # Validate phone number format
    if not to_phone or not to_phone.startswith("+"):
        return {
            "success": False,
            "error": "Invalid phone number format. Use E.164 format (+15551234567)",
        }

    if not message or len(message.strip()) == 0:
        return {"success": False, "error": "Message cannot be empty"}

    # Dev mode - just log
    if not is_twilio_configured():
        current_app.logger.info(
            f"[DEV MODE SMS] To: {to_phone} | Message: {message[:100]}..."
        )
        return {
            "success": True,
            "dev_mode": True,
            "message": "SMS logged (dev mode - Twilio not configured)",
        }

    # Real Twilio integration
    try:
        from twilio.rest import Client
        from twilio.base.exceptions import TwilioRestException

        client = Client(
            current_app.config["TWILIO_ACCOUNT_SID"],
            current_app.config["TWILIO_AUTH_TOKEN"],
        )

        twilio_message = client.messages.create(
            body=message,
            from_=current_app.config["TWILIO_PHONE_NUMBER"],
            to=to_phone,
        )

        current_app.logger.info(
            f"SMS sent: SID={twilio_message.sid}, To={to_phone}, Status={twilio_message.status}"
        )

        return {
            "success": True,
            "message_sid": twilio_message.sid,
            "status": twilio_message.status,
        }

    except TwilioRestException as e:
        current_app.logger.error(f"Twilio error: {e.code} - {e.msg}")
        return {"success": False, "error": f"Twilio error {e.code}: {e.msg}"}

    except Exception as e:
        current_app.logger.error(f"SMS send error: {str(e)}")
        return {"success": False, "error": str(e)}


def format_phone_number(phone):
    """
    Normalize a phone number to E.164 format.

    Args:
        phone: Phone number in various formats

    Returns:
        str: E.164 formatted number or None if invalid
    """
    if not phone:
        return None

    # Remove common formatting characters
    cleaned = "".join(c for c in phone if c.isdigit() or c == "+")

    # Already in E.164 format
    if cleaned.startswith("+"):
        return cleaned

    # US/Canada number without country code
    if len(cleaned) == 10:
        return f"+1{cleaned}"

    # US/Canada number with country code but no +
    if len(cleaned) == 11 and cleaned.startswith("1"):
        return f"+{cleaned}"

    # Unknown format - return as-is with +
    return f"+{cleaned}" if cleaned else None
