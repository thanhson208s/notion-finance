# API Reference

**Base URL**: `https://finance.gootube.online/api`
**Content-Type**: `application/json` (all requests and responses)

---

## Response Format

### Success (HTTP 200)

Data is returned directly as the response body — no envelope wrapper:

```json
{ "accounts": [...], "total": 0 }
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 400 | Bad request (missing/invalid query param, Notion validation error) |
| 403 | Forbidden (Notion permission error) |
| 404 | Route not found, or Notion object not found |
| 409 | Conflict (Notion ConflictError) |
| 429 | Rate limited by Notion |
| 500 | Internal error or database schema mismatch |
| 503 | Notion service unavailable |

---

## Endpoints

---

### GET /api/accounts

**Status**: ✅ DONE

Returns all accounts with aggregated balance totals.

**Response 200**:
```json
{
  "accounts": [
    {
      "id": "string",
      "name": "string",
      "type": "Cash | Bank | eWallet | ...",
      "balance": 0,
      "totalTransactions": 0,
      "lastTransactionDate": 0,
      "priorityScore": 0,
      "linkedCardIds": ["string"],
      "cards": [{ "id": "string", "name": "string", "imageUrl": "string" }]
    }
  ],
  "total": 0,
  "totalOfAssets": 0,
  "totalOfLiabilities": 0
}
```

**Notes**:
- `total` = sum of ALL account balances
- `totalOfAssets` = sum of asset-type accounts only
- `totalOfLiabilities` = sum of liability-type accounts only
- `totalTransactions` — number of expense/income transactions logged against this account; `null` for accounts with no history yet
- `lastTransactionDate` — Unix ms timestamp of the most recent expense/income transaction; `null` for unused accounts
- `priorityScore` — computed ranking score: `0.4 * log(1 + totalTransactions) + 0.6 * 0.5^(daysSince / 30)`; `0` for unused accounts. Frontend can sort by this field descending to surface preferred accounts first.
- No pagination — returns all accounts

---

### GET /api/categories

**Status**: ✅ DONE

Returns all categories, optionally filtered by type.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `type` | `"Income" \| "Expense" \| "Financial"` | No | Filter by category type |

**Response 200**:
```json
{
  "categories": [
    {
      "id": "string",
      "name": "string",
      "type": "Income | Expense | Financial",
      "parentId": "string | null"
    }
  ]
}
```

**Notes**:
- `parentId: null` = top-level category
- `parentId: string` = subcategory (child of that ID)
- Calling without `?type` returns all categories (no filter applied)

---

### POST /api/expense

**Status**: ✅ DONE

Logs an expense and deducts the amount from the specified account.

**Request Body**:
```json
{
  "accountId": "string (required)",
  "amount": "number (required, must be positive)",
  "categoryId": "string (required)",
  "note": "string (required, may be empty)",
  "timestamp": "number (optional, Unix ms)",
  "linkedCardId": "string (optional)"
}
```

**Response 200**:
```json
{
  "accountId": "string",
  "oldBalance": 0,
  "newBalance": 0,
  "amount": 0,
  "categoryId": "string",
  "note": "string"
}
```

**Business logic**:
1. Fetch account → get `oldBalance`, `totalTransactions`
2. Validate category exists
3. Create transaction: `FromAccount = accountId`, `ToAccount = null`
4. Update account (single Notion call): `balance = oldBalance - amount`, `totalTransactions += 1`, `lastTransactionDate = timestamp ?? now`

---

### POST /api/income

**Status**: ✅ DONE

Logs income and adds the amount to the specified account.

**Request Body**:
```json
{
  "accountId": "string (required)",
  "amount": "number (required, must be positive)",
  "categoryId": "string (required)",
  "note": "string (required, may be empty)",
  "timestamp": "number (optional, Unix ms)",
  "linkedCardId": "string (optional)"
}
```

**Response 200**:
```json
{
  "accountId": "string",
  "oldBalance": 0,
  "newBalance": 0,
  "amount": 0,
  "categoryId": "string",
  "note": "string"
}
```

**Business logic**: Same as expense but `balance = oldBalance + amount`. Transaction: `FromAccount = null`, `ToAccount = accountId`. Also increments `totalTransactions` and sets `lastTransactionDate` in the same Notion call.

---

### POST /api/transfer

**Status**: ✅ DONE

Transfers an amount from one account to another.

**Request Body**:
```json
{
  "fromAccountId": "string (required)",
  "toAccountId": "string (required)",
  "amount": "number (required, must be positive)",
  "timestamp": "number (optional, Unix ms)"
}
```

**Response 200**:
```json
{
  "fromAccountId": "string",
  "toAccountId": "string",
  "oldFromAccountBalance": 0,
  "newFromAccountBalance": 0,
  "oldToAccountBalance": 0,
  "newToAccountBalance": 0,
  "amount": 0
}
```

**Business logic**:
1. Fetch both account balances (2 Notion reads)
2. Create transfer transaction (category = `NOTION_TRANSFER_TRANSACTION_ID`)
3. Update `fromAccount`: `balance = old - amount`
4. Update `toAccount`: `balance = old + amount`

> ⚠️ **Non-atomic**: if step 4 fails after step 3 completes, `fromAccount` balance is decremented but `toAccount` is not incremented. Balances will be inconsistent.

---

### POST /api/adjustment

**Status**: ✅ DONE

Sets an account's balance to a target value, creating an audit transaction for the difference.

**Request Body**:
```json
{
  "accountId": "string (required)",
  "balance": "number (required — this is the TARGET balance, not a delta)",
  "note": "string (required)",
  "timestamp": "number (optional, Unix ms)"
}
```

**Response 200**:
```json
{
  "accountId": "string",
  "oldBalance": 0,
  "newBalance": 0,
  "delta": 0,
  "note": "string"
}
```

**Business logic**:
1. Fetch `oldBalance`
2. Compute `delta = |oldBalance - targetBalance|`
3. Create adjustment transaction (category = `NOTION_ADJUSTMENT_TRANSACTION_ID`):
   - If `oldBalance > target`: `FromAccount = accountId`, `ToAccount = null`
   - If `oldBalance < target`: `FromAccount = null`, `ToAccount = accountId`
   - `Amount = delta`
4. Set account balance to `targetBalance`

**Note**: `delta` in the response is always the absolute value.

---

### GET /api/expense

**Status**: ✅ DONE

Lists expense transactions, optionally filtered by date range.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `startDate` | `string` (ISO 8601) | No | Filter transactions on or after this date |
| `endDate` | `string` (ISO 8601) | No | Filter transactions on or before this date |

Omitting both params returns all expense transactions (no date filter).

**Response 200**:
```json
{
  "transactions": [
    {
      "id": "string",
      "timestamp": 0,
      "amount": 0,
      "fromAccountId": "string",
      "toAccountId": "string | undefined",
      "categoryId": "string",
      "note": "string",
      "linkedCardId": "string | undefined"
    }
  ],
  "total": 0
}
```

**Notes**:
- Results sorted by `timestamp` descending
- `total` = server-side sum of `amount` across all results
- Excludes transfer and adjustment transactions (filtered by category)
- Full pagination via Notion cursor — returns all matching records

---

### GET /api/income

**Status**: ✅ DONE

Same structure as `GET /api/expense`. Filters by `ToAccount is not empty` instead of `FromAccount`.
Date params and response shape are identical.

---

### GET /api/reports

**Status**: ✅ DONE (v1.5.0)

Returns spending and income summary with category breakdown for a selected date range (F-09, F-10).

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `startDate` | `string` (ISO 8601) | No | Filter transactions on or after this date |
| `endDate` | `string` (ISO 8601) | No | Filter transactions on or before this date |

**Response 200**:
```json
{
  "totalIncome": 0,
  "totalExpense": 0,
  "netSavings": 0,
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
  "expenseCategoryBreakdown": [
    {
      "categoryId": "string",
      "amount": 0
    }
  ],
  "incomeCategoryBreakdown": [
    {
      "categoryId": "string",
      "amount": 0
    }
  ]
}
```

**Notes**:
- `netSavings = totalIncome - totalExpense`
- `transactions`: all transactions in the date range (expense, income, transfer, adjustment), sorted by `timestamp` descending
- Category breakdowns are exclusive to expense/income — transfer and adjustment transactions are excluded
- `parentId`: category's own `id` when Notion returns `null` (top-level category)
- Each breakdown sorted by `amount` descending
- 2 parallel Notion calls: all transactions + all categories
- Handler: `src/handlers/reports.handler.ts` → `getReports()`

---

### GET /api/transactions

**Status**: ✅ DONE

Returns a single transaction by ID.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Notion page ID of the transaction |

**Response 200**: `Transaction` object

**Errors**: 400 if `id` missing, 404 if not found

---

### PATCH /api/transactions

**Status**: ✅ DONE

Updates a transaction and reconciles account balances when amount changes.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Notion page ID of the transaction |

**Request Body** (all fields optional):
```json
{
  "amount": "number (must be positive if provided)",
  "note": "string",
  "categoryId": "string",
  "timestamp": "number (Unix ms)",
  "linkedCardId": "string | null"
}
```

**Response 200**:
```json
{
  "transaction": { "id": "string", "timestamp": 0, "amount": 0, "categoryId": "string", "note": "string" },
  "balanceChanges": [{ "accountId": "string", "oldBalance": 0, "newBalance": 0 }]
}
```

**Business logic**:
- Fetches the existing transaction
- If `amount` changed: `delta = newAmount - oldAmount`
  - Expense: `fromAccount.balance -= delta`
  - Income: `toAccount.balance += delta`
  - Transfer: `fromAccount.balance -= delta`, `toAccount.balance += delta`
- Partially updates the Notion page (only provided fields are written)

**Errors**: 400 if `id` missing or `amount <= 0`

---

### DELETE /api/transactions

**Status**: ✅ DONE

Reverses a transaction's balance effects and trashes the Notion page.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Notion page ID of the transaction |

**Response 200**:
```json
{
  "id": "string",
  "balanceChanges": [{ "accountId": "string", "oldBalance": 0, "newBalance": 0 }]
}
```

**Business logic**:
- Fetches the transaction to determine type and amount
- Reverses balance effects:
  - Expense (`fromAccountId` only): `fromAccount.balance += amount`
  - Income (`toAccountId` only): `toAccount.balance -= amount`
  - Transfer (both set): `fromAccount.balance += amount`, `toAccount.balance -= amount`
- Archives the Notion page via `in_trash: true`

**Errors**: 400 if `id` missing, 404 if not found
