# PowerApps Timesheet - Reference Documentation

> **Purpose:** Document every detail of the original PowerApps timesheet application for feature parity in the Python/Flask version.
>
> **Last Updated:** January 6, 2026
> **Source URL:** `https://apps.powerapps.com/play/e/default-94b9b97a-c107-40a4-ab6e-1323c7ba2159/a/90670c3b-c8af-4ce6-802a-dbfd452c60a8`

---

## Missing Features from PowerApps

### 🔴 P0 - Critical (Core Functionality)

| Feature                 | Status      | Notes                                                        |
| ----------------------- | ----------- | ------------------------------------------------------------ |
| Field Hours Red Warning | ✅ Complete | Red warning appears above attachments when Field Hours added |
| User Notes Field        | ✅ Complete | 255 char multi-line text area with live character counter    |
| Admin Notes Field       | ✅ Complete | Read-only for users, editable by admins for feedback         |

### 🟡 P1 - Important (UX Polish)

| Feature                  | Status      | Notes                                                    |
| ------------------------ | ----------- | -------------------------------------------------------- |
| Time Code Help Popup     | ✅ Complete | (?) icon with popup explaining each hour type            |
| Row Totals               | ✅ Complete | Per-row sum column in the time entry table               |
| Status Definitions Popup | ✅ Complete | (?) icon explaining what each status means               |
| Empty Attachments Text   | ✅ Complete | "There is nothing attached." placeholder when no uploads |

### 🟢 P2 - Nice to Have

| Feature                 | Status      | Notes                                         |
| ----------------------- | ----------- | --------------------------------------------- |
| Welcome Screen          | ✅ Complete | Dashboard has personalized greeting           |
| Unsaved Changes Warning | ✅ Complete | Blue pulsing text when form has unsaved edits |
| Refresh Button          | ✅ Complete | Manual refresh button in My Timesheets header |

## 🎨 Visual Identity & Color Palette

| Element            | Color        | Hex Code  | Usage                               |
| ------------------ | ------------ | --------- | ----------------------------------- |
| Primary Dark Green | Forest Green | `#004d1a` | Sidebar, headers, primary buttons   |
| Content Background | Light Gray   | `#f3f2f1` | Main content area background        |
| Accent Green       | Grass Green  | `#7da43a` | "View/Create" button, highlights    |
| Warning/Required   | Bold Red     | `#d13438` | Required field indicators, warnings |
| Info/Help          | Light Blue   | -         | Information popups                  |
| Text Primary       | Dark Gray    | `#323130` | Body text                           |
| Text Muted         | Medium Gray  | `#605e5c` | Secondary text, placeholders        |

### Branding

- **Logo:** Northstar "Star with velocity lines" logo
- **Logo Position:** Bottom-right corner of main content area
- **Logo Color:** Green matching primary brand color

---

## 🏠 Welcome Screen (Home)

### Header Banner

- **Background:** Dark green gradient (`#004d1a`)
- **Left Text:** "Welcome, [User Full Name]!" (white, bold)
- **Right Text:** Current date - "[Day of Week], [Month] [Day], [Year]" (e.g., "Tuesday, January 6, 2026")

### Navigation Cards

#### View/Create Card

- **Icon:** Large clock icon (dark green outline)
- **Button:** "View/Create" with green background (`#7da43a`)
- **Purpose:** Primary action for regular users
- **State:** Always enabled

#### Admin Card

- **Icon:** Group/people icon (gray outline)
- **Button:** "Admin" (grayed out for non-admins)
- **Purpose:** Administrative functions
- **State:** Disabled/grayed for non-admin users

---

## 📅 Sidebar (Timesheet Management)

### Sidebar Header

- **Background:** Dark green (`#004d1a`)
- **Title:** "Timesheets" (white, bold)
- **Left Icon:** Back arrow (←) - returns to welcome screen
- **Right Icon:** Question mark (?) - shows status definitions popup

### Timesheet List

- **Layout:** Vertical scrollable list
- **Item Format:**
  ```
  [Week Range]
  [Status]
  ```
  Example:
  ```
  Jan 4 - Jan 10
  New
  ```

### Selection State

- **Selected Item:** Semi-transparent green overlay highlight
- **Hover State:** Subtle highlight

