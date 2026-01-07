# Design Decisions - Outstanding Questions

> **Purpose:** Track architectural and design decisions that need stakeholder input before production deployment.
>
> **Status:** 🟡 Awaiting Decisions
>
> **Last Updated:** January 7, 2026

---

## 📦 Storage & Data

### Q1: Attachment Storage Location

**Current State:** Attachments stored in local container filesystem (`/app/uploads`)

**Options:**

- **A) Local Container Storage** - Simple, but data lost if container destroyed
- **B) Azure Blob Storage** - Persistent, scalable, CDN-ready, ~$0.02/GB/month
- **C) Azure Files (SMB mount)** - Shared across containers, easy migration from on-prem

**Considerations:**

- Current estimate: ~10-50MB per user per week (timecard images)
- Need backup strategy regardless of choice
- Blob storage enables direct-to-cloud uploads (no server bottleneck)

**Your Decision:** ********\_********

---

### Q2: Database Hosting

**Current State:** PostgreSQL in Docker container (local development)

**Options:**

- **A) Azure Database for PostgreSQL** - Managed, automatic backups, ~$50-100/month
- **B) Self-hosted PostgreSQL on VM** - More control, higher maintenance
- **C) Azure SQL Database** - Microsoft ecosystem, different SQL dialect

**Considerations:**

- Need to migrate data from SharePoint Lists (current PowerApps backend)
- Expected data volume: # users × 52 weeks × ~10 entries per week

**Your Decision:** ********\_********

---

### Q3: Data Retention Policy

**Question:** How long should timesheet records be retained?

**Options:**

- **A) Forever** - Keep all historical data
- **B) 7 years** - Typical payroll/tax compliance requirement
- **C) 3 years** - Reduced storage costs
- **D) User-configurable** - Admin setting

**Related:** Should soft-delete be used, or permanent deletion?

**Your Decision:** ********\_********

---

## 🔐 Authentication & Authorization

### Q4: Production Authentication

**Current State:** Development auth with hardcoded test users

**Options:**

- **A) Microsoft 365 SSO via MSAL** - Already partially implemented
- **B) Azure AD B2C** - Supports external users if needed
- **C) Hybrid** - M365 SSO + local service accounts for integrations

**Considerations:**

- Need Azure AD App Registration in production tenant
- Redirect URIs must match production domain

**Your Decision:** ********\_********

---

### Q5: Admin User Definition

**Question:** How are admin users identified?

**Options:**

- **A) Azure AD Group membership** - Users in "Timesheet Admins" group get admin role
- **B) Database table** - Manually managed list of admin emails
- **C) Azure AD App Roles** - Assign roles in Azure portal
- **D) Manager hierarchy** - Managers can approve their direct reports

**Current Implementation:** Database `users.is_admin` boolean flag

**Your Decision:** ********\_********

---

### Q6: Manager/Approval Hierarchy

**Question:** Is multi-level approval needed?

**Options:**

- **A) Single admin pool** - Any admin can approve any timesheet (current)
- **B) Manager hierarchy** - Only your manager can approve
- **C) Department-based** - Admins assigned to departments
- **D) Two-level** - Manager approval → HR final approval

**Your Decision:** ********\_********

---

## 🚀 Deployment & Infrastructure

### Q7: Hosting Platform

**Current State:** Docker Compose (local development)

**Options:**

- **A) Azure Container Apps** - Serverless containers, auto-scaling, ~$20-50/month
- **B) Azure App Service** - PaaS, easier but less flexible
- **C) Azure Kubernetes Service (AKS)** - Full orchestration, higher complexity
- **D) On-premises server** - Behind company firewall

**Considerations:**

- Container Apps is recommended for this workload size
- Need SSL certificate for production domain

**Your Decision:** ********\_********

---

### Q8: Production Domain/URL

**Question:** What URL will users access the app from?

**Examples:**

- `timesheet.northstar.com`
- `apps.northstar.com/timesheet`
- `northstar-timesheet.azurewebsites.net` (Azure default)

**Your Decision:** ********\_********

---

### Q9: Environment Strategy

**Question:** How many environments are needed?

**Options:**

- **A) Dev + Prod** - Simple, two environments
- **B) Dev + Staging + Prod** - Testing environment before production
- **C) Dev + UAT + Prod** - User acceptance testing with real users

**Your Decision:** ********\_********

---

## 📧 Notifications & Integrations

