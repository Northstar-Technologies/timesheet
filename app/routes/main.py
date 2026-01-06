"""
Main Routes

Landing page and static content routes.
"""

from flask import Blueprint, render_template, session, redirect, url_for

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
def index():
    """
    Root route - redirects to dashboard or login.
    """
    if "user" not in session:
        return redirect(url_for("main.login_page"))

    return redirect(url_for("main.dashboard"))


@main_bp.route("/login")
def login_page():
    """
    Login page with username/password form.
    """
    if "user" in session:
        return redirect(url_for("main.dashboard"))

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
    """Health check endpoint for Docker/load balancers."""
    return {"status": "healthy"}, 200
