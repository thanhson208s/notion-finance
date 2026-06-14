# Feature: Budget Management

**Status**: ❌ TODO (backend + frontend)

---

## Business Description

Allow users to set monthly spending budgets per expense category and track actual spend against those budgets in real time.

---

## Current State

No code, no Notion table, and no detailed specification beyond this placeholder.

---

## Planned Scope (Backlog)

### Data Model (proposed)

New Notion database — **Budget**:

| Property | Type | Notes |
|---|---|---|
| `Name` | Title | Auto-generated: `{categoryId}-{year}-{month}` |
| `Category` | Relation | Relation to Category DB |
| `Amount` | Number | Budgeted amount in VND |
| `Month` | Number | 1–12 |
| `Year` | Number | e.g. 2026 |

### Proposed Endpoints

- `GET /api/budgets?month=&year=` — list budgets for a period with actual vs. planned spend
- `POST /api/budgets` — create or update a budget for a category/period
- `DELETE /api/budgets/:id` — remove a budget entry

### Frontend

- Budget view with progress bars (budgeted vs. actual per category)
- Monthly navigation

---

## Dependencies

- `GET /api/expense` with date filtering must be implemented first (provides actual spend data)
- Category management must be stable before budget allocation is meaningful
