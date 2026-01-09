"""
Attachment Model

File attachments for timesheets (images/PDFs for field hour approval).
"""

import uuid
from datetime import datetime
from ..extensions import db


class Attachment(db.Model):
    """
    File attachment for a timesheet.

    Stores metadata for uploaded files (images/PDFs).
    The actual files are stored in the filesystem.

    Attributes:
        id: Primary key (UUID)
        timesheet_id: Foreign key to Timesheet
        filename: Stored filename (UUID-based)
        original_filename: User's original filename
        mime_type: File MIME type
        file_size: Size in bytes
        reimbursement_type: Optional reimbursement type tag (REQ-021)
        uploaded_at: Upload timestamp
    """

    __tablename__ = "attachments"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timesheet_id = db.Column(
        db.String(36), db.ForeignKey("timesheets.id"), nullable=False, index=True
    )
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    mime_type = db.Column(db.String(100), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    reimbursement_type = db.Column(db.String(20), nullable=True)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    timesheet = db.relationship("Timesheet", back_populates="attachments")

    def __repr__(self):
        return f"<Attachment {self.original_filename}>"

    def to_dict(self):
        """Serialize attachment to dictionary."""
        return {
            "id": self.id,
            "filename": self.original_filename,
            "mime_type": self.mime_type,
            "file_size": self.file_size,
            "reimbursement_type": self.reimbursement_type,
            "uploaded_at": self.uploaded_at.isoformat(),
        }
