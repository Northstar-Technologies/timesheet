"""
Bot activity handler.

Uses the Microsoft Bot Framework SDK (botbuilder-core) to process incoming
Teams activities and send replies.
"""

from __future__ import annotations

from botbuilder.core import ActivityHandler, MessageFactory, TurnContext
from botbuilder.schema import Attachment

from . import cards
from .intents import (
    INTENT_CHECK_STATUS,
    INTENT_CREATE_TIMESHEET,
    INTENT_HELP,
    INTENT_SUBMIT_HOURS,
    INTENT_UNKNOWN,
    INTENT_VIEW_TIMESHEETS,
    recognize_intent,
)


def _adaptive_card_attachment(card: dict) -> Attachment:
    return Attachment(content_type=cards.ADAPTIVE_CARD_CONTENT_TYPE, content=card)


class TimesheetBot(ActivityHandler):
    def __init__(self, app_base_url: str):
        super().__init__()
        self._app_base_url = (app_base_url or "").rstrip("/")

    async def on_members_added_activity(self, members_added, turn_context: TurnContext):
        bot_id = getattr(turn_context.activity.recipient, "id", None)
        should_welcome = any(
            getattr(m, "id", None) != bot_id for m in members_added or []
        )
        if not should_welcome:
            return

        welcome_card = cards.build_welcome_card(self._app_base_url)
        await turn_context.send_activity(
            MessageFactory.attachment(_adaptive_card_attachment(welcome_card))
        )

    async def on_message_activity(self, turn_context: TurnContext):
        intent = recognize_intent(turn_context.activity.text)

        if intent == INTENT_HELP:
            card = cards.build_welcome_card(self._app_base_url)
            await turn_context.send_activity(
                MessageFactory.attachment(_adaptive_card_attachment(card))
            )
            return

        if intent == INTENT_CREATE_TIMESHEET:
            url = cards.build_open_app_url(self._app_base_url, hash_fragment="new")
            card = cards.build_link_card(
                "Create a new timesheet",
                "Open the Timesheets app to start a new draft for this week.",
                url,
                "Create Timesheet",
            )
            await turn_context.send_activity(
                MessageFactory.attachment(_adaptive_card_attachment(card))
            )
            return

        if intent == INTENT_VIEW_TIMESHEETS:
            url = cards.build_open_app_url(
                self._app_base_url, hash_fragment="timesheets"
            )
            card = cards.build_link_card(
                "View your timesheets",
                "Open the Timesheets app to view your submission history.",
                url,
                "View Timesheets",
            )
            await turn_context.send_activity(
                MessageFactory.attachment(_adaptive_card_attachment(card))
            )
            return

        if intent in {INTENT_SUBMIT_HOURS, INTENT_CHECK_STATUS}:
            url = cards.build_open_app_url(
                self._app_base_url, hash_fragment="timesheets"
            )
            title = (
                "Submit hours"
                if intent == INTENT_SUBMIT_HOURS
                else "Check your timesheet status"
            )
            card = cards.build_link_card(
                title,
                (
                    "Open the Timesheets app to view your current week and submit when "
                    "ready."
                ),
                url,
                "Open Timesheets App",
            )
            await turn_context.send_activity(
                MessageFactory.attachment(_adaptive_card_attachment(card))
            )
            return

        if intent == INTENT_UNKNOWN:
            await turn_context.send_activity(
                "I didn't understand that. Try 'help' to see what I can do."
            )
