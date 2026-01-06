"""
Notification Model

SMS notification records for Twilio integration.
"""

import uuid
from datetime import datetime
from ..extensions import db


class NotificationType:
    """Notification type constants."""

    NEEDS_ATTACHMENT = "NEEDS_ATTACHMENT"
    APPROVED = "APPROVED"
    REMINDER = "REMINDER"
    UNSUBMITTED = "UNSUBMITTED"  # Daily reminder for unsubmitted timesheets

    ALL = [NEEDS_ATTACHMENT, APPROVED, REMINDER, UNSUBMITTED]


class Notification(db.Model):
    """
    Notification record for SMS messages.

    Tracks all SMS notifications sent via Twilio.

    Attributes:
        id: Primary key (UUID)
        user_id: Foreign key to recipient User
        timesheet_id: Foreign key to related Timesheet (optional)
        type: Notification type (NEEDS_ATTACHMENT, APPROVED, REMINDER)
        message: SMS message content
        sent: Whether message was successfully sent
        sent_at: When message was sent
        created_at: When notification was created
    """

    __tablename__ = "notifications"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(
        db.String(36), db.ForeignKey("users.id"), nullable=False, index=True
    )
    timesheet_id = db.Column(
        db.String(36), db.ForeignKey("timesheets.id"), nullable=True, index=True
    )
    type = db.Column(db.String(20), nullable=False)
    message = db.Column(db.Text, nullable=False)
    sent = db.Column(db.Boolean, default=False, nullable=False)
    sent_at = db.Column(db.DateTime, nullable=True)
    error = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = db.relationship("User", back_populates="notifications")
    timesheet = db.relationship("Timesheet")

    def __repr__(self):
        return f"<Notification {self.type} to {self.user_id}>"

    def to_dict(self):
        """Serialize notification to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "timesheet_id": self.timesheet_id,
            "type": self.type,
            "message": self.message,
            "sent": self.sent,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "created_at": self.created_at.isoformat(),
        }
