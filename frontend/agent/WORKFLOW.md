# Agent Workflow: Log Expense / Income

This document defines the exact, deterministic workflow for an AI agent (via Telegram bot) to receive transaction records from a user and log them via the Finance API.

---

## Constants

| Name | Value |
|------|-------|
| `ACCOUNTS_FILE` | `data/accounts.csv` |
| `CATEGORIES_FILE` | `data/categories.csv` |
| `CARDS_FILE` | `data/cards.csv` |
| `ACCOUNT_HINTS_FILE` | `data/account_hints.csv` |
| `CATEGORY_HINTS_FILE` | `data/category_hints.csv` |
| `CARD_HINTS_FILE` | `data/card_hints.csv` |
| `MSG_TX_MAP_FILE` | `data/msg_tx_map.csv` |
| `API_BASE` | `https://finance.gootube.online/api` |
| `TIMEZONE` | `Asia/Bangkok` (UTC+7) |
| `CURRENCY` | VND |
| `CACHE_TTL_HOURS` | `168` |
| `MAP_TTL_HOURS` | `72` |

---

## Workflow

### Step 1 — Receive Input

Accept text, image, or both. Forward all inputs directly to **Step 2**.

---

### Step 2 — Refresh Cache

```bash
npx tsx script/refreshCache.ts
```

Output: `{ success: true, refreshed: true|false }`

On error: **STOP** and report to the user.

---

### Step 3 — Load Cache and Hints

**Load Cache** (read only — `refreshCache` already ensured files are fresh):
- `ACCOUNTS_FILE` → list of `{ id, name, type, balance, priorityScore }`
- `CATEGORIES_FILE` → list of `{ id, name, type, parentId, note }`
- `CARDS_FILE` → list of `{ id, accountId, name, number }`

**Load Hints**:
- Read `ACCOUNT_HINTS_FILE` → list of `{ hint, accountId }`. If file does not exist, use empty list.
- Read `CATEGORY_HINTS_FILE` → list of `{ hint, categoryId }`. If file does not exist, use empty list.
- Read `CARD_HINTS_FILE` → list of `{ hint, cardId }`. If file does not exist, use empty list.

---

### Step 4 — Unified Inference

Using all of the following as a **single unified context**, infer all required fields in one pass:
- Input: text and/or image from the user
- `accounts[]` from cache: `{ id, name, type, balance, priorityScore, cards: [{ id, name, number }] }`
- `categories[]` from cache: `{ id, name, type, parentId, note }`
- `accountHints[]` from hints: `{ hint, accountId }`
- `categoryHints[]` from hints: `{ hint, categoryId }`

**Output all 9 fields simultaneously:**

| Field | Type | Rules |
|-------|------|-------|
| `amount` | positive integer (VND) | Parse from input. Strip `₫`, `VND`, `,`, `.`. Round to integer. Must be > 0. |
| `accountId` | string | Apply account priority rules below. |
| `accountRef` | string | Key word(s) from the input that led to the account match (e.g. "vcb", "momo"). Max 20 words. Store only terms the agent considered decisive — omit filler words. Stored for hints learning. |
| `categoryId` | string | Apply category priority rules below. `type` is derived from the matched category. |
| `categoryRef` | string | Key word(s) or phrase(s) from the input that led to the category match (e.g. "coffee", "grab lunch", "xăng xe"). Max 20 words. Store only terms the agent considered decisive — omit filler words. Stored for hints learning. |
| `cardId` | string \| null | Optional. Apply card priority rules below. `null` if no card mentioned or matched. |
| `cardRef` | string \| null | Optional. Key word(s)/digits from input that matched the card (e.g. "9999", "visa 9999"). Max 20 words. `null` if `cardId` is null. |
| `note` | string | Full transaction description from input. Preserve original wording. |
| `timestamp` | Unix ms | Extract date/time from input if present (e.g. "hôm qua 3pm", "12/03 10:30", receipt timestamp); convert to Unix ms in `TIMEZONE`. Default: `Date.now()`. Never omit. |

