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
| 401 | Unauthorized — missing or invalid JWT token |
| 403 | Forbidden — missing or invalid `x-cloudflare-secret` header, or Notion permission error |
| 404 | Route not found, or Notion object not found |
| 405 | Method not allowed |
| 409 | Conflict (Notion ConflictError) |
| 429 | Rate limited by Notion |
| 500 | Internal error or database schema mismatch |
| 503 | Notion service unavailable |

---

## Endpoints

---

### POST /api/auth

**Status**: ✅ DONE

Authenticates the owner and returns a JWT token. This endpoint is **not** protected by middleware — no `x-cloudflare-secret` or JWT required.

**Request Body**:
```json
{
  "secret": "string (required)"
}
```

**Response 200**:
```json
{ "token": "string" }
```

**Notes**:
- Validates `secret` against `APP_SECRET` env var
- Returns a signed JWT (`HS256`, `sub: owner`, `expiresIn: 30d`)
- Token must be sent as `Authorization: Bearer <token>` on all subsequent API requests

**Errors**: 401 if `secret` is missing or incorrect

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
      "active": true,
      "note": "string",
      "totalTransactions": 0,
      "lastTransactionDate": 0,
      "priorityScore": 0,
      "linkedCardIds": ["string"]
    }
  ],
  "total": 0,
  "totalOfAssets": 0,
  "totalOfLiabilities": 0
}
```

**Notes**:
- `total` = sum of ALL account balances (including inactive)
- `totalOfAssets` = sum of asset-type accounts only
- `totalOfLiabilities` = sum of liability-type accounts only
- `active` — `false` for deactivated accounts; frontend should filter these from forms and selectors
- `note` — free-text note; empty string if not set
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
| `type` | `"Income" \| "Expense" \| "System"` | No | Filter by category type |

**Response 200**:
```json
{
  "categories": [
    {
      "id": "string",
      "name": "string",
      "type": "Income | Expense | System",
      "parentId": "string | null",
      "note": "string"
    }
  ]
}
```

**Notes**:
- `parentId: null` = top-level category
- `parentId: string` = subcategory (child of that ID)
- Calling without `?type` returns all categories (no filter applied)

---

### POST /api/accounts?action=transfer

**Status**: ✅ DONE

Transfers an amount from one account to another.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `action` | `"transfer"` | Yes | Must be `transfer` |

**Request Body**:
```json
{
  "fromAccountId": "string (required)",
  "toAccountId": "string (required)",
  "amount": "number (required, must be positive)",
  "note": "string (required, may be empty)",
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

### POST /api/accounts?action=adjustment

**Status**: ✅ DONE

Sets an account's balance to a target value, creating an audit transaction for the difference.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `action` | `"adjustment"` | Yes | Must be `adjustment` |

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

### POST /api/accounts?action=set-active

**Status**: ✅ DONE

Activates or deactivates an account. Deactivated accounts are still returned by `GET /api/accounts` with `active: false`; the frontend is responsible for hiding them from forms and selectors.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `action` | `"set-active"` | Yes | Must be `set-active` |

**Request Body**:
```json
{
  "accountId": "string (required)",
  "active": "boolean (required)"
}
```

**Response 200**:
```json
{
  "accountId": "string",
  "active": false
}
```

---

### POST /api/accounts?action=create

**Status**: ✅ DONE

Creates a new account in the Notion Account database. Initial `balance` is `0` and `active` is `true`.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `action` | `"create"` | Yes | Must be `create` |

**Request Body**:
```json
{
  "name": "string (required)",
  "type": "AccountType (required)",
  "note": "string (optional, defaults to empty)"
}
```

**Response 200**: full `Account` object
```json
{
  "id": "string",
  "name": "string",
  "type": "string",
  "balance": 0,
  "active": true,
  "note": "string",
  "totalTransactions": null,
  "lastTransactionDate": null,
  "priorityScore": 0,
  "linkedCardIds": []
}
```

---

### GET /api/transactions?type=expense|income

**Status**: ✅ DONE

Lists expense or income transactions, optionally filtered by date range.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `type` | `"expense" \| "income"` | Yes | Transaction type to list |
| `startDate` | `string` (ISO 8601) | No | Filter transactions on or after this date |
| `endDate` | `string` (ISO 8601) | No | Filter transactions on or before this date |

**Response 200**:
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
      "linkedCardId": "string | undefined",
      "cashback": "number | undefined",
      "discount": "number | undefined"
    }
  ],
  "total": 0
}
```

**Notes**:
- Results sorted by `timestamp` descending
- `total` = server-side sum of `amount` across all results
- Excludes transfer and adjustment transactions
- Full pagination via Notion cursor — returns all matching records
- `note` is always a `string` — Notion null notes are returned as `""` (empty string)

---

### POST /api/transactions?type=expense

**Status**: ✅ DONE

Logs an expense and deducts the amount from the specified account.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `type` | `"expense"` | Yes | Must be `expense` |

**Request Body**:
```json
{
  "accountId": "string (required)",
  "amount": "number (required, must be positive)",
  "categoryId": "string (required)",
  "note": "string (required, may be empty)",
  "timestamp": "number (optional, Unix ms)",
  "linkedCardId": "string (optional)",
  "cashback": "number (optional)",
  "discount": "number (optional)"
}
```

**Response 200**:
```json
{
  "transactionId": "string",
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

### POST /api/transactions?type=income

**Status**: ✅ DONE

Logs income and adds the amount to the specified account.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `type` | `"income"` | Yes | Must be `income` |

**Request Body**: Same as `POST /api/transactions?type=expense`.

**Response 200**: Same shape as expense response.

**Business logic**: Same as expense but `balance = oldBalance + amount`. Transaction: `FromAccount = null`, `ToAccount = accountId`.

---

### GET /api/reports

**Status**: ✅ DONE (v1.5.0)

Returns spending and income summary with category breakdown for a selected date range (F-09, F-10).

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `startDate` | `string` (`YYYY-MM-DD`) | No | Inclusive start date — matches transactions from `startDate T00:00:00` onwards |
| `endDate` | `string` (`YYYY-MM-DD`) | No | Inclusive end date — matches transactions up to `endDate T23:59:59` |

Omitting both params returns all transactions (no date filter). Pass dates as `YYYY-MM-DD` only — do not include a time component; the handler appends the appropriate time boundary automatically.

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
- Handler: `api/_handlers/reports.handler.ts` → `getReports()`

---

### GET /api/transactions?id=

**Status**: ✅ DONE

Returns a single transaction by ID.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Notion page ID of the transaction |

**Response 200**: `Transaction` object

**Errors**: 400 if neither `id` nor `type` is provided, 404 if not found

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
  "linkedCardId": "string | null",
  "cashback": "number | null",
  "discount": "number | null"
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

> ⚠️ **Known gap**: `categoryId` is written without existence validation in PATCH (unlike POST endpoints which call `fetchCategory()` first). Providing an invalid category ID will silently create a broken Notion relation.

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


---

### GET /api/cards

**Status**: ✅ DONE

Returns all cards.

**Response 200**:
```json
{
  "cards": [
    {
      "id": "string",
      "name": "string",
      "number": "string",
      "imageUrl": "string",
      "annualFee": 0,
      "spendingLimit": 0,
      "requiredSpending": 0,
      "lastChargedDate": 0,
      "billingDay": 0,
      "linkedAccountId": "string | null",
      "linkedServices": ["string"],
      "cashbackCap": 0,
      "network": "string | null"
    }
  ]
}
```

---

### GET /api/cards?id={cardId}

**Status**: ✅ DONE

Returns a single card with current billing cycle spending metrics.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Card page ID |

**Response 200**: `CardWithSpending` — all `Card` fields plus:
```json
{
  "cycleStart": "YYYY-MM-DD | null",
  "cycleEnd": "YYYY-MM-DD | null",
  "currentCycleSpending": 0,
  "currentCycleCashback": 0,
  "currentCycleDiscount": 0
}
```

**Notes**:
- `cycleStart` / `cycleEnd` are `null` for cards without a `billingDay` (e.g. debit cards)
- Spending metrics are summed from expense transactions linked to this card in the current billing cycle
- Adjustment transactions are excluded from cycle totals

---

### GET /api/promotions

**Status**: ✅ DONE

Returns all promotions, optionally filtered by card.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `cardId` | `string` | No | Filter promotions linked to this card |

**Response 200**:
```json
{
  "promotions": [
    {
      "id": "string",
      "name": "string",
      "cardId": "string | null",
      "category": "Shopping | F&B | Travel | Entertain | Digital | null",
      "type": "Cashback | Discount",
      "expiresAt": 0,
      "link": "string | null"
    }
  ]
}
```

---

### POST /api/promotions

**Status**: ✅ DONE

Creates a new promotion.

**Request Body**:
```json
{
  "name": "string (required)",
  "cardId": "string (optional)",
  "category": "Shopping | F&B | Travel | Entertain | Digital (optional)",
  "type": "Cashback | Discount (required)",
  "expiresAt": "number (optional, Unix ms)",
  "link": "string (optional)"
}
```

**Response 200**: `Promotion` object

**Errors**: 400 if `name` missing or `type` is not `Cashback` or `Discount`

---

### PATCH /api/promotions

**Status**: ✅ DONE

Updates an existing promotion (full replacement of all fields).

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Promotion page ID |

**Request Body**: Same shape as `POST /api/promotions`

**Response 200**: Updated `Promotion` object

---

### DELETE /api/promotions

**Status**: ✅ DONE

Trashes a promotion.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Promotion page ID |

**Response 200**:
```json
{ "id": "string" }
```

---

### GET /api/statements

**Status**: ✅ DONE

Returns all statements, optionally filtered by card.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `cardId` | `string` | No | Filter statements for this card |

**Response 200**:
```json
{
  "statements": [
    {
      "id": "string",
      "cardId": "string",
      "startDate": 0,
      "endDate": 0,
      "spending": 0,
      "cashback": 0,
      "discount": 0
    }
  ]
}
```

---

### GET /api/statements?preview=1

**Status**: ✅ DONE

Previews spending totals for a date range without creating a statement record.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `preview` | `"1"` | Yes | Must be `1` |
| `cardId` | `string` | Yes | Card to compute totals for |
| `startDate` | `number` (Unix ms) | Yes | Period start |
| `endDate` | `number` (Unix ms) | Yes | Period end |

**Response 200**:
```json
{
  "spending": 0,
  "cashback": 0,
  "discount": 0
}
```

**Errors**: 400 if any param missing, or `startDate >= endDate`

---

### POST /api/statements

**Status**: ✅ DONE

Creates a statement record with spending totals computed from transactions in the given period.

**Request Body**:
```json
{
  "cardId": "string (required)",
  "startDate": "number (required, Unix ms)",
  "endDate": "number (required, Unix ms)"
}
```

**Response 200**: `Statement` object

**Business logic**:
1. Compute `startDateStr = YYYY-MM-DDT00:00:00+07:00`, `endDateStr = YYYY-MM-DDT23:59:59+07:00`
2. Fetch all expense transactions linked to `cardId` in the period (excludes adjustment and transfer)
3. Sum `amount`, `cashback`, `discount`
4. Create Statement record in Notion with computed totals

**Errors**: 400 if any required field missing or `startDate >= endDate`

---

### DELETE /api/statements

**Status**: ✅ DONE

Trashes a statement.

**Query Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Statement page ID |

**Response 200**:
```json
{ "id": "string" }
```

---

## Internal / Cron Endpoints

These endpoints are not user-facing. They are invoked by Vercel's cron scheduler or manually for testing.

---

### GET /api/cron/snapshot

**Status**: ✅ DONE

Creates monthly balance snapshots for all accounts. Runs automatically via Vercel cron at the start of each month (00:00 Bangkok time).

**Auth**: Requires `Authorization: Bearer <CRON_SECRET>` header. Returns `401` if missing or invalid.

**Response 200** (executed on 1st of month):
```json
{
  "label": "01-02-2026",
  "results": [
    {
      "accountId": "string",
      "accountName": "Cash",
      "status": "created",
      "snapshotId": "string",
      "calculatedBalance": 1500000,
      "actualBalance": 1500000,
      "mismatch": false
    },
    {
      "accountId": "string",
      "accountName": "Savings",
      "status": "no_transactions"
    },
    {
      "accountId": "string",
      "accountName": "Old Account",
      "status": "no_prior_snapshot"
    }
  ],
  "mismatches": 0
}
```

**`status` values**:

| Value | Meaning |
|---|---|
| `created` | Snapshot record created successfully |
| `no_prior_snapshot` | Skipped — no prior snapshot exists (first snapshot must be created manually) |
| `no_transactions` | Skipped — no transactions since the last snapshot |

**Business logic**:
- For each account with a prior snapshot: fetches transactions since the last snapshot, calculates new balance, creates snapshot record
- Always sends a full Telegram run report listing created snapshots, mismatched accounts, and skipped accounts with their skip reason
- Accounts without a prior snapshot or with no new transactions are skipped (reflected in `status`)

**Errors**: 401 if unauthorized, 500 on internal error

---

### GET /api/cron/archive

**Status**: ✅ DONE

Archives transactions older than 3 calendar months into per-month Archive pages with inline child databases. Runs automatically via Vercel cron every day at 00:00 UTC.

**Auth**: Requires `Authorization: Bearer <CRON_SECRET>` header. Returns `401` if missing or invalid.

**Response 200**:
```json
{
  "archived": 42,
  "archivesCreated": 1,
  "archivesUpdated": 1
}
```

**Notes**:
- `archived` = total number of transactions moved
- `archivesCreated` = new Archive pages created (new months)
- `archivesUpdated` = existing Archive pages that received more transactions

**Business logic**:
1. Compute cutoff = now minus 3 calendar months (midnight UTC)
2. Fetch all transactions with `Timestamp < cutoff` from the main Transaction DB
3. Group transactions by Bangkok-timezone month/year
4. For each bucket:
   - Find or create an Archive page in the Archive DB
   - Find or create an inline child Transaction DB under that page
   - Copy each transaction to the inline DB
   - Trash each transaction from the main Transaction DB
   - Update archive stats (`Count`, `Debit`, `Credit`)
5. Always sends a Telegram run report

**Errors**: 401 if unauthorized, 500 on internal error
