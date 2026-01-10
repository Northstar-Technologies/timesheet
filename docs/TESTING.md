# Testing Guide

> Comprehensive testing documentation for the Northstar Timesheet application.

---

## 📊 Current Status

| Metric             | Value   | Target |
| ------------------ | ------- | ------ |
| **Unit/API Tests** | 85      | 120+   |
| **E2E Tests**      | 4 files | 6+     |
| **Code Coverage**  | 74%     | 90%+   |
| **Test Files**     | 8 (4+4) | 12+    |

---

## 🏗 Test Architecture

### Directory Structure

```
tests/
├── __init__.py           # Test package
├── conftest.py           # Shared fixtures
│
├── test_models.py        # Unit tests (21 tests)
├── test_timesheets.py    # Timesheet API tests (22 tests)
├── test_admin.py         # Admin API tests (24 tests)
├── test_auth.py          # Auth tests (10 tests)
│
├── test_sms.py           # TODO: SMS utility tests
├── test_notifications.py # TODO: Notification service tests
├── test_events.py        # TODO: SSE endpoint tests
├── test_attachments.py   # TODO: File upload tests
│
└── e2e/                  # Playwright E2E tests
    ├── fixtures.js       # Shared fixtures and utilities
    ├── auth.spec.js      # Authentication flow tests
    ├── timesheet.spec.js # Timesheet CRUD tests
    ├── admin.spec.js     # Admin dashboard tests
    └── csrf.spec.js      # CSRF protection tests
```

### Test Categories

| Category            | Description                           | File Pattern            |
| ------------------- | ------------------------------------- | ----------------------- |
| **Unit Tests**      | Model logic, calculations, validators | `test_models.py`        |
| **API Integration** | HTTP endpoints, request/response      | `test_*.py`             |
| **Service Tests**   | Business logic services               | `test_notifications.py` |
| **Utility Tests**   | Helper functions                      | `test_sms.py`           |
| **E2E Tests**       | Browser-based user flow tests         | `e2e/*.spec.js`         |

---

## 🔧 Running Tests

### Prerequisites

```bash
# Install test dependencies (local development)
pip install pytest pytest-cov pytest-flask

# Or use requirements-dev.txt
pip install -r requirements-dev.txt
```

### Basic Commands

```bash
# Run all tests
pytest tests/ -v

# Run with coverage report
pytest tests/ --cov=app --cov-report=term-missing

# Run specific test file
pytest tests/test_models.py -v

# Run specific test class
pytest tests/test_models.py::TestUserModel -v

# Run specific test function
pytest tests/test_models.py::TestUserModel::test_create_user -v
```

### Coverage Reports

```bash
# Terminal report with missing lines
pytest tests/ --cov=app --cov-report=term-missing

# Generate HTML report
pytest tests/ --cov=app --cov-report=html
open htmlcov/index.html

# XML report for CI/CD
pytest tests/ --cov=app --cov-report=xml
```

### Docker Testing

```bash
# Run tests in Docker container
docker exec timesheet-web-1 python -m pytest tests/ -v

# Run with coverage in Docker
docker exec timesheet-web-1 python -m pytest tests/ --cov=app
```

### E2E Testing with Playwright

End-to-end browser tests are implemented using Playwright for cross-browser testing of critical user flows.

**Prerequisites:**

```bash
# Install Node.js dependencies
npm install

# Install Playwright browsers (requires Node 18+)
npm run playwright:install

# Or skip local install and use Docker
```

**Running E2E Tests:**

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run with browser visible
npm run test:e2e:headed

# Run with interactive UI mode
npm run test:e2e:ui

# Run with debugger
npm run test:e2e:debug

# View HTML report from last run
npm run test:e2e:report
```

**Running E2E Tests in Docker (recommended for CI/CD):**

```bash
# Ensure the app is running
cd docker && docker compose up -d && cd ..

# Run tests using official Playwright Docker image
npm run test:e2e:docker

# Or using the E2E compose file
docker compose -f docker/docker-compose.e2e.yml run --rm playwright
```

**E2E Test Structure:**

```
tests/e2e/
├── fixtures.js       # Shared fixtures and utilities
├── auth.spec.js      # Authentication flow tests
├── timesheet.spec.js # Timesheet CRUD tests
├── admin.spec.js     # Admin dashboard tests
└── csrf.spec.js      # CSRF protection tests
```

**Test Coverage:**

| Flow                                 | File              | Priority |
| ------------------------------------ | ----------------- | -------- |
| Dev login → Dashboard loads          | auth.spec.js      | P0       |
| Create new timesheet → Save draft    | timesheet.spec.js | P0       |
| Add time entries → Submit → Confirm  | timesheet.spec.js | P0       |
| Admin login → View → Approve         | admin.spec.js     | P0       |
| CSRF protection (POST without token) | csrf.spec.js      | P1       |
| Logout → Session cleared             | auth.spec.js      | P1       |

**Configuration:**

Playwright configuration is in `playwright.config.js`:

- Default browser: Chromium
- Base URL: `http://localhost` (configurable via `BASE_URL` env var)
- Screenshots on failure
- Video recording on retry
- HTML report generation

