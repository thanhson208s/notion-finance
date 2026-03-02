# API — Accounts

Base URL: `https://finance.gootube.online/api`

---

## GET /api/accounts

Returns all accounts with aggregated balance totals. Handler: `account.handler.ts → getAccounts`.

**Response fields**: `accounts[]` (id, name, type, balance), `total` (sum of all balances), `totalOfAssets`, `totalOfLiabilities`.

- Assets: Cash, Prepaid, eWallet, Bank, Loan, Savings, Gold, Fund, Bond, Stock
- Liabilities: Debt, Crypto, Credit, PayLater

---

## POST /api/adjustment

Sets an account balance to an exact target value and records the difference as a transaction. Handler: `account.handler.ts → adjustBalance`.

**Request fields**: `accountId`, `balance` (target — not a delta), `note`, `timestamp` (optional).

**Response fields**: `accountId`, `oldBalance`, `newBalance`, `delta` (absolute difference), `note`.
