"""
Intent recognition for the Timesheet bot.

Phase 1 uses lightweight keyword matching; this can be replaced with a
more robust NLU layer later (Teams AI, LLM routing, etc.).
"""

from __future__ import annotations

import re


INTENT_HELP = "help"
INTENT_SUBMIT_HOURS = "submit_hours"
INTENT_CREATE_TIMESHEET = "create_timesheet"
INTENT_VIEW_TIMESHEETS = "view_timesheets"
INTENT_CHECK_STATUS = "check_status"
INTENT_UNKNOWN = "unknown"


_INTENT_PATTERNS: list[tuple[str, list[str]]] = [
    (INTENT_HELP, [r"\bhelp\b", r"what can you do", r"\bcommands?\b"]),
    (INTENT_SUBMIT_HOURS, [r"submit", r"submit hours", r"submit timesheet"]),
    (INTENT_CREATE_TIMESHEET, [r"create", r"new timesheet", r"start timesheet"]),
    (INTENT_VIEW_TIMESHEETS, [r"view", r"history", r"my timesheets"]),
    (INTENT_CHECK_STATUS, [r"\bstatus\b", r"check status", r"where am i"]),
]


def recognize_intent(text: str | None) -> str:
    normalized = (text or "").strip().lower()
    if not normalized:
        return INTENT_HELP

    for intent, patterns in _INTENT_PATTERNS:
        for pattern in patterns:
            if re.search(pattern, normalized):
                return intent

    return INTENT_UNKNOWN
