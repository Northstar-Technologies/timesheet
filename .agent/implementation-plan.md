# P1 Requirements Implementation Plan

> **Purpose:** Track implementation plan for P1 priority requirements.
>
> **Last Updated:** January 8, 2026

---

## 🎯 Overview

This document tracks the implementation of P1 (Important, should have) requirements from REQUIREMENTS.md.

---

## ✅ Recently Completed

### REQ-007: Column Totals (All Grids)

- **Completed:** January 8, 2026
- **Files Modified:** `admin.js`, `components.css`
- **Description:** Added "Day Total" footer row showing sum of hours per day

### REQ-008: Row Totals (All Grids)

- **Completed:** January 8, 2026
- **Files Modified:** `admin.js`, `components.css`, `index.html`
- **Description:** Added "Total" column showing sum of hours per hour type

### REQ-014: Submit Without Attachment (Warning)

- **Completed:** January 7, 2026
- **Description:** Allow submit with warning when Field Hours lack attachment

### REQ-022: Holiday Awareness & Warning

- **Completed:** January 7, 2026
- **Description:** Visual holiday indicators and confirmation dialog

---

## 🔜 Up Next

### REQ-005: Current Week Filter

**Priority:** High (Quick Win)
**Effort:** Low (~30 min)

**Implementation:**

1. Add "This Week" button to admin filter bar
2. Calculate current week's Sunday date
3. Set week filter value when clicked
4. Style as quick-action button

**Files to Modify:**

- `templates/index.html` - Add button to filter bar
- `static/js/admin.js` - Add click handler

---

### REQ-004: Pay Period Filter

**Priority:** High
**Effort:** Medium (~1 hour)

**Implementation:**

1. Define pay period logic (biweekly schedule)
2. Add "Current Pay Period" filter button
3. Calculate start/end dates for current pay period
4. Show date range in filter UI

**Files to Modify:**

- `templates/index.html` - Add pay period filter
- `static/js/admin.js` - Add pay period calculation
- May need config for pay period start dates

---

### REQ-020: Travel Flag Visibility

**Priority:** Medium
**Effort:** Low (~20 min)

**Implementation:**

1. Add travel indicator icon to timesheet cards
2. Optional: "Show traveled only" filter toggle
3. Flag timesheets that traveled but lack documentation

**Files to Modify:**

- `static/js/admin.js` - Add indicator to card template
- `static/css/components.css` - Style travel badge

---

### REQ-018: Hour Type Filter

**Priority:** Medium
**Effort:** Medium (~45 min)

**Implementation:**

1. Add dropdown filter for hour types
2. Query entries to find matching timesheets
3. Options: All, Field Only, Internal Only, Training, Mixed

**Files to Modify:**

- `templates/index.html` - Add hour type filter dropdown
- `static/js/admin.js` - Add filter logic
- `app/routes/admin.py` - Add backend filtering (optional)

---

## 📋 Remaining P1 Requirements

| REQ     | Description                          | Status     | Est. Effort |
| ------- | ------------------------------------ | ---------- | ----------- |
| REQ-003 | User Notification Preferences        | 📋 Planned | High        |
| REQ-004 | Pay Period Filter                    | 📋 Planned | Medium      |
| REQ-005 | Current Week Filter                  | 📋 Planned | Low         |
| REQ-009 | Auto-Populate Any Hour Type          | ✅ Partial | Low         |
| REQ-011 | Email Notifications                  | 📋 Planned | High        |
| REQ-018 | Hour Type Filter                     | 📋 Planned | Medium      |
| REQ-019 | Export Format Options                | 📋 Planned | Medium      |
| REQ-020 | Travel Flag Visibility               | 📋 Planned | Low         |
| REQ-021 | Per-Option Reimbursement Attachments | 📋 Planned | Medium      |

---

## 📝 Notes

- Focus on quick wins first (REQ-005, REQ-020)
- REQ-004 depends on business input for pay period schedule
- REQ-011 and REQ-003 are larger features requiring more planning

---

_Plan created: January 8, 2026_
