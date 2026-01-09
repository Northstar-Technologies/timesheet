"""
Timesheet Routes

CRUD operations for user timesheets.
"""

from datetime import datetime, timedelta
from flask import Blueprint, request, session, current_app
from ..models import (
    Timesheet,
    TimesheetEntry,
    Attachment,
    Note,
    TimesheetStatus,
    HourType,
    ReimbursementItem,
)
from ..extensions import db
from ..utils.decorators import login_required

timesheets_bp = Blueprint("timesheets", __name__)


def _get_week_start(date):
    """
    Get Sunday of the week containing the given date.

    Args:
        date: Date to find week start for

    Returns:
        date: Sunday of that week
    """
    # weekday() returns 0=Monday, 6=Sunday
    # We want to get to Sunday (start of week)
    days_since_sunday = (date.weekday() + 1) % 7
    return date - timedelta(days=days_since_sunday)


@timesheets_bp.route("", methods=["GET"])
@login_required
def list_timesheets():
    """
    List current user's timesheets.

    Query params:
        status: Filter by status
        page: Page number (default 1)
        per_page: Items per page (default 20)

    Returns:
        dict: Paginated list of timesheets
    """
    user_id = session["user"]["id"]

    query = Timesheet.query.filter_by(user_id=user_id)

    # Filter by status
    status = request.args.get("status")
    if status and status in TimesheetStatus.ALL:
        query = query.filter_by(status=status)

    # Order by week start (newest first)
    query = query.order_by(Timesheet.week_start.desc())

    # Paginate
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    pagination = query.paginate(page=page, per_page=per_page)

    return {
        "timesheets": [t.to_dict(include_entries=False) for t in pagination.items],
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
        "pages": pagination.pages,
    }


@timesheets_bp.route("", methods=["POST"])
@login_required
def create_timesheet():
    """
    Create a new draft timesheet.

    Request body:
        week_start: ISO date string (optional, defaults to current week)
        auto_populate: Boolean to auto-fill 40 hours Field (optional)

    Returns:
        dict: Created timesheet
    """
    user_id = session["user"]["id"]
    data = request.get_json() or {}

    # Determine week start
    if "week_start" in data:
        week_start = datetime.fromisoformat(data["week_start"]).date()
    else:
        week_start = _get_week_start(datetime.now().date())

    # Ensure week_start is a Sunday
    week_start = _get_week_start(week_start)

    # Check for existing timesheet for this week
    existing = Timesheet.query.filter_by(user_id=user_id, week_start=week_start).first()

    if existing:
        return {"error": f"Timesheet already exists for week of {week_start}"}, 400

    # Create timesheet
    timesheet = Timesheet(
        user_id=user_id,
        week_start=week_start,
        status=TimesheetStatus.NEW,
    )
    db.session.add(timesheet)

    # Auto-populate if requested
    if data.get("auto_populate"):
        for day_offset in range(1, 6):  # Mon=1 through Fri=5
            entry_date = week_start + timedelta(days=day_offset)
            entry = TimesheetEntry(
                timesheet=timesheet,
                entry_date=entry_date,
                hour_type=HourType.FIELD,
                hours=8.0,
            )
            db.session.add(entry)

    db.session.commit()

    return timesheet.to_dict(), 201


