# Database Schema (Notion)

All databases exist as Notion databases created via the Notion UI.
The backend only queries and updates records — it never creates or modifies schema.

> **Important**: Notion property names are case-sensitive and must match exactly.
> The Connector (`api/_lib/connector.ts`) uses these names as string literals.

---

## 1. Account Database

**ENV**: `NOTION_ACCOUNT_DATABASE_ID`

| Notion Property | Notion Type | TypeScript Type | Notes |
|---|---|---|---|
| `Name` | Title | `string` | Display name of the account |
| `Balance` | Number | `number` | Current balance in VND |
| `Type` | Select | `AccountType` | See enum below |
| `Active` | Checkbox | `boolean` | `false` for deactivated accounts |
| `Note` | Rich text | `string` | Optional free-text note; `""` if not set |
| `Linked cards` | Relation | `string[]` | Relation to Card database — all linked card IDs returned in `GET /api/accounts` |
| `Total Transactions` | Number | `number \| null` | Count of expense/income transactions; incremented by `POST /transactions?type=expense` and `POST /transactions?type=income`. Null for unused accounts. |
| `Last Transaction Date` | Date | `number \| null` (epoch ms) | Date of the most recent expense/income; set to request `timestamp` on each write. Null for unused accounts. |

> **Note**: `Total Transactions` and `Last Transaction Date` are used to compute `priorityScore` in `GET /api/accounts`. They are **not** updated by transfers or adjustments.

### AccountType Enum

```
Cash | Prepaid | eWallet | Bank | Debt | Crypto | Loan | Savings
Gold | Credit  | Fund    | Bond | Stock | PayLater
```

Asset types (positive net worth contribution): `Cash, Prepaid, eWallet, Bank, Loan, Savings, Gold, Fund, Bond, Stock`

Liability types (negative net worth contribution): `Credit, Debt, Crypto, PayLater`

---

## 2. Category Database

**ENV**: `NOTION_CATEGORY_DATABASE_ID`

| Notion Property | Notion Type | TypeScript Type | Notes |
|---|---|---|---|
| `Name` | Title | `string` | Category display name |
| `Type` | Select | `CategoryType` | `Income \| Expense \| System` |
| `Parent item` | Relation | `string \| null` | Self-referential for subcategories |
| `Note` | Rich text | `string` | Optional description of what the category covers (e.g. keywords, examples). Used by AI agents for semantic category inference. Returns `""` if not set. |

> **Note**: The property key is exactly `"Parent item"` — with a space and lowercase `i`.
> The `Note` property is optional — if absent from the Notion database, the field defaults to `""`.
> This is a Notion-generated name for self-referential relations.

### Special System Categories

These are Category **page IDs** (not database IDs) that must be created in the Category database via Notion UI, then configured as environment variables:

| ENV Variable | Purpose |
|---|---|
| `NOTION_TRANSFER_TRANSACTION_ID` | Category assigned to all transfer transactions |
| `NOTION_ADJUSTMENT_TRANSACTION_ID` | Category assigned to all balance adjustment transactions |

---

## 3. Transaction Database

**ENV**: `NOTION_TRANSACTION_DATABASE_ID`

