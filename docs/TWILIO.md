# Twilio SMS Configuration Guide

This guide walks through setting up Twilio SMS notifications for the Northstar Timesheet application.

## Overview

The Timesheet app uses Twilio to send SMS notifications to users when:

- Their timesheet is **approved** by an admin
- Their timesheet **needs attention** (missing attachment, rejected, etc.)
- Weekly **reminders** to submit timesheets (optional)

---

## Prerequisites

- A Twilio account (free trial works for testing)
- A verified phone number for testing (trial accounts require this)
- The Timesheet application running (locally or in Docker)

---

## Step 1: Create a Twilio Account

1. Go to [Twilio Console](https://www.twilio.com/console)
2. Sign up for a new account or log in
3. Complete phone verification (required for all accounts)

### Trial Account Limitations

| Feature             | Trial                        | Paid             |
| ------------------- | ---------------------------- | ---------------- |
| **Outbound SMS**    | To verified numbers only     | Any number       |
| **Phone Number**    | One free number              | Multiple numbers |
| **Trial Message**   | Prefixed with "Sent from..." | No prefix        |
| **Monthly Credits** | ~$15 free credits            | Pay as you go    |

> **Note**: For production with 60+ users, you'll need a paid account.

---

## Step 2: Get a Twilio Phone Number

1. In the Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a number**
2. Search for a number with **SMS capability**
3. Choose a local number (or toll-free for broader reach)
4. Click **Buy** (uses trial credits or account balance)

### Recommended Number Types

| Type       | Best For                    | Cost (approx) |
| ---------- | --------------------------- | ------------- |
| Local      | Single region, professional | $1.15/month   |
| Toll-Free  | Multi-region, recognizable  | $2.15/month   |
| Short Code | High volume, marketing      | $1000+/month  |

For the Timesheet app, a **local number** is recommended.

---

## Step 3: Collect API Credentials

From the [Twilio Console Dashboard](https://www.twilio.com/console):

| Twilio Console Field | Environment Variable  |
| -------------------- | --------------------- |
| **Account SID**      | `TWILIO_ACCOUNT_SID`  |
| **Auth Token**       | `TWILIO_AUTH_TOKEN`   |
| **Phone Number**     | `TWILIO_PHONE_NUMBER` |

### Where to Find Credentials

1. **Account SID & Auth Token**: Visible on the main Console dashboard
2. **Phone Number**: Go to **Phone Numbers** → **Manage** → **Active Numbers**

> **IMPORTANT**: Click "Show" to reveal your Auth Token. Keep it secret!

---

## Step 4: Verify Test Phone Numbers (Trial Only)

If using a trial account, you must verify recipient phone numbers:

1. Go to **Phone Numbers** → **Manage** → **Verified Caller IDs**
2. Click **Add a new Caller ID**
3. Enter the phone number to verify
4. Enter the verification code received via call/SMS

### Add Your Team for Testing

| Team Member | Phone           | Verified |
| ----------- | --------------- | -------- |
| Admin       | +1-555-123-4567 | ✅       |
| Developer   | +1-555-987-6543 | ✅       |

> **Note**: Once you upgrade to a paid account, verification is not required.

---

## Step 5: Update Environment Variables

### Option A: Docker (.env file in docker/ directory)

Create or edit `docker/.env`:

```bash
# Twilio SMS
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15551234567
```

### Option B: Local Development (.env in project root)

```bash
# Twilio SMS
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15551234567
```

### Phone Number Format

The phone number must be in **E.164 format**:

| Format               | Example           | Valid |
| -------------------- | ----------------- | ----- |
| E.164 (correct)      | `+15551234567`    | ✅    |
| With dashes          | `+1-555-123-4567` | ❌    |
| Without country code | `5551234567`      | ❌    |
| With parentheses     | `(555) 123-4567`  | ❌    |

---

## Step 6: Restart the Application

### Docker

```bash
cd docker
docker-compose down
docker-compose up --build
```

### Local Development

```bash
# Stop the running Flask app (Ctrl+C)
flask run
```

---

## Step 7: Enable SMS for Users

Users must opt-in to receive SMS notifications:

1. Log in to the Timesheet app
2. Go to **Settings** or **Profile**
3. Enter phone number in E.164 format
4. Toggle **SMS Notifications** to enabled

### Database Fields

The User model includes:

| Field        | Type    | Description                          |
| ------------ | ------- | ------------------------------------ |
| `phone`      | String  | User's phone number (E.164)          |
| `sms_opt_in` | Boolean | Whether user wants SMS notifications |

---

## Step 8: Test SMS Notifications

### Manual Test via Flask Shell

```bash
flask shell
```

```python
from app.utils.sms import send_sms

# Test message
send_sms("+15551234567", "Test message from Northstar Timesheet!")
```

### Test via Admin Action

1. Log in as an admin
2. Find a submitted timesheet
3. Click **Approve** or **Needs Attention**
4. If the user has SMS enabled, they should receive a notification

---

## Notification Messages

The app sends these SMS messages:

### Timesheet Approved

```
✅ Your timesheet for [Week of Jan 1] has been approved!
```

### Needs Attention

```
⚠️ Your timesheet for [Week of Jan 1] needs attention.
Please log in to add the required attachment.
```

### Weekly Reminder (Optional)

```
📋 Reminder: Don't forget to submit your timesheet for this week!
```

### Unsubmitted Timesheet Reminder (Automated)

This reminder is sent automatically starting on **Monday** and continues **every day** until the previous week's timesheet is submitted. It includes a link to open the app directly.

```
⏰ You have not submitted last week's timesheet.

Open in Timesheets App: https://your-domain.com/app
```

This feature mirrors the behavior of the Timesheets Bot notification system:

- Triggered automatically by the scheduled reminder service
- Starts on Monday morning
- Repeats daily at the configured reminder time
- Stops once the timesheet status changes to SUBMITTED or APPROVED
- Includes a direct link to the app for quick action

---

## Troubleshooting

### "Error 21608: The 'To' phone number is not a valid phone number"

The recipient phone number format is incorrect.

**Fix**:

1. Ensure phone numbers are in E.164 format: `+15551234567`
2. Include country code (e.g., `+1` for US/Canada)
3. Remove dashes, spaces, and parentheses

### "Error 21211: The 'To' number is not a valid mobile number"

The number cannot receive SMS (landline, VOIP, etc.).

**Fix**:

1. Use a mobile phone number
2. Some VOIP numbers (Google Voice) may not work

### "Error 21608: The 'From' phone number is not a valid phone number"

The Twilio phone number is incorrectly formatted.

**Fix**:

1. Check `TWILIO_PHONE_NUMBER` in `.env`
2. Use E.164 format: `+15551234567`
3. Ensure the number has SMS capability

### "Error 21212: The 'From' phone number is not a valid, SMS-capable Twilio phone number"

The Twilio number doesn't support SMS.

**Fix**:

1. Go to Twilio Console → Phone Numbers → Active Numbers
2. Verify the number shows "SMS" in capabilities
3. If not, release and buy a new SMS-capable number

### "Error 20003: Authenticate" or "Error 20404: Not Found"

Invalid Account SID or Auth Token.

**Fix**:

1. Verify `TWILIO_ACCOUNT_SID` starts with `AC`
2. Copy Auth Token again from Console (click "Show")
3. Restart the application after updating `.env`

### "Error 21614: 'To' number is not a verified"

Trial account trying to send to an unverified number.

**Fix**:

1. Verify the recipient number in Twilio Console
2. Or upgrade to a paid Twilio account

### SMS Not Sending (No Error)

Check if the feature is properly configured.

**Fix**:

1. Verify all three env vars are set
2. Check user has `sms_opt_in = True` and valid `phone`
3. Check Flask logs for any suppressed errors
4. Verify Twilio number is active and has credits

---

## Security Notes

- **Never commit `.env` files** to version control (they're in `.gitignore`)
- **Rotate Auth Token** if compromised (Twilio Console → Settings)
- **Monitor usage** in Twilio Console to detect abuse
- **Rate limit** SMS sending to prevent accidental spam
- **Respect opt-out** - always honor user SMS preferences

---

## Cost Estimation

### Per-Message Pricing (US)

| Message Type | Cost per Segment |
| ------------ | ---------------- |
| Outbound SMS | ~$0.0079         |
| Inbound SMS  | ~$0.0079         |

### Monthly Estimate for 60 Users

| Scenario                          | Messages/Month | Cost/Month |
| --------------------------------- | -------------- | ---------- |
| Weekly reminders only             | 240            | ~$2        |
| Approval notifications only       | 240            | ~$2        |
| Both + occasional needs-attention | 500            | ~$5        |

> Plus phone number rental: ~$1.15/month for local number

---

## Optional: Messaging Service

For production, consider using a Twilio **Messaging Service**:

### Benefits

1. **Sender Pool**: Multiple numbers for better deliverability
2. **Sticky Sender**: Same number for same recipient
3. **Compliance**: Built-in opt-out handling
4. **Scalability**: Better for high-volume sending

### Setup

1. Go to **Messaging** → **Services** → **Create Messaging Service**
2. Add your phone number to the service's number pool
3. Update environment variable:

```bash
# Instead of TWILIO_PHONE_NUMBER, use:
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Optional: Webhook for Delivery Status

Track message delivery with status callbacks:

### Setup Status Callback URL

1. Go to **Phone Numbers** → **Active Numbers** → Select your number
2. Under **Messaging**, set **A MESSAGE COMES IN** webhook (optional)
3. Under **Messaging**, set **STATUS CALLBACK URL**:
   - Docker: `http://your-domain.com/api/sms/status`
   - Local: Use ngrok for testing

### Callback Payload

Twilio sends these status updates:

| Status        | Description                    |
| ------------- | ------------------------------ |
| `queued`      | Message is queued for sending  |
| `sent`        | Message sent to carrier        |
| `delivered`   | Carrier confirmed delivery     |
| `failed`      | Message could not be delivered |
| `undelivered` | Message sent but not delivered |

---

## Reference: Environment Variables

| Variable                       | Description                      | Example                              |
| ------------------------------ | -------------------------------- | ------------------------------------ |
| `TWILIO_ACCOUNT_SID`           | Your Twilio Account SID          | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN`            | Your Twilio Auth Token           | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`   |
| `TWILIO_PHONE_NUMBER`          | Your Twilio phone number (E.164) | `+15551234567`                       |
| `TWILIO_MESSAGING_SERVICE_SID` | Messaging Service SID (optional) | `MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |

---

## Reference: Common Phone Number Formats

| Country        | E.164 Format     | Example          |
| -------------- | ---------------- | ---------------- |
| United States  | `+1XXXXXXXXXX`   | `+15551234567`   |
| Canada         | `+1XXXXXXXXXX`   | `+14165551234`   |
| United Kingdom | `+44XXXXXXXXXX`  | `+447911123456`  |
| Australia      | `+61XXXXXXXXX`   | `+61412345678`   |
| Germany        | `+49XXXXXXXXXXX` | `+4915112345678` |

---

## Testing Checklist

- [ ] Twilio account created and verified
- [ ] Phone number purchased with SMS capability
- [ ] Credentials added to `.env` file
- [ ] Application restarted
- [ ] Test user has phone number and SMS opt-in enabled
- [ ] Manual test SMS sent successfully
- [ ] Approval notification triggers SMS
- [ ] Needs-attention notification triggers SMS
- [ ] Unsubmitted reminder triggers SMS (scheduled)

---

## Feature: Unsubmitted Timesheet Reminder

This feature replicates the Timesheets Bot behavior where a reminder is sent on **Monday** and every day after if a user has not submitted their previous week's timesheet.

### Message Format

```
⏰ You have not submitted last week's timesheet.

Open in Timesheets App: https://your-domain.com/app
```

This matches the Timesheets Bot notification pattern:

- Clear warning that the timesheet is not submitted
- Direct link to the app for quick action

### Trigger Logic

| Day       | Action                                                   |
| --------- | -------------------------------------------------------- |
| Monday    | Check all users for unsubmitted previous week timesheets |
| Tuesday   | Continue sending to users who still haven't submitted    |
| Wednesday | Continue sending to users who still haven't submitted    |
| Thursday  | Continue sending to users who still haven't submitted    |
| Friday    | Continue sending to users who still haven't submitted    |
| Weekend   | No reminders sent                                        |

### Implementation Plan

#### 1. Add Notification Type

Add `UNSUBMITTED` to `NotificationType` class in `app/models/notification.py`:

```python
class NotificationType:
    NEEDS_ATTACHMENT = "NEEDS_ATTACHMENT"
    APPROVED = "APPROVED"
    REMINDER = "REMINDER"
    UNSUBMITTED = "UNSUBMITTED"  # Daily reminder for unsubmitted timesheets

    ALL = [NEEDS_ATTACHMENT, APPROVED, REMINDER, UNSUBMITTED]
```

#### 2. Add APP_URL Configuration

Add to `app/config.py`:

```python
# Application URL (for SMS notification links)
APP_URL = os.environ.get("APP_URL", "http://localhost/app")
```

Add to `.env`:

```bash
APP_URL=https://your-domain.com/app
```

#### 3. Add Notification Service Method

Add to `NotificationService` class in `app/services/notification.py`:

```python
@staticmethod
def notify_unsubmitted(user, week_start):
    """
    Send a reminder for an unsubmitted timesheet from the previous week.

    Args:
        user: The User object to remind
        week_start: The date of the unsubmitted week (previous week's Sunday)

    Returns:
        Notification: The created notification record, or None if not sent
    """
    if not user.sms_opt_in:
        return None

    phone = format_phone_number(user.phone)
    if not phone:
        return None

    app_url = current_app.config.get("APP_URL", "http://localhost/app")

    message = (
        f"⏰ You have not submitted last week's timesheet.\n\n"
        f"Open in Timesheets App: {app_url}"
    )

    notification = Notification(
        user_id=user.id,
        timesheet_id=None,
        type=NotificationType.UNSUBMITTED,
        message=message,
    )
    db.session.add(notification)

    result = send_sms(phone, message)

    if result.get("success"):
        notification.sent = True
        notification.sent_at = datetime.utcnow()
    else:
        notification.sent = False
        notification.error = result.get("error")

    db.session.commit()
    return notification
```

#### 4. Create Scheduler Service

Create `app/services/scheduler.py`:

```python
from datetime import datetime, timedelta
from flask import current_app
from ..models import User, Timesheet, TimesheetStatus
from ..extensions import db
from .notification import NotificationService


def get_previous_week_start():
    """Calculate the start date (Sunday) of the previous week."""
    today = datetime.now().date()
    days_since_sunday = (today.weekday() + 1) % 7
    this_week_start = today - timedelta(days=days_since_sunday)
    previous_week_start = this_week_start - timedelta(days=7)
    return previous_week_start


def get_users_with_unsubmitted_timesheets(week_start):
    """
    Find all users who have not submitted their timesheet for the given week.

    Returns users where:
    - No timesheet exists for the week, OR
    - Timesheet exists but status is NEW
    """
    all_users = User.query.all()
    users_needing_reminder = []

    for user in all_users:
        timesheet = Timesheet.query.filter_by(
            user_id=user.id,
            week_start=week_start
        ).first()

        if timesheet is None or timesheet.status == TimesheetStatus.NEW:
            users_needing_reminder.append(user)

    return users_needing_reminder


def send_unsubmitted_reminders():
    """
    Send reminders to all users who haven't submitted last week's timesheet.

    Should be called daily (Monday-Friday) by a scheduler.
    """
    today = datetime.now().date()
    weekday = today.weekday()  # 0 = Monday, 6 = Sunday

    if weekday > 4:  # Saturday or Sunday
        return {"status": "skipped", "reason": "weekend"}

    previous_week_start = get_previous_week_start()
    users_needing_reminder = get_users_with_unsubmitted_timesheets(previous_week_start)

    reminders_sent = 0
    for user in users_needing_reminder:
        notification = NotificationService.notify_unsubmitted(user, previous_week_start)
        if notification and notification.sent:
            reminders_sent += 1

    return {
        "status": "completed",
        "week_start": previous_week_start.isoformat(),
        "users_checked": len(users_needing_reminder),
        "reminders_sent": reminders_sent
    }


def run_daily_reminders(app):
    """Run the daily reminder check with app context."""
    with app.app_context():
        return send_unsubmitted_reminders()
```

#### 5. Add CLI Command

Add to `app/__init__.py` or create `app/cli.py`:

```python
import click
from flask.cli import with_appcontext

@click.command('send-reminders')
@with_appcontext
def send_reminders_command():
    """Send unsubmitted timesheet reminders."""
    from app.services.scheduler import send_unsubmitted_reminders
    result = send_unsubmitted_reminders()
    click.echo(f"Reminders sent: {result}")
```

#### 6. Schedule with Cron

Add a cron job to run daily at a specified time (e.g., 9:00 AM):

```bash
# Edit crontab
crontab -e

# Add this line (runs at 9:00 AM weekdays)
0 9 * * 1-5 cd /path/to/app && flask send-reminders >> /var/log/timesheet-reminders.log 2>&1
```

Or for Docker deployments, add to `docker-compose.yml`:

```yaml
services:
  scheduler:
    build: .
    command: sh -c "while true; do flask send-reminders; sleep 86400; done"
    depends_on:
      - app
      - db
```

### API Endpoint (Optional)

Add an admin endpoint to manually trigger reminders:

```python
@admin_bp.route('/api/admin/send-reminders', methods=['POST'])
@admin_required
def trigger_reminders():
    """Manually trigger unsubmitted timesheet reminders."""
    from app.services.scheduler import send_unsubmitted_reminders
    result = send_unsubmitted_reminders()
    return jsonify(result)
```

### Testing the Feature

1. **Manual Test via Flask Shell**:

```bash
flask shell
```

```python
from app.services.scheduler import send_unsubmitted_reminders
result = send_unsubmitted_reminders()
print(result)
```

2. **Test with Specific User**:

```python
from app.models import User
from app.services.notification import NotificationService
from datetime import date, timedelta

user = User.query.filter_by(email="test@example.com").first()
week_start = date.today() - timedelta(days=7)
NotificationService.notify_unsubmitted(user, week_start)
```

### Feature Checklist

- [ ] Add `UNSUBMITTED` notification type to models
- [ ] Add `APP_URL` to config and .env
- [ ] Add `notify_unsubmitted()` method to NotificationService
- [ ] Create scheduler service with reminder logic
- [ ] Add Flask CLI command for manual execution
- [ ] Configure cron job or Docker scheduler
- [ ] Test with verified phone numbers
- [ ] Verify reminders stop after timesheet submission
