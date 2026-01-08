# Feature Requirements

> **Purpose:** Track new feature requirements identified from stakeholder decisions.
>
> **Source:** Design decisions captured in [DESIGN.md](DESIGN.md)
>
> **Last Updated:** January 7, 2026

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

---

## 📊 Admin Dashboard

### REQ-004: Pay Period Filter (P1)

Add ability to filter timesheets by current pay period (biweekly).

**Features:**

- "Current Pay Period" quick filter button
- Pay period date range display
- Group timesheets by pay period

**Implementation Notes:**

- Define pay period start dates (need business input on which weeks)
- Calculate current pay period dynamically
- Add to existing filter controls

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

### REQ-009: Auto-Populate Any Hour Type (P1)

Extend auto-populate feature to work with any hour type selection.

**Current:** Auto-populates 8h/day for Field Hours only

**Required:**

- User selects hour type from dropdown
- User checks "Auto-fill 8h Mon-Fri" checkbox
- System fills 8 hours for Mon-Fri for selected type

**Implementation Notes:**

- Already implemented for Field Hours
- Generalize to accept any selected hour type

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

---

## 🔔 Notifications

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

### REQ-023: Read-Only Submitted Timesheets (P0)

Submitted timesheets should be read-only. Users should not be able to edit a timesheet after submission until an admin rejects it.

**Current Bug:**

- Submitted timesheets still show "Select hour type to add..." dropdown
- Hour inputs are editable (not disabled)
- "Edit" button appears in Actions column
- Form action buttons (Save, Submit) are visible

**Required Behavior:**

| Status         | Editable | Can Add Hours | Can Submit | Can Delete |
| -------------- | -------- | ------------- | ---------- | ---------- |
| Draft (NEW)    | ✅ Yes   | ✅ Yes        | ✅ Yes     | ✅ Yes     |
| Submitted      | ❌ No    | ❌ No         | ❌ No      | ❌ No      |
| Needs Approval | ❌ No\*  | ❌ No         | ❌ No      | ❌ No      |
| Approved       | ❌ No    | ❌ No         | ❌ No      | ❌ No      |

> \*Note: "Needs Approval" status should still allow attachment uploads.

**Implementation Notes:**

- Check `timesheet.status` when populating the form
- Hide/disable edit controls for non-draft timesheets
- Show status message explaining why editing is disabled
- See [BUGS.md](BUGS.md) for detailed implementation plan

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

## ✅ Implementation Status

| Requirement | Status      | Notes                                    |
| ----------- | ----------- | ---------------------------------------- |
| REQ-001     | ✅ Complete | Four-tier role system implemented        |
| REQ-002     | ✅ Complete | All 4 test accounts available            |
| REQ-003     | 📋 Planned  | New feature                              |
| REQ-004     | 📋 Planned  | Admin dashboard enhancement              |
| REQ-005     | ✅ Complete | "This Week" quick filter button          |
| REQ-006     | 📋 Planned  | New workflow                             |
| REQ-007     | ✅ Complete | Column totals added to admin grid        |
| REQ-008     | ✅ Complete | Row totals added to all grid views       |
| REQ-009     | ✅ Partial  | Works for Field, needs generalization    |
| REQ-010     | 📋 Planned  | SharePoint integration                   |
| REQ-011     | 📋 Planned  | Email service                            |
| REQ-012     | 📋 Planned  | Teams bot                                |
| REQ-013     | ✅ Complete | Dropdown filters by user role            |
| REQ-014     | ✅ Complete | Submit without attachment (with warning) |
| REQ-015     | 📋 Planned  | Azure AD integration                     |
| REQ-016     | ✅ Complete | Auto-redirect to /app after login        |
| REQ-017     | ✅ Complete | 4 quick-login buttons on login page      |
| REQ-018     | ✅ Complete | Hour type filter dropdown on admin dash  |
| REQ-019     | 📋 Planned  | Export format options                    |
| REQ-020     | ✅ Complete | Travel ✈️ and expense 💰 badges on cards |
| REQ-021     | 📋 Planned  | Per-option reimbursement attachments     |
| REQ-022     | ✅ Complete | Holiday indicators + entry warning       |
| REQ-023     | 🐛 Bug      | Read-only submitted timesheets (BUG-001) |
| REQ-024     | 📋 Planned  | Travel mileage tracking & details        |
| REQ-025     | 📋 Planned  | Expanded expense type dropdown           |
| REQ-026     | 🐛 Bug      | Expense amount validation ($null fix)    |

---

_Document updated January 8, 2026_