---

## 📋 Existing Test Coverage

### test_models.py (21 tests)

| Class                       | Tests | Coverage                                             |
| --------------------------- | ----- | ---------------------------------------------------- |
| `TestUserModel`             | 4     | User creation, repr, to_dict, unique constraint      |
| `TestTimesheetModel`        | 4     | Timesheet creation, repr, to_dict, unique constraint |
| `TestTimesheetCalculations` | 7     | Totals calculation, requires_attachment logic        |
| `TestTimesheetEntry`        | 3     | Entry creation, to_dict                              |
| `TestHourTypeConfig`        | 5     | Hour type payable/billable configuration             |

### test_timesheets.py (22 tests)

| Class                 | Tests | Coverage                           |
| --------------------- | ----- | ---------------------------------- |
| `TestTimesheetList`   | 5     | List, filter, pagination           |
| `TestTimesheetCreate` | 5     | Create, duplicate prevention       |
| `TestTimesheetGet`    | 4     | Get, not found, access control     |
| `TestTimesheetUpdate` | 2     | Update draft, submitted protection |
| `TestTimesheetDelete` | 2     | Delete draft, submitted protection |
| `TestTimesheetSubmit` | 4+    | Submit workflow, validation        |

### test_admin.py (24 tests)

| Class                       | Tests | Coverage                            |
| --------------------------- | ----- | ----------------------------------- |
| `TestAdminListTimesheets`   | 6     | List, filter, exclude drafts        |
| `TestAdminGetTimesheet`     | 3     | Get, draft visibility               |
| `TestAdminApproveTimesheet` | 5     | Approve workflow, status validation |
| `TestAdminRejectTimesheet`  | 4     | Reject, notes creation              |
| `TestAdminNotes`            | 3+    | Add notes, validation               |
| `TestAdminUnapprove`        | 2+    | Unapprove workflow                  |

### test_auth.py (10 tests)

| Class                   | Tests | Coverage                 |
| ----------------------- | ----- | ------------------------ |
| `TestAuthRequired`      | 1     | Protected route access   |
| `TestAdminRequired`     | 1     | Admin route access       |
| `TestSessionManagement` | 2     | Session data, admin flag |
| `TestGetCurrentUser`    | 2     | /auth/me endpoint        |
| `TestLogout`            | 2     | Logout, redirect         |

---

## 🔴 Coverage Gaps (Priority Order)

### P0: Critical - Must Test

| Module                         | Current | Target | Missing Tests                                                             |
| ------------------------------ | ------- | ------ | ------------------------------------------------------------------------- |
| `app/utils/sms.py`             | 0%      | 100%   | `send_sms()`, `is_twilio_configured()`, `format_phone_number()`           |
| `app/services/notification.py` | 0%      | 90%    | `notify_approved()`, `notify_needs_attention()`, `send_weekly_reminder()` |
| `app/routes/timesheets.py`     | 72%     | 90%    | Attachment upload, notes CRUD                                             |

### P1: High Priority

| Module                 | Current | Target | Missing Tests                        |
| ---------------------- | ------- | ------ | ------------------------------------ |
| `app/routes/events.py` | 0%      | 80%    | SSE stream, pub/sub                  |
| `app/routes/auth.py`   | ~50%    | 85%    | MSAL flow (mock), dev bypass         |
| `app/routes/admin.py`  | 85%     | 95%    | Edge cases, SMS trigger verification |

### P2: Nice to Have

| Module               | Current | Target | Missing Tests            |
| -------------------- | ------- | ------ | ------------------------ |
| `app/config.py`      | 0%      | 60%    | Config loading           |
| `app/routes/main.py` | 0%      | 80%    | Static routes, redirects |

---

## 📝 Test Implementation Plan

### Phase 1: SMS & Notifications (Week 1)

**Goal:** 100% coverage on new Twilio integration

#### test_sms.py

```python
class TestSmsUtility:
    """Tests for app/utils/sms.py"""

    def test_is_twilio_configured_with_valid_credentials(self):
        """Should return True when all credentials are set."""

    def test_is_twilio_configured_with_missing_credentials(self):
        """Should return False when any credential is missing."""

    def test_is_twilio_configured_with_placeholder_values(self):
        """Should return False when credentials contain 'your-'."""

    def test_send_sms_success(self, mocker):
        """Should send SMS via Twilio and return success."""

    def test_send_sms_dev_mode(self):
        """Should log message when Twilio not configured."""

    def test_send_sms_invalid_phone(self):
        """Should reject invalid phone number format."""

    def test_send_sms_twilio_error(self, mocker):
        """Should handle Twilio API errors gracefully."""

    def test_format_phone_number_e164(self):
        """Should pass through E.164 numbers unchanged."""

    def test_format_phone_number_10_digit(self):
        """Should add +1 to 10-digit US numbers."""

    def test_format_phone_number_with_formatting(self):
        """Should strip dashes and parentheses."""
```

