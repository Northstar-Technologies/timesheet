"""
Timesheet and TimesheetEntry Models

Core models for timesheet management.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from ..extensions import db


class TimesheetStatus:
    """Timesheet status constants."""

    NEW = "NEW"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    NEEDS_APPROVAL = "NEEDS_APPROVAL"

    ALL = [NEW, SUBMITTED, APPROVED, NEEDS_APPROVAL]


class HourType:
    """Hour type constants with their billing properties."""

    FIELD = "Field"
    INTERNAL = "Internal"
    TRAINING = "Training"
    PTO = "PTO"
    UNPAID = "Unpaid"
    HOLIDAY = "Holiday"

    ALL = [FIELD, INTERNAL, TRAINING, PTO, UNPAID, HOLIDAY]

    # Billing configuration
    CONFIG = {
        FIELD: {"payable": True, "billable": True, "requires_attachment": True},
        INTERNAL: {"payable": True, "billable": False, "requires_attachment": False},
        TRAINING: {"payable": False, "billable": False, "requires_attachment": False},
        PTO: {"payable": True, "billable": False, "requires_attachment": False},
        UNPAID: {"payable": False, "billable": False, "requires_attachment": False},
        HOLIDAY: {"payable": True, "billable": False, "requires_attachment": False},
    }


class ReimbursementType:
    """Reimbursement type constants (REQ-025)."""

    CAR = "Car"
    GAS = "Gas"
    HOTEL = "Hotel"
    FLIGHT = "Flight"
    FOOD = "Food"
    PARKING = "Parking"
    TOLL = "Toll"
    OTHER = "Other"

    ALL = [CAR, GAS, HOTEL, FLIGHT, FOOD, PARKING, TOLL, OTHER]


class Timesheet(db.Model):
    """
    Timesheet model.

    Represents a weekly timesheet for a user. Week always starts on Sunday.

    Attributes:
        id: Primary key (UUID)
        user_id: Foreign key to User
        week_start: Sunday of the timesheet week
        status: Current status (NEW, SUBMITTED, APPROVED, NEEDS_APPROVAL)
        traveled: Whether employee traveled during this week
        has_expenses: Whether there are expenses
        reimbursement_needed: Whether reimbursement is requested
        reimbursement_type: Type of reimbursement (if applicable)
        reimbursement_amount: Amount requested (if applicable)
        stipend_date: Date for stipend (if applicable)
        submitted_at: When timesheet was submitted
        approved_at: When timesheet was approved
        approved_by: User ID of approving admin
    """

    __tablename__ = "timesheets"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(
        db.String(36), db.ForeignKey("users.id"), nullable=False, index=True
    )
    week_start = db.Column(db.Date, nullable=False, index=True)
    status = db.Column(
        db.String(20), default=TimesheetStatus.NEW, nullable=False, index=True
    )

    # Travel and expenses
    traveled = db.Column(db.Boolean, default=False, nullable=False)
    has_expenses = db.Column(db.Boolean, default=False, nullable=False)
    reimbursement_needed = db.Column(db.Boolean, default=False, nullable=False)
    reimbursement_type = db.Column(db.String(20), nullable=True)
    reimbursement_amount = db.Column(db.Numeric(10, 2), nullable=True)
    stipend_date = db.Column(db.Date, nullable=True)

    # Notes (PowerApps parity)
    user_notes = db.Column(db.String(255), nullable=True)  # User comments, 255 char max
    admin_notes = db.Column(db.Text, nullable=True)  # Admin feedback, read-only for users

    # Timestamps
    submitted_at = db.Column(db.DateTime, nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    approved_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    user = db.relationship("User", back_populates="timesheets", foreign_keys=[user_id])
    approver = db.relationship("User", foreign_keys=[approved_by])
    entries = db.relationship(
        "TimesheetEntry",
        back_populates="timesheet",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    attachments = db.relationship(
        "Attachment",
        back_populates="timesheet",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    notes = db.relationship(
        "Note", back_populates="timesheet", lazy="dynamic", cascade="all, delete-orphan"
    )
    # REQ-028: Multiple reimbursement line items
    reimbursement_items = db.relationship(
        "ReimbursementItem",
        back_populates="timesheet",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    # Constraints
    __table_args__ = (
        db.UniqueConstraint("user_id", "week_start", name="uq_user_week"),
    )

    def __repr__(self):
        return f"<Timesheet {self.id} - {self.week_start}>"

    def calculate_totals(self):
        """
        Calculate payable, billable, and unpaid hours.

        Returns:
            dict: Totals for each category
        """
        totals = {
            "payable": Decimal("0"),
            "billable": Decimal("0"),
            "unpaid": Decimal("0"),
            "total": Decimal("0"),
        }

        for entry in self.entries:
            config = HourType.CONFIG.get(entry.hour_type, {})
            hours = Decimal(str(entry.hours))

            totals["total"] += hours

            if config.get("payable"):
                totals["payable"] += hours
            else:
                totals["unpaid"] += hours

            if config.get("billable"):
                totals["billable"] += hours

        return totals

    def requires_attachment(self):
        """
        Check if timesheet has field hours but no attachment.

        Returns:
            bool: True if attachment is required but missing
        """
        has_field_hours = any(e.hour_type == HourType.FIELD for e in self.entries)
        has_attachment = self.attachments.count() > 0

        return has_field_hours and not has_attachment

    def to_dict(self, include_entries=True):
        """Serialize timesheet to dictionary."""
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "week_start": self.week_start.isoformat(),
            "status": self.status,
            "traveled": self.traveled,
            "has_expenses": self.has_expenses,
            "reimbursement_needed": self.reimbursement_needed,
            "reimbursement_type": self.reimbursement_type,
            # REQ-026: Always return a number, default to 0.0 (never null)
            "reimbursement_amount": (
                float(self.reimbursement_amount) if self.reimbursement_amount else 0.0
            ),
            "stipend_date": (
                self.stipend_date.isoformat() if self.stipend_date else None
            ),
            "user_notes": self.user_notes,
            "admin_notes": self.admin_notes,
            "submitted_at": (
                self.submitted_at.isoformat() if self.submitted_at else None
            ),
            "approved_at": (self.approved_at.isoformat() if self.approved_at else None),
            "created_at": self.created_at.isoformat(),
            "totals": {
                "payable": float(self.calculate_totals()["payable"]),
                "billable": float(self.calculate_totals()["billable"]),
                "unpaid": float(self.calculate_totals()["unpaid"]),
                "total": float(self.calculate_totals()["total"]),
            },
        }

        if include_entries:
            data["entries"] = [e.to_dict() for e in self.entries]
            data["attachments"] = [a.to_dict() for a in self.attachments]
            # REQ-028: Include reimbursement line items
            data["reimbursement_items"] = [r.to_dict() for r in self.reimbursement_items]

        return data


class TimesheetEntry(db.Model):
    """
    Time entry within a timesheet.

    Each entry represents hours worked on a specific day with a specific type.

    Attributes:
        id: Primary key (UUID)
        timesheet_id: Foreign key to Timesheet
        entry_date: Date of the entry
        hour_type: Type of hours (Field, Internal, etc.)
        hours: Number of hours
    """

    __tablename__ = "timesheet_entries"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timesheet_id = db.Column(
        db.String(36), db.ForeignKey("timesheets.id"), nullable=False, index=True
    )
    entry_date = db.Column(db.Date, nullable=False)
    hour_type = db.Column(db.String(20), nullable=False)
    hours = db.Column(db.Numeric(4, 2), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    timesheet = db.relationship("Timesheet", back_populates="entries")

    def __repr__(self):
        return f"<TimesheetEntry {self.entry_date} - {self.hour_type}: {self.hours}h>"

    def to_dict(self):
        """Serialize entry to dictionary."""
        return {
            "id": self.id,
            "entry_date": self.entry_date.isoformat(),
            "hour_type": self.hour_type,
            "hours": float(self.hours),
        }