| Notion Property | Notion Type | TypeScript Type | Notes |
|---|---|---|---|
| `ID` | Title | `string` | Auto-generated: `{categoryId}-{epochMs}-{amount}` |
| `Timestamp` | Date | `number` (epoch ms) | Written in Asia/Bangkok timezone; always set to current time (🐛 BUG #1) |
| `Amount` | Number | `number` | Always positive |
| `FromAccount` | Relation | `string \| null` | Relation to Account DB; set for expense/transfer |
| `ToAccount` | Relation | `string \| null` | Relation to Account DB; set for income/transfer |
| `Category` | Relation | `string` | Relation to Category DB; required |
| `Note` | Rich Text | `string` | User-provided description |
| `Linked card` | Relation | `string \| null` | Relation to Card DB; written to Notion when `linkedCardId` provided in request |
| `Cashback` | Number | `number \| null` | Cashback earned on this transaction (credit card rewards) |
| `Discount` | Number | `number \| null` | Discount applied on this transaction |

> **Note**: The property key is `"Linked card"` — with a space and lowercase `c`.

### Transaction Semantics

| Transaction Type | `FromAccount` | `ToAccount` | Balance Effect |
|---|---|---|---|
| Expense | `accountId` | `null` | `account -= amount` |
| Income | `null` | `accountId` | `account += amount` |
| Transfer | `fromAccountId` | `toAccountId` | `from -= amount`, `to += amount` |
| Adjustment (decrease) | `accountId` | `null` | `account = targetBalance` |
| Adjustment (increase) | `null` | `accountId` | `account = targetBalance` |

---

## 4. Card Database

**ENV**: `NOTION_CARD_DATABASE_ID`

| Notion Property | Notion Type | TypeScript Type | Notes |
|---|---|---|---|
| `Name` | Title | `string` | Card display name |
| `Number` | Rich text | `string` | Masked card number (e.g. `415231*****9999`). `""` if not set. |
| `Image` | Files | `string` | Vercel Blob public URL of the card image. `""` if not set. |
| `Annual Fee` | Number | `number \| null` | Annual fee in VND |
| `Spending Limit` | Number | `number \| null` | Credit limit in VND |
| `Required Spending` | Number | `number \| null` | Minimum spend required to unlock benefits |
| `Last Charged Date` | Date | `number \| null` | Epoch ms of last annual fee charge |
| `Billing Day` | Number | `number \| null` | Day of month the billing cycle resets (1–31). `null` for debit cards. |
| `Linked Account` | Relation | `string \| null` | Relation to Account DB |
| `Linked Services` | Multi-select | `string[]` | Services linked to this card (e.g. streaming, travel) |
| `Cashback Cap` | Number | `number \| null` | Maximum cashback per billing cycle in VND |
| `Network` | Select | `string \| null` | Card network (e.g. `Visa`, `Mastercard`) |

**Status**: Served via `GET /api/cards`.
See [feature-cards.md](./feature-cards.md).

---

## 5. Snapshot Database

**ENV**: `NOTION_SNAPSHOT_DATABASE_ID`

| Notion Property | Notion Type | TypeScript Type | Notes |
|---|---|---|---|
| `Name` | Title | `string` | Auto-generated: `[account name]-[DD]-[MM]-[YYYY]` e.g. `Cash-01-02-2026` |
| `Account` | Relation | `string` | Relation to Account database (single) |
| `Date` | Date | `number` (epoch ms) | `00:00:00+07:00` (Bangkok midnight) on the day of the snapshot |
| `Balance` | Number | `number` | Calculated balance: previous snapshot balance + transaction delta since last snapshot |

> **First snapshot**: Must be created manually in Notion. Subsequent monthly snapshots are created automatically by the cron job.
>
> **Skip rule**: Accounts with no prior snapshot, or no transactions since the last snapshot, are not snapshotted.

See [feature-snapshots.md](./feature-snapshots.md).

---

## 6. Archive Database

**ENV**: `NOTION_ARCHIVE_DATABASE_ID`

Each page in this database represents one calendar month of archived transactions. The page contains an inline child database (created programmatically) that holds the actual moved transaction records.

| Notion Property | Notion Type | TypeScript Type | Notes |
|---|---|---|---|
| `Name` | Title | `string` | Auto-generated: `[MM]-[YYYY]` e.g. `11-2025` |
| `Month` | Number | `number` | Calendar month (1–12) |
| `Year` | Number | `number` | Calendar year e.g. `2025` |
| `Count` | Number | `number` | Total number of archived transactions in this page |
| `Debit` | Number | `number` | Sum of `amount` for transactions where `FromAccount` is set (expense/transfer-out) |
| `Credit` | Number | `number` | Sum of `amount` for transactions where `ToAccount` is set (income/transfer-in) |
| `Transactions DB` | Rich text | `string` | Notion database ID of the inline child Transaction DB created under this page |

> **Inline child DB**: Created via `databases.create` with `parent: { type: 'page_id', page_id: archivePageId }`. Its schema mirrors the main Transaction DB.
>
> **Archive cutoff**: Transactions older than 3 calendar months from the current date (midnight UTC) are eligible for archiving.
>
> **Idempotency**: `fetchArchive(month, year)` checks for an existing archive page before creating a new one — re-running the cron safely re-uses existing pages.

See [feature-archive.md](./feature-archive.md).

---

## 7. Promotion Database

**ENV**: `NOTION_PROMOTION_DATABASE_ID`

| Notion Property | Notion Type | TypeScript Type | Notes |
|---|---|---|---|
| `Name` | Title | `string` | Promotion display name |
| `Card` | Relation | `string \| null` | Relation to Card DB (single); `null` for card-agnostic promotions |
| `Category` | Select | `PromotionCategory \| null` | `Shopping \| F&B \| Travel \| Entertain \| Digital` |
| `Type` | Select | `PromotionType` | `Cashback \| Discount` (required) |
| `Expiry Date` | Date | `number \| null` | Epoch ms of promotion expiry |
| `Link` | URL | `string \| null` | Source link or T&C URL |

---

## 8. Statement Database

**ENV**: `NOTION_STATEMENT_DATABASE_ID`

Each record represents a billing statement for a card, with spending totals computed at creation time from transactions in the given date range.

| Notion Property | Notion Type | TypeScript Type | Notes |
|---|---|---|---|
| `Name` | Title | `string` | Auto-generated: `stmt-{cardId}-{startDate}-{endDate}` |
| `Card` | Relation | `string` | Relation to Card DB (required) |
| `Start Date` | Date | `number` (epoch ms) | Statement period start; stored as `YYYY-MM-DDT00:00:00+07:00` |
| `End Date` | Date | `number` (epoch ms) | Statement period end; stored as `YYYY-MM-DDT23:59:59+07:00` |
| `Spending` | Number | `number` | Sum of expense amounts linked to this card in the period |
| `Cashback` | Number | `number` | Sum of cashback from linked transactions in the period |
| `Discount` | Number | `number` | Sum of discounts from linked transactions in the period |

> **Computed at creation**: `Spending`, `Cashback`, and `Discount` are calculated server-side from the Transaction DB at `POST /api/statements` time — they are not live-computed values.