### Q10: Email Notifications

**Question:** Should the system send email notifications?

**Use Cases:**

- Notify employee when timesheet is approved/rejected
- Notify admin when timesheet is submitted
- Weekly reminder for incomplete timesheets

**Options:**

- **A) No emails** - Users check the app manually
- **B) Microsoft Graph API** - Send emails via M365
- **C) SendGrid/Azure Communication Services** - Dedicated email service
- **D) Teams notifications only** - See Q11

**Your Decision:** ********\_********

---

### Q11: Microsoft Teams Integration

**Question:** Should there be a Teams bot or app?

**Potential Features:**

- Submit timesheet from Teams
- Receive approval notifications in Teams
- Quick approve/reject from Teams message
- Weekly summary card

**Options:**

- **A) No Teams integration** - Web app only
- **B) Notifications only** - Bot sends alerts, no interaction
- **C) Full Teams app** - Interactive cards, commands, tab app

**Considerations:**

- Teams integration adds complexity and separate registration
- Mentioned as a future goal in previous conversations

**Your Decision:** ********\_********

---

### Q12: Slack/Other Chat Integration

**Question:** Are employees on other platforms besides Teams?

**Your Decision:** ********\_********

---

## 📱 User Experience

### Q13: Mobile Experience

**Current State:** Responsive web design (hamburger menu on mobile)

**Options:**

- **A) Responsive web only** - Current implementation
- **B) Progressive Web App (PWA)** - Installable, offline-capable
- **C) Native mobile apps** - iOS/Android (significant development effort)

**Considerations:**

- Field workers may primarily use mobile
- Camera access for timecard photo uploads

**Your Decision:** ********\_********

---

### Q14: Offline Support

**Question:** Should the app work without internet?

**Use Cases:**

- Field workers in areas with poor connectivity
- Queue submissions for when online

**Options:**

- **A) Online only** - Requires internet connection
- **B) View-only offline** - Cache recent timesheets
- **C) Full offline with sync** - Queue submissions, sync when online

**Your Decision:** ********\_********

---

## 🔍 Audit & Compliance

### Q15: Audit Logging Level

**Question:** What actions should be logged for compliance?

**Options:**

- **A) Basic** - Login, submit, approve (current)
- **B) Detailed** - All data changes with before/after values
- **C) Full audit trail** - Every page view, action, with retention policy

**Your Decision:** ********\_********

---

### Q16: GDPR/Privacy Compliance

**Question:** Are there specific privacy requirements?

**Considerations:**

- User data export on request
- Right to deletion
- Data residency requirements (e.g., EU data stays in EU)

**Your Decision:** ********\_********

---

## 📊 Reporting & Analytics

### Q17: Reporting Requirements

**Question:** What reports are needed beyond the current Admin Dashboard?

**Potential Reports:**

- Payroll export (CSV/Excel for payroll system)
- Utilization reports (billable vs internal hours)
- Year-to-date summaries per employee
- Department rollups

**Current Implementation:** Basic CSV export of filtered timesheets

**Your Decision:** ********\_********

---

### Q18: External System Integration

**Question:** Does timesheet data need to flow to other systems?

**Examples:**

- Payroll software (ADP, Paychex, etc.)
- ERP system
- Project management tools
- Billing system (for client billable hours)

**Your Decision:** ********\_********

---

## ⚡ Performance & Scale

### Q19: Expected Usage

**Question:** How many users and what's the usage pattern?

- **Total employees:** **\_\_\_**
- **Peak usage time:** (e.g., Monday mornings, end of week)
- **Concurrent users:** **\_\_\_**

---

### Q20: Backup & Disaster Recovery

**Question:** What's the Recovery Time Objective (RTO) and Recovery Point Objective (RPO)?

- **RTO:** How quickly must the system be restored after failure?
- **RPO:** How much data loss is acceptable? (e.g., last 1 hour, last 24 hours)

**Your Decision:** ********\_********

---

## 📝 How to Provide Decisions

For each question above, you can respond with:

1. The question number (e.g., "Q1")
2. Your chosen option letter or custom answer
3. Any additional context or requirements

Example:

```
Q1: B (Azure Blob Storage) - We already have an Azure subscription
Q5: A (Azure AD Group) - Use the "HR-Approvers" group
Q10: D (Teams only) - We don't want email clutter
```

---

_Document created January 7, 2026_
