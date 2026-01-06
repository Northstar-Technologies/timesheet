"""
Conversation reference storage and proactive messaging helpers.

Phase 1 focuses on storing enough information to enable proactive messaging
later (scheduled reminders and status notifications).
"""

from __future__ import annotations

from datetime import datetime

from flask import current_app

from ..extensions import db
from ..models import TeamsConversation, User


def upsert_conversation_reference(activity_data: dict) -> None:
    """
    Upsert Teams conversation reference from a raw Bot Framework activity.

    Notes:
    - Teams activities typically include the user's AAD object id as
      `from.aadObjectId`. This is used as the stable key.
    - `user_id` is linked when we can find a matching `User.azure_id`.
    """
    aad_object_id = (activity_data.get("from") or {}).get("aadObjectId")
    if not aad_object_id:
        return

    conversation = activity_data.get("conversation") or {}
    recipient = activity_data.get("recipient") or {}
    channel_data = activity_data.get("channelData") or {}
    tenant_data = channel_data.get("tenant") or {}

    conversation_id = conversation.get("id")
    service_url = activity_data.get("serviceUrl")
    bot_id = recipient.get("id")

    if not conversation_id or not service_url or not bot_id:
        current_app.logger.warning(
            "Bot activity missing required conversation fields; skipping storage"
        )
        return

    tenant_id = conversation.get("tenantId") or tenant_data.get("id")

    record = TeamsConversation.query.filter_by(aad_object_id=aad_object_id).first()
    if not record:
        record = TeamsConversation(aad_object_id=aad_object_id)
        db.session.add(record)

    user = User.query.filter_by(azure_id=aad_object_id).first()
    record.user_id = user.id if user else None
    record.conversation_id = conversation_id
    record.service_url = service_url
    record.channel_id = activity_data.get("channelId") or "msteams"
    record.bot_id = bot_id
    record.bot_name = recipient.get("name")
    record.tenant_id = tenant_id
    record.last_activity = datetime.utcnow()

    db.session.commit()
