# AGENTS.md

## Session Startup

1. Read `SOUL.md`
2. Read `USER.md` if it exists

## Memory

No mental notes — files only. Write to `memory/YYYY-MM-DD.md` if anything needs to be remembered across sessions.

## Red Lines

- No destructive commands without asking.
- No exfiltrating private data.

## Group Chat

Stay silent unless:
- Directly mentioned or asked
- A transaction or callback was detected (→ execute workflow)

One response per message. No fragments.

**Formatting:** No markdown tables — use bullet lists.

## Trigger Rules

| Input type | Action |
|------------|--------|
| Transaction (expense, income, payment, purchase) | Execute workflow Step 1 → 4 |
| Inline button callback (Accept / Reject) | Execute workflow Step 5 |
| Anything else | Respond conversationally, briefly |

---

## Workflow: Log Transaction

### Constants

| Name | Value |
|------|-------|
| `ACCOUNTS_FILE` | `data/accounts.csv` |
| `CATEGORIES_FILE` | `data/categories.csv` |
| `CARDS_FILE` | `data/cards.csv` |
| `ACCOUNT_HINTS_FILE` | `data/account_hints.csv` |
| `CATEGORY_HINTS_FILE` | `data/category_hints.csv` |
| `TIMEZONE` | `Asia/Bangkok` (UTC+7) |

---

### Step 1 — Refresh Cache

```bash
npx tsx script/refreshCache.ts
```

Output: `{ success: true, refreshed: true|false }`

On error: **STOP** and report to user.

---

### Step 2 — Load Cache and Hints

**Cache** (read-only):
- `ACCOUNTS_FILE` → `{ id, name, type, balance, priorityScore }`
- `CATEGORIES_FILE` → `{ id, name, type, parentId, note }`
- `CARDS_FILE` → `{ id, accountId, name, number }`

**Hints** (empty list if file missing):
- `ACCOUNT_HINTS_FILE` → `{ type, hint, accountId, cardId }`
- `CATEGORY_HINTS_FILE` → `{ type, hint, categoryId, note }`

---

### Step 3 — Unified Inference

Infer all 9 fields simultaneously from input + cache + hints:

| Field | Type | Rules |
|-------|------|-------|
| `amount` | positive integer (VND) | Strip `₫`, `VND`, `,`, `.`. Round to integer. Must be > 0. |
| `accountId` | string | Account priority rules below. |
| `accountRef` | string | `\|`-delimited `type:phrase` items that matched the account. `type` = `text` (message/image text) or `visual` (image visual descriptor). e.g. `text:vcb\|visual:blue store logo` |
| `categoryId` | string | Category priority rules below. |
| `categoryRef` | string | Same `type:phrase\|...` format. |
| `cardId` | string \| null | Card priority rules below. `null` if no card. |
| `cardRef` | string \| null | Same format. `null` if `cardId` is null. |
| `note` | string | Reason/purpose only. Exclude amount, account, card, date/time. |
| `timestamp` | string `dd/mm/yyyy HH:mm` | Extract **only what is explicitly stated** in the input. Use `--` for any day/month/hour/minute not mentioned, `----` for year not mentioned. **Never infer, assume, or default to "now".** e.g. input has date only → `18/03/---- --:--`; input has time only → `--/--/---- 20:24`; input has both → `18/03/2026 20:24`; input has neither → `--/--/---- --:--`. Never omit the field. |

**Account priority** (stop at first match):

| # | Rule | Action |
|---|------|--------|
| 1 | `accountHints` row: `type=text` → hint matches input word; `type=visual` → hint matches image descriptor (case-insensitive) | Use that `accountId` |
| 2 | `account.name` exactly equals an account word in input (case-insensitive) | Use that `account.id` |
| 3 | Input word is substring of `account.name` or vice versa (case-insensitive) | Pick highest `priorityScore` |
| 4 | No match | Fail: `"Cannot find account matching '{ref}'. Check spelling or update hints."` |

**Category priority** (stop at first match; search ALL categories):

| # | Rule | Action |
|---|------|--------|
| 1 | `categoryHints` row: `type=text` → hint exactly equals input word; `type=visual` → hint matches image descriptor | Use that `categoryId` |
| 2 | Input semantically relates to `category.note` (only when note non-empty) | Collect matches |
| 3 | Input word exactly equals `category.name` (case-insensitive) | Collect matches |
| 4 | Input word is substring of `category.name` or vice versa | Collect matches |
| 5 | No match | Fail: `"Cannot determine category. Please specify the category name."` |

**Category tie-breaking:** prefer subcategory (`parentId != null`) > top-level; if still tied → first alphabetically.

**Card priority** (search only within `matchedAccount.cards[]`):

| # | Rule | Action |
|---|------|--------|
| 1 | `accountHints` row where `cardId != '-'`: hint matches input word or image descriptor | Use `cardId` and `accountId` from that row |
| 2 | Last 4 digits in input match `card.number` last 4 | Use that `cardId` |
| 3 | First 6 digits in input match `card.number` first 6 | Use that `cardId` |
| 4 | Input word matches `card.name` (case-insensitive, partial OK) | Use that `cardId` |
| 5 | No card reference | `cardId = null`, `cardRef = null` |

`cardId = null` is valid — no clarification needed.

---

### Step 4 — Log Transaction

```bash
npx tsx script/logTransaction.ts '<json>'
```

Pass `null` for any field not confidently determined:

```json
{
  "accountId": "...|null",
  "accountName": "...|null",
  "amount": 50000,
  "categoryId": "...|null",
  "categoryName": "...|null",
  "note": "...|null",
  "timestamp": "18/03/2026 20:24",
  "cardId": "...|null",
  "cardName": "...|null",
  "cardNumber": "...|null",
  "accountRef": "...",
  "categoryRef": "...",
  "cardRef": "...|null"
}
```

Outputs:
- Unclear fields: `{ success: true, clarificationSent: true }`
- All confident, API success: `{ success: true, telegramMessageId }`
- All confident, API failure: `{ success: false, error: "..." }` (exit code 1)

---

### Step 5 — Handle Accept / Reject Callback

**On `[✅ Accept]`:** Extract telegram message id and run:

```bash
npx tsx script/onAccept.ts '<telegramMessageId>'
```

Output: `{ success: true, transactionId }`

**On `[❌ Reject]`:** Extract telegram message id and run:

```bash
npx tsx script/onReject.ts '<telegramMessageId>'
```

Output: `{ success: true, transactionId }`
