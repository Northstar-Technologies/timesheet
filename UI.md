# Timesheet UI Refactor

## Overview

This branch contains work-in-progress UI changes to simplify the timesheet hour entry experience. The goal is to align the UI with the PowerApps version while maintaining all functionality.

## Current State

**Status:** 🚧 In Development

The core functionality is implemented but needs additional polish before merging to main.

---

## Changes Made

### 1. Time Entries Section (New "Add Row" UX)

**Before:**

- Static grid showing ALL hour types as rows simultaneously
- 8-column layout: Hour Type + 7 days
- Users could enter hours for any type in any row

**After:**

- Dynamic rows added via dropdown + **[+]** button
- Users select an hour type → click + → row appears
- Each row has 7-day inputs + action buttons (Done/Edit, Remove)
- Multiple hour types can be added as separate rows
- Cleaner, PowerApps-style interaction

### 2. Files Modified

| File                        | Changes                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `templates/index.html`      | Replaced static grid with dropdown + add button + dynamic row container                                          |
| `static/js/timesheet.js`    | Complete rewrite with new methods: `addHourTypeRow()`, `removeHourTypeRow()`, `toggleEditRow()`, `initForWeek()` |
| `static/css/components.css` | Added styles for `.add-hour-type-row`, `.hour-type-row`, `.hour-type-row-header`, button variants                |
| `static/js/app.js`          | Removed obsolete hour-type validation from `saveDraft()` and `submitTimesheet()`                                 |

---

## UX Flow

### Adding a New Hour Type Row

1. Select hour type from dropdown (e.g., "Field Hours")
2. Click the **[+]** button
3. A new row appears in the grid:

| Hour Type   | Sun | Mon | Tue | Wed | Thu | Fri | Sat | Actions  |
| ----------- | --- | --- | --- | --- | --- | --- | --- | -------- |
| Field Hours | `0` | `0` | `0` | `0` | `0` | `0` | `0` | ✓ Done ✕ |

4. Enter hours for each day → Click **✓ Done** (row becomes read-only)
5. Repeat for additional hour types (PTO, Training, etc.)
6. **Save Draft** or **Submit**

### Example: Completed Week

| Hour Type   | Sun | Mon | Tue | Wed | Thu | Fri | Sat | Actions   |
| ----------- | --- | --- | --- | --- | --- | --- | --- | --------- |
| Field Hours | 0   | 8   | 8   | 8   | 8   | 8   | 0   | ✏️ Edit ✕ |
| PTO         | 0   | 0   | 0   | 0   | 0   | 0   | 0   | ✏️ Edit ✕ |
| Training    | 0   | 0   | 0   | 0   | 0   | 0   | 4   | ✏️ Edit ✕ |

---

## Known Issues

### P1 - Static File Caching

- **Issue:** Nginx/browser caching prevents new JavaScript from loading
- **Workaround:** Rebuild Docker container with `--no-cache` or hard refresh
- **Fix Needed:** Add cache-busting version params to static file includes

### P2 - View Navigation

- **Issue:** Sidebar "New Timesheet" link sometimes doesn't switch views correctly
- **Workaround:** Works when clicking "+ New Timesheet" button in empty state
- **Fix Needed:** Investigate view switching logic in `app.js`

### P3 - clearForm() Error

- **Issue:** Calling `clearForm()` throws error if checkboxes don't exist in DOM
- **Fix Needed:** Add null checks for form elements

---

## Remaining Work

- [ ] Fix static file caching (add version params or configure nginx)
- [ ] Fix view navigation from sidebar
- [ ] Add null checks in clearForm()
- [ ] Test with existing timesheets (populate entries correctly)
- [ ] Verify save/submit works end-to-end
- [ ] Mobile responsive testing
- [ ] Code cleanup and comments

---

## Testing

### Manual Test Steps

1. Start Docker: `docker compose up -d`
2. Navigate to http://localhost/app
3. Click "+ New Timesheet"
4. Verify dropdown shows hour types
5. Select "Field Hours" → Click [+]
6. Verify row appears with 7-day inputs
7. Enter hours → Click "✓ Done"
8. Add another type (e.g., PTO)
9. Click "Save Draft"
10. Verify entries are saved correctly

---

## Reference

- **PowerApps Version:** Uses dropdown-based hour type selection
- **Original Grid:** Still available in main branch for comparison
