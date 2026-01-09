# Feature Requirements

> **Purpose:** Track new feature requirements identified from stakeholder decisions.
>
> **Source:** Design decisions captured in [DESIGN.md](DESIGN.md), plus roadmap/security/testing notes in `docs/`
>
> **Last Updated:** January 8, 2026

---

## 🎯 Priority Legend

- **P0** - Must have for launch
- **P1** - Important, should have
- **P2** - Nice to have
- **P3** - Future consideration

---

## 👥 User Roles & Permissions

### REQ-001: Four-Tier Role System (P0)

Implement a 4-level role hierarchy with different permissions:

| Role        | Submit Own | Approve Trainee | Approve All | Hour Types Available |
| ----------- | ---------- | --------------- | ----------- | -------------------- |
| **Trainee** | ✅         | ❌              | ❌          | Training only        |
| **Support** | ✅         | ✅              | ❌          | All types            |
| **Staff**   | ✅         | ❌              | ❌          | All types            |
| **Admin**   | ✅         | ✅              | ✅          | All types            |

**Implementation Notes:**

- Add `role` field to User model (enum: `trainee`, `support`, `staff`, `admin`)
- Replace boolean `is_admin` with role-based checks
- Filter hour type dropdown based on user role
- Filter approval actions based on role permissions

---

### REQ-002: Dev Mode Test Accounts (P0)

Create test accounts on the login page for development:

| Role    | Username | Password |
| ------- | -------- | -------- |
| Trainee | trainee  | trainee  |
| Support | support  | support  |
| Staff   | staff    | staff    |
| Admin   | admin    | password |

**Implementation Notes:**

- Display login buttons/form on landing page
- These will be replaced by Azure AD credentials in production
- Each account should demonstrate its role's capabilities

---

## 📱 User Settings

### REQ-003: User Notification Preferences (P1)

Add a User Settings section where users can configure:

**Contact Information:**

- Phone number (for SMS notifications)
- Email address (for email notifications)

**Notification Preferences:**

- [ ] Email notifications (toggle)
- [ ] SMS notifications (toggle)
- [ ] Teams notifications (toggle)

**Implementation Notes:**

- Add settings page accessible from user menu
- Store preferences in User model
- Default all notifications to ON for new users
- SMS opt-out already partially implemented
- Add a username drop-down menu in the header with a **Settings** option
- Settings page includes channel tiles for Email, SMS, and Teams
- Email: allow entering one or more email addresses
- SMS: allow selecting/entering one or more phone numbers
- Teams: allow connecting a Microsoft account for Teams notifications
- Allow multiple emails and phone numbers per user

---

## 📊 Admin Dashboard

### REQ-004: Pay Period Filter (P1) ✅

Add ability to filter timesheets by current pay period (biweekly).

**Status: ✅ IMPLEMENTED (January 8, 2026)**

**Features:**

- ✅ "Current Pay Period" quick filter button (💵 Pay Period)
- ✅ Pay period date range display (shows "Jan 5 - Jan 18" style badge)
- ✅ Fetches timesheets for both weeks in the pay period
- ✅ Configurable anchor date for pay period calendar

**Implementation Notes:**

- ✅ Uses `PAY_PERIOD_ANCHOR` (Jan 5, 2026) to calculate biweekly periods
- ✅ `getCurrentPayPeriod()` calculates start/end dates for current period
- ✅ Makes 2 API calls (one per week) and combines results
- ✅ Added to admin.js with style in components.css
- ✅ Clears when "Reset" or "This Week" clicked

---

### REQ-005: Current Week Filter (P1)

Add quick filter for current week's timesheets.

**Features:**

- "This Week" quick filter button
- Shows only timesheets with `week_start` = current Sunday

**Implementation Notes:**

- Calculate current week's Sunday
- Add to existing filter controls alongside pay period filter

---

### REQ-006: Biweekly Pay Period Confirmation (P2)

Add confirmation step at end of pay period.

**Features:**

- Admin view showing all timesheets in pay period
- "Confirm Pay Period" action to lock/finalize
- Export all confirmed timesheets for payroll

**Implementation Notes:**

- May need new status or flag for "pay period confirmed"
- Prevents further edits after confirmation

---

### REQ-041: Support Dashboard for Trainee Approvals (P1) ✅

Support users should have access to an Admin Dashboard, but it should only display trainee training timesheets that require their approval.

**Status: ✅ IMPLEMENTED (January 8, 2026)**

