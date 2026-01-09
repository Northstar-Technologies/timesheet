"""
Timesheet Application

Flask application for managing employee timesheets.
Replaces PowerApps solution with modern web stack.
"""

import os
from flask import Flask, jsonify, request
from .config import Config
from .extensions import db, migrate, csrf, limiter


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
    csrf.init_app(app)  # REQ-031: CSRF protection for mutating endpoints
    limiter.init_app(app)  # REQ-042: Rate limiting on auth endpoints

    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.timesheets import timesheets_bp
    from .routes.admin import admin_bp
    from .routes.events import events_bp
    from .routes.main import main_bp
    from .routes.users import users_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(timesheets_bp, url_prefix="/api/timesheets")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(events_bp, url_prefix="/api")
    app.register_blueprint(users_bp, url_prefix="/api/users")

    # REQ-035: Register global error handlers for standardized API responses
    from .utils.errors import register_error_handlers
    register_error_handlers(app)

    # REQ-036: Register observability middleware for structured logging and metrics
    from .utils.observability import register_observability
    register_observability(app)

    # REQ-029: Database schema is managed exclusively by Flask-Migrate.
    # Run 'flask db upgrade' before starting the application.
    # The old db.create_all() call has been removed to prevent
    # schema drift and encourage proper migration usage.

    # Security headers
    @app.after_request
    def set_security_headers(response):
        """Add security headers to all responses."""
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Enable HSTS in production (uncomment when using HTTPS)
        # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    # REQ-042: Rate limit exceeded handler
    @app.errorhandler(429)
    def ratelimit_handler(e):
        """Handle rate limit exceeded errors."""
        app.logger.warning(
            f"Rate limit exceeded: {request.remote_addr} on {request.path}"
        )
        # Return JSON for API endpoints, HTML for web endpoints
        if request.path.startswith("/api/") or request.path.startswith("/auth/"):
            return jsonify({
                "error": "Too many requests",
                "message": "Rate limit exceeded. Please try again later.",
                "retry_after": e.description if hasattr(e, "description") else None
            }), 429
        return "Too many requests. Please try again later.", 429

    return app
