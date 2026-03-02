# API — Categories

Base URL: `https://finance.gootube.online/api`

---

## GET /api/categories

Returns categories, optionally filtered by type. Handler: `category.handler.ts → getCategories`.

**Query params**: `type` (optional) — `Income` | `Expense` | `Financial`.

**Response fields**: `categories[]` (id, name, type, parentId).

`parentId: null` = top-level category. `parentId: "<id>"` = sub-category referencing its parent. The frontend renders these as `<optgroup>` (parent) + `<option>` (children) — see [guides/frontend.md](../guides/frontend.md#category-dropdown).
