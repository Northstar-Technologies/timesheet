"""
Background Jobs Module (REQ-034)

Provides scheduled and background job processing for:
- SMS notifications (async, with retries)
- Daily unsubmitted timesheet reminders
- Weekly submission reminders
- Export generation

Configuration:
    REDIS_URL: Redis connection URL (for RQ)
    JOB_QUEUE_NAME: Queue name (default: "timesheet")
    
Usage:
    # Enqueue a notification job
    from app.jobs.tasks import send_notification_async
    send_notification_async.delay(user_id, "approved", timesheet_id)
    
    # Schedule daily reminders (in scheduler)
    from app.jobs.scheduler import schedule_daily_reminders
    schedule_daily_reminders()
"""

import logging
from datetime import datetime, date, timedelta
from functools import wraps
from flask import current_app

logger = logging.getLogger(__name__)


# ============================================================================
# Job Queue Setup (using RQ - Redis Queue)
# ============================================================================

def get_queue():
    """Get the RQ job queue."""
    try:
        from redis import Redis
        from rq import Queue
        
        redis_url = current_app.config.get("REDIS_URL", "redis://localhost:6379/0")
        queue_name = current_app.config.get("JOB_QUEUE_NAME", "timesheet")
        
        redis_conn = Redis.from_url(redis_url)
        return Queue(queue_name, connection=redis_conn)
    except ImportError:
        logger.warning("RQ not installed. Background jobs will run synchronously.")
        return None
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        return None


