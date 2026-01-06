"""
Bot configuration helpers.

Configuration is sourced from `app.config.Config` (env vars).
"""

from __future__ import annotations

from dataclasses import dataclass

from flask import current_app


@dataclass(frozen=True)
class BotConfig:
    enabled: bool
    app_id: str
    app_password: str
    tenant_id: str | None
    app_base_url: str

    @classmethod
    def from_flask(cls) -> "BotConfig":
        config = current_app.config
        return cls(
            enabled=bool(config.get("BOT_ENABLED", False)),
            app_id=(config.get("BOT_APP_ID") or "").strip(),
            app_password=(config.get("BOT_APP_PASSWORD") or "").strip(),
            tenant_id=(config.get("BOT_TENANT_ID") or None),
            app_base_url=(config.get("APP_BASE_URL") or "http://localhost").rstrip("/"),
        )

    @property
    def is_configured(self) -> bool:
        return bool(self.app_id and self.app_password)
