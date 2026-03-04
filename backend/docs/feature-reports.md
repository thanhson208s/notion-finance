# Feature: Reports

**Status**: ✅ Done (backend — v1.4.0) / ✅ Done (frontend — v0.2.0)

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

**File**: `src/pages/ReportsPage.tsx` + `src/pages/ReportsPage.css`
**Route**: `/reports`

### Implemented UI

- **Date range pills**: Last month / This month (default) / Custom range (native `<input type="date">`)
- **Net Savings summary card**: shows `netSavings`, `totalIncome`, `totalExpense`
- **Tab toggle**: Expense | Income — switches which breakdown is displayed
- **Donut chart**: pure SVG, multi-segment, click segment or category row to highlight
- **Category list**: parent categories with group total (parent + children sum), expandable to show sub-categories with individual amounts and progress bars
- **Color palette**: 10-color assignment by index, consistent within each tab view

---

## Implemented: GET /api/reports

**Handler**: `src/handlers/reports.handler.ts` → `getReports()`
**Connector**: `connector.fetchTransactions('expense'|'income', startDate?, endDate?)` + `connector.fetchCategories(null)`

### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `startDate` | ISO 8601 string | No | Filter transactions on or after this date |
| `endDate` | ISO 8601 string | No | Filter transactions on or before this date |

### Response Shape

```json
{
  "totalIncome": 0,
  "totalExpense": 0,
  "netSavings": 0,
  "expenseCategoryBreakdown": [
    {
      "categoryId": "string",
      "categoryName": "string",
      "parentId": "string",
      "amount": 0
    }
  ],
  "incomeCategoryBreakdown": [
    {
      "categoryId": "string",
      "categoryName": "string",
      "parentId": "string",
      "amount": 0
    }
  ]
}
```

- `parentId`: the category's own `id` when Notion returns `null` (top-level category)
- Each breakdown includes **all categories of the matching type**, even those with `amount: 0` (no transactions in the date range)
- Each breakdown is sorted by `amount` descending
- `netSavings = totalIncome - totalExpense`
- 3 parallel Notion calls: expenses, incomes, all categories

---

## Backlog Items

1. ~~Implement `GET /api/expense` with real Notion date-range query~~ ✅ Done (v1.1.0)
2. ~~Implement `GET /api/income` with real Notion date-range query~~ ✅ Done (v1.1.0)
3. ~~Add cursor-based pagination for list endpoints~~ ✅ Done (v1.2.1)
4. ~~Implement `GET /api/reports` backend endpoint~~ ✅ Done (v1.4.0)
5. Build `ReportsPage` frontend with date picker and summary cards
6. Add category breakdown chart