#### test_notifications.py

```python
class TestNotificationService:
    """Tests for app/services/notification.py"""

    def test_notify_approved_sends_sms(self, mocker, sample_user, approved_timesheet):
        """Should send approval SMS when user has opted in."""

    def test_notify_approved_skips_opted_out_user(self, sample_user):
        """Should not send SMS when user has not opted in."""

    def test_notify_approved_skips_no_phone(self, sample_user):
        """Should not send SMS when user has no phone number."""

    def test_notify_approved_creates_notification_record(self):
        """Should create Notification record in database."""

    def test_notify_approved_records_error(self, mocker):
        """Should record error when SMS fails."""

    def test_notify_needs_attention_sends_sms(self, mocker):
        """Should send needs-attention SMS."""

    def test_notify_needs_attention_includes_reason(self, mocker):
        """Should include rejection reason in message."""

    def test_send_weekly_reminder(self, mocker):
        """Should send reminder SMS to opted-in users."""
```

### Phase 2: Attachments & Uploads (Week 2)

**Goal:** Test file upload and download functionality

#### test_attachments.py

```python
class TestAttachmentUpload:
    """Tests for attachment upload endpoints."""

    def test_upload_image_success(self, auth_client, sample_timesheet):
        """Should upload image attachment to draft timesheet."""

    def test_upload_pdf_success(self, auth_client, sample_timesheet):
        """Should upload PDF attachment."""

    def test_upload_invalid_file_type(self, auth_client, sample_timesheet):
        """Should reject non-image/PDF files."""

    def test_upload_file_too_large(self, auth_client, sample_timesheet):
        """Should reject files over size limit."""

    def test_upload_to_submitted_timesheet(self, auth_client, submitted_timesheet):
        """Should allow upload to submitted timesheet (for resubmit)."""

    def test_upload_to_approved_timesheet(self, auth_client, approved_timesheet):
        """Should reject upload to approved timesheet."""

class TestAttachmentDownload:
    """Tests for attachment download endpoints."""

    def test_download_own_attachment(self, auth_client):
        """User should download their own attachment."""

    def test_download_other_users_attachment(self, auth_client):
        """User should not download other users' attachments."""

    def test_admin_download_attachment(self, admin_client):
        """Admin should download any submitted timesheet attachment."""
```

### Phase 3: SSE & Real-time (Week 3)

**Goal:** Test server-sent events for real-time updates

#### test_events.py

```python
class TestSSEStream:
    """Tests for SSE endpoint."""

    def test_sse_endpoint_authenticated(self, auth_client):
        """Should accept authenticated connections."""

    def test_sse_endpoint_unauthenticated(self, client):
        """Should reject unauthenticated connections."""

    def test_sse_publishes_on_submit(self, auth_client, admin_client):
        """Should publish event when timesheet submitted."""

    def test_sse_publishes_on_approve(self, admin_client):
        """Should publish event when timesheet approved."""
```

### Phase 4: Edge Cases & Integration (Week 4)

**Goal:** Cover edge cases and integration scenarios

- Concurrent submissions
- Transaction rollback on errors
- Rate limiting
- Session expiration
- Database connection failures (graceful degradation)

---

## 🛠 Fixtures Reference

### conftest.py Fixtures

| Fixture                         | Scope    | Description                              |
| ------------------------------- | -------- | ---------------------------------------- |
| `app`                           | function | Flask app with test config, fresh DB     |
| `client`                        | function | Test client (unauthenticated)            |
| `db_session`                    | function | Database session                         |
| `sample_user`                   | function | Regular user (dict with id, email, etc.) |
| `sample_admin`                  | function | Admin user                               |
| `auth_client`                   | function | Authenticated client (regular user)      |
| `admin_client`                  | function | Authenticated client (admin)             |
| `sample_week_start`             | function | Current week's Sunday                    |
| `sample_timesheet`              | function | Draft timesheet                          |
| `sample_timesheet_with_entries` | function | Draft with 5 days of field hours         |
| `submitted_timesheet`           | function | Submitted timesheet (internal hours)     |
| `approved_timesheet`            | function | Approved timesheet                       |

### Adding New Fixtures

