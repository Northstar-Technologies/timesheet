# Dark Mode Implementation Plan

## Overview

This document outlines the strategy for implementing a dark mode theme for the Northstar Timesheet application, using Google products (YouTube, Gmail, Material Design) as the design reference. The goal is to create a premium, accessible, eye-friendly dark interface that will become the **default** theme.

---

## Research Summary: Google Dark Mode Best Practices

### Core Principles from Material Design

| Principle                  | Description                                                  |
| -------------------------- | ------------------------------------------------------------ |
| **Dark Gray, Not Black**   | Use `#121212` as primary surface, not pure black (`#000000`) |
| **Desaturated Colors**     | Primary/accent colors should be lighter tones (200-50 range) |
| **White Text Opacity**     | Avoid 100% white; use opacity levels for hierarchy           |
| **Elevation = Brightness** | Higher elevation = brighter surface (white overlay)          |
| **15.8:1 Contrast Target** | Dark surfaces to white body text should exceed WCAG          |

### YouTube Dark Mode Color Palette

```css
/* Primary Backgrounds */
--yt-background: #0f0f0f; /* Main page background */
--yt-surface: #121212; /* Card/component surface */
--yt-surface-raised: #181818; /* Elevated cards */
--yt-surface-overlay: #212121; /* Modals, dropdowns */
--yt-surface-hover: #272727; /* Hover states */
--yt-border: #303030; /* Subtle borders */

/* Text Colors */
--yt-text-primary: #ffffff; /* Primary text (87% effective) */
--yt-text-secondary: #aaaaaa; /* Secondary text (~60%) */
--yt-text-disabled: #717171; /* Disabled/hint text (~38%) */

/* Accent Colors (desaturated) */
--yt-accent-blue: #3ea6ff; /* Links, primary actions */
--yt-accent-red: #ff0000; /* Subscribe/error (YouTube brand) */
```

### Gmail Dark Mode Color Palette

```css
/* Surfaces */
--gmail-background: #121212; /* Main background */
--gmail-surface: #1f1f1f; /* Sidebar, cards */
--gmail-surface-alt: #2d2d2d; /* Hover/selected */
--gmail-border: #5f6368; /* Dividers */

/* Text */
--gmail-text-primary: #e8eaed; /* Primary text */
--gmail-text-muted: #9aa0a6; /* Secondary text */
```

### Material Design Elevation Overlay System

In dark mode, shadows are ineffective. Instead, use **white overlays** to indicate elevation:

