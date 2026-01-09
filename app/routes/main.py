"""
Main Routes

Landing page and static content routes.
"""

from flask import Blueprint, render_template, session, redirect, url_for

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
def index():
    """
    Root route - redirects to app or login.
    """
    if "user" not in session:
        return redirect(url_for("main.login_page"))
    
    return redirect(url_for("main.app"))  # REQ-016: Go directly to app


@main_bp.route("/login")
def login_page():
    """
    Login page with username/password form.
    """
    if "user" in session:
        return redirect(url_for("main.app"))  # REQ-016: Go directly to app
    
    return render_template("login.html")


@main_bp.route("/dashboard")
def dashboard():
    """
    Dashboard landing page after login.
    
    Shows welcome message and navigation cards.
    """
    if "user" not in session:
        return redirect(url_for("main.login_page"))
    
    return render_template("dashboard.html", user=session["user"])


@main_bp.route("/app")
def app():
    """
    Main timesheet application page.
    
    Renders the full timesheet application.
    """
    if "user" not in session:
        return redirect(url_for("main.login_page"))
    
    return render_template("index.html", user=session["user"])


@main_bp.route("/health")
def health():
    """
    Health check endpoint for load balancers and monitoring.
    
    REQ-043: Returns 200 OK when app is healthy, 503 if any dependency is down.
    Does not require authentication.
    """
    from ..extensions import db
    import redis
    from flask import current_app
    
    status = {
        "status": "healthy",
        "version": "1.0.0",
        "checks": {}
    }
    all_healthy = True
    
    # Check database connectivity
    try:
        db.session.execute(db.text("SELECT 1"))
        status["checks"]["database"] = "ok"
    except Exception as e:
        status["checks"]["database"] = f"error: {str(e)[:100]}"
        all_healthy = False
    
    # Check Redis connectivity (if configured)
    try:
        redis_url = current_app.config.get("REDIS_URL")
        if redis_url:
            r = redis.from_url(redis_url)
            r.ping()
            status["checks"]["redis"] = "ok"
        else:
            status["checks"]["redis"] = "not configured"
    except Exception as e:
        status["checks"]["redis"] = f"error: {str(e)[:100]}"
        # Redis is optional, don't fail health check
    
    if not all_healthy:
        status["status"] = "unhealthy"
        return status, 503
    
    return status, 200

