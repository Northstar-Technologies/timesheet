"""
Application Configuration

Loads settings from environment variables with sensible defaults.
"""

import os
from dotenv import load_dotenv

load_dotenv()


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Config:
    """Base configuration class."""

    # Flask
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-me")

    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "postgresql://timesheet:timesheet@localhost:5432/timesheet"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Azure AD / MSAL
    AZURE_CLIENT_ID = os.environ.get("AZURE_CLIENT_ID")
    AZURE_CLIENT_SECRET = os.environ.get("AZURE_CLIENT_SECRET")
    # Use 'common' for multi-tenant (any Microsoft account), or specific tenant ID
    AZURE_TENANT_ID = os.environ.get("AZURE_TENANT_ID", "common")
    AZURE_REDIRECT_URI = os.environ.get(
        "AZURE_REDIRECT_URI", "http://localhost:5000/auth/callback"
    )
    AZURE_AUTHORITY = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}"
    # MSAL automatically adds openid/profile/offline_access;
    # only specify additional scopes.
    AZURE_SCOPES = ["User.Read"]

    # Twilio
    TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
    TWILIO_PHONE_NUMBER = os.environ.get("TWILIO_PHONE_NUMBER")

    # Redis
    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

    # App deep links (used by the Teams bot)
    APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost")

    # File uploads
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "uploads")
    MAX_CONTENT_LENGTH = int(
        os.environ.get("MAX_CONTENT_LENGTH", 16 * 1024 * 1024)
    )  # 16MB
    ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "gif"}

    # Microsoft Teams bot (Azure Bot Service / Bot Framework)
    BOT_ENABLED = _env_bool("BOT_ENABLED", False)
    BOT_APP_ID = os.environ.get("BOT_APP_ID", "")
    BOT_APP_PASSWORD = os.environ.get("BOT_APP_PASSWORD", "")
    BOT_TENANT_ID = os.environ.get("BOT_TENANT_ID")

    BOT_WEEKLY_REMINDER_ENABLED = _env_bool("BOT_WEEKLY_REMINDER_ENABLED", True)
    BOT_REMINDER_CRON = os.environ.get("BOT_REMINDER_CRON", "0 14 * * 5")


class DevelopmentConfig(Config):
    """Development configuration."""

    DEBUG = True


class ProductionConfig(Config):
    """Production configuration."""

    DEBUG = False


class TestingConfig(Config):
    """Testing configuration."""

    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
