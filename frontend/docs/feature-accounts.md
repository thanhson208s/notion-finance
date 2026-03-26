# Feature: Accounts

**Status**: ✅ DONE (backend + frontend, activation + creation added)

---

## Business Description

Accounts represent financial containers: cash wallets, bank accounts, credit cards, savings deposits, investments, and liabilities. Each account has a current balance. The system computes net worth by aggregating all account balances, separated into asset and liability buckets.

---

## Backend Implementation

### GET /api/accounts

**Handler**: `api/_handlers/account.handler.ts` → `getAccounts()`
**Connector**: `connector.fetchAllAccounts()`

**Logic**:
1. Fetch all account pages from `NOTION_ACCOUNT_DATABASE_ID`
2. Reduce over accounts:
   - `total` = sum of all balances
   - `totalOfAssets` = sum where `isAssetType(account.type) === true`
   - `totalOfLiabilities` = total − totalOfAssets
3. If any account has `linkedCardIds`, fetch all cards from `NOTION_CARD_DATABASE_ID` in a single extra Notion call and embed matching cards into each account's `cards[]` array. If no account has linked cards, the extra call is skipped.

**`cards` field behaviour**:
- `cards: []` — account has no linked cards (or `NOTION_CARD_DATABASE_ID` is not set)
- `cards: [{ id, name, imageUrl }]` — one or more linked cards; `imageUrl` can be `null` if the card has no Image property set
- The `imageUrl` field maps directly to the Card database's `Image` (URL property)

**Asset vs Liability classification** (`api/_lib/types/account.type.ts → isAssetType()`):

| Classification | AccountType values |
|---|---|
| Asset | `Cash, Prepaid, eWallet, Bank, Loan, Savings, Gold, Fund, Bond, Stock` |
| Liability | `Credit, Debt, Crypto, PayLater` |

> **Design note**: `Loan` is an asset (money you have lent out; you are owed it).
> `Crypto` is classified as a liability in the current implementation.

### Account Ranking (Priority Score)

Each account returned by `GET /api/accounts` includes a computed `priorityScore` field. This allows the frontend to sort accounts by usage frequency and recency.

**Notion columns** (must exist in the Account database):
- `Active` — checkbox. Whether the account is active. Defaults to `true` on creation. Inactive accounts are still returned by `GET /api/accounts` (with `active: false`); frontend should filter them from forms and selectors.
- `Note` — rich_text, optional. Free-text note about the account. Defaults to `""`.
- `Total Transactions` — number, nullable. Incremented on every expense/income write.
- `Last Transaction Date` — date, nullable. Set to the transaction timestamp on every expense/income write.

**Formula** (`api/_lib/types/account.type.ts → computePriorityScore()`):

```
priority_score = 0.4 * log(1 + total_transactions) + 0.6 * 0.5^(days_since / 30)
```

| Parameter | Value |
|---|---|
| `weight_frequency` | 0.4 |
| `weight_recency` | 0.6 |
| `decay_half_life_days` | 30 days |

**Edge cases:**
- `total_transactions = null` → treated as 0
- `last_transaction_date = null` → recency term omitted; score = `0.4 * log(1 + freq)` only
- Both null → `priority_score = 0` (unused account — appears last when sorted)

**Design notes:**
- `updateAccountAfterTransaction()` updates Balance, Total Transactions, and Last Transaction Date atomically in a single Notion `pages.update()` call.
- Only expense and income transactions increment the stats. Transfers and adjustments use `updateAccountBalance()` and do **not** affect ranking.
- `lastTransactionDate` is set to the request `timestamp` (when the transaction happened), not the API call time.

### POST /api/accounts?action=set-active

**Handler**: `api/_handlers/account.handler.ts` → `setAccountActive()`
**Connector**: `connector.updateAccountActive(accountId, active)`

Activates or deactivates an account. Deactivated accounts (`active: false`) should be hidden from forms and selectors on the frontend but are still returned by `GET /api/accounts`.

**Request body**: `{ accountId: string, active: boolean }`
**Response**: `{ accountId: string, active: boolean }`

### POST /api/accounts?action=create

**Handler**: `api/_handlers/account.handler.ts` → `createAccount()`
**Connector**: `connector.createAccount(name, type, note)`

Creates a new account in the Notion Account database. Initial `balance` is set to `0` and `active` to `true`.

**Request body**: `{ name: string, type: AccountType, note?: string }`
**Response**: full `Account` object

### POST /api/adjustment

**Handler**: `api/_handlers/account.handler.ts` → `adjustBalance()`

Sets an account to a target balance and creates an audit transaction for the difference. See [api-reference.md](./api-reference.md#post-apiadjustment) for full contract.

---

## Frontend Implementation

**Component**: `src/pages/AccountsPage.tsx` + `src/pages/AccountsPage.css`

### Features

- **Sticky pill header**: displays the current total balance formatted as VND
- **Filter toolbar**: All / Assets / Liabilities
- **Sort toolbar**:
  - *By Balance*: descending, zero-balance accounts sorted last
  - *By Group*: ordered by account type priority (see below)
- **Hide Empty Accounts**: toggle to hide accounts with `balance === 0`
- **Expandable account card**: tap to reveal action buttons
- **Action buttons per account**: Expense · Income · Transfer · Adjustment

### Type-to-Priority Mapping (Group Sort)

| Priority | AccountType |
|---|---|
| 0 | Cash |
| 1 | Bank |
| 2 | eWallet |
| 3 | Credit |
| 4 | Savings |
| 5 | PayLater |
| 6 | Prepaid |
| 7 | Gold |

> **Gap**: The frontend map covers 8 of 14 backend `AccountType` values. Types `Debt, Crypto, Loan, Fund, Bond, Stock` will cause runtime errors if returned by the backend, as they have no priority mapping.

### Navigation on Action Click

All action pages receive the account object via `location.state`:

| Action | Route |
|---|---|
| Expense | `/expense/:accountId` |
| Income | `/income/:accountId` |
| Transfer | `/transfer/:accountId` |
| Adjustment | `/adjustment/:accountId` |

---

## Known Issues

- 🐛 **Frontend AccountType map incomplete**: 6 backend types have no priority entry (see above)
- 🐛 **No pagination**: all accounts are fetched and rendered at once

## Backlog

- Account editing (name/type/note) from the UI
- Transaction history view per account
- Pagination for large account lists
