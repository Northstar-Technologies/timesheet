"""
Teams Conversation Model

Stores Microsoft Teams conversation references for proactive messaging.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from ..extensions import db


class TeamsConversation(db.Model):
    """
    Stores Teams conversation references for proactive messaging.

    Notes:
    - Teams user identity is keyed by the Azure AD object id (`aad_object_id`).
    - `user_id` is optional because a user may message the bot before they have
      an application `User` record (created during web app auth).
    """

    __tablename__ = "teams_conversations"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    aad_object_id = db.Column(db.String(100), nullable=False, unique=True, index=True)

    user_id = db.Column(
        db.String(36), db.ForeignKey("users.id"), nullable=True, unique=True
    )

    # Bot Framework conversation reference fields
    conversation_id = db.Column(db.String(255), nullable=False)
    service_url = db.Column(db.String(500), nullable=False)
    channel_id = db.Column(db.String(50), default="msteams", nullable=False)
    bot_id = db.Column(db.String(100), nullable=False)
    bot_name = db.Column(db.String(100), nullable=True)
    tenant_id = db.Column(db.String(100), nullable=True)

    # Metadata
    last_activity = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = db.relationship("User", back_populates="teams_conversation")

    def __repr__(self):
        return f"<TeamsConversation aad_object_id={self.aad_object_id}>"
