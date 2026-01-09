"""
User Model

Stores user information synced from Microsoft 365.
"""

import enum
import uuid
from datetime import datetime
from ..extensions import db


class UserRole(enum.Enum):
    """
    Four-tier role system for user permissions.

    Role Hierarchy:
        TRAINEE - Can only submit Training hours, no approval rights
        STAFF   - Can submit all hour types, no approval rights  
        SUPPORT - Can submit all hour types, can approve trainee timesheets
        ADMIN   - Full access: all hour types, approve all timesheets

    See REQ-001 in docs/REQUIREMENTS.md for details.
    """

    TRAINEE = "trainee"
    STAFF = "staff"
    SUPPORT = "support"
    ADMIN = "admin"

    @classmethod
    def from_string(cls, value):
        """Convert string to UserRole enum."""
        if isinstance(value, cls):
            return value
        try:
            return cls(value.lower())
        except (ValueError, AttributeError):
            return cls.STAFF  # Default to staff

    def can_approve_trainee(self):
        """Check if role can approve trainee timesheets."""
        return self in (UserRole.SUPPORT, UserRole.ADMIN)

    def can_approve_all(self):
        """Check if role can approve all timesheets."""
        return self == UserRole.ADMIN

    def is_admin(self):
        """Check if role has admin privileges."""
        return self == UserRole.ADMIN

    def get_allowed_hour_types(self):
        """Get list of hour types this role can use."""
        if self == UserRole.TRAINEE:
            return ["Training"]
        return ["Field", "Internal", "Training", "PTO", "Unpaid", "Holiday"]


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
        role: User's role (trainee, staff, support, admin)
        sms_opt_in: Whether user has opted into SMS notifications
        email_opt_in: Whether user has opted into email notifications
        teams_opt_in: Whether user has opted into Teams notifications
        notification_emails: List of email addresses for notifications
        notification_phones: List of phone numbers for notifications
        teams_account: Teams account email/identifier (if connected)
        created_at: When the user record was created
        updated_at: Last modification time
    """

    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    azure_id = db.Column(db.String(255), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    display_name = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    # Role field - replaces is_admin boolean
    # Use values_callable to store the enum value (lowercase) not the name (uppercase)
    role = db.Column(
        db.Enum(
            UserRole, 
            values_callable=lambda x: [e.value for e in x],
            name='userrole',
            create_type=False  # Type already exists from migration
        ),
        default=UserRole.STAFF,
        nullable=False
    )
    # Keep is_admin for backwards compatibility during migration
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    sms_opt_in = db.Column(db.Boolean, default=True, nullable=False)
    email_opt_in = db.Column(db.Boolean, default=True, nullable=False)
    teams_opt_in = db.Column(db.Boolean, default=True, nullable=False)
    notification_emails = db.Column(db.JSON, nullable=True)
    notification_phones = db.Column(db.JSON, nullable=True)
    teams_account = db.Column(db.String(255), nullable=True)
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

    def __repr__(self):
        return f"<User {self.email}>"

    @property
    def is_admin_role(self):
        """Check if user has admin role."""
        return self.role == UserRole.ADMIN

    def can_approve(self, target_user=None):
        """
        Check if this user can approve another user's timesheet.

        Args:
            target_user: The user whose timesheet is being approved

        Returns:
            bool: True if this user can approve the target's timesheet
        """
        if self.role == UserRole.ADMIN:
            return True
        if self.role == UserRole.SUPPORT and target_user:
            return target_user.role == UserRole.TRAINEE
        return False

    def get_allowed_hour_types(self):
        """Get list of hour types this user can submit."""
        return self.role.get_allowed_hour_types()

    def get_notification_emails(self):
        """Get list of notification emails with primary email fallback."""
        emails = list(self.notification_emails or [])
        if self.email and self.email not in emails:
            emails.insert(0, self.email)
        return emails

    def get_notification_phones(self):
        """Get list of notification phones with primary phone fallback."""
        phones = list(self.notification_phones or [])
        if self.phone and self.phone not in phones:
            phones.insert(0, self.phone)
        return phones

    def to_dict(self):
        """Serialize user to dictionary."""
        return {
            "id": self.id,
            "email": self.email,
            "display_name": self.display_name,
            "role": self.role.value if self.role else "staff",
            "is_admin": self.role == UserRole.ADMIN if self.role else self.is_admin,
            "allowed_hour_types": self.get_allowed_hour_types(),
            "sms_opt_in": self.sms_opt_in,
            "email_opt_in": self.email_opt_in,
            "teams_opt_in": self.teams_opt_in,
            "notification_emails": self.get_notification_emails(),
            "notification_phones": self.get_notification_phones(),
            "teams_account": self.teams_account,
        }
