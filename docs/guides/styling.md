# Guide — Styling System

## Design Principles

- **Simple and modern**: clean layouts with minimal decoration, ample whitespace, no heavy shadows or gradients.
- **Dark blue tone**: the entire app uses a dark navy palette. Every background, surface, and border must stay within this palette.
- **Consistent typography**: single font stack (Inter), tight size scale, limited weight variation (400 / 500 / 600 / 800).
- **No external UI library**: all styles are hand-written CSS. No Tailwind, no CSS Modules — plain `.css` files imported per component.

---

## CSS Variables

Defined in `App.css` `:root`. Always prefer these over hardcoded hex values:

| Variable | Value | Role |
|---|---|---|
| `--bg` | `#0f172a` | Page background — deep navy |
| `--card` | `#1e293b` | Card / surface background |
| `--text` | `#e2e8f0` | Primary text |
| `--muted` | `#8b93a7` | Secondary / placeholder text |
| `--accent` | `#4f8cff` | Accent blue — links, highlights |
| `--green` | `#2ecc71` | Positive / income / success |
| `--red` | `#e74c3c` | Negative / expense / error |
| `--border` | `#232733` | Subtle borders |

> **Known inconsistency**: several rules still use hardcoded hex values (`#334155`, `#3b82f6`, etc.) instead of variables. Migrate them when touching those rules.

---

## Color Palette

### Semantic Roles

| Role | Value | Usage |
|---|---|---|
| Page background | `var(--bg)` | `body`, `.app` |
| Surface / card | `var(--card)` | Cards, form areas |
| Elevated surface | `#111827` | Header, NavBar — slightly darker than card |
| Primary text | `var(--text)` | All body copy |
| Secondary text | `var(--muted)` | Labels, subtitles |
| Inactive | `#6b7280` | NavBar inactive icons |
| Subtle border | `var(--border)` | Default borders |
| Active border | `#334155` | Input borders, card borders |
| Hover border | `#3b82f6` | Card hover state |
| Interactive blue | `#3b82f6` / `#2563eb` (hover) | Buttons, checkboxes |
| Cyan | `#22d3ee` | Header title, NavBar active indicator |
| Income / success | `var(--green)` | Success circle, income button |
| Expense / error | `var(--red)` | Error circle, expense button |

### Action Button Colors

| Action | Idle background | Idle text | Selected background | Selected text |
|---|---|---|---|---|
| Expense | `#fef2f2` | `#dc2626` | `#dc2626` | white |
| Income | `#f0fdf4` | `#16a34a` | `#16a34a` | white |
| Transfer | `#d6e6fa` | `#2563eb` | `#2563eb` | white |
| Adjustment | `#f3f4f6` | `#4b5563` | `#4b5563` | white |

Add `.action-select` to activate the filled style. Keep exactly 4 buttons per action row.

### Account Type Badge Colors

Pill shape (`border-radius: 999px`), white text, uppercase font.

| Type | Background |
|---|---|
| Cash | `#16a34a` |
| Bank | `#2563eb` |
| Credit | `#dc2626` |
| eWallet | `#7c3aed` |
| Savings | `#059669` |
| PayLater | `#ea580c` |
| Prepaid | `#d97706` |
| Gold | `#e6b033` |

---

## Typography

Font: `Inter, system-ui, sans-serif`. Antialiased. Line-height `1.5`.

| Element | Size | Weight |
|---|---|---|
| Page / section title | `24px` | `800` |
| Account name | `16px` | `500` |
| Account balance | `20px` | `600` |
| Form label | `18px` | `500` |
| Form input | `20px` | `400` |
| Action button | `14px` | `500` |
| Account type badge | `12px` | `500` |
| Form submit button | `16px` | `500` |

---

## Spacing

| Purpose | Value |
|---|---|
| Page horizontal padding | `16px` |
| Card padding | `14px` |
| Gap between cards | `16px` |
| Gap between form rows | `10px` |
| Gap inside a form row | `10px` |
| Gap between action buttons | `12px` |
| Gap between submit buttons | `40px` |
| NavBar height (reserved) | `64px` |
| `.page` bottom margin | `64px` (clears NavBar) |

---

## Border Radius

| Component | Radius |
|---|---|
| Card | `14px` |
| Button | `10px` |
| Input / select / textarea | `8px` |
| Toggle switch | `24px` |
| Badge | `999px` (pill) |
| NavBar dot / circles | `50%` |

---

## Components

### Card (`.account-card`)

Dark surface (`var(--card)`), `1px` border, `14px` radius, `14px` padding. Border transitions to `#3b82f6` on hover. `overflow: hidden`. The action row slides in below the card info with `actions-anim`.

### Form Inputs (`input`, `select`, `textarea`)

Page-bg fill (`#0f172a`) creates an inset effect. Border `#334155`, radius `8px`. On validation error, add `.input-error` (red border).

### Form Buttons

`.submit-btn` — blue fill, `.cancel-btn` — red-tinted, `.retry-btn` — gray, `.switch-btn` — transparent icon-only. Standard size: `80px × 40px`, `border-radius: 10px`.

### Loading / State Feedback (`.submit-state`)

Centered column, fixed `240px` height. Shows `.circle-loading` (spinning border, `60px`) while loading, then `.circle-state .circle-success` or `.circle-state .circle-error` (`80px` circle with colored border and icon).

### Header (`.header`)

Elevated surface (`#111827`), sticky top, `1px` bottom border. Title and icon buttons use cyan (`#22d3ee`).

### NavBar (`.nav-bar`)

Fixed bottom, `64px` tall, elevated surface, `backdrop-filter: blur`. Active nav item turns cyan with a small dot indicator that scales in via CSS transition.

---

## Animations

| Name | Used by | Duration |
|---|---|---|
| `spin` | `.circle-loading` | `1s linear infinite` |
| `actions-anim` | card action row | `0.25s ease` |

---

## Responsive

Mobile-first. Single breakpoint at `768px`: list containers get `max-width: 720px; margin: 0 auto`. Apply the same pattern when building new pages.

---

## Rules

1. **Always use CSS variables** for palette values from `:root`.
2. **Dark background only** — no light-mode surfaces, white backgrounds, or light cards.
3. **No inline styles** except for truly dynamic values (e.g. computed colors). All static styles belong in `.css` files.
4. **Co-locate CSS with component** — each page/component has its own `.css` file imported at the top of the `.tsx`.
5. **New pages must clear the NavBar** — `.page { margin-bottom: 64px }` is already global in `App.css`.