### Footer Button

- **Label:** "+ New Timesheet"
- **Icon:** Plus sign (+)
- **Position:** Pinned to bottom of sidebar
- **Action:** Opens date picker for new timesheet

---

## ❓ Status Definitions (Sidebar Help Popup)

| Status             | Description                                                 | User Action                                                 |
| ------------------ | ----------------------------------------------------------- | ----------------------------------------------------------- |
| **Approved**       | Immutable state. No further action possible.                | None                                                        |
| **Resubmit**       | Action required. Admin feedback will be in **Admin Notes**. | Adjust timesheet and click **Submit** again.                |
| **Needs Approval** | Action required. Awaiting additional documentation.         | Upload an APPROVED timecard image by **12 PM CST Tuesday**. |
| **New**            | Draft state. Created but not yet submitted.                 | Complete entries and submit.                                |
| **Rejected**       | Final state. No further action possible.                    | None (contact admin if questions)                           |

---

## 📝 Timesheet Entry Screen

### Screen Title

- **Format:** "Timesheet: [Month] [Day Range], [Year]"
- **Example:** "Timesheet: January 4 - January 10, 2026"

### Refresh Control

- **Icon:** Circular arrow (↻)
- **Position:** Top-right of main content area
- **Action:** Refreshes timesheet data

---

## 🛠 Toolbar Actions

### Layout

Horizontal toolbar with icons and checkboxes:

| Control            | Type     | Icon | Label                | Description                               |
| ------------------ | -------- | ---- | -------------------- | ----------------------------------------- |
| New Line           | Button   | ➕   | "+ New Line"         | Adds a new entry row to the grid          |
| Traveled           | Checkbox | ☐    | "Traveled"           | Flags that user traveled during this week |
| Expenses           | Checkbox | ☐    | "Expenses"           | Flags that expense report is pending      |
| Need Reimbursement | Checkbox | ☐    | "Need Reimbursement" | Flags reimbursement request               |
| Save               | Button   | 💾   | (floppy disk)        | Saves current timesheet as draft          |
| Delete             | Button   | 🗑️   | (trash can)          | Deletes the entire timesheet              |
| Submit             | Button   | ✈️   | (paper plane)        | Submits timesheet for approval            |

### Button States

- **Save:** Disabled when no changes; enabled when modifications made
- **Submit:** Disabled until valid data entered; enabled when complete
- **Delete:** Always enabled for draft timesheets

---

## 📊 Time Entry Table

### Column Headers

| Column        | Width  | Description                              |
| ------------- | ------ | ---------------------------------------- |
| `* Time Code` | ~140px | Dropdown with required indicator (\*)    |
| `?`           | ~30px  | Info icon - shows time code descriptions |
| `Sun`         | ~50px  | Sunday hours                             |
| `Mon`         | ~50px  | Monday hours                             |
| `Tue`         | ~50px  | Tuesday hours                            |
| `Wed`         | ~50px  | Wednesday hours                          |
| `Thur`        | ~50px  | Thursday hours                           |
| `Fri`         | ~50px  | Friday hours                             |
| `Sat`         | ~50px  | Saturday hours                           |
| `Total`       | ~60px  | Calculated row total                     |
| (delete)      | ~30px  | Trash icon for row deletion              |

### Time Code Dropdown

The dropdown is marked with a **red asterisk (\*)** indicating required field.

| Time Code             | Description                               | Payable | Billable |
| --------------------- | ----------------------------------------- | ------- | -------- |
| **Training**          | Hours trained - tracking purposes         | No      | No       |
| **Internal**          | Hours worked for NST (Northstar internal) | Yes     | No       |
| **Field**             | Hours worked for client                   | Yes     | Yes      |
| **Paid-Leave (PTO)**  | Paid Time-Off approved by NST             | Yes     | No       |
| **Holiday**           | Holidays paid by NST                      | Yes     | No       |
| **Unpaid-Time/Leave** | Unpaid time off, or hours not worked      | No      | No       |

### Help Icon (?) - Time Code Info Popup

Clicking the `?` icon shows a popup with descriptions:

```
Training: Hours trained - tracking purposes.
Internal: Hours worked for NST.
Field: Hours worked for client.
Paid-Leave(PTO): Paid Time-Off approved by NST.
Holiday: Holidays paid by NST.
Unpaid-Time/Leave: Unpaid-time off, or hours not worked.
```

### Day Input Cells

- **Default Value:** "0"
- **Input Type:** Numeric
- **Border:** Light gray
- **Focus State:** Blue border highlight

### Total Column

- **Type:** Calculated (non-editable)
- **Format:** Sum of all day values for the row

### Row Delete

- **Icon:** Trash can (🗑️)
- **Position:** Far right of each row
- **Action:** Removes that specific row

---

## ⚠️ Conditional Warning Messages

### Field Hours Attachment Requirement

**CRITICAL MISSING FEATURE**

When **"Field"** is selected as the Time Code, a **red warning message** appears:

> **⚠️ "Field engineers must submit at least one image."**

| Property   | Value                                    |
| ---------- | ---------------------------------------- |
| Color      | Red (`#d13438` or similar)               |
| Position   | Above the attachments box                |
| Visibility | Only when "Field" is selected in ANY row |
| Font       | Bold, slightly larger than body text     |

### Implementation Logic

```
IF any_row.time_code == "Field":
    SHOW warning_message("Field engineers must submit at least one image.")
ELSE:
    HIDE warning_message
```

---

## 📎 Attachments Section

### Container

- **Border:** Light gray border
- **Background:** White

### Empty State

- **Text:** "There is nothing attached."
- **Font:** Italic or muted gray

### Upload Action

- **Icon:** Paperclip (📎)
- **Label:** "Attach Image or PDF"
- **Interaction:** Click to open file picker

### Info Icon

- **Icon:** Circled "i" (ℹ️)
- **Position:** Bottom-right of attachment container
- **Action:** Opens informational popup about attachment requirements

### Attachment List (when files exist)

- Shows thumbnails or file names
- Each attachment has a remove/delete option

---

## 💬 Notes Sections

### User Notes

| Property        | Value                                     |
| --------------- | ----------------------------------------- |
| Label           | "Notes" (bold)                            |
| Input Type      | Multi-line text area                      |
| Placeholder     | "255 char. max"                           |
| Character Limit | 255 characters                            |
| Position        | Below attachments                         |
| Purpose         | User's personal notes about the timesheet |

### Admin Notes

**CRITICAL MISSING FEATURE**

| Property    | Value                                      |
| ----------- | ------------------------------------------ |
| Label       | "Admin Note" (bold)                        |
| Input Type  | Read-only display area (for regular users) |
| Position    | Below user Notes section                   |
| Purpose     | Administrative feedback from approvers     |
| Visibility  | Always visible (even if empty)             |
| Editable By | Admins only                                |

### Notes Implementation Logic

```
IF user.is_admin:
    admin_notes.editable = True
ELSE:
    admin_notes.editable = False
    admin_notes.display_only = True
```

---

## 🔔 System Messages

### Unsaved Changes Warning

- **Text:** "Unsaved changes may be lost"
- **Color:** Blue/info color
- **Position:** Bottom-left of the screen
- **Visibility:** Appears when there are unsaved modifications

---

## 📋 Feature Comparison: PowerApps vs Flask App

