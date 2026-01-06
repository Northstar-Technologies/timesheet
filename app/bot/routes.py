"""
Bot API routes.

Implements the Bot Framework messaging endpoint:
  POST /api/bot/messages
and a simple health endpoint:
  GET /api/bot/health
"""

from __future__ import annotations

import asyncio

from botbuilder.core import BotFrameworkAdapter, BotFrameworkAdapterSettings
from botbuilder.schema import Activity
from flask import Blueprint, current_app, jsonify, request

from .config import BotConfig
from .handler import TimesheetBot
from .proactive import upsert_conversation_reference

bot_bp = Blueprint("bot", __name__)

_adapter: BotFrameworkAdapter | None = None
_bot: TimesheetBot | None = None


def _get_adapter(config: BotConfig) -> BotFrameworkAdapter:
    global _adapter
    if _adapter is None:
        settings = BotFrameworkAdapterSettings(config.app_id, config.app_password)
        _adapter = BotFrameworkAdapter(settings)

        async def on_error(turn_context, error):
            current_app.logger.exception("Bot error: %s", error)
            await turn_context.send_activity(
                "Sorry — something went wrong processing your message."
            )

        _adapter.on_turn_error = on_error

    return _adapter


def _get_bot(config: BotConfig) -> TimesheetBot:
    global _bot
    if _bot is None:
        _bot = TimesheetBot(app_base_url=config.app_base_url)
    return _bot


@bot_bp.get("/health")
def bot_health():
    config = BotConfig.from_flask()
    return {
        "status": "ok",
        "bot_enabled": config.enabled,
        "bot_configured": config.is_configured,
    }, 200


@bot_bp.post("/messages")
def bot_messages():
    config = BotConfig.from_flask()

    if not config.enabled:
        return {"error": "Bot is disabled"}, 404

    if not config.is_configured:
        current_app.logger.warning(
            "Bot enabled but missing BOT_APP_ID/BOT_APP_PASSWORD"
        )
        return {"error": "Bot is not configured"}, 503

    activity_data = request.get_json(silent=True) or {}
    upsert_conversation_reference(activity_data)

    activity = Activity().deserialize(activity_data)
    auth_header = request.headers.get("Authorization", "")

    adapter = _get_adapter(config)
    bot = _get_bot(config)

    async def turn_call(turn_context):
        await bot.on_turn(turn_context)

    invoke_response = asyncio.run(
        adapter.process_activity(activity, auth_header, turn_call)
    )

    if invoke_response:
        return jsonify(invoke_response.body), invoke_response.status

    return "", 200
