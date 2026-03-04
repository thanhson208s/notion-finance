# Known Issues & Bug Registry

Last updated: 2026-03-04

## Severity Legend

| Severity | Definition |
|---|---|
| **P1** | Data integrity risk or silent data corruption |
| **P2** | Incorrect or missing behavior, user-visible |
| **P3** | Code quality / latent issue, not user-visible yet |

---

## ~~BUG #1~~ — `timestamp` field is accepted but never used ✅ RESOLVED {#bug-1}

**Resolved in**: v1.1.0
**Fix**: Added optional `timestamp?: number` to `connector.addTransaction()`, `addExpense()`, `addIncome()`, `addTransfer()`. All four handlers now forward `req.timestamp` to the connector. If provided, uses `moment(timestamp).tz('Asia/Bangkok').format()`; otherwise defaults to current time.

---

## ~~BUG #2~~ — `linkedCardId` accepted in request but never stored ✅ RESOLVED {#bug-2}

**Resolved in**: v1.3.0
**Fix**: Added `linkedCardId?: string` to `addTransaction()`, `addExpense()`, `addIncome()`. When provided, writes `"Linked card": { relation: [{ id: linkedCardId }] }` to the Notion Transaction page. Handlers `logExpense` and `logIncome` now forward `req.linkedCardId`.

---

## ~~BUG #3~~ — `getQueryString()` with `required=false` throws instead of returning `null` ✅ RESOLVED {#bug-3}

**Resolved in**: v1.1.0
**Fix**: Changed `throw null as any` to `return null as any` at `helper.ts` lines 47 and 56 (`getQueryString` and `getQueryBool`).

---

## ~~BUG #4~~ — No amount validation; negative values silently corrupt balances ✅ RESOLVED {#bug-4}

**Resolved in**: v1.1.0
**Fix**: Added `if (req.amount <= 0) throw new QueryError("Amount must be a positive number")` at the top of `logExpense`, `logIncome`, and `transferBalance` handlers.

---

## ~~BUG #5~~ — Account and category IDs not validated before use ✅ RESOLVED {#bug-5}

**Resolved in**: v1.3.0
**Fix**: Added `connector.fetchCategory(categoryId)` method (same pattern as `fetchAccount`). Called in `logExpense` and `logIncome` before writing the transaction. If the category page does not exist, Notion returns `object_not_found` which `main.ts` maps to HTTP 404 — no malformed records are created. Account IDs were already implicitly validated via the existing `fetchAccount` call.

---

## ~~BUG #6~~ — Zero test coverage ✅ RESOLVED {#bug-6}

**Resolved in**: v1.2.0
**Fix**: Added `vitest` to `devDependencies`. Added `"test": "vitest run"` and `"test:watch": "vitest"` scripts to `package.json`. Created 69 unit tests across 6 test files covering `helper.ts`, `router.ts`, `account.type.ts`, and all three handler modules. All tests pass.

---

## ~~BUG #7~~ — `GET /api/expense` and `GET /api/income` are stubs ✅ RESOLVED {#bug-7}

**Resolved in**: v1.1.0
**Fix**: Implemented `connector.fetchTransactions(type, startDate?, endDate?)` with a Notion compound filter (FromAccount/ToAccount is_not_empty, excludes system categories, optional date bounds). `listExpenses` and `listIncomes` now call this method and compute `total` server-side. Date params are optional.