**Account priority rules** (apply in strict order, stop at first match):

| Priority | Rule | Action |
|----------|------|--------|
| 1 | Find a row in `accountHints` where `hint` matches any account-related word in input (case-insensitive) | Use that `accountId` |
| 2 | Find an account where `account.name` exactly equals an account-related word in input (case-insensitive) | Use that `account.id` |
| 3 | Find accounts where an input word is a substring of `account.name` or vice versa (case-insensitive) | Collect all matches; pick the one with highest `priorityScore` |
| 4 | No match | Fail with: `"Cannot find account matching '{input reference}'. Check spelling or update hints."` |

**Category priority rules** (apply in strict order, stop at first match; search across ALL categories):

| Priority | Rule | Action |
|----------|------|--------|
| 1 | Find a row in `categoryHints` where `hint` exactly equals any word in input (case-insensitive) | Use that `categoryId` |
| 2 | Semantic note match: input semantically relates to `category.note` using common-sense reasoning (only when `category.note` is non-empty; e.g. "grab a coffee" matches a category whose note says "coffee, tea, beverages") | Collect all matches |
| 3 | Any input word exactly equals `category.name` (case-insensitive) | Collect all matches |
| 4 | Any input word is a substring of `category.name` word or vice versa (case-insensitive) | Collect all matches |
| 5 | No match | Fail with: `"Cannot determine category from the description. Please specify the category name."` |

**Category tie-breaking** (when multiple matches at the same priority level):
1. Prefer subcategory (`parentId != null`) over top-level (`parentId == null`)
2. If still tied → pick first alphabetically by `category.name`

**Card priority rules** (apply in strict order; only search cards within `matchedAccount.cards[]`):

| Priority | Rule | Action |
|----------|------|--------|
| 1 | Find a row in `cardHints` where `hint` matches any word in input (case-insensitive) | Use that `cardId` |
| 2 | Last 4 digits in input match `card.number` last 4 characters | Use that `cardId` |
| 3 | First 6 digits in input match `card.number` first 6 characters | Use that `cardId` |
| 4 | Any word in input matches `card.name` (case-insensitive, partial match OK) | Use that `cardId` |
| 5 | No card reference found in input | `cardId = null`, `cardRef = null` |

**Note**: `cardId = null` is valid — it does NOT trigger a clarification message.

**After all fields are inferred**, proceed to **Step 5** — pass all results (including nulls for unresolved fields) to the `logTransaction` script.

---

### Step 5 — Log Transaction

```bash
npx tsx agent/script/logTransaction.ts '<json>'
```

Input — pass null for any field that could not be confidently determined:
```json
{
  "accountId": "... | null",
  "accountName": "... | null",
  "amount": 50000,
  "categoryId": "... | null",
  "categoryName": "... | null",
  "note": "... | null",
  "timestamp": 1710000000000,
  "cardId": "... | null",
  "cardName": "... | null",
  "cardNumber": "... | null",
  "accountRef": "...",
  "categoryRef": "...",
  "cardRef": "... | null"
}
```

Output:
- Unclear fields detected: `{ success: true, clarificationSent: true }`.
- All fields confident, API success: `{ success: true, telegramMessageId }`.
- All fields confident, API failure: `{ success: false, error: "..." }` (exit code 1).

---

### Step 7 — Handle Accept / Reject Callback

**On `[✅ Accept]`:**

```bash
npx tsx agent/script/onAccept.ts '{"telegramMessageId": <id>}'
```

Output: `{ success: true, transactionId }`

**On `[❌ Reject]`:**

```bash
npx tsx agent/script/onReject.ts '{"telegramMessageId": <id>}'
```

Output: `{ success: true, transactionId }`

---

## API Reference

### POST /api/expense

Logs an expense. Deducts `amount` from the account.

**Request body:**
```json
{
  "accountId": "string (required)",
  "amount": "number (required, integer > 0)",
  "categoryId": "string (required)",
  "note": "string (required, may be empty string)",
  "timestamp": "number (optional, Unix ms — defaults to server time if omitted)",
  "linkedCardId": "string (optional)"
}
```