**Previous Bug:**

- Support users did not see any Admin Dashboard option
- Support users could not access timesheets they are authorized to approve (per REQ-001)

**Required Behavior:**

| Role    | Dashboard Access | Visible Timesheets      |
| ------- | ---------------- | ----------------------- |
| Trainee | ❌ None          | N/A                     |
| Support | ✅ Limited       | Trainee timesheets only |
| Staff   | ❌ None          | N/A                     |
| Admin   | ✅ Full          | All timesheets          |

**Features:**

- ✅ Show "Trainee Approvals" navigation link for Support role
- ✅ Filter dashboard to show ONLY timesheets submitted by users with role = `trainee`
- ✅ Support can Approve/Reject trainee timesheets
- ✅ Support cannot see Staff or other Support timesheets

**UI Differences from Full Admin Dashboard:**

- ✅ Title: "Trainee Approvals" instead of "Admin Dashboard"
- ✅ No access to system settings or user management (list_users remains admin-only)
- ✅ Only approval-related actions available

**Implementation Notes:**

- ✅ Added `_can_access_timesheet()` helper for role-based authorization
- ✅ Changed all approval endpoints from `@admin_required` to `@can_approve`
- ✅ Added role-based filtering in `list_timesheets()` for Support users
- ✅ Updated sidebar navigation in `templates/index.html`
- ✅ Dashboard returns `view_mode` to frontend for UI customization

---

## ⏱️ Time Entry Grid

### REQ-007: Column Totals (All Grids) (P1)

Show total hours for each day (column) in all Time Entry grids.

**Applies to:**

- Employee timesheet form
- Admin detail view
- Any other grid appearances

**Display:**

```
           Sun  Mon  Tue  Wed  Thu  Fri  Sat  | Row Total
Field        -   8    8    8    8    8    -   |    40
Internal     -   -    -    -    -    -    -   |     0
─────────────────────────────────────────────────────────
Day Total    0   8    8    8    8    8    0   |    40
```

---

### REQ-008: Row Totals (All Grids) (P1)

Show total hours for each hour type (row) in all Time Entry grids.

**Already Implemented:** Partial (only on submission summary)

**Needs:** Add to all grid appearances, not just summary view

---

### REQ-009: Auto-Populate Any Hour Type (P1) ✅

Extend auto-populate feature to work with any hour type selection.

**Status: ✅ IMPLEMENTED (January 8, 2026)**

**Previous:** Auto-populated 8h/day for Field Hours only

**Now:**

- ✅ User selects any hour type from dropdown
- ✅ User checks "Auto-fill 8h Mon-Fri when adding rows" checkbox
- ✅ System fills 8 hours for Mon-Fri for selected type

**Implementation Notes:**

- ✅ Removed `hourType === 'Field'` condition from `addHourTypeRow()`
- ✅ Updated checkbox label to be generic
- ✅ Works for: Field, Internal, Training, PTO, Unpaid, Holiday

---

## 📎 Attachments

### REQ-010: SharePoint Sync (P2)

Sync uploaded attachments to SharePoint for permanent storage.

**Features:**

- Background job to upload files to SharePoint document library
- Maintain local copy for immediate access
- Track sync status per attachment

**Implementation Notes:**

- Use Microsoft Graph API for SharePoint access
- Define folder structure in SharePoint
- Handle sync failures gracefully
- Roadmap recommends S3/R2 object storage for scale; decide whether SharePoint sync remains primary or becomes secondary (see REQ-033)

---

## 🔔 Notifications

> SMS notifications are implemented via Twilio; see [TWILIO.md](TWILIO.md) for configuration, templates, and reminder scheduling.

### REQ-011: Email Notifications (P1)

Send email notifications for timesheet events.

**Events:**

- Timesheet approved
- Timesheet marked "Needs Approval"
- Weekly reminder to submit (Friday)
- Admin: New timesheet submitted

**Implementation Notes:**

- Use Microsoft Graph API (M365 email)
- Respect user notification preferences
- Template-based emails

---

### REQ-012: Teams Bot Notifications (P2)

Extend existing Timesheet Bot to send all notification types.

**Events:**

- All events from REQ-011
- Interactive cards for approve/reject

**Implementation Notes:**

- See [BOT.md](BOT.md) for Teams bot architecture
- Requires Teams app registration

---

## 📝 Workflow

### REQ-013: Trainee Hour Type Restriction (P0)