| Elevation | White Overlay | Resulting Color (on #121212) |
| --------- | ------------- | ---------------------------- |
| 0dp       | 0%            | `#121212`                    |
| 1dp       | 5%            | `#1e1e1e`                    |
| 2dp       | 7%            | `#222222`                    |
| 3dp       | 8%            | `#242424`                    |
| 4dp       | 9%            | `#262626`                    |
| 6dp       | 11%           | `#2a2a2a`                    |
| 8dp       | 12%           | `#2c2c2c`                    |
| 12dp      | 14%           | `#303030`                    |
| 16dp      | 15%           | `#333333`                    |
| 24dp      | 16%           | `#363636`                    |

---

## Current App Analysis

### Existing CSS Variables (main.css)

| Current Variable   | Current Value            | Dark Mode Target          |
| ------------------ | ------------------------ | ------------------------- |
| `--color-primary`  | `#006400` (forest green) | `#4ade80` (lighter green) |
| `--color-gray-50`  | `#f8fafc`                | `#0f0f0f` (background)    |
| `--color-gray-100` | `#f1f5f9`                | `#121212` (surface)       |
| `--color-gray-200` | `#e2e8f0`                | `#1e1e1e` (borders)       |
| `--color-gray-800` | `#1e293b`                | `#e8eaed` (text)          |
| `--color-white`    | `#ffffff`                | `#121212` (surfaces)      |

### Components to Update

1. **Header** - Currently green gradient → dark surface with lighter logo
2. **Sidebar** - White background → `#121212` surface
3. **Cards** - White with shadow → `#181818` with subtle border
4. **Forms** - White inputs → `#1e1e1e` with lighter border
5. **Buttons** - Primary green → lighter, desaturated green
6. **Tables** - Alternating white/gray → dark gray variations
7. **Toasts** - Various colors → darker variants
8. **Modals** - White → dark overlay with `#1e1e1e` surface

---

## Proposed Dark Mode Color System

### Semantic Color Tokens

```css
:root {
  /* === BASE PALETTE === */

  /* Backgrounds (darkest to lighter) */
  --dm-bg-page: #0f0f0f; /* Page background */
  --dm-bg-surface: #121212; /* Cards, sidebar */
  --dm-bg-elevated: #181818; /* Raised cards, modals */
  --dm-bg-overlay: #1e1e1e; /* Dropdowns, popovers */

  /* Borders & Dividers */
  --dm-border-subtle: #2a2a2a; /* Faint dividers */
  --dm-border-default: #3a3a3a; /* Standard borders */
  --dm-border-strong: #4a4a4a; /* Emphasized borders */

  /* Text */
  --dm-text-primary: #e8eaed; /* Primary text (93%) */
  --dm-text-secondary: #9aa0a6; /* Secondary text (60%) */
  --dm-text-disabled: #5f6368; /* Disabled text (38%) */
  --dm-text-inverse: #121212; /* Text on light bg */

  /* === BRAND COLORS (Desaturated for Dark Mode) === */

  /* Primary - Northstar Green (lightened) */
  --dm-primary: #4ade80; /* Bright green for accents */
  --dm-primary-hover: #22c55e; /* Hover state */
  --dm-primary-muted: #166534; /* Muted/background green */

  /* === STATUS COLORS (Lightened) === */
  --dm-success: #34d399; /* Emerald 400 */
  --dm-warning: #fbbf24; /* Amber 400 */
  --dm-danger: #f87171; /* Red 400 */
  --dm-info: #22d3ee; /* Cyan 400 */

  /* === INTERACTIVE STATES === */
  --dm-hover: rgba(255, 255, 255, 0.08);
  --dm-active: rgba(255, 255, 255, 0.12);
  --dm-focus-ring: rgba(74, 222, 128, 0.4); /* Green glow */
}
```

### Detailed Component Mapping

#### Header

```css
.header {
  background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
  border-bottom: 1px solid var(--dm-border-subtle);
  /* Keep slight elevation feel */
}
```

#### Sidebar

```css
.sidebar {
  background: var(--dm-bg-surface);
  border-right: 1px solid var(--dm-border-subtle);
}

.sidebar-link {
  color: var(--dm-text-secondary);
}

.sidebar-link:hover {
  background: var(--dm-hover);
  color: var(--dm-text-primary);
}

.sidebar-link.active {
  background: var(--dm-primary-muted);
  color: var(--dm-primary);
}
```

#### Cards

```css
.timesheet-card {
  background: var(--dm-bg-elevated);
  border: 1px solid var(--dm-border-subtle);
  box-shadow: none; /* Shadows ineffective in dark mode */
}

.timesheet-card:hover {
  border-color: var(--dm-primary);
  background: #1e1e1e;
}
```

#### Form Inputs

```css
.form-input,
.form-select,
.form-textarea {
  background: var(--dm-bg-overlay);
  border: 1px solid var(--dm-border-default);
  color: var(--dm-text-primary);
}

.form-input:focus {
  border-color: var(--dm-primary);
  box-shadow: 0 0 0 3px var(--dm-focus-ring);
}

.form-input::placeholder {
  color: var(--dm-text-disabled);
}
```

#### Buttons

```css
.btn-primary {
  background: var(--dm-primary);
  color: var(--dm-text-inverse);
}

.btn-primary:hover {
  background: var(--dm-primary-hover);
}

.btn-secondary {
  background: var(--dm-bg-overlay);
  border: 1px solid var(--dm-border-default);
  color: var(--dm-text-primary);
}

.btn-secondary:hover {
  background: var(--dm-hover);
  border-color: var(--dm-border-strong);
}
```

---

## Accessibility Checklist

### WCAG Compliance Targets

| Element                         | Minimum Contrast | Our Target   |
| ------------------------------- | ---------------- | ------------ |
| Body text on background         | 4.5:1            | 7:1+         |
| Large text (18px+)              | 3:1              | 4.5:1+       |
| UI components (buttons, inputs) | 3:1              | 4.5:1+       |
| Focus indicators                | 3:1              | Visible glow |

### Contrast Verification (to be tested)

| Combination            | Ratio  | Pass?              |
| ---------------------- | ------ | ------------------ |
| `#e8eaed` on `#121212` | ~13:1  | ✅                 |
| `#9aa0a6` on `#121212` | ~7:1   | ✅                 |
| `#4ade80` on `#121212` | ~10:1  | ✅                 |
| `#5f6368` on `#121212` | ~3.5:1 | ⚠️ (disabled only) |

### Key Accessibility Considerations

1. **Focus States** - Green glow ring must be clearly visible
2. **Error States** - Red must be distinguishable (use `#f87171` not `#ef4444`)
3. **Link Colors** - Must contrast from surrounding text
4. **Status Badges** - Each status needs distinct color AND shape/text

---

## Implementation Strategy

### Phase 1: CSS Variable System

1. Create dark mode variable set in `:root`
2. Use `[data-theme="dark"]` attribute on `<html>`
3. No toggle initially - dark mode is the default

### Phase 2: Core Layout

1. Header and navigation
2. Sidebar
3. Main content area background
4. Footer

### Phase 3: Components

1. Cards (timesheet cards)
2. Forms and inputs
3. Buttons
4. Tables (hour-type grid)
5. Status badges
6. Toast notifications

### Phase 4: Polish

1. Focus states and accessibility
2. Transitions between states
3. Loading states
4. Empty states
5. Error states

### Phase 5: Testing & Validation

1. WCAG contrast verification
2. Cross-browser testing
3. Mobile responsiveness
4. User feedback

---

## File Changes Required

| File                        | Changes                                 |
| --------------------------- | --------------------------------------- |
| `static/css/main.css`       | Add dark mode variables, update `:root` |
| `static/css/components.css` | Update all component colors             |
| `templates/base.html`       | Add `data-theme="dark"` to `<html>`     |

---

## Visual Reference

### Inspiration Screenshots

**YouTube Dark Mode:**

- Background: Near-black (`#0f0f0f`)
- Cards: Slightly elevated (`#181818`)
- Text: Soft white (`#f1f1f1`)
- Accent: Bright blue for links

**Gmail Dark Mode:**

- Clean minimalist dark surfaces
- Subtle borders for separation
- Red accent for primary actions

**Google Drive:**

- Consistent dark gray surfaces
- Good use of icons with sufficient contrast
- Clear file type differentiation

---

## Open Questions

1. **Logo Treatment** - Do we have a white/light version of the Northstar logo?
2. **Brand Compliance** - Is the lighter green (`#4ade80`) acceptable for brand?
3. **Print Styles** - Should we auto-switch to light mode for print?
4. **System Preference** - Later phase: respect `prefers-color-scheme`?

---

## Success Metrics

- [ ] All text meets 4.5:1 contrast minimum
- [ ] Focus states visible without relying on color alone
- [ ] No pure black (#000) or pure white (#fff) used
- [ ] Header still feels branded (Northstar identity)
- [ ] Cards and surfaces have clear visual hierarchy
- [ ] Forms are clearly readable and editable
- [ ] Status badges remain distinguishable

---

## Next Steps

1. **Review this plan** - Get approval on color choices
2. **Create dark mode branch** - `git checkout -b dark-mode`
3. **Implement Phase 1** - CSS variables
4. **Screenshot comparison** - Before/after for sign-off
5. **Iterate based on feedback**

---

_Document created: January 6, 2026_  
_Last updated: January 6, 2026_
