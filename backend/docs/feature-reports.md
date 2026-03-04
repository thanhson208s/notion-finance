# Feature: Reports

**Status**: ❌ TODO (backend — no `/api/reports` endpoint yet) / ⚠️ STUB (frontend — empty `ReportsPage` component)

---

## Business Description

Provide spending and income analysis for a user-selected date range. Users should be able to see total income, total expenses, net savings, and a breakdown by category.

---

## Dependencies

All backend dependencies are **already implemented**:

| Dependency | Status |
|---|---|
| `GET /api/expense` with real Notion date-range query | ✅ Done (v1.1.0) |
| `GET /api/income` with real Notion date-range query | ✅ Done (v1.1.0) |
| Cursor-based pagination (fetch all pages from Notion) | ✅ Done (v1.2.1) |

Both endpoints accept optional `startDate` / `endDate` params, apply Notion filters, exclude system categories (transfer/adjustment), and return computed `total`. The connector fetches all pages automatically via `queryAllPages` — no 100-result truncation.

---

## Implemented: List Transactions

### GET /api/expense

**Handler**: `src/handlers/transaction.handler.ts` → `listExpenses()`
**Connector**: `connector.fetchTransactions('expense', startDate?, endDate?)`

Notion filter applied:

```
AND [
  FromAccount  is not empty
  Category     does_not_contain NOTION_TRANSFER_TRANSACTION_ID
  Category     does_not_contain NOTION_ADJUSTMENT_TRANSACTION_ID
  Timestamp    on_or_after  startDate  (if provided)
  Timestamp    on_or_before endDate    (if provided)
]
```

Sort: `Timestamp` descending. `total` computed server-side.

### GET /api/income

Same as above with `ToAccount is not empty` filter.

### Response Shape (both endpoints)

```json
{
  "transactions": [
    {
      "id": "string",
      "timestamp": 0,
      "amount": 0,
      "fromAccountId": "string | undefined",
      "toAccountId": "string | undefined",
      "categoryId": "string",
      "note": "string",
      "linkedCardId": "string | undefined"
    }
  ],
  "total": 0
}
```

---

## Frontend: ReportsPage

**File**: `src/pages/ReportsPage.tsx`
**Route**: `/reports`
**Current state**: Empty stub (`<main className="page"></main>`)

### Proposed UI

- **Date range selector**: start date / end date pickers (default: current month)
- **Summary cards**: Total Income · Total Expense · Net Savings
- **Category breakdown**: bar or pie chart by expense category
- **Account filter**: view spending by account (optional)

---

## Backlog Items

1. ~~Implement `GET /api/expense` with real Notion date-range query~~ ✅ Done (v1.1.0)
2. ~~Implement `GET /api/income` with real Notion date-range query~~ ✅ Done (v1.1.0)
3. ~~Add cursor-based pagination for list endpoints~~ ✅ Done (v1.2.1)
4. Build `ReportsPage` frontend with date picker and summary cards
5. Add category breakdown chart