@timesheets_bp.route("/<timesheet_id>", methods=["GET"])
@login_required
def get_timesheet(timesheet_id):
    """
    Get a specific timesheet.

    Args:
        timesheet_id: Timesheet UUID

    Returns:
        dict: Timesheet with entries
    """
    user_id = session["user"]["id"]

    timesheet = Timesheet.query.filter_by(id=timesheet_id, user_id=user_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    return timesheet.to_dict()


@timesheets_bp.route("/<timesheet_id>", methods=["PUT"])
@login_required
def update_timesheet(timesheet_id):
    """
    Update a draft timesheet.

    Only drafts (status=NEW) can be edited.

    Request body:
        traveled: Boolean
        has_expenses: Boolean
        reimbursement_needed: Boolean
        reimbursement_type: String (if reimbursement_needed)
        reimbursement_amount: Decimal (if reimbursement_needed)
        stipend_date: ISO date (if reimbursement_needed)

    Returns:
        dict: Updated timesheet
    """
    user_id = session["user"]["id"]

    timesheet = Timesheet.query.filter_by(id=timesheet_id, user_id=user_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    if timesheet.status != TimesheetStatus.NEW:
        return {"error": "Only draft timesheets can be edited"}, 400

    data = request.get_json() or {}

    # Update fields
    if "traveled" in data:
        timesheet.traveled = bool(data["traveled"])
    if "has_expenses" in data:
        timesheet.has_expenses = bool(data["has_expenses"])
    if "reimbursement_needed" in data:
        timesheet.reimbursement_needed = bool(data["reimbursement_needed"])
    if "reimbursement_type" in data:
        timesheet.reimbursement_type = data["reimbursement_type"]
    if "reimbursement_amount" in data:
        # REQ-026: Validate and sanitize reimbursement amount
        amount = data["reimbursement_amount"]
        if amount is None or amount == "" or amount == "null":
            amount = 0.0
        else:
            try:
                amount = float(amount)
            except (ValueError, TypeError):
                amount = 0.0
        # Clamp to valid range
        amount = max(0.0, min(amount, 10000.0))
        timesheet.reimbursement_amount = amount
    if "stipend_date" in data and data["stipend_date"]:
        timesheet.stipend_date = datetime.fromisoformat(data["stipend_date"]).date()
    if "user_notes" in data:
        # Limit to 255 characters per PowerApps spec
        notes = data["user_notes"] or ""
        timesheet.user_notes = notes[:255] if notes else None
    
    # REQ-028: Handle multiple reimbursement line items
    if "reimbursement_items" in data:
        # Delete existing reimbursement items
        ReimbursementItem.query.filter_by(timesheet_id=timesheet_id).delete()
        
        # Create new items
        for item_data in data["reimbursement_items"]:
            if not item_data.get("type") or item_data.get("type") == "":
                continue  # Skip items without a type selected
            
            # Parse and validate amount
            amount = item_data.get("amount", 0)
            if amount is None or amount == "" or amount == "null":
                amount = 0.0
            else:
                try:
                    amount = float(amount)
                except (ValueError, TypeError):
                    amount = 0.0
            amount = max(0.0, min(amount, 10000.0))
            
            # Parse expense date if provided
            expense_date = None
            if item_data.get("date"):
                try:
                    expense_date = datetime.fromisoformat(item_data["date"]).date()
                except ValueError:
                    pass
            
            item = ReimbursementItem(
                timesheet_id=timesheet_id,
                expense_type=item_data["type"],
                amount=amount,
                expense_date=expense_date,
                notes=(item_data.get("notes") or "")[:200],  # Limit notes to 200 chars
            )
            db.session.add(item)
        
        # Update the legacy reimbursement_amount field with total
        total_amount = sum(
            max(0.0, min(float(item.get("amount", 0) or 0), 10000.0))
            for item in data["reimbursement_items"]
            if item.get("type")
        )
        timesheet.reimbursement_amount = total_amount

    db.session.commit()

    return timesheet.to_dict()


@timesheets_bp.route("/<timesheet_id>", methods=["DELETE"])
@login_required
def delete_timesheet(timesheet_id):
    """
    Delete a draft timesheet.

    Only drafts (status=NEW) can be deleted.

    Returns:
        dict: Success message
    """
    user_id = session["user"]["id"]

    timesheet = Timesheet.query.filter_by(id=timesheet_id, user_id=user_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    if timesheet.status != TimesheetStatus.NEW:
        return {"error": "Only draft timesheets can be deleted"}, 400

    db.session.delete(timesheet)
    db.session.commit()

    return {"message": "Timesheet deleted"}


@timesheets_bp.route("/<timesheet_id>/submit", methods=["POST"])
@login_required
def submit_timesheet(timesheet_id):
    """
    Submit a timesheet for approval.

    If field hours exist but no attachment, status becomes NEEDS_APPROVAL.
    Otherwise, status becomes SUBMITTED.

    Returns:
        dict: Updated timesheet
    """
    user_id = session["user"]["id"]

    timesheet = Timesheet.query.filter_by(id=timesheet_id, user_id=user_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    if timesheet.status != TimesheetStatus.NEW:
        return {"error": "Only draft timesheets can be submitted"}, 400

    # Check if attachment is required but missing
    if timesheet.requires_attachment():
        timesheet.status = TimesheetStatus.NEEDS_APPROVAL
    else:
        timesheet.status = TimesheetStatus.SUBMITTED

    timesheet.submitted_at = datetime.utcnow()
    db.session.commit()

    return timesheet.to_dict()


@timesheets_bp.route("/<timesheet_id>/entries", methods=["POST"])
@login_required
def update_entries(timesheet_id):
    """
    Add or update time entries.

    Request body:
        entries: List of {entry_date, hour_type, hours}

    Returns:
        dict: Updated timesheet with entries
    """
    user_id = session["user"]["id"]

    timesheet = Timesheet.query.filter_by(id=timesheet_id, user_id=user_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    if timesheet.status != TimesheetStatus.NEW:
        return {"error": "Only draft timesheets can be edited"}, 400

    data = request.get_json() or {}
    entries_data = data.get("entries", [])

    # Delete existing entries
    TimesheetEntry.query.filter_by(timesheet_id=timesheet_id).delete()

    # Create new entries
    for entry_data in entries_data:
        if not entry_data.get("hours") or float(entry_data["hours"]) <= 0:
            continue

        entry = TimesheetEntry(
            timesheet_id=timesheet_id,
            entry_date=datetime.fromisoformat(entry_data["entry_date"]).date(),
            hour_type=entry_data["hour_type"],
            hours=float(entry_data["hours"]),
        )
        db.session.add(entry)

    db.session.commit()

    return timesheet.to_dict()


@timesheets_bp.route("/<timesheet_id>/attachments", methods=["POST"])
@login_required
def upload_attachment(timesheet_id):
    """
    Upload an attachment (image/PDF).

    Returns:
        dict: Attachment info
    """
    import os
    import uuid as uuid_lib
    from werkzeug.utils import secure_filename

    user_id = session["user"]["id"]

    timesheet = Timesheet.query.filter_by(id=timesheet_id, user_id=user_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    if "file" not in request.files:
        return {"error": "No file provided"}, 400

    file = request.files["file"]
    if not file.filename:
        return {"error": "No file selected"}, 400

    # Validate file extension
    allowed = current_app.config["ALLOWED_EXTENSIONS"]
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed:
        return {"error": f'File type not allowed. Allowed: {", ".join(allowed)}'}, 400

    # Generate unique filename
    original_filename = secure_filename(file.filename)
    stored_filename = f"{uuid_lib.uuid4()}.{ext}"

    # Save file
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)
    filepath = os.path.join(upload_folder, stored_filename)
    file.save(filepath)

    # Validate file content (magic numbers)
    MAGIC_NUMBERS = {
        "pdf": [b"%PDF"],
        "png": [b"\x89PNG\r\n\x1a\n"],
        "jpg": [b"\xff\xd8\xff"],
        "jpeg": [b"\xff\xd8\xff"],
        "gif": [b"GIF87a", b"GIF89a"],
    }
    try:
        with open(filepath, "rb") as f:
            header = f.read(8)
        valid_magic = False
        if ext in MAGIC_NUMBERS:
            for magic in MAGIC_NUMBERS[ext]:
                if header.startswith(magic):
                    valid_magic = True
                    break
        if not valid_magic:
            os.remove(filepath)
            return {"error": "File content does not match extension"}, 400
    except Exception:
        if os.path.exists(filepath):
            os.remove(filepath)
        return {"error": "Failed to validate file"}, 500

    # Get file size
    file_size = os.path.getsize(filepath)

    # Create attachment record
    attachment = Attachment(
        timesheet_id=timesheet_id,
        filename=stored_filename,
        original_filename=original_filename,
        mime_type=file.content_type,
        file_size=file_size,
    )
    db.session.add(attachment)

    # If timesheet was NEEDS_APPROVAL, update to SUBMITTED
    if timesheet.status == TimesheetStatus.NEEDS_APPROVAL:
        timesheet.status = TimesheetStatus.SUBMITTED

    db.session.commit()

    return attachment.to_dict(), 201


@timesheets_bp.route("/<timesheet_id>/attachments/<attachment_id>", methods=["DELETE"])
@login_required
def delete_attachment(timesheet_id, attachment_id):
    """
    Delete an attachment.

    Returns:
        dict: Success message
    """
    import os

    user_id = session["user"]["id"]

    timesheet = Timesheet.query.filter_by(id=timesheet_id, user_id=user_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    if timesheet.status != TimesheetStatus.NEW:
        return {"error": "Only draft timesheet attachments can be deleted"}, 400

    attachment = Attachment.query.filter_by(
        id=attachment_id, timesheet_id=timesheet_id
    ).first()

    if not attachment:
        return {"error": "Attachment not found"}, 404

    # Delete file from filesystem
    filepath = os.path.join(current_app.config["UPLOAD_FOLDER"], attachment.filename)
    if os.path.exists(filepath):
        os.remove(filepath)

    db.session.delete(attachment)
    db.session.commit()

    return {"message": "Attachment deleted"}


@timesheets_bp.route("/<timesheet_id>/notes", methods=["POST"])
@login_required
def add_note(timesheet_id):
    """
    Add a note to a timesheet.

    Request body:
        content: Note text

    Returns:
        dict: Created note
    """
    user_id = session["user"]["id"]

    timesheet = Timesheet.query.filter_by(id=timesheet_id, user_id=user_id).first()

    if not timesheet:
        return {"error": "Timesheet not found"}, 404

    data = request.get_json() or {}
    content = data.get("content", "").strip()

    if not content:
        return {"error": "Note content required"}, 400

    note = Note(
        timesheet_id=timesheet_id,
        author_id=user_id,
        content=content,
    )
    db.session.add(note)
    db.session.commit()

    return note.to_dict(), 201
