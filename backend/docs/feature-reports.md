# Feature: Reports

**Status**: ❌ TODO (backend) / ⚠️ STUB (frontend — empty `ReportsPage` component)

---

## Business Description

Provide spending and income analysis for a user-selected date range. Users should be able to see total income, total expenses, net savings, and a breakdown by category.

---

## Dependencies

- Requires `GET /api/expense` to be implemented with real Notion queries
- Requires `GET /api/income` to be implemented with real Notion queries
- Stub routes already exist for both endpoints; they accept `startDate` / `endDate` params but return empty arrays. See [feature-transactions.md](./feature-transactions.md) and [api-reference.md](./api-reference.md).

---

## Backend: Implement List Transactions

### GET /api/expense — Required Notion Query

Filter the Transaction database:

```
AND [
  FromAccount  is not empty
  Category     is not NOTION_TRANSFER_TRANSACTION_ID
  Category     is not NOTION_ADJUSTMENT_TRANSACTION_ID
  Timestamp    on or after  startDate
  Timestamp    on or before endDate
]
```

Sort: `Timestamp` descending.

### GET /api/income — Required Notion Query

```
AND [
  ToAccount    is not empty
  Category     is not NOTION_TRANSFER_TRANSACTION_ID
  Category     is not NOTION_ADJUSTMENT_TRANSACTION_ID
  Timestamp    on or after  startDate
  Timestamp    on or before endDate
]
```

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

`total` is computed server-side as the sum of all `amount` values in the result set.

### Design Constraints

- Notion API does not support server-side aggregation — the sum must be computed in Lambda
- Pagination will be required for large date ranges (Notion limits queries to 100 pages per request; cursor-based pagination via `next_cursor` is needed)
- Date params should be validated as ISO 8601 strings before constructing the Notion filter

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

1. Implement `GET /api/expense` with real Notion date-range query
2. Implement `GET /api/income` with real Notion date-range query
3. Add cursor-based pagination for list endpoints
4. Build `ReportsPage` frontend with date picker and summary cards
5. Add category breakdown chart