**Response 200:**
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

---

### POST /api/income

Logs income. Adds `amount` to the account.

**Request body:** identical to `POST /api/expense`.

**Response 200:** identical shape to `POST /api/expense`.

---

### Error Response Shape

All error responses follow this format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

| HTTP Status | Meaning |
|-------------|---------|
| 400 | Bad request (missing/invalid param) |
| 403 | Forbidden (permission error) |
| 404 | Not found |
| 409 | Conflict |
| 429 | Rate limited |
| 500 | Internal server error |
| 503 | Service unavailable |

---

## File Formats

### CSV cache files

Each file uses standard CSV with a header row. The first data column is always `updatedAt` (ISO 8601 with timezone offset) used for TTL checking. Overwrite the entire file when refreshing — do not merge.

**`data/accounts.csv`**
```
updatedAt,id,name,type,balance,priorityScore
2026-03-17T10:00:00+07:00,abc123,Cash,Cash,1000000,0.85
2026-03-17T10:00:00+07:00,def456,MoMo,eWallet,500000,0.62
```

**`data/categories.csv`**
```
updatedAt,id,name,type,parentId,note
2026-03-17T10:00:00+07:00,xyz,Food & Drink,Expense,null,"meals, restaurant, street food, takeaway"
2026-03-17T10:00:00+07:00,uvw,Dining Out,Expense,xyz,
2026-03-17T10:00:00+07:00,rst,Salary,Income,null,"monthly pay, base salary, payroll"
```

**`data/cards.csv`**
```
updatedAt,id,accountId,name,number
2026-03-17T10:00:00+07:00,card-1,abc123,Vietcombank Visa,415231*****9999
2026-03-17T10:00:00+07:00,card-2,def456,MB Black,123456*****1234
```

Rules:
- `updatedAt` is repeated on every data row and is the same value for all rows in a refresh batch.
- `parentId` stores the literal string `null` when the category has no parent.
- `note` and `name` fields that contain commas must be quoted.
- `cards.csv` is flattened from `accounts[].cards[]`; include `accountId` for each card row.

---

### Hint CSV files

Three separate files, each with a two-column header row.

**`data/account_hints.csv`**
```
hint,accountId
vcb,abc123
momo,def456
```

**`data/category_hints.csv`**
```
hint,categoryId
grab,uvw
coffee,xyz
lunch,uvw
```

**`data/card_hints.csv`**
```
hint,cardId
visa,card-1
black,card-2
```

Rules:
- Each `hint` is a single lowercase word (no spaces, no punctuation).
- No duplicate rows (same `hint` + same `id`).
- If a conflicting row exists (same `hint`, different `id`) → replace with the new `id` (upsert).
- Only update these files on **Accept** (Step 6). Never on Reject.

---

### `data/msg_tx_map.csv`

```
messageId,transactionId,type,amount,accountId,categoryId,cardId,accountRef,categoryRef,cardRef,note,timestamp,lastModified
123456789,notion-page-id-abc,Expense,50000,acc-id-1,cat-id-2,card-1,momo,coffee grab,visa 9999,"Grab a coffee at Highland",1710000000000,1710000001000
987654321,notion-page-id-xyz,Expense,30000,acc-id-1,cat-id-3,-,momo,lunch,-,Bún bò,1710003600000,1710003601000
```

Rules:
- Append new rows when logging a transaction (Step 5a).
- `messageId` is the Telegram message ID of the confirmation message.
- `transactionId` is the Notion page ID returned in the API response.
- `cardId`, `cardRef`: use `-` when no card was matched.
- `accountRef`, `categoryRef`, `cardRef` are the key terms from Step 3 (max 20 words each).
- `timestamp` is Unix milliseconds of the transaction time (sent in the API request).
- `lastModified` is `Date.now()` (Unix ms) at the time the row was written.
- On **Accept** (Step 6): rewrite the file keeping only rows where `messageId` is not the accepted ID AND `Date.now() - lastModified < MAP_TTL_HOURS * 3600000`.