```python
# Example: Fixture for timesheet with attachment
@pytest.fixture
def timesheet_with_attachment(app, sample_user, sample_week_start):
    """Create a timesheet with field hours and an attachment."""
    with app.app_context():
        timesheet = Timesheet(
            user_id=sample_user["id"],
            week_start=sample_week_start - timedelta(weeks=3),
            status=TimesheetStatus.SUBMITTED,
        )
        db.session.add(timesheet)
        db.session.flush()

        # Add field hours entry
        entry = TimesheetEntry(
            timesheet_id=timesheet.id,
            entry_date=sample_week_start - timedelta(weeks=3) + timedelta(days=1),
            hour_type=HourType.FIELD,
            hours=Decimal("8.0"),
        )
        db.session.add(entry)

        # Add attachment
        attachment = Attachment(
            timesheet_id=timesheet.id,
            filename="test-attachment.png",
            original_filename="approval_doc.png",
            mime_type="image/png",
            size=12345,
        )
        db.session.add(attachment)
        db.session.commit()

        return {
            "id": timesheet.id,
            "user_id": timesheet.user_id,
            "attachment_id": attachment.id,
        }
```

---

## 🎯 Testing Best Practices

### 1. Arrange-Act-Assert Pattern

```python
def test_approve_timesheet(self, admin_client, submitted_timesheet, app):
    """Test approving a submitted timesheet."""
    # Arrange
    timesheet_id = submitted_timesheet["id"]

    # Act
    response = admin_client.post(f"/api/admin/timesheets/{timesheet_id}/approve")

    # Assert
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "APPROVED"
```

### 2. Use Descriptive Test Names

```python
# ❌ Bad
def test_timesheet(self): ...

# ✅ Good
def test_create_timesheet_returns_201_with_valid_week_start(self): ...
```

### 3. Test One Thing Per Test

```python
# ❌ Bad - testing multiple behaviors
def test_timesheet_workflow(self):
    # create, update, submit, approve all in one test
    ...

# ✅ Good - separate tests
def test_create_timesheet(self): ...
def test_update_timesheet(self): ...
def test_submit_timesheet(self): ...
def test_approve_timesheet(self): ...
```

### 4. Mock External Services

```python
from unittest.mock import patch, MagicMock

def test_send_sms_success(self, app):
    """Test SMS sending with mocked Twilio."""
    with app.app_context():
        with patch('app.utils.sms.Client') as mock_client:
            # Set up mock
            mock_instance = MagicMock()
            mock_instance.messages.create.return_value.sid = "SM123"
            mock_instance.messages.create.return_value.status = "queued"
            mock_client.return_value = mock_instance

            # Call function
            result = send_sms("+15551234567", "Test message")

            # Assert
            assert result["success"] is True
            assert result["message_sid"] == "SM123"
```

### 5. Use Fixtures for Common Setup

```python
# ❌ Bad - setup in each test
def test_create_entry(self):
    user = User(...)
    db.session.add(user)
    timesheet = Timesheet(user_id=user.id, ...)
    db.session.add(timesheet)
    ...

# ✅ Good - use fixtures
def test_create_entry(self, sample_timesheet):
    entry = TimesheetEntry(timesheet_id=sample_timesheet["id"], ...)
    ...
```

---

## 📈 Coverage Goals

### Quarterly Targets

| Quarter | Coverage  | Tests     | Focus Areas                     |
| ------- | --------- | --------- | ------------------------------- |
| Q1 2026 | 74% → 85% | 85 → 100  | SMS, Notifications, Attachments |
| Q2 2026 | 85% → 90% | 100 → 120 | SSE, Auth flows, Edge cases     |
| Q3 2026 | 90% → 95% | 120 → 140 | Performance, Security tests     |

### Module-Level Targets

| Module                         | Current | Q1 Target | Q2 Target |
| ------------------------------ | ------- | --------- | --------- |
| `app/models/`                  | 95%     | 95%       | 95%       |
| `app/routes/timesheets.py`     | 72%     | 85%       | 90%       |
| `app/routes/admin.py`          | 85%     | 90%       | 95%       |
| `app/routes/auth.py`           | 50%     | 70%       | 85%       |
| `app/utils/sms.py`             | 0%      | 100%      | 100%      |
| `app/services/notification.py` | 0%      | 90%       | 95%       |
| `app/routes/events.py`         | 0%      | 50%       | 80%       |

---

## 🔄 CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, UI]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov

      - name: Run tests
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          SECRET_KEY: test-secret-key
        run: |
          pytest tests/ --cov=app --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: coverage.xml
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running tests..."
pytest tests/ -q --tb=short

if [ $? -ne 0 ]; then
    echo "Tests failed. Commit aborted."
    exit 1
fi
```

---

## 🔗 Related Documentation

- [IMPLEMENTATION.md](IMPLEMENTATION.md) - Technical architecture
- [roadmap.md](roadmap.md) - Production hardening recommendations
- [TWILIO.md](TWILIO.md) - SMS integration (for notification tests)

---

_Last updated: January 10, 2026_
