# Security

This document outlines security best practices and a pre-deployment checklist for the Northstar Timesheet application.

---

## Pre-Deployment Security Checklist

Before deploying to production, run through this comprehensive checklist to ensure your application is secure.

### 🔐 Secrets Management

#### Backend Secrets

- [ ] **Verify `.env` is in `.gitignore`** - Ensure environment files are never committed
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
- [ ] **Parameterized queries** - Verify all database queries use SQLAlchemy ORM or parameterized queries (no string concatenation)

#### Data Protection

- [ ] **Check SQL injection vulnerabilities** - Review all raw SQL queries (if any) for proper parameterization
- [ ] **Verify data ownership policies** - Ensure users can only access their own timesheets (except admins)
- [ ] **Test admin authorization** - Verify admin routes require both authentication AND admin privileges

---

### 🔒 Authentication & Authorization

#### Session Security

- [ ] **Secure session configuration** - Ensure Flask session cookies are:
  - `SESSION_COOKIE_SECURE = True` (HTTPS only in production)
  - `SESSION_COOKIE_HTTPONLY = True` (prevent XSS access)
  - `SESSION_COOKIE_SAMESITE = 'Lax'` (CSRF protection)
- [ ] **Session timeout** - Configure appropriate `PERMANENT_SESSION_LIFETIME`

#### Server-Side Authentication

- [ ] **Verify `@login_required` decorator** - All protected routes must use `@login_required`
- [ ] **Verify `@admin_required` decorator** - Admin routes must use both `@login_required` and `@admin_required`
- [ ] **No client-side only protection** - Never rely solely on hiding UI elements; all endpoints must verify server-side

#### Authorization Checks

- [ ] **Ownership verification** - Routes that access user data must verify:
  ```python
  # Example from timesheets.py
  timesheet = Timesheet.query.filter_by(
      id=timesheet_id,
      user_id=session["user"]["id"]  # Verify ownership
  ).first_or_404()
  ```
- [ ] **Admin privilege checks** - Admin routes properly check `is_admin` flag:
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

- [ ] **Validate file extensions** - Only allow: `pdf`, `png`, `jpg`, `jpeg`, `gif`
- [ ] **Enforce file size limits** - Currently set to 16MB (`MAX_CONTENT_LENGTH`)
- [ ] **Validate file content** - Extension check alone isn't enough; verify file headers/magic numbers
- [ ] **Secure file storage** - Uploaded files stored in `/app/uploads` with restricted access
- [ ] **Sanitize filenames** - Use `werkzeug.utils.secure_filename()` (already implemented in [timesheets.py](file:///Users/lappy/Developer/northstar/timesheet/app/routes/timesheets.py))

#### User Input

- [ ] **Validate all form inputs** - Check timesheet entries, notes, admin notes for appropriate length and content
- [ ] **XSS prevention** - Use Jinja2's auto-escaping for all user-generated content:
  ```jinja2
  {{ user_input }}  <!-- Auto-escaped -->
  {{ user_input|safe }}  <!-- Only if you're absolutely sure it's safe -->
  ```
- [ ] **Sanitize rich text** - If implementing rich text notes, use a library like Bleach to sanitize HTML
- [ ] **Validate numeric inputs** - Ensure hours, amounts use proper decimal validation

---

### 🌐 HTTPS & Network Security

#### SSL/TLS Configuration

- [ ] **Enable HTTPS in production** - All traffic must use HTTPS
- [ ] **Set `SESSION_COOKIE_SECURE = True`** - Cookies only sent over HTTPS
- [ ] **Update `AZURE_REDIRECT_URI`** - Must be `https://` in production
- [ ] **Update `APP_URL`** - Used in SMS notifications, must be `https://`

#### CORS & Headers

- [ ] **Configure security headers** - Add Flask-Talisman or manually set:
  ```python
  # app/__init__.py
  @app.after_request
  def set_security_headers(response):
      response.headers['X-Content-Type-Options'] = 'nosniff'
      response.headers['X-Frame-Options'] = 'DENY'
      response.headers['X-XSS-Protection'] = '1; mode=block'
      response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
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

- [ ] **Use official base images** - Python, PostgreSQL, Redis from official sources
- [ ] **Keep images updated** - Regularly update base images for security patches
- [ ] **Scan for vulnerabilities** - Use `docker scan` or Trivy to check for CVEs
- [ ] **Non-root user** - Run application as non-root user in container
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

### ✅ Good Security Practices Already Implemented

1. **Session-based authentication** - Server-side session storage (no JWT in localStorage)
2. **Decorator-based authorization** - `@login_required` and `@admin_required` decorators
3. **SQLAlchemy ORM** - Parameterized queries prevent SQL injection
4. **Ownership verification** - Timesheets filtered by `user_id`
5. **Development mode detection** - `_is_dev_mode()` prevents accidental bypass in production
6. **File extension validation** - `ALLOWED_EXTENSIONS` restricts upload types
7. **Secure filename handling** - Uses `secure_filename()` for uploads
8. **Environment-based configuration** - Secrets loaded from environment variables
9. **`.gitignore` properly configured** - `.env`, secrets, and sensitive files excluded

### ⚠️ Areas Requiring Attention

1. **Session cookie flags** - Need to add `SECURE`, `HTTPONLY`, `SAMESITE` in production config
2. **Security headers** - Missing `X-Frame-Options`, `CSP`, `HSTS`
3. **File content validation** - Only checking extensions, not file magic numbers
4. **Production secrets** - Must rotate from default/placeholder values
5. **HTTPS enforcement** - Must configure for production
6. **Rate limiting** - No rate limiting on API endpoints or SMS
7. **Audit logging** - Limited logging of security events

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

**Last Updated:** 2026-01-07  
**Review Schedule:** Quarterly or before major releases
