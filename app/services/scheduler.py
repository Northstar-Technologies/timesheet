"""
Scheduler Service

Handles scheduled tasks for automated notifications.
Run these tasks via cron, systemd timer, or task scheduler.
"""

from datetime import datetime, timedelta
from flask import current_app
from ..models import User, Timesheet, TimesheetStatus
from ..extensions import db
from .notification import NotificationService


def get_previous_week_start():
    """
    Calculate the start date (Sunday) of the previous week.

    Returns:
        date: The Sunday that begins the previous week
    """
    today = datetime.now().date()
    # Days since last Sunday (0 = Sunday, 6 = Saturday)
    days_since_sunday = (today.weekday() + 1) % 7
    this_week_start = today - timedelta(days=days_since_sunday)
    previous_week_start = this_week_start - timedelta(days=7)
    return previous_week_start


def get_users_with_unsubmitted_timesheets(week_start):
    """
    Find all users who have not submitted their timesheet for the given week.

    A timesheet is considered unsubmitted if:
    - No timesheet exists for the week, OR
    - The timesheet exists but status is NEW

    Args:
        week_start: The Sunday date of the week to check

    Returns:
        list: Users who need a reminder
    """
    # Get all users
    all_users = User.query.all()

    users_needing_reminder = []

    for user in all_users:
        # Find timesheet for this week
        timesheet = Timesheet.query.filter_by(
            user_id=user.id,
            week_start=week_start
        ).first()

        # Check if unsubmitted
        if timesheet is None:
            # No timesheet at all - needs reminder
            users_needing_reminder.append(user)
        elif timesheet.status == TimesheetStatus.NEW:
            # Timesheet exists but not submitted
            users_needing_reminder.append(user)
        # If status is SUBMITTED, APPROVED, or NEEDS_APPROVAL, skip

    return users_needing_reminder


def send_unsubmitted_reminders():
    """
    Send reminders to all users who haven't submitted last week's timesheet.

    This function should be called daily (starting Monday) by a scheduler.
    It will:
    1. Calculate the previous week's start date
    2. Find all users without submitted timesheets for that week
    3. Send SMS reminders to each user (if they've opted in)

    Returns:
        dict: Summary of reminders sent
    """
    # Only run on Monday through Friday
    today = datetime.now().date()
    weekday = today.weekday()  # 0 = Monday, 6 = Sunday

    if weekday > 4:  # Saturday or Sunday
        current_app.logger.info(
            "Unsubmitted reminder check skipped - weekend"
        )
        return {
            "status": "skipped",
            "reason": "weekend",
            "reminders_sent": 0,
            "users_checked": 0
        }

    # Get previous week's start date
    previous_week_start = get_previous_week_start()

    current_app.logger.info(
        f"Checking for unsubmitted timesheets for week of {previous_week_start}"
    )

    # Find users needing reminders
    users_needing_reminder = get_users_with_unsubmitted_timesheets(previous_week_start)

    current_app.logger.info(
        f"Found {len(users_needing_reminder)} users with unsubmitted timesheets"
    )

    # Send reminders
    reminders_sent = 0
    errors = []

    for user in users_needing_reminder:
        try:
            notification = NotificationService.notify_unsubmitted(
                user,
                previous_week_start
            )
            if notification and notification.sent:
                reminders_sent += 1
        except Exception as e:
            current_app.logger.error(
                f"Error sending reminder to {user.email}: {str(e)}"
            )
            errors.append({
                "user": user.email,
                "error": str(e)
            })

    result = {
        "status": "completed",
        "week_start": previous_week_start.isoformat(),
        "users_checked": len(users_needing_reminder),
        "reminders_sent": reminders_sent,
        "errors": errors if errors else None
    }

    current_app.logger.info(
        f"Unsubmitted reminder task completed: {reminders_sent} reminders sent"
    )

    return result


def run_daily_reminders(app):
    """
    Run the daily reminder check with app context.

    Use this function when calling from outside Flask request context
    (e.g., from a cron job or CLI command).

    Args:
        app: The Flask application instance

    Returns:
        dict: Summary of reminders sent
    """
    with app.app_context():
        return send_unsubmitted_reminders()