Trainees can only select "Training" from the hour type dropdown.

**Implementation Notes:**

- Filter dropdown options based on `user.role`
- Backend validation to reject non-Training entries from trainees
- Show helpful message explaining restriction

---

### REQ-014: Submit Without Attachment (Warning) (P1)

Allow users to submit timesheets with Field Hours but no attachment.

**Current Behavior:** Blocks submission

**Required Behavior:**

- Show warning: "Field Hours require attachment"
- User can choose to submit anyway
- Timesheet auto-flags as "Needs Approval"
- Flag remains visible until attachment uploaded

**Implementation Notes:**

- Change from blocking to warning
- Auto-set status to NEEDS_APPROVAL on submit
- Already partially implemented (warning shows)

---

### REQ-015: Azure AD Integration (P0)

Enable full Azure AD SSO for production authentication.

**Known Issue:**

- Clicking "Sign in with Microsoft" on the landing page fails if Azure credentials are not configured
- Without valid `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, and `AZURE_TENANT_ID`, users must use the dev login buttons instead
- See [AZURE.md](AZURE.md) "Microsoft Login Button Fails" section for detailed troubleshooting
- See [BUGS.md](BUGS.md) BUG-003 for duplicate key error on repeated logins

**Current Behavior:**

| Credentials Configured | Microsoft Login | Dev Login Buttons |
| ---------------------- | --------------- | ----------------- |
| ❌ Not configured      | ❌ Fails        | ✅ Shown          |
| ✅ Configured          | ✅ Works        | ❌ Hidden         |

**Desired Behavior (To Be Implemented):**

1. **Microsoft Login Button Click:**

   - Clicking "Sign in with Microsoft" should redirect to the actual Microsoft login page (`login.microsoftonline.com`)
   - User authenticates with their Microsoft 365 / Azure AD credentials
   - After successful authentication, redirect back to the app

2. **User Provisioning:**

   - On first login, create the user in the local database using Azure AD profile info
   - On subsequent logins, retrieve the existing user (no duplicate key errors)
   - Use "get or create" pattern in `app/routes/auth.py`

3. **Role Assignment (Phased Rollout):**

   | Phase   | Role Source                    | Purpose                                      |
   | ------- | ------------------------------ | -------------------------------------------- |
   | Phase 1 | Admin by default               | Verify Microsoft authentication is working   |
   | Phase 2 | Northstar internal permissions | Evaluate user against internal role mappings |
   | Phase 3 | Azure AD group sync (optional) | Map AD groups to app roles automatically     |

   > **Note:** Phase 1 grants all Microsoft-authenticated users Admin access temporarily.
   > This confirms the OAuth flow works before integrating with Northstar's internal permission system.

4. **Fallback for Unconfigured Azure:**
   - When Azure credentials are missing, show clear message instead of error
   - Dev login buttons remain available for local development

**Implementation Notes:**

- Configure app registration, redirect URIs, and tenant settings
- Replace dev auth with Azure AD in production environments
- Fix BUG-003: Use `get_or_create` pattern for user provisioning
- See [AZURE.md](AZURE.md) for full setup and troubleshooting guide

---

### REQ-016: Auto-Redirect After Login (P0)

After successful login, redirect users directly to their appropriate view:

- **Trainee/Support/Staff** → My Timesheets (`/app`)
- **Admin** → Admin Dashboard (`/app#admin`)

**No landing page** - users go straight to their workspace.

---

### REQ-017: Dev Mode Test Logins (P0)

Display 4 clickable test login buttons on the login page:

| Role    | Button Label | Credentials     |
| ------- | ------------ | --------------- |
| Trainee | 🎓 Trainee   | trainee/trainee |
| Support | 🛠️ Support   | support/support |
| Staff   | 👤 Staff     | staff/staff     |
| Admin   | 👑 Admin     | admin/password  |

**Implementation Notes:**

- Show buttons only in dev mode (when Azure credentials not configured)
- Each button logs in as that role for testing
- Style as prominent buttons on login page

---

### REQ-018: Hour Type Filter (P1)

Add filter on Admin Dashboard to show only timesheets containing specific hour types.

**Options:**

- All Hour Types (default)
- Field Hours Only
- Internal Hours Only
- Training Only
- Mixed (multiple types)

**Implementation Notes:**

- Add alongside existing status/user filters
- Query entries table to find matching timesheets

---

### REQ-019: Export Format Options (P1)

Add export functionality with multiple format options:

| Format | Description                             |
| ------ | --------------------------------------- |
| CSV    | Comma-separated values for Excel import |
| Excel  | Native .xlsx format                     |
| PDF    | Formatted printable report              |

**Export Scope:**

- Current filtered view (all visible timesheets)
- Single timesheet detail view
- Pay period summary

---

### REQ-020: Travel Flag Visibility (P1)

Show travel status prominently on admin timesheet list.

**Features:**

- Travel indicator icon/badge on timesheet cards
- Quick filter: "Show only traveled"
- Flag timesheets that traveled but lack documentation

**Implementation Notes:**

- `traveled` field already exists on Timesheet model
- Add visual indicator to admin card component

---

### REQ-021: Per-Option Reimbursement Attachments (P1)

Each reimbursement type should have its own attachment requirement:

| Reimbursement Type | Attachment Required         |
| ------------------ | --------------------------- |
| Car                | Mileage log or receipt      |
| Flight             | Flight receipt/confirmation |
| Food               | Receipt(s)                  |
| Other              | Supporting documentation    |

**Implementation Notes:**

- Extend Attachment model to link to reimbursement type
- Validate each selected reimbursement type has attachment
- Show warning if missing (similar to Field Hours warning)

---

### REQ-022: Holiday Awareness & Warning (P1)

Display holidays on the time entry grid and show a confirmation warning when users enter hours on a holiday.

**Features:**

- **Holiday Indicators:** Visually mark holidays on the calendar/grid (e.g., colored cell, icon, label)
- **Holiday List:** Maintain list of company-observed holidays (configurable)
- **Double-Verification Warning:** When a user enters hours on a holiday:
  - Display confirmation dialog: "This day is a holiday ([Holiday Name]). Are you sure you want to enter hours?"
  - User must confirm to proceed
  - Works for all hour types (Field, Internal, Training, etc.)
- **Holiday Hour Type:** Users can still select "Holiday" hour type for holiday pay

**Implementation Notes:**

- Store holidays in database (date, name, year) or configuration file
- Check entry dates against holiday list on input
- Show warning modal before saving hours on holiday
- Consider making holidays configurable per year
- Visual indicator should be visible before user enters hours

**Holiday Examples (US):**

- New Year's Day
- Memorial Day
- Independence Day (July 4th)
- Labor Day
- Thanksgiving
- Christmas Day

---

### REQ-023: Read-Only Submitted Timesheets (P0) ✅

Submitted timesheets should be read-only. Users should not be able to edit a timesheet after submission until an admin rejects it.

**Status: ✅ IMPLEMENTED (January 8, 2026)**

**Behavior:**

| Status         | Editable | Can Add Hours | Can Submit | Can Delete |
| -------------- | -------- | ------------- | ---------- | ---------- |
| Draft (NEW)    | ✅ Yes   | ✅ Yes        | ✅ Yes     | ✅ Yes     |
| Submitted      | ❌ No    | ❌ No         | ❌ No      | ❌ No      |
| Needs Approval | ✅ Yes   | ✅ Yes        | ✅ Yes     | ❌ No      |
| Approved       | ❌ No    | ❌ No         | ❌ No      | ❌ No      |

> **Decision Made:** `NEEDS_APPROVAL` (rejected) timesheets are fully editable so users can fix issues and resubmit.

**Implementation:**

- ✅ Added `isTimesheetEditable(status)` helper function
- ✅ `setFormReadOnly()` hides all edit controls for non-editable statuses
- ✅ Read-only notice banner displays status-specific message
- ✅ Backend routes updated to allow `NEEDS_APPROVAL` editing
- ✅ See [BUGS.md](BUGS.md) BUG-001 for full details

---

### REQ-024: Travel Mileage Tracking (P1)

When "Traveled this week" is checked in Additional Information, display a **Travel Details** section for mileage entry.

**Current Bug:**

- Checking "Traveled this week" does not reveal any additional input fields
- No way to track miles driven or travel method

**Required UI Elements:**

| Field                 | Type     | Description                                   | Validation              |
| --------------------- | -------- | --------------------------------------------- | ----------------------- |
| **Miles Traveled**    | Number   | Total miles driven for the week               | Min: 0, Max: 9999       |
| **Starting Location** | Text     | Origin address or city                        | Optional, max 100 chars |
| **Destination**       | Text     | Destination address or city                   | Optional, max 100 chars |
| **Travel Method**     | Dropdown | Car (Personal), Car (Company), Rental, Flight | Required when traveled  |

