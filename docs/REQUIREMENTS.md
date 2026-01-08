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

## ✅ Implementation Status

| Requirement | Status      | Notes                                    |
| ----------- | ----------- | ---------------------------------------- |
| REQ-001     | ✅ Complete | Four-tier role system implemented        |
| REQ-002     | ✅ Complete | All 4 test accounts available            |
| REQ-003     | 📋 Planned  | New feature                              |
| REQ-004     | 📋 Planned  | Admin dashboard enhancement              |
| REQ-005     | 📋 Planned  | Admin dashboard enhancement              |
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
| REQ-018     | 📋 Planned  | Hour type filter                         |
| REQ-019     | 📋 Planned  | Export format options                    |
| REQ-020     | 📋 Planned  | Travel flag visibility                   |
| REQ-021     | 📋 Planned  | Per-option reimbursement attachments     |
| REQ-022     | ✅ Complete | Holiday indicators + entry warning       |

---

_Document updated January 8, 2026_
