# Agent Workflow: Log Expense / Income

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
| `TIMEZONE` | `Asia/Bangkok` (UTC+7) |

---

## Workflow

### Step 1 — Refresh Cache

```bash
npx tsx script/refreshCache.ts
```

Output: `{ success: true, refreshed: true|false }`

On error: **STOP** and report to the user.

---

### Step 2 — Load Cache and Hints

**Load Cache** (read only — `refreshCache` already ensured files are fresh):
- `ACCOUNTS_FILE` → list of `{ id, name, type, balance, priorityScore }`
- `CATEGORIES_FILE` → list of `{ id, name, type, parentId, note }`
- `CARDS_FILE` → list of `{ id, accountId, name, number }`

**Load Hints**:
- Read `ACCOUNT_HINTS_FILE` → list of `{ type, hint, accountId }`. If file does not exist, use empty list.
- Read `CATEGORY_HINTS_FILE` → list of `{ type, hint, categoryId }`. If file does not exist, use empty list.
- Read `CARD_HINTS_FILE` → list of `{ type, hint, cardId }`. If file does not exist, use empty list.

---

### Step 3 — Unified Inference

Infer all 9 fields simultaneously from the user input + loaded cache and hints:

| Field | Type | Rules |
|-------|------|-------|
| `amount` | positive integer (VND) | Parse from input. Strip `₫`, `VND`, `,`, `.`. Round to integer. Must be > 0. |
| `accountId` | string | Apply account priority rules below. |
| `accountRef` | string | `\|`-delimited `type:phrase` items that matched the account. `type` is `text` (from message/image text) or `visual` (image visual descriptor). Each item is stored as one hint row. e.g. `text:vcb\|visual:blue store logo` |
| `categoryId` | string | Apply category priority rules below. `type` derived from matched category. |
| `categoryRef` | string | Same `type:phrase\|...` format. e.g. `text:coffee\|visual:green cup logo` |
| `cardId` | string \| null | Apply card priority rules below. `null` if no card mentioned or matched. |
| `cardRef` | string \| null | Same `type:phrase\|...` format. `null` if `cardId` is null. |
| `note` | string | Reason or purpose of the transaction only. Exclude amount, account, card, date/time, and any other already-structured fields. |
| `timestamp` | Unix ms | Extract date/time from input if present; convert to Unix ms in `TIMEZONE`. Default: `Date.now()`. |

**Account priority rules** (apply in strict order, stop at first match):

| Priority | Rule | Action |
|----------|------|--------|
| 1 | Find a row in `accountHints` where: `type=text` → `hint` matches any text word in input; `type=visual` → `hint` matches any visual descriptor from the image (case-insensitive) | Use that `accountId` |
| 2 | Find an account where `account.name` exactly equals an account-related word in input (case-insensitive) | Use that `account.id` |
| 3 | Find accounts where an input word is a substring of `account.name` or vice versa (case-insensitive) | Collect all matches; pick the one with highest `priorityScore` |
| 4 | No match | Fail with: `"Cannot find account matching '{input reference}'. Check spelling or update hints."` |

**Category priority rules** (apply in strict order, stop at first match; search across ALL categories):

| Priority | Rule | Action |
|----------|------|--------|
| 1 | Find a row in `categoryHints` where: `type=text` → `hint` exactly equals any text word in input; `type=visual` → `hint` matches any visual descriptor from the image (case-insensitive) | Use that `categoryId` |
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
| 1 | Find a row in `cardHints` where: `type=text` → `hint` matches any text word in input; `type=visual` → `hint` matches any visual descriptor from the image (case-insensitive) | Use that `cardId` |
| 2 | Last 4 digits in input match `card.number` last 4 characters | Use that `cardId` |
| 3 | First 6 digits in input match `card.number` first 6 characters | Use that `cardId` |
| 4 | Any word in input matches `card.name` (case-insensitive, partial match OK) | Use that `cardId` |
| 5 | No card reference found in input | `cardId = null`, `cardRef = null` |

**Note**: `cardId = null` is valid — it does NOT trigger a clarification message.

---

### Step 4 — Log Transaction

```bash
npx tsx script/logTransaction.ts '<json>'
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

### Step 5 — Handle Accept / Reject Callback

**On `[✅ Accept]`:** Extract telegram message id and run this

```bash
npx tsx script/onAccept.ts '<telegramMessageId>'
```

Output: `{ success: true, transactionId }`

**On `[❌ Reject]`:** Extract telegram message id and run this

```bash
npx tsx script/onReject.ts '<telegramMessageId>'
```

Output: `{ success: true, transactionId }`