**Display Logic:**

- Show "Travel Details" section ONLY when "Traveled this week" checkbox is checked
- Collapse/hide section when unchecked
- Calculate mileage reimbursement rate (configurable, e.g., $0.67/mile IRS rate)

**Implementation Notes:**

- Add `miles_traveled` field to Timesheet model (nullable integer)
- Add `travel_method` enum field to Timesheet model
- Connect to Reimbursement Details if travel reimbursement is also needed
- Admin view should display travel icons based on travel_method

---

### REQ-025: Expanded Expense Type Dropdown (P1)

Expand the reimbursement expense type dropdown to include all common business expense categories.

**Current State:**

| Option  | Status     |
| ------- | ---------- |
| Car     | ✅ Exists  |
| Flight  | ✅ Exists  |
| Food    | ✅ Exists  |
| Other   | ✅ Exists  |
| Hotel   | ❌ Missing |
| Gas     | ❌ Missing |
| Parking | ❌ Missing |
| Toll    | ❌ Missing |

**Required Dropdown Options:**

| Expense Type | Icon | Attachment Required       |
| ------------ | ---- | ------------------------- |
| Car          | 🚗   | Mileage log               |
| Gas          | ⛽   | Gas station receipt       |
| Hotel        | 🏨   | Hotel folio/receipt       |
| Flight       | ✈️   | Flight confirmation       |
| Food         | 🍽️   | Receipt(s)                |
| Parking      | 🅿️   | Parking receipt           |
| Toll         | 🛣️   | Toll receipt or statement |
| Other        | 📄   | Supporting documentation  |

**Implementation Notes:**

- Update `reimbursement_type` enum in database schema
- Update frontend dropdown in timesheet form
- Each expense type should allow optional notes field
- Support multiple expenses of same type (e.g., multiple meals)

---

### REQ-026: Expense Amount Validation (P1)

Prevent null, empty, or invalid values in expense amount fields to avoid displaying "$null" or "$undefined".

**Current Bug:**

- Expense entries display "Car: $null" when amount is not properly set
- No client-side validation prevents empty submissions
- Backend accepts null values for reimbursement amounts

**Required Validation:**

| Rule                        | Client-Side       | Server-Side              |
| --------------------------- | ----------------- | ------------------------ |
| Amount must be a number     | ✅ type="number"  | ✅ Decimal validation    |
| Amount cannot be null/empty | ✅ required field | ✅ NOT NULL or default 0 |
| Amount must be ≥ $0.00      | ✅ min="0"        | ✅ Check constraint      |
| Amount must be ≤ $10,000    | ✅ max="10000"    | ✅ Check constraint      |
| Amount max 2 decimal places | ✅ step="0.01"    | ✅ Decimal(10,2)         |

**UI Improvements:**

- Display currency symbol ($) prefix in input field
- Default placeholder: "0.00" (not empty)
- If user clears field and submits, auto-set to $0.00
- Show inline error message for invalid amounts

**Display Formatting:**

- Always display amounts as "$X.XX" format (e.g., "$45.00" not "$45")
- For zero amounts, display "$0.00" (not "$null" or empty)
- Format negative refunds as "-$X.XX" if applicable

**Database Migration:**

- Add DEFAULT 0.00 to reimbursement_amount column
- Update existing NULL values to 0.00
- Add CHECK constraint: amount >= 0 AND amount <= 10000

**Implementation Notes:**

- Add client-side validation in timesheet form JavaScript
- Add server-side validation in `/api/timesheets` endpoint
- Update display logic in admin dashboard to handle edge cases
- Add unit tests for amount validation

---

### REQ-027: "Has Expenses" Expense Details Section (P1)

When "Has expenses" is checked in Additional Information, display an **Expense Details** section for tracking business expenses.

**Current Bug:**

- Checking "Has expenses" does not reveal any additional input fields
- Users have no way to itemize or describe their expenses
- Only "Reimbursement needed" shows the reimbursement section

**Required UI Behavior:**

| Checkbox             | Shows Section         | Purpose                                 |
| -------------------- | --------------------- | --------------------------------------- |
| Traveled this week   | Travel Details        | Mileage, destination (see REQ-024)      |
| Has expenses         | Expense Summary       | Quick note about expenses incurred      |
| Reimbursement needed | Reimbursement Details | Detailed expense line items for payment |

