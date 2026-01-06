"""
Adaptive Card builders for the Timesheet bot.

Cards are returned as plain dicts and attached to Bot Framework messages.
"""

from __future__ import annotations

from urllib.parse import urlencode


ADAPTIVE_CARD_CONTENT_TYPE = "application/vnd.microsoft.card.adaptive"


def _join_url(base_url: str, path: str, query: dict[str, str] | None = None) -> str:
    base = (base_url or "").rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    url = f"{base}{path}"
    if query:
        url = f"{url}?{urlencode(query)}"
    return url


def build_open_app_url(app_base_url: str, *, hash_fragment: str | None = None) -> str:
    url = _join_url(app_base_url, "/app")
    if hash_fragment:
        fragment = hash_fragment.lstrip("#")
        url = f"{url}#{fragment}"
    return url


def build_welcome_card(app_base_url: str) -> dict:
    return {
        "type": "AdaptiveCard",
        "version": "1.4",
        "body": [
            {
                "type": "TextBlock",
                "text": "Hi! I'm NorthStar's Timecards virtual agent.",
                "wrap": True,
                "weight": "Bolder",
                "size": "Medium",
            },
            {
                "type": "TextBlock",
                "text": (
                    "You can say things like:\n"
                    '• "Submit hours"\n'
                    '• "Create timesheet"\n'
                    '• "View my timesheets"\n'
                    '• "Status"\n'
                    '• "Help"\n\n'
                    "I'll also send you important updates and reminders regarding your "
                    "timesheets."
                ),
                "wrap": True,
            },
        ],
        "actions": [
            {
                "type": "Action.OpenUrl",
                "title": "Open Timesheets App",
                "url": build_open_app_url(app_base_url),
            }
        ],
    }


def build_link_card(title: str, message: str, url: str, button_title: str) -> dict:
    return {
        "type": "AdaptiveCard",
        "version": "1.4",
        "body": [
            {"type": "TextBlock", "text": title, "wrap": True, "weight": "Bolder"},
            {"type": "TextBlock", "text": message, "wrap": True},
        ],
        "actions": [{"type": "Action.OpenUrl", "title": button_title, "url": url}],
    }
