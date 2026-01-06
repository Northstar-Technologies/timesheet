"""
Admin Routes

Admin-only endpoints for timesheet management.
"""

from datetime import datetime
from flask import Blueprint, request, session, send_file, current_app
from ..models import Timesheet, User, Note, TimesheetStatus
from ..extensions import db
from ..utils.decorators import login_required, admin_required

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/timesheets", methods=["GET"])
@login_required
@admin_required
def list_timesheets():
    """
    List all submitted timesheets (admin only).

    Drafts (NEW status) are NOT visible to admins.

    Query params:
        status: Filter by status (SUBMITTED, APPROVED, NEEDS_APPROVAL)
        user_id: Filter by user
        week_start: Filter by week (ISO date)
        page: Page number (default 1)
        per_page: Items per page (default 20)

    Returns:
        dict: Paginated list of timesheets with user info
    """
    # Base query - exclude drafts
    query = Timesheet.query.filter(Timesheet.status != TimesheetStatus.NEW)

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
        query = query.filter_by(user_id=user_id)

    # Filter by week
    week_start = request.args.get("week_start")
    if week_start:
        query = query.filter_by(week_start=datetime.fromisoformat(week_start).date())

    # Join with user for display name (explicit join due to multiple FKs)
    query = query.join(User, Timesheet.user_id == User.id)

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
    }


@admin_bp.route("/timesheets/<timesheet_id>", methods=["GET"])
@login_required
@admin_required
def get_timesheet(timesheet_id):
    """
    Get a specific timesheet (admin view).

    Returns:
        dict: Timesheet with entries, attachments, and user info
    """
    timesheet = Timesheet.query.filter_by(id=timesheet_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    # Admins cannot view drafts
    if timesheet.status == TimesheetStatus.NEW:
        return {"error": "Timesheet not found"}, 404

    data = timesheet.to_dict()
    data["user"] = timesheet.user.to_dict() if timesheet.user else None
    data["notes"] = [n.to_dict() for n in timesheet.notes]

    return data


@admin_bp.route("/timesheets/<timesheet_id>/approve", methods=["POST"])
@login_required
@admin_required
def approve_timesheet(timesheet_id):
    """
    Approve a submitted timesheet.

    Returns:
        dict: Updated timesheet
    """
    admin_id = session["user"]["id"]

    timesheet = Timesheet.query.filter_by(id=timesheet_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    if timesheet.status not in [
        TimesheetStatus.SUBMITTED,
        TimesheetStatus.NEEDS_APPROVAL,
    ]:
        return {"error": "Timesheet cannot be approved from current status"}, 400

    timesheet.status = TimesheetStatus.APPROVED
    timesheet.approved_at = datetime.utcnow()
    timesheet.approved_by = admin_id
    db.session.commit()

    # Send SMS notification
    from ..services.notification import NotificationService

    NotificationService.notify_approved(timesheet)

    return timesheet.to_dict()


@admin_bp.route("/timesheets/<timesheet_id>/reject", methods=["POST"])
@login_required
@admin_required
def reject_timesheet(timesheet_id):
    """
    Mark a timesheet as needing approval (missing attachment).

    Request body:
        reason: Optional rejection reason

    Returns:
        dict: Updated timesheet
    """
    timesheet = Timesheet.query.filter_by(id=timesheet_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    if timesheet.status != TimesheetStatus.SUBMITTED:
        return {"error": "Only submitted timesheets can be rejected"}, 400

    timesheet.status = TimesheetStatus.NEEDS_APPROVAL

    # Add note if reason provided
    data = request.get_json() or {}
    reason = data.get("reason", "").strip()
    if reason:
        admin_id = session["user"]["id"]
        note = Note(
            timesheet_id=timesheet_id,
            author_id=admin_id,
            content=f"Needs approval: {reason}",
        )
        db.session.add(note)

    db.session.commit()

    # Send SMS notification
    from ..services.notification import NotificationService

    NotificationService.notify_needs_attention(timesheet, reason)

    return timesheet.to_dict()


@admin_bp.route("/timesheets/<timesheet_id>/unapprove", methods=["POST"])
@login_required
@admin_required
def unapprove_timesheet(timesheet_id):
    """
    Revert an approved timesheet back to submitted status.

    Returns:
        dict: Updated timesheet
    """
    timesheet = Timesheet.query.filter_by(id=timesheet_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    if timesheet.status != TimesheetStatus.APPROVED:
        return {"error": "Only approved timesheets can be unapproved"}, 400

    timesheet.status = TimesheetStatus.SUBMITTED
    timesheet.approved_at = None
    timesheet.approved_by = None
    db.session.commit()

    return timesheet.to_dict()


@admin_bp.route(
    "/timesheets/<timesheet_id>/attachments/<attachment_id>", methods=["GET"]
)
@login_required
@admin_required
def download_attachment(timesheet_id, attachment_id):
    """
    Download an attachment (admin only).

    Returns:
        file: The attachment file
    """
    import os
    from ..models import Attachment

    timesheet = Timesheet.query.filter_by(id=timesheet_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    # Admins cannot view draft attachments
    if timesheet.status == TimesheetStatus.NEW:
        return {"error": "Timesheet not found"}, 404

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
@admin_required
def add_note(timesheet_id):
    """
    Add an admin note to a timesheet.

    Request body:
        content: Note text

    Returns:
        dict: Created note
    """
    admin_id = session["user"]["id"]

    timesheet = Timesheet.query.filter_by(id=timesheet_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    # Admins cannot add notes to drafts
    if timesheet.status == TimesheetStatus.NEW:
        return {"error": "Timesheet not found"}, 404

    data = request.get_json() or {}
    content = data.get("content", "").strip()

    if not content:
        return {"error": "Note content required"}, 400

    note = Note(
        timesheet_id=timesheet_id,
        author_id=admin_id,
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