**Expense Summary Section (when "Has expenses" checked):**

| Field               | Type     | Description                            | Validation            |
| ------------------- | -------- | -------------------------------------- | --------------------- |
| **Expense Summary** | Textarea | Brief description of expenses incurred | Max 500 chars         |
| **Total Estimated** | Number   | Estimated total expense amount         | Optional, $0-$10,000  |
| **Paid By**         | Dropdown | Company Card, Personal, Mixed          | Required when checked |

**Display Logic:**

- Show "Expense Summary" section ONLY when "Has expenses" checkbox is checked
- If BOTH "Has expenses" AND "Reimbursement needed" are checked:
  - Show both sections
  - "Reimbursement Details" inherits context from "Expense Summary"
- Collapse/hide section when unchecked

**Implementation Notes:**

- Add `expense_summary` text field to Timesheet model
- Add `expense_paid_by` enum (company_card, personal, mixed)
- This section is for general expense acknowledgment
- Detailed reimbursement line items go in "Reimbursement Details" section

---

### REQ-028: Multiple Reimbursement Line Items (P1) ✅

Allow users to add multiple reimbursement entries, one for each expense requiring reimbursement.

**Status: ✅ IMPLEMENTED (January 8, 2026)**

**Previous State:**

- Only ONE reimbursement entry was possible (single Type/Amount/Date row)
- Could not track multiple expenses (e.g., gas + hotel + meals)

**Required UI:**

```
Reimbursement Details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Type      | Amount    | Date       | Notes      | ✕ |
|-----------|-----------|------------|------------|---|
| 🏨 Hotel  | $129.99   | 01/06/2026 | Marriott   | ✕ |
| ⛽ Gas    | $45.00    | 01/07/2026 | Round trip | ✕ |
| 🍽️ Food   | $32.50    | 01/07/2026 | Lunch mtg  | ✕ |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                              Total: $207.49

              [+ Add Expense]
```

**Features:**

- **Add Button:** "+ Add Expense" to create new line item
- **Remove Button:** "✕" to delete a line item
- **Running Total:** Display sum of all amounts at bottom
- **Notes Field:** Optional brief description per expense
- **Date Field:** Date expense was incurred
- **Type Icons:** Display emoji icons for each expense type (see REQ-025)

**Data Model:**

| Field     | Type          | Description                    |
| --------- | ------------- | ------------------------------ |
| id        | Integer       | Primary key                    |
| timesheet | Foreign Key   | Links to parent Timesheet      |
| type      | Enum          | Expense type (REQ-025 options) |
| amount    | Decimal(10,2) | Expense amount                 |
| date      | Date          | Date expense incurred          |
| notes     | String(200)   | Optional description           |

**Validation:**

- At least one line item required if "Reimbursement needed" is checked
- Each line item requires: Type + Amount (Notes/Date optional)
- Amount validation per REQ-026 (no null, $0-$10,000 range)
- Total sum displayed and saved to timesheet.total_reimbursement

**Implementation Notes:**

- ✅ Created `ReimbursementItem` model in `app/models/reimbursement.py`
- ✅ Added relationship to `Timesheet` model
- ✅ Updated `update_timesheet` route to handle `reimbursement_items` array
- ✅ Frontend: Dynamic form with add/remove buttons in `timesheet.js`
- ✅ CSS styling for line items in `components.css`
- ✅ Database migration: `004_add_reimbursement_items.py`
- ✅ Backward compatibility: Legacy `reimbursement_amount` field updated with total

---

## Security & Production Readiness

### REQ-029: Production Database Lifecycle (P0) ✅

Migrations should be the only schema management mechanism in production.

**Status: ✅ IMPLEMENTED (January 8, 2026)**

**Required Behavior:**

- Remove automatic `db.create_all()` on app startup
- Apply schema changes only via Alembic/Flask-Migrate
- Deployment step runs `flask db upgrade` before starting web workers

**Implementation:**

- ✅ Removed `db.create_all()` from `app/__init__.py` factory
- ✅ Created `docker/entrypoint.sh` that runs `flask db upgrade` before Gunicorn
- ✅ Updated `docker/Dockerfile` to use entrypoint script
- ✅ Schema is now exclusively managed via Flask-Migrate

---

### REQ-030: Authentication & Session Hardening (P0)

Ensure the OIDC flow and session handling meet production security expectations.

**Required Behavior:**

