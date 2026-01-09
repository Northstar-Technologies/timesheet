"""
Admin Routes

Admin-only endpoints for timesheet management.
Support users have limited access to approve trainee timesheets only (REQ-041).
"""

from datetime import datetime
from io import BytesIO, StringIO
import csv
from flask import Blueprint, request, session, send_file, current_app, Response
from ..models import Timesheet, User, Note, TimesheetStatus, UserRole, PayPeriod
from ..extensions import db
from ..utils.decorators import login_required, admin_required, can_approve
from ..utils.pay_periods import get_confirmed_pay_period

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/timesheets", methods=["GET"])
@login_required
@can_approve
def list_timesheets():
    """
    List submitted timesheets for approval.

    - Admin: sees all non-draft timesheets
    - Support: sees only trainee timesheets (REQ-041)

    Drafts (NEW status) are NOT visible.

    Query params:
        status: Filter by status (SUBMITTED, APPROVED, NEEDS_APPROVAL)
        user_id: Filter by user
        week_start: Filter by week (ISO date)
        page: Page number (default 1)
        per_page: Items per page (default 20)

    Returns:
        dict: Paginated list of timesheets with user info and view_mode
    """
    current_role = session.get("user", {}).get("role", "staff")
    is_support_only = (current_role == "support")
    
    # Base query - exclude drafts
    query = Timesheet.query.filter(Timesheet.status != TimesheetStatus.NEW)
    
    # REQ-041: Support users can only see trainee timesheets
    if is_support_only:
        # Join with User and filter to only trainee submitters
        query = query.join(User, Timesheet.user_id == User.id).filter(
            User.role == UserRole.TRAINEE
        )
    else:
        # Admin sees all - join with user for display name
        query = query.join(User, Timesheet.user_id == User.id)

    # Filter by status
    status = request.args.get("status")
    if status and status in [
        TimesheetStatus.SUBMITTED,
        TimesheetStatus.APPROVED,
        TimesheetStatus.NEEDS_APPROVAL,
    ]:
        query = query.filter_by(status=status)

    # Filter by user
    user_id = request.args.get("user_id")
    if user_id:
        query = query.filter(Timesheet.user_id == user_id)

    # Filter by week
    week_start = request.args.get("week_start")
    if week_start:
        query = query.filter(Timesheet.week_start == datetime.fromisoformat(week_start).date())

    # Filter by hour type (REQ-018)
    from ..models import TimesheetEntry
    hour_type = request.args.get("hour_type")
    if hour_type:
        if hour_type == "has_field":
            # Special case: show timesheets that have any Field hours
            query = query.filter(
                Timesheet.id.in_(
                    db.session.query(TimesheetEntry.timesheet_id)
                    .filter(TimesheetEntry.hour_type == "Field")
                    .distinct()
                )
            )
        else:
            # Filter by specific hour type
            query = query.filter(
                Timesheet.id.in_(
                    db.session.query(TimesheetEntry.timesheet_id)
                    .filter(TimesheetEntry.hour_type == hour_type)
                    .distinct()
                )
            )

    # Order by submitted_at (newest first)
    query = query.order_by(Timesheet.submitted_at.desc())

    # Paginate
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    pagination = query.paginate(page=page, per_page=per_page)

    timesheets = []
    for t in pagination.items:
        data = t.to_dict(include_entries=False)
        data["user"] = t.user.to_dict() if t.user else None
        timesheets.append(data)

    return {
        "timesheets": timesheets,
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
        "pages": pagination.pages,
        # REQ-041: Tell frontend which view mode we're in
        "view_mode": "trainee_approvals" if is_support_only else "admin",
    }


def _can_access_timesheet(timesheet):
    """
    Check if current user can access a specific timesheet.
    
    REQ-041: Support can only access trainee timesheets.
    Admin can access all timesheets.
    
    Returns:
        tuple: (can_access: bool, error_response: tuple or None)
    """
    current_role = session.get("user", {}).get("role", "staff")
    
    # Admin can access everything
    if current_role == "admin":
        return True, None
    
    # Support can only access trainee timesheets
    if current_role == "support":
        if timesheet.user and timesheet.user.role == UserRole.TRAINEE:
            return True, None
        return False, ({"error": "You can only access trainee timesheets"}, 403)
    
    # Other roles shouldn't reach here due to @can_approve, but just in case
    return False, ({"error": "Access denied"}, 403)


