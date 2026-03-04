# Feature: Categories

**Status**: ✅ DONE (backend). ✅ DONE (frontend — embedded within transaction forms, no standalone page).

---

## Business Description

Categories classify transactions for reporting and budgeting. They form a two-level hierarchy: a top-level parent category can have multiple child subcategories. Three category types are supported: `Income`, `Expense`, and `Financial` (for internal transfers and adjustments).

---

## Backend Implementation

### GET /api/categories

**Handler**: `src/handlers/category.handler.ts` → `getCategories()`
**Connector**: `connector.fetchCategories(type: string | null)`

**Query parameters**:
- `type` (optional): `"Income" | "Expense" | "Financial"` — if omitted, all categories are returned

**Logic**:
- When `type` is provided: Notion filter `{ property: "Type", select: { equals: type } }`
- When `type` is `null`: no filter applied, returns all categories

**Response**:
```json
{
  "categories": [
    { "id": "string", "name": "string", "type": "CategoryType", "parentId": "string | null" }
  ]
}
```

> 🐛 **BUG #3**: `getQueryString(query, "type", false)` with `required=false` throws `null` instead of returning `null` when the `?type` query parameter is absent. This causes an unhandled `null` error (HTTP 500) when calling `GET /api/categories` without `?type`.
>
> In practice, the frontend always provides `?type=Expense` or `?type=Income`, so this bug is not triggered in production. See [known-issues.md](./known-issues.md#bug-3).

---

## Special System Categories

Two category page IDs are used internally for system-generated transactions.
They must exist in the Category database (type = `Financial`) and be configured via environment variables:

| ENV Variable | Category Purpose |
|---|---|
| `NOTION_TRANSFER_TRANSACTION_ID` | Category assigned to all transfer transactions |
| `NOTION_ADJUSTMENT_TRANSACTION_ID` | Category assigned to all adjustment transactions |

These are **Notion page IDs** (not database IDs). If misconfigured, all transfer and adjustment transactions will have an invalid category relation.

---

## Frontend Integration

**ExpenseForm**: fetches `GET /api/categories?type=Expense`
**IncomeForm**: fetches `GET /api/categories?type=Income`

**Dropdown rendering pattern** (ExpenseForm/IncomeForm):
- Top-level categories (`parentId === null`) are rendered as `<optgroup>` labels
- Subcategories (`parentId !== null`) are rendered as `<option>` inside the matching group
- If a top-level category has no children, it is rendered as a direct `<option>`

---

## Backlog

- Fix BUG #3 so `GET /api/categories` (no type filter) returns all categories correctly
- Category management UI (create, edit, delete)
- Budget allocation per category (see [feature-budget.md](./feature-budget.md))
