# Change Log

> **Purpose:** Track all changes made during development sessions.
>
> **Last Updated:** January 8, 2026

---

## January 8, 2026

### REQ-007 & REQ-008: Grid Totals Implementation

**Summary:** Added row totals and column totals to the admin timesheet detail grid.

#### Files Modified

| File                        | Type       | Changes                                                            |
| --------------------------- | ---------- | ------------------------------------------------------------------ |
| `static/js/admin.js`        | JavaScript | Rewrote `renderAdminEntriesGrid()` to calculate and display totals |
| `static/css/components.css` | CSS        | Added 9th column to grid, styled total cells                       |
| `templates/index.html`      | HTML       | Updated cache versions for CSS/JS                                  |
| `docs/REQUIREMENTS.md`      | Docs       | Marked REQ-007 and REQ-008 as Complete                             |

#### Detailed Changes

**`static/js/admin.js` (lines 302-356)**

- Added `dayTotals` array to track column sums
- Added "Total" header cell to header row
- Added row total calculation for each hour type
- Added "Day Total" footer row with column totals
- Added grand total cell in bottom-right corner

**`static/css/components.css` (lines 1002-1037)**

- Changed grid from 8 columns to 9 columns: `140px repeat(7, minmax(70px, 1fr)) 80px`
- Added `.total-column` styling with green tint
- Added `.total-row` styling with border-top
- Added `.grand-total` styling with enhanced green

**`templates/index.html`**

- Updated CSS version: `v=20260108p2`
- Updated JS admin version: `v=20260108p1`

---

## Previous Sessions

_See IMPLEMENTATION.md and POWERAPPS.md for history of earlier changes._

---

_Log started: January 8, 2026_
