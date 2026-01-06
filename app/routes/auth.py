"""
Authentication Routes

Microsoft 365 / MSAL authentication endpoints.
"""

from flask import Blueprint, redirect, url_for, session, request, current_app
import msal

auth_bp = Blueprint("auth", __name__)


def _is_dev_mode():
    """Check if we're in development mode without valid Azure credentials."""
    client_id = current_app.config.get("AZURE_CLIENT_ID")
    client_secret = current_app.config.get("AZURE_CLIENT_SECRET")

    # Check if credentials are placeholder values or missing
    # Note: tenant_id can be 'common' for multi-tenant apps, so we don't check it
    return (
        not client_id
        or not client_secret
        or "your-azure" in str(client_id).lower()
        or "your-azure" in str(client_secret).lower()
    )


def _get_msal_app():
    """Create MSAL ConfidentialClientApplication instance."""
    return msal.ConfidentialClientApplication(
        current_app.config["AZURE_CLIENT_ID"],
        authority=current_app.config["AZURE_AUTHORITY"],
        client_credential=current_app.config["AZURE_CLIENT_SECRET"],
    )


def _get_auth_url():
    """Build Microsoft 365 authorization URL."""
    msal_app = _get_msal_app()

    return msal_app.get_authorization_request_url(
        scopes=current_app.config["AZURE_SCOPES"],
        redirect_uri=current_app.config["AZURE_REDIRECT_URI"],
    )


@auth_bp.route("/login")
def login():
    """
    Initiate Microsoft 365 login flow.

    In development mode without Azure credentials, creates a test user session.
    """
    # Development mode bypass
    if _is_dev_mode():
        from ..models import User
        from ..extensions import db

        # Create or get a test user
        test_user = User.query.filter_by(email="dev@localhost").first()
        if not test_user:
            test_user = User(
                azure_id="dev-user-001",
                email="dev@localhost",
                display_name="Development User",
                is_admin=True,  # Give dev user admin access
            )
            db.session.add(test_user)
            db.session.commit()

        session["user"] = test_user.to_dict()
        current_app.logger.warning("DEV MODE: Bypassing Azure AD authentication")
        return redirect(url_for("main.dashboard"))

    # Production: redirect to Azure AD
    auth_url = _get_auth_url()
    return redirect(auth_url)


@auth_bp.route("/callback")
def callback():
    """
    Handle OAuth callback from Microsoft.

    Exchanges authorization code for access token and creates session.
    """
    from ..models import User
    from ..extensions import db

    # Check for errors
    if "error" in request.args:
        error = request.args.get("error")
        error_desc = request.args.get("error_description", "")
        current_app.logger.error(f"Auth error: {error} - {error_desc}")
        return f"Authentication error: {error}", 400

    # Get authorization code
    code = request.args.get("code")
    if not code:
        return "No authorization code received", 400

    # Exchange code for token
    msal_app = _get_msal_app()
    result = msal_app.acquire_token_by_authorization_code(
        code,
        scopes=current_app.config["AZURE_SCOPES"],
        redirect_uri=current_app.config["AZURE_REDIRECT_URI"],
    )

    if "error" in result:
        current_app.logger.error(f"Token error: {result}")
        return f"Token error: {result.get('error_description', '')}", 400

    # Get user info from ID token claims
    id_token_claims = result.get("id_token_claims", {})
    azure_id = id_token_claims.get("oid") or id_token_claims.get("sub")
    email = id_token_claims.get("preferred_username") or id_token_claims.get("email")
    display_name = id_token_claims.get("name", email)

    if not azure_id or not email:
        return "Could not get user info from token", 400

    # Find or create user in database
    user = User.query.filter_by(azure_id=azure_id).first()

    if not user:
        # Create new user
        user = User(
            azure_id=azure_id,
            email=email,
            display_name=display_name,
        )
        db.session.add(user)
        db.session.commit()
        current_app.logger.info(f"Created new user: {email}")
    else:
        # Update user info if changed
        user.email = email
        user.display_name = display_name
        db.session.commit()

    # Store user in session
    session["user"] = user.to_dict()
    session["access_token"] = result.get("access_token")

    return redirect(url_for("main.dashboard"))


@auth_bp.route("/logout", methods=["POST"])
def logout():
    """
    End user session.

    Clears session and redirects to login page.
    """
    session.clear()
    return redirect(url_for("main.login_page"))


@auth_bp.route("/dev-login", methods=["POST"])
def dev_login():
    """
    Development login with username/password.

    Test accounts:
    - user/user: Regular user
    - admin/password: Admin user
    """
    from ..models import User
    from ..extensions import db
    from flask import render_template

    username = request.form.get("username", "").strip().lower()
    password = request.form.get("password", "")

    # Test account credentials
    TEST_ACCOUNTS = {
        "user": {"password": "user", "is_admin": False, "display_name": "Test User"},
        "admin": {
            "password": "password",
            "is_admin": True,
            "display_name": "Admin User",
        },
    }

    # Validate credentials
    if username not in TEST_ACCOUNTS:
        return render_template("login.html", error="Invalid username or password")

    if TEST_ACCOUNTS[username]["password"] != password:
        return render_template("login.html", error="Invalid username or password")

    account = TEST_ACCOUNTS[username]

    # Create or get user in database
    email = f"{username}@localhost"
    user = User.query.filter_by(email=email).first()

    if not user:
        user = User(
            azure_id=f"dev-{username}-001",
            email=email,
            display_name=account["display_name"],
            is_admin=account["is_admin"],
        )
        db.session.add(user)
        db.session.commit()
        current_app.logger.info(f"Created dev user: {email}")
    else:
        # Update admin status if changed
        user.is_admin = account["is_admin"]
        user.display_name = account["display_name"]
        db.session.commit()

    # Store user in session
    session["user"] = user.to_dict()
    current_app.logger.info(
        f"DEV LOGIN: {username} logged in (admin={account['is_admin']})"
    )

    return redirect(url_for("main.dashboard"))


@auth_bp.route("/me")
def me():
    """
    Get current user info.

    Returns:
        dict: Current user data or 401 if not authenticated
    """
    if "user" not in session:
        return {"error": "Not authenticated"}, 401

    return session["user"]
