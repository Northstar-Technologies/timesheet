"""
User Model

Stores user information synced from Microsoft 365.
"""

import uuid
from datetime import datetime
from ..extensions import db


class User(db.Model):
    """
    User model for employees.

    Users are synced from Microsoft 365/Azure AD. The azure_id links
    to their Microsoft identity for authentication.

    Attributes:
        id: Primary key (UUID)
        azure_id: Microsoft 365 user ID (unique)
        email: User's email address (unique)
        display_name: User's display name
        phone: Phone number for Twilio SMS notifications
        is_admin: Whether user has admin privileges
        sms_opt_in: Whether user has opted into SMS notifications
        teams_notifications_enabled: Whether user has opted into Teams notifications
        created_at: When the user record was created
        updated_at: Last modification time
    """

    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    azure_id = db.Column(db.String(255), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    display_name = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    sms_opt_in = db.Column(db.Boolean, default=True, nullable=False)
    teams_notifications_enabled = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    timesheets = db.relationship(
        "Timesheet",
        back_populates="user",
        lazy="dynamic",
        foreign_keys="Timesheet.user_id",
    )
    notifications = db.relationship(
        "Notification", back_populates="user", lazy="dynamic"
    )
    notes = db.relationship("Note", back_populates="author", lazy="dynamic")
    teams_conversation = db.relationship(
        "TeamsConversation", back_populates="user", uselist=False
    )

    def __repr__(self):
        return f"<User {self.email}>"

    def to_dict(self):
        """Serialize user to dictionary."""
        return {
            "id": self.id,
            "email": self.email,
            "display_name": self.display_name,
            "is_admin": self.is_admin,
            "sms_opt_in": self.sms_opt_in,
            "teams_notifications_enabled": self.teams_notifications_enabled,
        }
