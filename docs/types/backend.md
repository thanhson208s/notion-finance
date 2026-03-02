# Types — Backend

All types are in `backend/src/types/`. This doc summarizes semantics — read the source for exact shapes.

## Domain Types

### Account (`account.type.ts`)

`AccountType` — 14 values split into two groups:
- **Assets**: Cash, Prepaid, eWallet, Bank, Loan, Savings, Gold, Fund, Bond, Stock
- **Liabilities**: Debt, Crypto, Credit, PayLater

`Account` — id, name, type (AccountType), balance (VND integer).

`isAssetType(type)` — returns true if the type belongs to the Assets group.

### Category (`category.type.ts`)

`CategoryType` — `Income` | `Expense` | `Financial`.

`Category` — id, name, type, parentId. `parentId: null` = top-level; otherwise references the parent category's id. See [notion-schema.md](../architecture/notion-schema.md) for DB structure.

### Transaction (`transaction.type.ts`)

`Transaction` — id, timestamp (ms epoch), amount (always positive), categoryId, note, optional linkedCardId.

`fromAccountId` and `toAccountId` are each optional — which fields are present depends on the transaction type:

| Transaction type | fromAccountId | toAccountId |
|---|---|---|
| Expense | ✅ | — |
| Income | — | ✅ |
| Transfer | ✅ | ✅ |
| Adjustment (decrease) | ✅ | — |
| Adjustment (increase) | — | ✅ |

## Request DTOs (`request.ts`)

| Type | Required fields | Optional fields |
|---|---|---|
| `LogExpenseRequest` | accountId, amount, categoryId, note | timestamp, linkedCardId *(not yet used)* |
| `LogIncomeRequest` | same shape as above | same |
| `TransferBalanceRequest` | fromAccountId, toAccountId, amount | timestamp |
| `AdjustBalanceRequest` | accountId, balance, note | timestamp |

> `AdjustBalanceRequest.balance` is the **target** balance, not a delta.

## Response DTOs (`response.ts`)

| Type | Key fields |
|---|---|
| `GetAccountsResponse` | accounts[], total, totalOfAssets, totalOfLiabilities |
| `GetCategoriesResponse` | categories[] |
| `LogExpenseResponse` / `LogIncomeResponse` | accountId, oldBalance, newBalance, amount, categoryId, note |
| `ListExpensesResponse` / `ListIncomesResponse` | transactions[], total |
| `TransferBalanceResponse` | fromAccountId, toAccountId, old/new balance for each account, amount |
| `AdjustBalanceResponse` | accountId, oldBalance, newBalance, delta, note |

## Error Classes (`error.ts`)

Thrown from handlers; caught and mapped to HTTP responses by `main.ts`.

| Class | Error code | HTTP |
|---|---|---|
| `SchemaError` | `SCHEMA_ERROR` | 500 |
| `QueryError` | `QUERY_ERROR` | 400 |
| `DatabaseError` | `DATABASE_ERROR` | 500 |

## Router Types (`utils/router.ts`)

`RouteHandler<Req, Res>` — async function `(event, connector) → { statusCode, body }`. `event` carries method, path, typed query params, and the typed request body.

`RouteKey` — string in `"METHOD /path"` format, e.g. `"GET /api/accounts"`.