- Validate `state` and `nonce` in the MSAL callback
- Enforce strict redirect URI handling
- Harden session cookies: `Secure`, `HttpOnly`, `SameSite`
- Dev auth bypass only when explicitly enabled (not when env vars are missing)

---

### REQ-031: CSRF Protection for Mutating Endpoints (P0) ✅

All authenticated `POST`/`PUT`/`DELETE` routes must require a CSRF token.

**Status: ✅ IMPLEMENTED (January 8, 2026)**

**Implementation:**

- ✅ Added Flask-WTF CSRFProtect extension (`flask-wtf>=1.2.0`)
- ✅ CSRF extension initialized in app factory (`app/__init__.py`)
- ✅ CSRF token exposed via `<meta name="csrf-token">` tag in base template
- ✅ JavaScript API client reads token from meta tag for AJAX requests
- ✅ All POST/PUT/DELETE/PATCH requests include `X-CSRFToken` header
- ✅ Form submissions include `csrf_token` hidden input (e.g., logout form)

---

### REQ-032: Security Baseline & Audit (P1)

Adopt the pre-deployment security checklist and keep it enforceable.

**Minimum Checklist:**

- Strong `SECRET_KEY`, no placeholder credentials in production
- Dependency scanning (e.g., Dependabot, safety, bandit)
- Container hardening (non-root user, updated base images)
- Rate limiting on sensitive endpoints (login, notifications)
- Admin action audit logging
- Explicit CORS/CSP policy if enabled
- See [SECURITY.md](SECURITY.md) for the full checklist

---

### REQ-033: Attachment Storage Strategy (P1)

Finalize durable attachment storage for production scaling.

**Required Behavior:**

- Decide between SharePoint sync (REQ-010) and object storage (S3/R2), or both
- Store attachment metadata in Postgres with stable storage keys
- Support multi-instance web deployment without shared filesystem
- Use signed URLs for downloads if object storage is selected
- Consider malware scanning for untrusted uploads

---

### REQ-034: Background Jobs & Scheduled Notifications (P1)

Move long-running work and reminders to a job queue.

**Required Behavior:**

- Use RQ or Celery for notifications, exports, and sync jobs
- Add retries and dead-letter handling
- Implement daily unsubmitted reminders (Mon-Fri) and weekly reminders
- Persist notification outcomes in the Notification table

---

### REQ-035: API Validation & Error Handling (P1)

Standardize request validation and error responses.

**Required Behavior:**

- Validate request bodies (Marshmallow, Pydantic, or equivalent)
- Use a consistent error shape: `{ "error": "...", "code": "...", "details": {...} }`
- Add global exception handlers with request IDs in logs

---

### REQ-036: Observability & Metrics (P1)

Add structured logging and basic operational metrics.

**Required Behavior:**

- Structured JSON logs with request_id, user_id, route, latency
- Generate `X-Request-ID` if missing and propagate
- Metrics for request duration, error rate, queue depth, DB/Redis errors

---

### REQ-037: Testing Coverage & Gaps (P1)

Close the top coverage gaps and raise overall coverage to 90%+.

**Required Tests:**

- `app/utils/sms.py` utilities (Twilio config + formatting)
- `app/services/notification.py` flows
- `app/routes/events.py` SSE stream + pub/sub
- `app/routes/timesheets.py` attachment upload + notes CRUD
- `app/routes/auth.py` MSAL flow + dev bypass
- See [TESTING.md](TESTING.md) for the full test plan and fixtures

---

## UX & Accessibility

### REQ-038: UX & Accessibility Backlog (P2)

Complete the remaining UI/UX items from supporting docs.

**Scope:**

- Microsoft-style login page parity (LOGIN.md)
- Responsive enhancements: swipe gestures, orientation, print styles (RESPONSIVE.md)
- Dark mode review: logo treatment, brand compliance, print styles, prefers-color-scheme (DARKMODE.md)
- Accessibility audit: keyboard navigation, focus visibility, contrast
- UI refactor patterns reference (UI.md)
- Use [WALKTHROUGH.md](WALKTHROUGH.md) for end-user flow validation

---

### REQ-039: PowerApps Data Report View (P2)

Implement the missing PowerApps `Screen1` data report view.

**Implementation Notes:**

- Build a read-only data table view for raw entries
- Decide routing (admin-only vs separate report page)
- Preserve parity with the original PowerApps report fields (POWERAPPS.md)

---

## Developer Tooling

### REQ-040: MCP Tooling Integration (P3)

