"""
Application Configuration

Loads settings from environment variables with sensible defaults.
"""

import os
import secrets
from dotenv import load_dotenv

load_dotenv()


_SECRET_KEY_PLACEHOLDERS = (
    "dev-secret-key",
    "your-secret-key",
)


def _load_secret_key():
    secret_key = os.environ.get("SECRET_KEY")
    if not secret_key:
        return secrets.token_hex(32)

    lowered = str(secret_key).lower()
    if any(marker in lowered for marker in _SECRET_KEY_PLACEHOLDERS):
        return secrets.token_hex(32)

    return secret_key


class Config:
    """Base configuration class."""

    # Flask
    SECRET_KEY = _load_secret_key()

    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "postgresql://timesheet:timesheet@localhost:5432/timesheet"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Session security (REQ-031: CSRF requires sessions for token validation)
    SESSION_COOKIE_HTTPONLY = True  # Prevent XSS access to session cookie
    SESSION_COOKIE_SAMESITE = "Lax"  # CSRF protection for same-site requests
    # Note: SESSION_COOKIE_SECURE should only be True in production with HTTPS

    # Azure AD / MSAL
    AZURE_CLIENT_ID = os.environ.get("AZURE_CLIENT_ID")
    AZURE_CLIENT_SECRET = os.environ.get("AZURE_CLIENT_SECRET")
    # Use 'common' for multi-tenant (any Microsoft account), or specific tenant ID
    AZURE_TENANT_ID = os.environ.get("AZURE_TENANT_ID", "common")
    AZURE_REDIRECT_URI = os.environ.get(
        "AZURE_REDIRECT_URI", "http://localhost:5000/auth/callback"
    )
    AZURE_AUTHORITY = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}"
    # MSAL automatically adds openid, profile, offline_access - only specify additional scopes
    AZURE_SCOPES = ["User.Read"]

    # Twilio
    TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
    TWILIO_PHONE_NUMBER = os.environ.get("TWILIO_PHONE_NUMBER")

    # Redis
    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

    # Application URL (for SMS notification links)
    APP_URL = os.environ.get("APP_URL", "http://localhost/app")

    # File uploads
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "uploads")
    MAX_CONTENT_LENGTH = int(
        os.environ.get("MAX_CONTENT_LENGTH", 16 * 1024 * 1024)
    )  # 16MB
    ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "gif"}


class DevelopmentConfig(Config):
    """Development configuration."""

    DEBUG = True


class ProductionConfig(Config):
    """Production configuration."""

    DEBUG = False

    # Session security (production only - requires HTTPS)
    SESSION_COOKIE_SECURE = True  # Cookies only sent over HTTPS
    SESSION_COOKIE_HTTPONLY = True  # Prevent XSS access to session cookie
    SESSION_COOKIE_SAMESITE = "Lax"  # CSRF protection

    # Session timeout (8 hours)
    PERMANENT_SESSION_LIFETIME = 28800


class TestingConfig(Config):
    """Testing configuration."""

    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