@admin_bp.route("/timesheets/<timesheet_id>", methods=["GET"])
@login_required
@can_approve
def get_timesheet(timesheet_id):
    """
    Get a specific timesheet for approval review.
    
    REQ-041: Support users can only view trainee timesheets.

    Returns:
        dict: Timesheet with entries, attachments, and user info
    """
    timesheet = Timesheet.query.filter_by(id=timesheet_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    # Cannot view drafts
    if timesheet.status == TimesheetStatus.NEW:
        return {"error": "Timesheet not found"}, 404
    
    # REQ-041: Check if Support user can access this timesheet
    can_access, error = _can_access_timesheet(timesheet)
    if not can_access:
        return error

    data = timesheet.to_dict()
    period = get_confirmed_pay_period(timesheet.week_start)
    data["pay_period_confirmed"] = period is not None
    data["pay_period_confirmed_at"] = (
        period.confirmed_at.isoformat() if period else None
    )
    data["user"] = timesheet.user.to_dict() if timesheet.user else None
    data["notes"] = [n.to_dict() for n in timesheet.notes]

    return data


@admin_bp.route("/timesheets/<timesheet_id>/approve", methods=["POST"])
@login_required
@can_approve
def approve_timesheet(timesheet_id):
    """
    Approve a submitted timesheet.
    
    REQ-041: Support users can only approve trainee timesheets.

    Returns:
        dict: Updated timesheet
    """
    approver_id = session["user"]["id"]

    timesheet = Timesheet.query.filter_by(id=timesheet_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404
    
    # REQ-041: Check if Support user can access this timesheet
    can_access, error = _can_access_timesheet(timesheet)
    if not can_access:
        return error

    if timesheet.status not in [
        TimesheetStatus.SUBMITTED,
        TimesheetStatus.NEEDS_APPROVAL,
    ]:
        return {"error": "Timesheet cannot be approved from current status"}, 400

    if get_confirmed_pay_period(timesheet.week_start):
        return {"error": "Pay period has been confirmed and is locked"}, 400

    timesheet.status = TimesheetStatus.APPROVED
    timesheet.approved_at = datetime.utcnow()
    timesheet.approved_by = approver_id
    db.session.commit()

    # Send SMS notification
    from ..services.notification import NotificationService

    NotificationService.notify_approved(timesheet)

    return timesheet.to_dict()


@admin_bp.route("/timesheets/<timesheet_id>/reject", methods=["POST"])
@login_required
@can_approve
def reject_timesheet(timesheet_id):
    """
    Mark a timesheet as needing approval (missing attachment).
    
    REQ-041: Support users can only reject trainee timesheets.

    Request body:
        reason: Optional rejection reason (also sets admin_notes)

    Returns:
        dict: Updated timesheet
    """
    timesheet = Timesheet.query.filter_by(id=timesheet_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404
    
    # REQ-041: Check if Support user can access this timesheet
    can_access, error = _can_access_timesheet(timesheet)
    if not can_access:
        return error

    if timesheet.status != TimesheetStatus.SUBMITTED:
        return {"error": "Only submitted timesheets can be rejected"}, 400

    if get_confirmed_pay_period(timesheet.week_start):
        return {"error": "Pay period has been confirmed and is locked"}, 400

    timesheet.status = TimesheetStatus.NEEDS_APPROVAL

    # Add note if reason provided - also set admin_notes field
    data = request.get_json() or {}
    reason = data.get("reason", "").strip()
    if reason:
        approver_id = session["user"]["id"]
        # Set the admin_notes field
        timesheet.admin_notes = reason
        # Also create a Note record for history
        note = Note(
            timesheet_id=timesheet_id,
            author_id=approver_id,
            content=f"Needs approval: {reason}",
        )
        db.session.add(note)

    db.session.commit()

    # Send SMS notification
    from ..services.notification import NotificationService

    NotificationService.notify_needs_attention(timesheet, reason)

    return timesheet.to_dict()


@admin_bp.route("/timesheets/<timesheet_id>/admin-notes", methods=["PUT"])
@login_required
@can_approve
def update_admin_notes(timesheet_id):
    """
    Update admin notes on a timesheet.
    
    REQ-041: Support users can only update notes on trainee timesheets.

    Request body:
        admin_notes: The admin notes text

    Returns:
        dict: Updated timesheet
    """
    timesheet = Timesheet.query.filter_by(id=timesheet_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    # Cannot edit drafts
    if timesheet.status == TimesheetStatus.NEW:
        return {"error": "Timesheet not found"}, 404
    
    # REQ-041: Check if Support user can access this timesheet
    can_access, error = _can_access_timesheet(timesheet)
    if not can_access:
        return error

    data = request.get_json() or {}
    timesheet.admin_notes = data.get("admin_notes", "").strip() or None
    db.session.commit()

    return timesheet.to_dict()


@admin_bp.route("/timesheets/<timesheet_id>/unapprove", methods=["POST"])
@login_required
@can_approve
def unapprove_timesheet(timesheet_id):
    """
    Revert an approved timesheet back to submitted status.
    
    REQ-041: Support users can only unapprove trainee timesheets.

    Returns:
        dict: Updated timesheet
    """
    timesheet = Timesheet.query.filter_by(id=timesheet_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404
    
    # REQ-041: Check if Support user can access this timesheet
    can_access, error = _can_access_timesheet(timesheet)
    if not can_access:
        return error

    if timesheet.status != TimesheetStatus.APPROVED:
        return {"error": "Only approved timesheets can be unapproved"}, 400

    if get_confirmed_pay_period(timesheet.week_start):
        return {"error": "Pay period has been confirmed and is locked"}, 400

    timesheet.status = TimesheetStatus.SUBMITTED
    timesheet.approved_at = None
    timesheet.approved_by = None
    db.session.commit()

    return timesheet.to_dict()


@admin_bp.route("/pay-periods/status", methods=["GET"])
@login_required
@admin_required
def get_pay_period_status():
    """
    Get confirmation status for a pay period.

    Query params:
        start_date: Pay period start (YYYY-MM-DD)
        end_date: Pay period end (YYYY-MM-DD)
    """
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if not start_date or not end_date:
        return {"error": "start_date and end_date are required"}, 400

    try:
        start = datetime.fromisoformat(start_date).date()
        end = datetime.fromisoformat(end_date).date()
    except ValueError:
        return {"error": "Invalid date format"}, 400

    period = PayPeriod.query.filter_by(start_date=start).first()
    if period and period.end_date != end:
        return {"error": "Pay period dates do not match existing record"}, 400

    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "confirmed": period is not None,
        "pay_period": period.to_dict() if period else None,
    }


@admin_bp.route("/pay-periods/confirm", methods=["POST"])
@login_required
@admin_required
def confirm_pay_period():
    """
    Confirm and lock a pay period (REQ-006).

    Request body:
        start_date: Pay period start (YYYY-MM-DD)
        end_date: Pay period end (YYYY-MM-DD)
    """
    data = request.get_json() or {}
    start_date = data.get("start_date")
    end_date = data.get("end_date")

    if not start_date or not end_date:
        return {"error": "start_date and end_date are required"}, 400

    try:
        start = datetime.fromisoformat(start_date).date()
        end = datetime.fromisoformat(end_date).date()
    except ValueError:
        return {"error": "Invalid date format"}, 400

    if start.weekday() != 6 or (end - start).days != 13:
        return {"error": "Pay period must start on Sunday and span 14 days"}, 400

    existing = PayPeriod.query.filter_by(start_date=start).first()
    if existing:
        return {"error": "Pay period already confirmed"}, 400

    timesheets = Timesheet.query.filter(
        Timesheet.week_start >= start,
        Timesheet.week_start <= end,
    ).all()

    not_approved = [ts for ts in timesheets if ts.status != TimesheetStatus.APPROVED]
    if not_approved:
        status_counts = {}
        for ts in not_approved:
            status_counts[ts.status] = status_counts.get(ts.status, 0) + 1
        return {
            "error": "All timesheets must be approved before confirmation",
            "details": {
                "pending_count": len(not_approved),
                "status_counts": status_counts,
            },
        }, 400

    pay_period = PayPeriod(
        start_date=start,
        end_date=end,
        confirmed_by=session["user"]["id"],
    )
    db.session.add(pay_period)
    db.session.commit()

    return pay_period.to_dict(), 201


@admin_bp.route(
    "/timesheets/<timesheet_id>/attachments/<attachment_id>", methods=["GET"]
)
@login_required
@can_approve
def download_attachment(timesheet_id, attachment_id):
    """
    Download an attachment for review.
    
    REQ-041: Support users can only download attachments from trainee timesheets.

    Returns:
        file: The attachment file
    """
    import os
    from ..models import Attachment

    timesheet = Timesheet.query.filter_by(id=timesheet_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    # Cannot view draft attachments
    if timesheet.status == TimesheetStatus.NEW:
        return {"error": "Timesheet not found"}, 404
    
    # REQ-041: Check if Support user can access this timesheet
    can_access, error = _can_access_timesheet(timesheet)
    if not can_access:
        return error

    attachment = Attachment.query.filter_by(
        id=attachment_id, timesheet_id=timesheet_id
    ).first()

    if not attachment:
        return {"error": "Attachment not found"}, 404

    filepath = os.path.join(current_app.config["UPLOAD_FOLDER"], attachment.filename)

    if not os.path.exists(filepath):
        return {"error": "File not found"}, 404

    return send_file(
        filepath,
        mimetype=attachment.mime_type,
        as_attachment=True,
        download_name=attachment.original_filename,
    )


@admin_bp.route("/timesheets/<timesheet_id>/notes", methods=["POST"])
@login_required
@can_approve
def add_note(timesheet_id):
    """
    Add a note to a timesheet.
    
    REQ-041: Support users can only add notes to trainee timesheets.

    Request body:
        content: Note text

    Returns:
        dict: Created note
    """
    author_id = session["user"]["id"]

    timesheet = Timesheet.query.filter_by(id=timesheet_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    # Cannot add notes to drafts
    if timesheet.status == TimesheetStatus.NEW:
        return {"error": "Timesheet not found"}, 404
    
    # REQ-041: Check if Support user can access this timesheet
    can_access, error = _can_access_timesheet(timesheet)
    if not can_access:
        return error

    data = request.get_json() or {}
    content = data.get("content", "").strip()

    if not content:
        return {"error": "Note content required"}, 400

    note = Note(
        timesheet_id=timesheet_id,
        author_id=author_id,
        content=content,
    )
    db.session.add(note)
    db.session.commit()

    return note.to_dict(), 201


@admin_bp.route("/users", methods=["GET"])
@login_required
@admin_required
def list_users():
    """
    List all users (admin only).

    Returns:
        dict: List of users
    """
    users = User.query.order_by(User.display_name).all()

    return {
        "users": [u.to_dict() for u in users],
    }
