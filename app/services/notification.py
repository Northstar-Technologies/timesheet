"""
Notification Service

Handles sending SMS notifications for timesheet events.
Creates notification records and sends via Twilio.
"""

from datetime import datetime
from flask import current_app
from ..models import Notification, NotificationType, User
from ..extensions import db
from ..utils.sms import send_sms, format_phone_number


class NotificationService:
    """
    Service for sending SMS notifications to users.

    Handles:
    - Timesheet approval notifications
    - Needs attention notifications
    - Weekly reminder notifications (scheduled)
    """

    @staticmethod
    def notify_approved(timesheet):
        """
        Send notification when a timesheet is approved.

        Args:
            timesheet: The approved Timesheet object

        Returns:
            Notification: The created notification record
        """
        user = timesheet.user
        if not user:
            current_app.logger.warning(
                f"Cannot notify: timesheet {timesheet.id} has no associated user"
            )
            return None

        # Check if user has opted in and has a phone number
        if not user.sms_opt_in:
            current_app.logger.info(
                f"SMS skipped for {user.email}: user has not opted in"
            )
            return None

        phone = format_phone_number(user.phone)
        if not phone:
            current_app.logger.info(
                f"SMS skipped for {user.email}: no valid phone number"
            )
            return None

        # Format the message
        week_str = timesheet.week_start.strftime("%b %d, %Y")
        message = f"✅ Your timesheet for week of {week_str} has been approved!"

        # Create notification record
        notification = Notification(
            user_id=user.id,
            timesheet_id=timesheet.id,
            type=NotificationType.APPROVED,
            message=message,
        )
        db.session.add(notification)

        # Send SMS
        result = send_sms(phone, message)

        if result.get("success"):
            notification.sent = True
            notification.sent_at = datetime.utcnow()
            current_app.logger.info(
                f"Approval notification sent to {user.email} ({phone})"
            )
        else:
            notification.sent = False
            notification.error = result.get("error", "Unknown error")
            current_app.logger.error(
                f"Failed to send approval notification to {user.email}: {notification.error}"
            )

        db.session.commit()
        return notification

    @staticmethod
    def notify_needs_attention(timesheet, reason=None):
        """
        Send notification when a timesheet needs attention.

        Args:
            timesheet: The Timesheet object marked as needing attention
            reason: Optional reason for the rejection

        Returns:
            Notification: The created notification record
        """
        user = timesheet.user
        if not user:
            current_app.logger.warning(
                f"Cannot notify: timesheet {timesheet.id} has no associated user"
            )
            return None

        # Check if user has opted in and has a phone number
        if not user.sms_opt_in:
            current_app.logger.info(
                f"SMS skipped for {user.email}: user has not opted in"
            )
            return None

        phone = format_phone_number(user.phone)
        if not phone:
            current_app.logger.info(
                f"SMS skipped for {user.email}: no valid phone number"
            )
            return None

        # Format the message
        week_str = timesheet.week_start.strftime("%b %d, %Y")
        if reason:
            message = f"⚠️ Your timesheet for week of {week_str} needs attention: {reason}"
        else:
            message = f"⚠️ Your timesheet for week of {week_str} needs attention. Please log in to add the required attachment."

        # Truncate if too long (SMS limit is 160 chars for single segment)
        if len(message) > 160:
            message = message[:157] + "..."

        # Create notification record
        notification = Notification(
            user_id=user.id,
            timesheet_id=timesheet.id,
            type=NotificationType.NEEDS_ATTACHMENT,
            message=message,
        )
        db.session.add(notification)

        # Send SMS
        result = send_sms(phone, message)

        if result.get("success"):
            notification.sent = True
            notification.sent_at = datetime.utcnow()
            current_app.logger.info(
                f"Needs attention notification sent to {user.email} ({phone})"
            )
        else:
            notification.sent = False
            notification.error = result.get("error", "Unknown error")
            current_app.logger.error(
                f"Failed to send needs attention notification to {user.email}: {notification.error}"
            )

        db.session.commit()
        return notification

    @staticmethod
    def send_weekly_reminder(user, week_start):
        """
        Send a weekly reminder to submit timesheet.

        Args:
            user: The User object to remind
            week_start: The date of week start

        Returns:
            Notification: The created notification record
        """
        # Check if user has opted in and has a phone number
        if not user.sms_opt_in:
            return None

        phone = format_phone_number(user.phone)
        if not phone:
            return None

        # Format the message
        week_str = week_start.strftime("%b %d")
        message = f"📋 Reminder: Don't forget to submit your timesheet for week of {week_str}!"

        # Create notification record
        notification = Notification(
            user_id=user.id,
            timesheet_id=None,
            type=NotificationType.REMINDER,
            message=message,
        )
        db.session.add(notification)

        # Send SMS
        result = send_sms(phone, message)

        if result.get("success"):
            notification.sent = True
            notification.sent_at = datetime.utcnow()
        else:
            notification.sent = False
            notification.error = result.get("error", "Unknown error")

        db.session.commit()
        return notification
