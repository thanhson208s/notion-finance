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
      "balance": 0
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
- 🐛 BUG #3: calling this endpoint **without** `?type` query param throws a `null` error (HTTP 500). Frontend always provides `?type`, so this is not triggered in production. See [known-issues.md](./known-issues.md#bug-3).

---

### POST /api/expense

**Status**: ✅ DONE

Logs an expense and deducts the amount from the specified account.

**Request Body**:
```json
{
  "accountId": "string (required)",
  "amount": "number (required, should be positive — 🐛 BUG #4: not validated)",
  "categoryId": "string (required)",
  "note": "string (required, may be empty)",
  "timestamp": "number (optional — 🐛 BUG #1: ignored, always uses current time)",
  "linkedCardId": "string (optional — 🐛 BUG #2: accepted but not stored)"
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
1. Fetch account → get `oldBalance`
2. Create transaction: `FromAccount = accountId`, `ToAccount = null`
3. Update account: `balance = oldBalance - amount`

---

### POST /api/income

**Status**: ✅ DONE

Logs income and adds the amount to the specified account.

**Request Body**:
```json
{
  "accountId": "string (required)",
  "amount": "number (required, should be positive — 🐛 BUG #4: not validated)",
  "categoryId": "string (required)",
  "note": "string (required, may be empty)",
  "timestamp": "number (optional — 🐛 BUG #1: ignored)",
  "linkedCardId": "string (optional — 🐛 BUG #2: accepted but not stored)"
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

**Business logic**: Same as expense but `balance = oldBalance + amount`. Transaction: `FromAccount = null`, `ToAccount = accountId`.

---

### POST /api/transfer

**Status**: ✅ DONE

Transfers an amount from one account to another.

**Request Body**:
```json
{
  "fromAccountId": "string (required)",
  "toAccountId": "string (required)",
  "amount": "number (required, should be positive — 🐛 BUG #4: not validated)",
  "timestamp": "number (optional — 🐛 BUG #1: ignored)"
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
  "timestamp": "number (optional — 🐛 BUG #1: ignored)"
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
- No pagination — returns all matching records (see backlog for cursor support)

---

### GET /api/income

**Status**: ✅ DONE

Same structure as `GET /api/expense`. Filters by `ToAccount is not empty` instead of `FromAccount`.
Date params and response shape are identical.
