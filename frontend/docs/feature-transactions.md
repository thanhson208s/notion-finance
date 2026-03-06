# Feature: Transactions

Covers all four transaction types: **Expense**, **Income**, **Transfer**, **Adjustment**.
All types write to the same Notion Transaction database and share the `Transaction` type.

---

## Status

| Sub-feature | Backend | Frontend |
|---|---|---|
| Log Expense | ✅ DONE | ✅ DONE |
| Log Income | ✅ DONE | ✅ DONE |
| Log Transfer | ✅ DONE | ✅ DONE |
| Log Adjustment | ✅ DONE | ✅ DONE |
| List Expenses by date range | ✅ DONE | ❌ TODO |
| List Incomes by date range | ✅ DONE | ❌ TODO |

---

## Transaction Semantics

All four types write to the same Notion Transaction DB. They differ in how `FromAccount` / `ToAccount` are set and how account balances are updated:

| Type | `FromAccount` | `ToAccount` | Balance Effect |
|---|---|---|---|
| Expense | `accountId` | `null` | `account -= amount` |
| Income | `null` | `accountId` | `account += amount` |
| Transfer | `fromAccountId` | `toAccountId` | `from -= amount`, `to += amount` |
| Adjustment (decrease) | `accountId` | `null` | `account = targetBalance` |
| Adjustment (increase) | `null` | `accountId` | `account = targetBalance` |

---

## Backend: Log Expense (`POST /api/expense`)

**Handler**: `src/handlers/transaction.handler.ts` → `logExpense()`

1. Validate `amount > 0` — throws `QueryError` (HTTP 400) if not
2. `connector.fetchAccount(accountId)` → get `oldBalance`
3. `connector.addExpense(accountId, amount, categoryId, note, timestamp?)`
   - Calls `addTransaction(accountId, null, amount, categoryId, note, timestamp?)`
   - Creates page in Transaction DB; timestamp defaults to `now()` if not provided
4. `connector.updateAccountBalance(accountId, oldBalance - amount)`

**Resolved issues**: ~~🐛 BUG #2~~ (linkedCardId now stored — v1.3.0), ~~🐛 BUG #5~~ (category ID validated — v1.3.0).

---

## Backend: Log Income (`POST /api/income`)

**Handler**: `src/handlers/transaction.handler.ts` → `logIncome()`

Same flow as expense, but:
- `addTransaction(null, accountId, amount, categoryId, note)`
- `updateAccountBalance(accountId, oldBalance + amount)`

---

## Backend: Transfer (`POST /api/transfer`)

**Handler**: `src/handlers/transaction.handler.ts` → `transferBalance()`

1. Fetch both `fromAccount` and `toAccount` (2 Notion reads)
2. Create transfer transaction:
   - `FromAccount = fromAccountId`, `ToAccount = toAccountId`
   - Category = `NOTION_TRANSFER_TRANSACTION_ID`
3. Update `fromAccount`: `balance = old - amount`
4. Update `toAccount`: `balance = old + amount`

> ⚠️ **Non-atomic**: if step 4 fails after step 3, `fromAccount` is decremented but `toAccount` is not credited. This can leave balances in an inconsistent state.

---

## Backend: Adjustment (`POST /api/adjustment`)

**Handler**: `src/handlers/account.handler.ts` → `adjustBalance()`

The `balance` field in the request is the **target balance**, not a delta.

1. Fetch `oldBalance`
2. `delta = |oldBalance - targetBalance|`
3. Create adjustment transaction (category = `NOTION_ADJUSTMENT_TRANSACTION_ID`):
   - Decrease path: `FromAccount = accountId`, `ToAccount = null`
   - Increase path: `FromAccount = null`, `ToAccount = accountId`
4. Set account balance to `targetBalance`

---

## Backend: List Expenses (`GET /api/expense`)

**Handler**: `src/handlers/transaction.handler.ts` → `listExpenses()`
**Connector**: `connector.fetchTransactions('expense', startDate?, endDate?)`

**Notion filter applied**:
```
AND [
  FromAccount is_not_empty
  Category does_not_contain NOTION_TRANSFER_TRANSACTION_ID
  Category does_not_contain NOTION_ADJUSTMENT_TRANSACTION_ID
  Timestamp on_or_after startDate  (if provided)
  Timestamp on_or_before endDate   (if provided)
]
```
Sorted by `Timestamp` descending. `total` is computed server-side as `sum(amount)`.
Date params are optional — omitting them returns all expense transactions.

---

## Backend: List Incomes (`GET /api/income`)

**Handler**: `src/handlers/transaction.handler.ts` → `listIncomes()`

Same as List Expenses, but uses `ToAccount is_not_empty` filter and passes `'income'` to `fetchTransactions`.

---

## Frontend Components

### ExpensePage / ExpenseForm

**Files**: `src/pages/ExpensePage.tsx`, `src/components/ExpenseForm.tsx`
**Route**: `/expense/:accountId` (requires `location.state.account`)

**Form fields**:
- *Amount*: large numeric input, keyboard-driven (digits append, backspace removes last digit)
- *Category*: select dropdown, fetches `GET /api/categories?type=Expense`, renders parent categories as `<optgroup>`
- *Note*: optional text input

**Validation**: `amount > 0`, `categoryId` selected

**POST body sent**: `{ accountId, amount, categoryId, note }`
(No `timestamp` or `linkedCardId` sent from current frontend — backend supports both fields but UI does not expose them)

### IncomePage / IncomeForm

**Files**: `src/pages/IncomePage.tsx`, `src/components/IncomeForm.tsx`
**Route**: `/income/:accountId`

Same UX as ExpenseForm. Fetches `GET /api/categories?type=Income`.

### TransferPage / TransferForm

**Files**: `src/pages/TransferPage.tsx`, `src/components/TransferForm.tsx`
**Route**: `/transfer/:accountId`

- Fetches all accounts to populate the destination account dropdown
- Excludes the source account from the destination options

### AdjustmentPage / AdjustmentForm

**Files**: `src/pages/AdjustmentPage.tsx`, `src/components/AdjustmentForm.tsx`
**Route**: `/adjustment/:accountId`

Input is the **target balance** (not a delta). Same numeric input UX as ExpenseForm.

---

## Known Issues

- ~~🐛 BUG #2~~: `linkedCardId` now stored in Notion — resolved in v1.3.0. See [known-issues.md](./known-issues.md#bug-2).
- ~~🐛 BUG #5~~: Category ID validation added — resolved in v1.3.0. See [known-issues.md](./known-issues.md#bug-5).
- ⚠️ **Transfer non-atomic**: if the final balance update fails, `fromAccount` is decremented but `toAccount` is not credited (data integrity risk). No frontend recovery mechanism exists.

## Backlog

- Transaction history view per account (frontend)
- Date range picker UI on Reports page (frontend)
- Make transfer operation atomic (or add compensating transaction on failure)
