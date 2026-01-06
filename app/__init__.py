"""
Timesheet Application

Flask application for managing employee timesheets.
Replaces PowerApps solution with modern web stack.
"""

import os
from flask import Flask
from .config import Config
from .extensions import db, migrate


def create_app(config_class=Config):
    """
    Flask application factory.

    Args:
        config_class: Configuration class to use (default: Config)

    Returns:
        Flask: Configured Flask application instance
    """
    # Get the project root (parent of the app directory)
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    app = Flask(
        __name__,
        template_folder=os.path.join(project_root, "templates"),
        static_folder=os.path.join(project_root, "static"),
    )
    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)

    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.timesheets import timesheets_bp
    from .routes.admin import admin_bp
    from .routes.events import events_bp
    from .routes.main import main_bp
    from .bot import bot_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(timesheets_bp, url_prefix="/api/timesheets")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(events_bp, url_prefix="/api")
    app.register_blueprint(bot_bp, url_prefix="/api/bot")

    # Create database tables if they don't exist
    with app.app_context():
        db.create_all()

    return app
