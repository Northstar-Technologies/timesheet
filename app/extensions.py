"""
Flask Extensions

Centralized extension initialization to avoid circular imports.
"""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect

# Database
db = SQLAlchemy()

# Database migrations
migrate = Migrate()

# CSRF protection (REQ-031)
csrf = CSRFProtect()
