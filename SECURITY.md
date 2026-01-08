# Security

This document outlines security best practices and a pre-deployment checklist for the Northstar Timesheet application.

---

## Pre-Deployment Security Checklist

Before deploying to production, run through this comprehensive checklist to ensure your application is secure.

### 🔐 Secrets Management

#### Backend Secrets

- [x] **Verify `.env` is in `.gitignore`** - ✅ Confirmed in `.gitignore` lines 50-66
- [ ] **Generate strong `SECRET_KEY`** - Use cryptographically secure random string (not the default `dev-secret-key-change-me`)
  ```bash
  python3 -c "import secrets; print(secrets.token_hex(32))"
  ```
- [ ] **Rotate Azure credentials** - Ensure `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` are production values (not placeholder `your-azure-*` values)
- [ ] **Secure Twilio credentials** - Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are properly configured
- [ ] **Use secrets manager in production** - Consider AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault for production deployments

#### Frontend Security

- [ ] **Search for exposed secrets** - Run the following commands to check for hardcoded secrets:
  ```bash
  grep -r "api_key" static/ templates/
  grep -r "secret" static/ templates/
  grep -r "sk_live" static/ templates/
  grep -r "token" static/ templates/
  grep -r "password" static/ templates/
  ```
- [ ] **Verify no secrets in JavaScript** - Check that API calls with secrets are server-side only
- [ ] **Review build artifacts** - If using a build process, ensure no secrets are bundled into JavaScript

> [!IMPORTANT] > **Frontend code is public.** Even if secrets are in `.env` files, build processes may bundle them into JavaScript. Anyone can extract them from the browser. All API calls requiring secrets MUST go through backend endpoints.

---

### 🗄️ Database Security

#### PostgreSQL Configuration

