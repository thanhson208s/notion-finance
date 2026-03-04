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

## BUG #2 — `linkedCardId` accepted in request but never stored {#bug-2}

**Severity**: P3 (becomes P2 when Cards feature is implemented)
**Affected endpoints**: `POST /api/expense`, `POST /api/income`
**Files**: `src/types/request.ts`, `src/handlers/transaction.handler.ts`, `src/utils/connector.ts`

**Description**:
`LogExpenseRequest` and `LogIncomeRequest` both include `linkedCardId?: string`.
Neither `logExpense()` nor `logIncome()` reads `req.linkedCardId`.
`connector.addTransaction()` does not accept a `linkedCardId` parameter.
The Notion Transaction DB has a `"Linked card"` relation field that is never written.

**Impact**: Currently cosmetic — Cards feature is not yet implemented. Once Cards are built, this omission will cause card-transaction linking to silently not work.

**Fix**:
1. Add `linkedCardId?: string` parameter to `addTransaction()` and upstream connector methods
2. When provided, include `"Linked card": { relation: [{ id: linkedCardId }] }` in the Notion page properties

---

## ~~BUG #3~~ — `getQueryString()` with `required=false` throws instead of returning `null` ✅ RESOLVED {#bug-3}

**Resolved in**: v1.1.0
**Fix**: Changed `throw null as any` to `return null as any` at `helper.ts` lines 47 and 56 (`getQueryString` and `getQueryBool`).

---

## ~~BUG #4~~ — No amount validation; negative values silently corrupt balances ✅ RESOLVED {#bug-4}

**Resolved in**: v1.1.0
**Fix**: Added `if (req.amount <= 0) throw new QueryError("Amount must be a positive number")` at the top of `logExpense`, `logIncome`, and `transferBalance` handlers.

---

## BUG #5 — Account and category IDs not validated before use {#bug-5}

**Severity**: P2
**Affected endpoints**: All POST handlers
**Files**: `src/handlers/transaction.handler.ts`, `src/handlers/account.handler.ts`

**Description**:
If an invalid `accountId` or `categoryId` is passed, the code proceeds to call Notion. Notion's behavior varies:
- For relation properties: Notion may silently create a relation pointing to a non-existent page
- For direct page operations: Notion returns `object_not_found` (404), which the error handler maps to HTTP 404

There is no explicit pre-flight existence check.

**Impact**: Invalid IDs can create malformed transaction records in Notion without a clear API error.

**Fix options**:
- Option A: Accept Notion's 404 as the validation mechanism; improve the error message mapping
- Option B: Fetch the account/category before use and throw `QueryError` with a clear message if not found

---

## BUG #6 — Zero test coverage {#bug-6}

**Severity**: P3
**Files**: Entire `src/` directory

**Description**:
No unit tests, integration tests, or mock tests exist.
`CLAUDE.md` references `pnpm test` in the pre-task checklist and the Standard AI Workflow, but no test runner is configured in `package.json`.

**Impact**: Breaking changes can be introduced undetected. `CLAUDE.md` compliance is not achievable.

**Fix**:
1. Add `vitest` (recommended for esbuild-based projects) to `devDependencies`
2. Configure `pnpm test` script
3. Start with unit tests for:
   - `helper.ts` — `getQueryString`, `getQueryInt`, `getQueryBool`
   - `connector.ts` — property mapper methods with mock `PageObjectResponse`
   - Handler business logic — with a mock `Connector` instance

---

## ~~BUG #7~~ — `GET /api/expense` and `GET /api/income` are stubs ✅ RESOLVED {#bug-7}

**Resolved in**: v1.1.0
**Fix**: Implemented `connector.fetchTransactions(type, startDate?, endDate?)` with a Notion compound filter (FromAccount/ToAccount is_not_empty, excludes system categories, optional date bounds). `listExpenses` and `listIncomes` now call this method and compute `total` server-side. Date params are optional.
