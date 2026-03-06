# Database Schema (Notion)

All databases exist as Notion databases created via the Notion UI.
The backend only queries and updates records — it never creates or modifies schema.

> **Important**: Notion property names are case-sensitive and must match exactly.
> The Connector (`src/utils/connector.ts`) uses these names as string literals.

---

## 1. Account Database

**ENV**: `NOTION_ACCOUNT_DATABASE_ID`

| Notion Property | Notion Type | TypeScript Type | Notes |
|---|---|---|---|
| `Name` | Title | `string` | Display name of the account |
| `Balance` | Number | `number` | Current balance in VND |
| `Type` | Select | `AccountType` | See enum below |
| `linkedCards` | Relation | _(not used)_ | Relation to Card database |

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
| `Type` | Select | `CategoryType` | `Income \| Expense \| Financial` |
| `Parent item` | Relation | `string \| null` | Self-referential for subcategories |

> **Note**: The property key is exactly `"Parent item"` — with a space and lowercase `i`.
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
| `Linked card` | Relation | `string \| null` | Relation to Card DB; accepted in API but never written (🐛 BUG #2) |

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

**ENV**: _(no dedicated env var — feature not yet implemented)_

| Notion Property | Notion Type | TypeScript Type | Notes |
|---|---|---|---|
| `Name` | Title | `string` | Card display name |
| `annualFee` | Number | `number` | Annual fee in VND |
| `linkedAccount` | Relation | `string` | Relation to Account DB |

**Status**: Schema defined in Notion UI. No backend handler implemented.
See [feature-cards.md](./feature-cards.md).
