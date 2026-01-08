# Design Decisions

> **Purpose:** Track architectural and design decisions for the Northstar Timesheet application.
>
> **Status:** � Decisions Captured
>
> **Last Updated:** January 7, 2026

---

## 📦 Storage & Data

### Q1: Attachment Storage Location ✅

**Current State:** Attachments stored in local container filesystem (`/app/uploads`)

**Decision:** Local storage initially, then **sync to SharePoint** for permanent storage.

**Implementation Notes:**

- Keep current local filesystem approach for uploads
- Add background job to sync files to SharePoint document library
- Retain existing file size limits

---

### Q2: Database Hosting

**Current State:** PostgreSQL in Docker container (local development)

**Decision:** _Pending - awaiting Azure subscription details_

---

### Q3: Data Retention Policy

**Decision:** _Pending_

---

## 🔐 Authentication & Authorization

### Q4: Production Authentication ✅

**Current State:** Development auth with hardcoded test users

**Decision:** **Azure AD SSO** via MSAL (already implemented)

**Dev Mode Test Accounts:**
Create dummy logins at landing page for each role (will be Azure credentials in production):

| Role      | Username | Password | Capabilities                                            |
| --------- | -------- | -------- | ------------------------------------------------------- |
| `trainee` | trainee  | trainee  | Can only select "Training" from hour type dropdown      |
| `support` | support  | support  | Can approve trainee hours + submit their own timesheets |
| `staff`   | staff    | staff    | Can only submit their own timesheets                    |
| `admin`   | admin    | password | Can approve all timesheets + submit their own           |

---

### Q5: User Roles & Permissions ✅

**Decision:** **4-tier role system** synced from Azure AD

| Role        | Submit Own | Approve Trainee | Approve All | Hour Types Available |
| ----------- | ---------- | --------------- | ----------- | -------------------- |
| **Trainee** | ✅         | ❌              | ❌          | Training only        |
| **Support** | ✅         | ✅              | ❌          | All types            |
| **Staff**   | ✅         | ❌              | ❌          | All types            |
| **Admin**   | ✅         | ✅              | ✅          | All types            |

**User Sync:** Users synced from Azure AD (names, emails, roles)

---

### Q6: Manager/Approval Hierarchy ✅

**Decision:** Role-based approval (not manager hierarchy)

- **Trainee** timesheets → Approved by **Support** or **Admin**
- **Support/Staff** timesheets → Approved by **Admin** only
- **Admin** timesheets → Self-approve or peer-approve

---

## 🚀 Deployment & Infrastructure

### Q7: Hosting Platform

**Decision:** _Pending_

---

### Q8: Production Domain/URL

**Decision:** _Pending_

---

### Q9: Environment Strategy

**Decision:** _Pending_

---

## 📧 Notifications & Integrations

### Q10: Notification Channels ✅

**Decision:** **All three channels** - Email, SMS (Twilio), and Teams Bot

**Notification Events:**

| Event                             | Email | SMS | Teams |
| --------------------------------- | ----- | --- | ----- |
| Timesheet marked "Needs Approval" | ✅    | ✅  | ✅    |
| Timesheet approved                | ✅    | ✅  | ✅    |
| Weekly reminder to submit         | ✅    | ✅  | ✅    |
| Admin notified of new submission  | ✅    | ✅  | ✅    |

**User Preferences:**

- Users can opt-out of SMS notifications
- Add **User Settings** section for:
  - Phone number (for SMS)
  - Email address (for email notifications)
  - Notification channel preferences (Email / SMS / Teams toggles)

---

### Q11: Microsoft Teams Integration ✅

**Decision:** **C) Full Teams app** - "Timesheet Bot" with all notification types

**Features:**

- Receive all notification types via Teams
- Interactive cards for quick approve/reject
- Weekly summary cards

---

### Q12: Slack/Other Chat Integration

**Decision:** Teams only (no Slack)

---

## 📱 User Experience

### Q13: Mobile Experience

**Decision:** _Pending_

---

### Q14: Offline Support

**Decision:** _Pending_

---

## 🔍 Audit & Compliance

### Q15: Audit Logging Level

**Decision:** _Pending_

---

### Q16: GDPR/Privacy Compliance

**Decision:** _Pending_

---

## 📊 Reporting & Analytics

### Q17: Reporting Requirements ✅

**Decision:** Add views in Admin Dashboard:

- **Filter by Current Week** - Show timesheets for current week only
- **Filter by Current Pay Period** - Show timesheets for current biweekly pay period
- Sort/group options for both views

---

### Q18: External System Integration ✅

**Decision:** SharePoint integration for attachment storage (see Q1)

---

## ⚡ Performance & Scale

### Q19: Expected Usage

- **Total employees:** ~60 users
- **Peak usage time:** End of week (Friday) and beginning of week (Monday)

---

### Q20: Backup & Disaster Recovery

**Decision:** _Pending_

---

## 📋 Business Logic Decisions

### Week Definition ✅

- **Week starts:** Sunday
- **Timesheet scope:** Full week only (no partial weeks)
- **Pay period:** Biweekly - add confirmation feature for pay period end

### Approval Workflow ✅

- **Un-approve:** Yes, approved timesheets can be un-approved and edited
- **Missing attachments:** Auto-flags as "Needs Approval" but user can still submit
  - Flag remains visible until attachment is uploaded
  - Does not reject back to draft

### Field Hours Attachment ✅

- **Purpose:** PDF documentation of work performed
- **Required when:** Field Hours are entered on timesheet
- **File types:** Images (JPG, PNG) and PDFs accepted

### Auto-Populate Feature ✅

- **Scope:** Works for ANY hour type (not just Field Hours)
- **Default:** 8 hours per weekday (Mon-Fri) = 40 hours total
- **User selects:** Hour type before auto-populating

### Time Entry Display ✅

- **Column totals:** Show total hours for each day (column) in all grids
- **Row totals:** Show total hours for each hour type (row) in all grids
- **Applies to:** All appearances of Time Entries grid (not just the submission summary)

### Holiday Awareness ✅

**Decision:** Display holidays on time entry grid with confirmation warning for double-verification

- **Visual Indicators:** Mark holidays in the grid with distinct styling (color, icon, label)
- **Warning Dialog:** When entering hours on a holiday, show confirmation:
  - "This day is [Holiday Name]. Are you sure you want to enter hours?"
  - User must confirm before hours are saved
- **Holiday List:** Configurable list of company-observed holidays
- **Purpose:** Prevent accidental hour entry on holidays, ensure intentional entries are verified

---

## ✅ Technical Stack Decisions

### SSE (Server-Sent Events) ✅

**Decision:** Flask with Gunicorn (gevent worker) for long-lived connections

- Pure Python approach
- No additional complexity
- Works well behind Nginx

---

_Document updated January 8, 2026_
