"""
ReimbursementItem Model

Stores individual expense line items for reimbursement requests (REQ-028).
"""

import uuid
from datetime import datetime
from ..extensions import db


class ReimbursementItem(db.Model):
    """
    Reimbursement expense line item.

    Each item represents a single expense requiring reimbursement.
    Multiple items can be associated with a single timesheet.

    Attributes:
        id: Primary key (UUID)
        timesheet_id: Foreign key to Timesheet
        expense_type: Type of expense (Car, Gas, Hotel, Flight, Food, Parking, Toll, Other)
        amount: Expense amount in dollars
        expense_date: Date expense was incurred
        notes: Optional brief description
        created_at: When item was created
    """

    __tablename__ = "reimbursement_items"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timesheet_id = db.Column(
        db.String(36), db.ForeignKey("timesheets.id"), nullable=False, index=True
    )
    expense_type = db.Column(db.String(20), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    expense_date = db.Column(db.Date, nullable=True)
    notes = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    timesheet = db.relationship("Timesheet", back_populates="reimbursement_items")

    def __repr__(self):
        return f"<ReimbursementItem {self.expense_type}: ${self.amount}>"

    def to_dict(self):
        """Serialize item to dictionary."""
        return {
            "id": self.id,
            "expense_type": self.expense_type,
            "amount": float(self.amount) if self.amount else 0.0,
            "expense_date": self.expense_date.isoformat() if self.expense_date else None,
            "notes": self.notes,
        }