- [ ] **Strong database password** - Ensure PostgreSQL password is not the default `timesheet`
- [ ] **Database user permissions** - Use principle of least privilege (app user shouldn't have `SUPERUSER` rights)
- [ ] **Network isolation** - Database should only be accessible from application server (not public internet)
- [x] **Parameterized queries** - ✅ All queries use SQLAlchemy ORM (no raw SQL concatenation)

#### Data Protection

- [x] **Check SQL injection vulnerabilities** - ✅ No raw SQL found; all queries via SQLAlchemy ORM
- [x] **Verify data ownership policies** - ✅ All routes use `filter_by(user_id=session["user"]["id"])`
- [x] **Test admin authorization** - ✅ Admin routes use both `@login_required` and `@admin_required`

---

### 🔒 Authentication & Authorization

#### Session Security

- [x] **Secure session configuration** - ✅ Added to `ProductionConfig` (Jan 7, 2026):
  - `SESSION_COOKIE_SECURE = True` (HTTPS only in production)
  - `SESSION_COOKIE_HTTPONLY = True` (prevent XSS access)
  - `SESSION_COOKIE_SAMESITE = 'Lax'` (CSRF protection)
- [x] **Session timeout** - ✅ `PERMANENT_SESSION_LIFETIME = 28800` (8 hours)

#### Server-Side Authentication

- [x] **Verify `@login_required` decorator** - ✅ All protected routes in `timesheets.py` use `@login_required`
- [x] **Verify `@admin_required` decorator** - ✅ All admin routes in `admin.py` use both decorators
- [x] **No client-side only protection** - ✅ All endpoints verify permissions server-side

#### Authorization Checks

- [x] **Ownership verification** - ✅ All routes verify ownership:
  ```python
  # Example from timesheets.py
  timesheet = Timesheet.query.filter_by(
      id=timesheet_id,
      user_id=session["user"]["id"]  # Verify ownership
  ).first_or_404()
  ```
- [x] **Admin privilege checks** - ✅ Implemented in `decorators.py`:
  ```python
  # From decorators.py
  if not session.get("user", {}).get("is_admin"):
      return jsonify({"error": "Admin access required"}), 403
  ```

#### Development Mode

- [ ] **Disable dev login in production** - Ensure `_is_dev_mode()` check works correctly:
  - Must have valid `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET`
  - No placeholder values like `your-azure-*`
- [ ] **Remove test accounts** - Remove or secure dev accounts (user/user, admin/password)

---

### 🛡️ Input Validation & XSS Prevention

#### File Uploads

- [x] **Validate file extensions** - ✅ `ALLOWED_EXTENSIONS` in `config.py`: `pdf`, `png`, `jpg`, `jpeg`, `gif`
- [x] **Enforce file size limits** - ✅ `MAX_CONTENT_LENGTH = 16MB` in `config.py`
- [x] **Validate file content** - ✅ Magic number validation added to `upload_attachment()` (Jan 7, 2026)
- [x] **Secure file storage** - ✅ Files stored in `/app/uploads` via Docker volume
- [x] **Sanitize filenames** - ✅ Uses `werkzeug.utils.secure_filename()` in `timesheets.py`

#### User Input

- [x] **Validate all form inputs** - ✅ Notes have `maxlength="255"`, hours validated client/server-side
- [x] **XSS prevention** - ✅ Jinja2 auto-escaping enabled by default, no `|safe` filters used
  ```jinja2
  {{ user_input }}  <!-- Auto-escaped -->
  {{ user_input|safe }}  <!-- Only if you're absolutely sure it's safe -->
  ```
- [x] **Sanitize rich text** - ✅ Not applicable - using plain text notes only
- [x] **Validate numeric inputs** - ✅ Hours use `type="number" min="0" max="24" step="0.5"`

---

### 🌐 HTTPS & Network Security

#### SSL/TLS Configuration

- [ ] **Enable HTTPS in production** - All traffic must use HTTPS
- [ ] **Set `SESSION_COOKIE_SECURE = True`** - Cookies only sent over HTTPS
- [ ] **Update `AZURE_REDIRECT_URI`** - Must be `https://` in production
- [ ] **Update `APP_URL`** - Used in SMS notifications, must be `https://`

#### CORS & Headers

- [x] **Configure security headers** - ✅ Added to `app/__init__.py` (Jan 7, 2026):
  ```python
  # app/__init__.py
  @app.after_request
  def set_security_headers(response):
      response.headers['X-Content-Type-Options'] = 'nosniff'
      response.headers['X-Frame-Options'] = 'DENY'
      response.headers['X-XSS-Protection'] = '1; mode=block'
      response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
      # HSTS enabled when using HTTPS
      return response
  ```
- [ ] **CORS policy** - If enabling CORS, restrict to specific domains (not `*`)

---

### 📱 Third-Party Integrations

#### Microsoft Azure AD

- [ ] **Verify redirect URI** - Must match exactly in Azure App Registration
- [ ] **Use specific tenant ID** - In production, use your specific tenant ID instead of `common` for better security
- [ ] **Minimal scopes** - Only request necessary permissions (currently `User.Read`)
- [ ] **Token storage** - Access tokens stored in server-side session only (not localStorage)

#### Twilio SMS

- [ ] **Verify webhook signatures** - If implementing Twilio webhooks, validate signatures
- [ ] **Rate limiting** - Implement rate limits on SMS notifications to prevent abuse
- [ ] **PII in SMS** - Don't include sensitive information in SMS messages (use links instead)

---

### 🐳 Docker & Infrastructure

#### Container Security

- [x] **Use official base images** - ✅ Using `python:3.11-slim`, official PostgreSQL, Redis
- [ ] **Keep images updated** - Regularly update base images for security patches
- [ ] **Scan for vulnerabilities** - Use `docker scan` or Trivy to check for CVEs
- [x] **Non-root user** - ✅ App runs as `appuser` (created via `useradd` in Dockerfile)
- [ ] **Minimal permissions** - Container should have minimal necessary permissions

#### Environment Variables

- [ ] **Docker secrets** - Use Docker secrets or environment injection (not hardcoded in Dockerfile)
- [ ] **Separate environments** - Different credentials for dev/staging/prod

---

### 🧪 Testing & Validation

#### Manual Testing

- [ ] **Test endpoint protection** - Try accessing `/api/timesheets`, `/api/admin/*` without authentication
- [ ] **Test ownership boundaries** - User A shouldn't access User B's timesheets
- [ ] **Test admin authorization** - Non-admin users shouldn't access admin endpoints
- [ ] **Browser network tab** - Check what data is exposed in API responses
- [ ] **Test common paths** - Try `/api`, `/.env`, `/config`, `/admin` and verify proper responses

#### Automated Testing

- [ ] **Run security linters** - Use Bandit for Python security issues:
  ```bash
  pip install bandit
  bandit -r app/
  ```
- [ ] **Dependency scanning** - Check for vulnerable dependencies:
  ```bash
  pip install safety
  safety check
  ```
- [ ] **OWASP ZAP** - Consider running OWASP ZAP automated scanner

---

### 📝 Logging & Monitoring

#### Security Logging

- [ ] **Authentication events** - Log successful/failed logins
- [ ] **Authorization failures** - Log 401/403 responses
- [ ] **Data access** - Log admin access to user timesheets
- [ ] **File uploads** - Log all file upload attempts
- [ ] **Don't log secrets** - Never log passwords, tokens, or sensitive data

#### Monitoring

- [ ] **Failed login tracking** - Monitor for brute force attempts
- [ ] **Rate limiting** - Implement rate limits on sensitive endpoints
- [ ] **Error monitoring** - Use Sentry or similar for error tracking

---

## Current Security Status

### ✅ Good Security Practices Implemented

1. **Session-based authentication** - Server-side session storage (no JWT in localStorage)
2. **Decorator-based authorization** - `@login_required`, `@admin_required`, `@role_required` decorators
3. **Role-based access control** - Four-tier role system (Trainee, Staff, Support, Admin) _(Added Jan 8, 2026)_
4. **SQLAlchemy ORM** - Parameterized queries prevent SQL injection
5. **Ownership verification** - Timesheets filtered by `user_id` in all routes
6. **Development mode detection** - `_is_dev_mode()` prevents accidental bypass in production
7. **File extension validation** - `ALLOWED_EXTENSIONS` restricts upload types
8. **File magic number validation** - Verifies file content matches extension _(Added Jan 7, 2026)_
9. **Secure filename handling** - Uses `secure_filename()` for uploads
10. **Environment-based configuration** - Secrets loaded from environment variables
11. **`.gitignore` properly configured** - `.env`, secrets, and sensitive files excluded
12. **Session cookie flags** - `SECURE`, `HTTPONLY`, `SAMESITE` configured _(Added Jan 7, 2026)_
13. **Security headers** - `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection` _(Added Jan 7, 2026)_
14. **Input validation** - Form length limits, numeric validation on hours
15. **XSS prevention** - Jinja2 auto-escaping enabled, no unsafe filters
16. **Non-root container** - Application runs as `appuser`, not root
17. **Official Docker images** - Using verified base images from Docker Hub

### ⚠️ Areas Requiring Attention Before Production

1. **Production secrets** - Must rotate `SECRET_KEY` and credentials from default/placeholder values
2. **HTTPS enforcement** - Must configure SSL/TLS for production
3. **Rate limiting** - No rate limiting on API endpoints or SMS
4. **Audit logging** - Limited logging of security events
5. **Database password** - Change from default `timesheet` in production

---

## Reporting Security Issues

If you discover a security vulnerability in this application:

1. **Do NOT** open a public GitHub issue
2. Email security concerns to: [your-security-email@example.com]
3. Include detailed steps to reproduce
4. Allow 48 hours for initial response

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Flask Security Best Practices](https://flask.palletsprojects.com/en/latest/security/)
- [SQLAlchemy Security](https://docs.sqlalchemy.org/en/latest/faq/security.html)
- [MSAL Python Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-python)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)

---

**Last Updated:** 2026-01-08  
**Review Schedule:** Quarterly or before major releases