| Feature                  | PowerApps       | Flask App       | Status                       |
| ------------------------ | --------------- | --------------- | ---------------------------- |
| Welcome Screen           | ✅              | ❌              | Missing (P2)                 |
| Week List Sidebar        | ✅              | ✅              | Implemented (as cards)       |
| Status Definitions Popup | ✅              | ✅              | ✅ Implemented (Jan 6, 2026) |
| "+ New Line" Button      | ✅              | ✅              | Implemented (dropdown + add) |
| Traveled Checkbox        | ✅              | ✅              | Implemented                  |
| Expenses Checkbox        | ✅              | ✅              | Implemented                  |
| Need Reimbursement       | ✅              | ✅              | Implemented                  |
| Field Warning Message    | ✅ **RED TEXT** | ✅ **RED TEXT** | ✅ Implemented (Jan 6, 2026) |
| Time Code Dropdown       | ✅              | ✅              | Implemented                  |
| Time Code Help (?)       | ✅ Popup        | ✅ Popup        | ✅ Implemented (Jan 6, 2026) |
| Daily Hour Inputs        | ✅              | ✅              | Implemented                  |
| Row Total Calculation    | ✅              | ✅              | ✅ Implemented (Jan 6, 2026) |
| Row Delete Button        | ✅              | ✅              | Implemented                  |
| Attachments Section      | ✅              | ✅              | Implemented                  |
| "Nothing attached" Text  | ✅              | ✅              | ✅ Implemented (Jan 6, 2026) |
| Attachment Info Icon     | ✅              | ❌              | Missing (P2)                 |
| **User Notes**           | ✅ 255 chars    | ✅ 255 chars    | ✅ Implemented (Jan 6, 2026) |
| **Admin Notes**          | ✅ Read-only    | ✅ Read-only    | ✅ Implemented (Jan 6, 2026) |
| Unsaved Changes Warning  | ✅ Blue text    | ❌              | Missing (P2)                 |
| Northstar Logo           | ✅ Lower-right  | ✅              | Implemented                  |
| Refresh Button           | ✅              | ❌              | Missing (P2)                 |
| Status Badges            | ✅              | ✅              | Implemented                  |

---

## 🚨 Priority Items to Implement

### P0 - Critical Missing Features ✅ COMPLETE

1. ✅ **Field Hours Red Warning** - _Implemented January 6, 2026_

   - Text: "Field engineers must submit at least one image."
   - Color: Red/orange with warning icon
   - Position: Above attachments in the Attachments section
   - Trigger: When ANY row has "Field" time code selected AND no attachments uploaded

2. ✅ **User Notes Field** - _Implemented January 6, 2026_

   - Label: "Your Notes" with live character counter
   - 255 character limit enforced
   - Multi-line text area
   - Counter shows "X/255" and updates in real-time

3. ✅ **Admin Notes Field** - _Implemented January 6, 2026_
   - Label: "Admin Notes"
   - Read-only display for regular users
   - Hidden when empty (shown only when admin adds feedback)
   - Editable via admin API endpoint

### P1 - Important Missing Features ✅ COMPLETE

4. ✅ **Time Code Help Popup** - _Implemented January 6, 2026_

   - (?) icon next to Time Entries header
   - Shows descriptions of each time code in a styled popup

5. ✅ **Row Totals** - _Implemented January 6, 2026_

   - "Total" column showing sum of hours per row
   - Updates dynamically as hours are entered

6. ✅ **Status Definitions Popup** - _Implemented January 6, 2026_

   - Help icon next to status filter on My Timesheets view
   - Explains each status meaning (Draft, Submitted, Needs Approval, Approved)

7. ✅ **Empty Attachments Text** - _Implemented January 6, 2026_
   - "There is nothing attached." placeholder when no files uploaded

### P2 - Nice to Have ✅ COMPLETE

8. ✅ **Welcome Screen** - _Dashboard exists with personalized greeting_

   - Dashboard shows "Welcome, [User]!" header
   - Quick action cards for navigation

9. ✅ **Unsaved Changes Warning** - _Implemented January 6, 2026_

   - Blue pulsing text "● Unsaved changes" in editor header
   - Appears when any form field is modified
   - Clears on form clear/save

10. ✅ **Refresh Button** - _Implemented January 6, 2026_

    - Ghost button in My Timesheets header
    - Allows manual refresh of timesheet list

### Remaining Nice-to-Have

11. **Attachment Info Icon**
    - Information popup about attachment requirements

---

## 📐 Layout Specifications

### Screen Dimensions

- **Sidebar Width:** ~300px
- **Content Area:** Remaining width
- **Header Height:** ~64px

### Spacing

- **Section Padding:** 16-24px
- **Row Height:** ~40px
- **Input Padding:** 8px

### Typography

- **Headers:** Segoe UI, bold
- **Body:** Segoe UI, regular
- **Labels:** 14px, semi-bold
- **Inputs:** 14px, regular

---

## 🔗 Related Documentation

- [UI.md](UI.md) - Current Flask app UI implementation
- [DARKMODE.md](DARKMODE.md) - Dark mode planning (upcoming)
- [IMPLEMENTATION.md](IMPLEMENTATION.md) - Technical architecture

---

_Document created from live PowerApps analysis on January 6, 2026_