def with_app_context(f):
    """Decorator to ensure function runs with Flask app context."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        from app import create_app
        app = create_app()
        with app.app_context():
            return f(*args, **kwargs)
    return wrapper


# ============================================================================
# Notification Jobs
# ============================================================================

@with_app_context
def send_notification_job(notification_type: str, timesheet_id: str, reason: str = None):
    """
    Background job to send a notification.
    
    Args:
        notification_type: Type of notification ("approved", "rejected", "reminder")
        timesheet_id: ID of the timesheet
        reason: Optional rejection reason
    """
    from app.models import Timesheet
    from app.services.notification import NotificationService
    
    try:
        timesheet = Timesheet.query.get(timesheet_id)
        if not timesheet:
            logger.error(f"Timesheet {timesheet_id} not found for notification")
            return {"success": False, "error": "Timesheet not found"}
        
        if notification_type == "approved":
            NotificationService.notify_approved(timesheet)
        elif notification_type == "rejected":
            NotificationService.notify_needs_attention(timesheet, reason)
        else:
            logger.warning(f"Unknown notification type: {notification_type}")
            return {"success": False, "error": f"Unknown type: {notification_type}"}
        
        logger.info(f"Notification sent: {notification_type} for timesheet {timesheet_id}")
        return {"success": True}
        
    except Exception as e:
        logger.error(f"Notification job failed: {e}")
        raise  # RQ will handle retries


def enqueue_notification(notification_type: str, timesheet_id: str, reason: str = None):
    """
    Enqueue a notification job.
    
    If RQ is not available, sends synchronously.
    """
    queue = get_queue()
    
    if queue:
        job = queue.enqueue(
            send_notification_job,
            notification_type,
            str(timesheet_id),
            reason,
            retry=3,
            job_timeout=60,
        )
        logger.info(f"Enqueued notification job: {job.id}")
        return job.id
    else:
        # Fallback to synchronous execution
        logger.info("Running notification synchronously (RQ not available)")
        return send_notification_job(notification_type, str(timesheet_id), reason)


# ============================================================================
# SharePoint Sync Jobs (REQ-010)
# ============================================================================

@with_app_context
def sync_attachment_sharepoint_job(attachment_id: str):
    """
    Background job to sync an attachment to SharePoint.
    """
    from app.models import Attachment
    from app.extensions import db
    from app.utils.sharepoint import (
        upload_attachment_to_sharepoint,
        SharePointSyncError,
        is_sharepoint_configured,
    )

    attachment = Attachment.query.get(attachment_id)
    if not attachment:
        logger.error(f"Attachment {attachment_id} not found for SharePoint sync")
        return {"success": False, "error": "Attachment not found"}

    if not is_sharepoint_configured():
        attachment.sharepoint_sync_status = Attachment.SharePointSyncStatus.FAILED
        attachment.sharepoint_last_error = "SharePoint sync is not configured"
        attachment.sharepoint_retry_count = (attachment.sharepoint_retry_count or 0) + 1
        attachment.sharepoint_last_attempt_at = datetime.utcnow()
        db.session.commit()
        return {"success": False, "error": "SharePoint not configured"}

    attachment.sharepoint_sync_status = Attachment.SharePointSyncStatus.PENDING
    attachment.sharepoint_last_attempt_at = datetime.utcnow()
    db.session.commit()

    try:
        result = upload_attachment_to_sharepoint(attachment)
    except SharePointSyncError as exc:
        attachment.sharepoint_sync_status = Attachment.SharePointSyncStatus.FAILED
        attachment.sharepoint_last_error = str(exc)
        attachment.sharepoint_retry_count = (attachment.sharepoint_retry_count or 0) + 1
        attachment.sharepoint_last_attempt_at = datetime.utcnow()
        db.session.commit()
        logger.error(f"SharePoint sync failed for attachment {attachment_id}: {exc}")
        raise
    except Exception as exc:
        attachment.sharepoint_sync_status = Attachment.SharePointSyncStatus.FAILED
        attachment.sharepoint_last_error = str(exc)
        attachment.sharepoint_retry_count = (attachment.sharepoint_retry_count or 0) + 1
        attachment.sharepoint_last_attempt_at = datetime.utcnow()
        db.session.commit()
        logger.error(f"SharePoint sync error for attachment {attachment_id}: {exc}")
        raise

    attachment.sharepoint_item_id = result.get("item_id")
    attachment.sharepoint_site_id = result.get("site_id")
    attachment.sharepoint_drive_id = result.get("drive_id")
    attachment.sharepoint_web_url = result.get("web_url")
    attachment.sharepoint_sync_status = Attachment.SharePointSyncStatus.SYNCED
    attachment.sharepoint_synced_at = datetime.utcnow()
    attachment.sharepoint_last_attempt_at = datetime.utcnow()
    attachment.sharepoint_last_error = None
    db.session.commit()

    logger.info(f"SharePoint sync completed for attachment {attachment_id}")
    return {"success": True, "item_id": result.get("item_id")}


def enqueue_sharepoint_sync(attachment_id: str):
    """
    Enqueue SharePoint sync job for an attachment.
    """
    queue = get_queue()

    if queue:
        job = queue.enqueue(
            sync_attachment_sharepoint_job,
            str(attachment_id),
            retry=3,
            job_timeout=300,
        )
        logger.info(f"Enqueued SharePoint sync job: {job.id}")
        return job.id

    logger.info("Running SharePoint sync synchronously (RQ not available)")
    try:
        return sync_attachment_sharepoint_job(str(attachment_id))
    except Exception as exc:
        logger.error(f"SharePoint sync failed: {exc}")
        return None


def _next_sharepoint_retry_delay(retry_count: int) -> int:
    retry_count = max(int(retry_count or 0), 0)
    return min(3600, 60 * (2 ** retry_count))


@with_app_context
def sync_pending_sharepoint_attachments_job(limit: int = 100):
    """
    Scan for pending/failed SharePoint syncs and enqueue retries.
    """
    from app.models import Attachment
    from flask import current_app

    if not current_app.config.get("SHAREPOINT_SYNC_ENABLED", False):
        logger.info("SharePoint sync scan skipped: disabled")
        return {"skipped": True, "reason": "disabled"}

    now = datetime.utcnow()
    pending_statuses = [
        Attachment.SharePointSyncStatus.PENDING,
        Attachment.SharePointSyncStatus.FAILED,
    ]

    attachments = (
        Attachment.query.filter(Attachment.sharepoint_sync_status.in_(pending_statuses))
        .order_by(Attachment.uploaded_at.asc())
        .limit(limit)
        .all()
    )

    queued = 0
    skipped = 0
    for attachment in attachments:
        delay_seconds = _next_sharepoint_retry_delay(attachment.sharepoint_retry_count)
        last_attempt = attachment.sharepoint_last_attempt_at
        if last_attempt and (now - last_attempt).total_seconds() < delay_seconds:
            skipped += 1
            continue
        enqueue_sharepoint_sync(attachment.id)
        queued += 1

    result = {
        "checked": len(attachments),
        "queued": queued,
        "skipped": skipped,
    }
    logger.info(f"SharePoint sync scan complete: {result}")
    return result


# ============================================================================
# Scheduled Reminder Jobs
# ============================================================================

@with_app_context
def send_daily_reminders_job():
    """
    Daily job to remind users with unsubmitted timesheets.
    
    Runs Mon-Fri. Sends reminders for the previous week if not submitted.
    """
    from app.models import User, Timesheet, TimesheetStatus
    from app.services.notification import NotificationService
    
    # Only run on weekdays
    today = date.today()
    if today.weekday() >= 5:  # Saturday or Sunday
        logger.info("Skipping daily reminders on weekend")
        return {"skipped": True, "reason": "weekend"}
    
    # Calculate previous week start (Sunday)
    days_since_sunday = (today.weekday() + 1) % 7
    current_week_start = today - timedelta(days=days_since_sunday)
    previous_week_start = current_week_start - timedelta(days=7)
    
    logger.info(f"Checking for unsubmitted timesheets for week of {previous_week_start}")
    
    # Find users without submitted timesheets for last week
    reminders_sent = 0
    errors = 0
    
    users = User.query.filter(User.phone.isnot(None)).all()
    
    for user in users:
        # Check if they have a submitted/approved timesheet for last week
        timesheet = Timesheet.query.filter(
            Timesheet.user_id == user.id,
            Timesheet.week_start == previous_week_start,
            Timesheet.status.in_([
                TimesheetStatus.SUBMITTED,
                TimesheetStatus.APPROVED,
            ])
        ).first()
        
        if not timesheet:
            try:
                NotificationService.notify_unsubmitted(user, previous_week_start)
                reminders_sent += 1
            except Exception as e:
                logger.error(f"Failed to send reminder to {user.email}: {e}")
                errors += 1
    
    result = {
        "date": str(today),
        "week_checked": str(previous_week_start),
        "users_checked": len(users),
        "reminders_sent": reminders_sent,
        "errors": errors,
    }
    
    logger.info(f"Daily reminders complete: {result}")
    return result


@with_app_context
def send_weekly_reminders_job():
    """
    Weekly job to remind all users to submit their timesheets.
    
    Typically runs on Friday afternoon or Monday morning.
    """
    from app.models import User
    from app.services.notification import NotificationService
    
    today = date.today()
    days_since_sunday = (today.weekday() + 1) % 7
    current_week_start = today - timedelta(days=days_since_sunday)
    
    logger.info(f"Sending weekly reminders for week of {current_week_start}")
    
    reminders_sent = 0
    errors = 0
    
    users = User.query.filter(User.phone.isnot(None)).all()
    
    for user in users:
        try:
            NotificationService.send_weekly_reminder(user, current_week_start)
            reminders_sent += 1
        except Exception as e:
            logger.error(f"Failed to send weekly reminder to {user.email}: {e}")
            errors += 1
    
    result = {
        "date": str(today),
        "week": str(current_week_start),
        "reminders_sent": reminders_sent,
        "errors": errors,
    }
    
    logger.info(f"Weekly reminders complete: {result}")
    return result


# ============================================================================
# Scheduler Integration
# ============================================================================

def setup_scheduler(app):
    """
    Set up scheduled jobs using APScheduler or RQ-Scheduler.
    
    Call this during app initialization.
    """
    try:
        from rq_scheduler import Scheduler
        from redis import Redis
        
        redis_url = app.config.get("REDIS_URL", "redis://localhost:6379/0")
        redis_conn = Redis.from_url(redis_url)
        scheduler = Scheduler(connection=redis_conn)
        
        # Clear existing scheduled jobs
        for job in scheduler.get_jobs():
            if job.meta.get("origin") == "timesheet":
                scheduler.cancel(job)
        
        # Schedule daily reminders at 9 AM
        scheduler.cron(
            "0 9 * * 1-5",  # 9 AM Mon-Fri
            func=send_daily_reminders_job,
            meta={"origin": "timesheet"},
        )
        
        # Schedule weekly reminders on Friday at 2 PM
        scheduler.cron(
            "0 14 * * 5",  # 2 PM Friday
            func=send_weekly_reminders_job,
            meta={"origin": "timesheet"},
        )

        # Schedule SharePoint sync scan hourly at :15
        scheduler.cron(
            "15 * * * *",
            func=sync_pending_sharepoint_attachments_job,
            meta={"origin": "timesheet"},
        )
        
        logger.info("Scheduled jobs configured successfully")
        return scheduler
        
    except ImportError:
        logger.warning("rq-scheduler not installed. Scheduled jobs not available.")
        return None
    except Exception as e:
        logger.error(f"Failed to setup scheduler: {e}")
        return None


# ============================================================================
# CLI Commands
# ============================================================================

def register_job_commands(app):
    """Register CLI commands for job management."""
    import click
    
    @app.cli.group()
    def jobs():
        """Manage background jobs."""
        pass
    
    @jobs.command()
    def daily_reminders():
        """Send daily unsubmitted timesheet reminders."""
        result = send_daily_reminders_job()
        click.echo(f"Result: {result}")
    
    @jobs.command()
    def weekly_reminders():
        """Send weekly timesheet reminders."""
        result = send_weekly_reminders_job()
        click.echo(f"Result: {result}")

    @jobs.command()
    @click.option("--limit", default=100, help="Max attachments to scan")
    def sharepoint_sync(limit):
        """Scan and enqueue SharePoint sync retries."""
        result = sync_pending_sharepoint_attachments_job(limit=limit)
        click.echo(f"Result: {result}")
    
    @jobs.command()
    @click.argument("notification_type")
    @click.argument("timesheet_id")
    @click.option("--reason", default=None, help="Rejection reason")
    def send_notification(notification_type, timesheet_id, reason):
        """Send a notification for a timesheet."""
        result = send_notification_job(notification_type, timesheet_id, reason)
        click.echo(f"Result: {result}")
    
    @jobs.command()
    def worker():
        """Start a background job worker."""
        try:
            from rq import Worker
            from redis import Redis
            
            redis_url = app.config.get("REDIS_URL", "redis://localhost:6379/0")
            redis_conn = Redis.from_url(redis_url)
            
            queue_name = app.config.get("JOB_QUEUE_NAME", "timesheet")
            
            click.echo(f"Starting worker for queue: {queue_name}")
            worker = Worker([queue_name], connection=redis_conn)
            worker.work()
        except ImportError:
            click.echo("Error: rq is required. Install with: pip install rq")
            raise SystemExit(1)
