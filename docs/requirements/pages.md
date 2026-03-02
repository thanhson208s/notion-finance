# Requirements — Pages

## Page 1: Accounts (`/`) ✅ Done

### Account List
- Filter: All / Assets / Liabilities
- Sort: by balance (descending, zeros at bottom) | by type (fixed priority order)
- Toggle: hide accounts with balance = 0

### Transaction Actions
Clicking an account card reveals four action buttons. Clicking a button expands an inline form below the card.

| Button | Icon | Fields |
|---|---|---|
| Expense | ArrowDownRight | Amount, Category (Expense type), Note |
| Income | ArrowUpRight | Amount, Category (Income type), Note |
| Transfer | ArrowLeftRight | From / To account (one locked to current), Amount |
| Adjustment | Pencil | Target balance (not a delta), Note |

All forms follow the state machine: `idle → loading → success | error` → "Log again" / "Try again"

---

## Page 2: Reports (`/reports`) ❌ Not implemented

### Monthly Report
- Month/year selector (default: current month)
- Display: total income, total expense, net = income − expense
- Category breakdown: list of categories with their amounts

### Category Breakdown
- Chart (pie or bar) of spending by category for the selected period
- Filter by type: Expense / Income
- Show amount and percentage per category

### Transaction List
- Scrollable, paginated list of transactions
- Filters: date range, transaction type (income / expense / transfer / adjustment), account, category
- Default sort: newest first

---

## Page 3: Cards (`/cards`) ❌ Not implemented

### Purpose
Manage credit cards and PayLater accounts (account types: Credit, PayLater).

### Card Information
- Credit limit
- Statement closing date (day of month)
- Payment due date (day of month)
- Minimum payment amount

### List View
- Card name, current balance, credit limit, utilization %
- Highlight cards with a due date within the next 7 days
- Show next statement date and payment due date

### Detail View
- Transaction history for the card (via `linkedCardId`)
- Transactions in the current statement period

> **TBD**: Whether card metadata (credit limit, dates) is stored as additional properties on the Accounts DB or in a separate Notion DB — to be decided at implementation time.

---

## Page 4: Promotions (`/promos`) ⏳ Placeholder

No requirements defined yet. Keep as an empty placeholder — do not implement.

---

## Global Constraints
- Currency: VND, integer amounts only
- Timezone: Asia/Bangkok (UTC+7)
- Single user, mobile-first UI
- Out of scope: budget tracking, recurring transactions, data export