Optional AI tooling integration using Model Context Protocol (MCP) servers.

**Priority 1 - High Value Servers:**

| MCP Server      | Use Case                                  | Related Features          |
| --------------- | ----------------------------------------- | ------------------------- |
| Microsoft Graph | Azure AD sync, SharePoint, Teams, Email   | REQ-010, REQ-011, REQ-015 |
| PostgreSQL      | Direct DB queries for debugging/reporting | Development               |
| Twilio          | SMS notifications management              | REQ-011 (SMS)             |

**Priority 2 - Operations Servers:**

| MCP Server | Use Case                          |
| ---------- | --------------------------------- |
| Docker     | Container management, log viewing |
| Sentry     | Error tracking, stack traces      |

**Implementation Notes:**

- Configure MCP servers as needed (see [MCP.md](MCP.md) for full setup)
- Use read-only database credentials when possible
- Store API keys securely (environment variables, not committed)
- Dynamic MCP available via Docker MCP Toolkit (experimental)

**Security Requirements:**

- Principle of least privilege for all MCP credentials
- Audit logging for database access via MCP
- Never commit credentials to git
- See [MCP.md](MCP.md) Security Best Practices section

---

## ✅ Implementation Status

| Requirement | Status      | Notes                                     |
| ----------- | ----------- | ----------------------------------------- |
| REQ-001     | ✅ Complete | Four-tier role system implemented         |
| REQ-002     | ✅ Complete | All 4 test accounts available             |
| REQ-003     | 📋 Planned  | New feature                               |
| REQ-004     | ✅ Complete | Pay period filter button + display        |
| REQ-005     | ✅ Complete | "This Week" quick filter button           |
| REQ-006     | 📋 Planned  | New workflow                              |
| REQ-007     | ✅ Complete | Column totals added to admin grid         |
| REQ-008     | ✅ Complete | Row totals added to all grid views        |
| REQ-009     | ✅ Complete | Auto-fill 8h works for any hour type      |
| REQ-010     | 📋 Planned  | SharePoint integration                    |
| REQ-011     | 📋 Planned  | Email service                             |
| REQ-012     | 📋 Planned  | Teams bot                                 |
| REQ-013     | ✅ Complete | Dropdown filters by user role             |
| REQ-014     | ✅ Complete | Submit without attachment (with warning)  |
| REQ-015     | 📋 Planned  | Azure AD integration                      |
| REQ-016     | ✅ Complete | Auto-redirect to /app after login         |
| REQ-017     | ✅ Complete | 4 quick-login buttons on login page       |
| REQ-018     | ✅ Complete | Hour type filter dropdown on admin dash   |
| REQ-019     | 📋 Planned  | Export format options                     |
| REQ-020     | ✅ Complete | Travel ✈️ and expense 💰 badges on cards  |
| REQ-021     | 📋 Planned  | Per-option reimbursement attachments      |
| REQ-022     | ✅ Complete | Holiday indicators + entry warning        |
| REQ-023     | ✅ Complete | Read-only submitted timesheets            |
| REQ-024     | ✅ Complete | Travel mileage tracking & details         |
| REQ-025     | ✅ Complete | Expanded expense type dropdown            |
| REQ-026     | ✅ Complete | Expense amount validation ($null fix)     |
| REQ-027     | ✅ Complete | "Has expenses" expense details section    |
| REQ-028     | ✅ Complete | Multiple reimbursement line items         |
| REQ-029     | ✅ Complete | Production DB lifecycle (migrations only) |
| REQ-030     | ✅ Partial  | Auth/session hardening                    |
| REQ-031     | ✅ Complete | CSRF protection for mutating endpoints    |
| REQ-032     | 📋 Planned  | Security baseline & audit checklist       |
| REQ-033     | 📋 Planned  | Attachment storage strategy               |
| REQ-034     | 📋 Planned  | Background jobs & scheduled notifications |
| REQ-035     | 📋 Planned  | API validation & error handling           |
| REQ-036     | 📋 Planned  | Observability & metrics                   |
| REQ-037     | 📋 Planned  | Testing coverage & gaps                   |
| REQ-038     | 📋 Planned  | UX & accessibility backlog                |
| REQ-039     | 📋 Planned  | PowerApps data report view                |
| REQ-040     | 📋 Planned  | MCP tooling integration                   |
| REQ-041     | ✅ Complete | Support dashboard for trainee approvals   |

---

_Document updated January 8, 2026_
