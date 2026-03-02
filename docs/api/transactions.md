# API — Transactions

Base URL: `https://finance.gootube.online/api`

---

## POST /api/expense

Records an expense: decreases account balance, creates a transaction with `fromAccountId` set. Handler: `transaction.handler.ts → logExpense`.

**Request fields**: `accountId`, `amount`, `categoryId`, `note` (required, may be empty string), `timestamp` + `linkedCardId` (optional, not yet used).

**Response fields**: `accountId`, `oldBalance`, `newBalance`, `amount`, `categoryId`, `note`.

---

## POST /api/income

Records income: increases account balance, creates a transaction with `toAccountId` set. Handler: `transaction.handler.ts → logIncome`.

**Request / Response**: same field shapes as `/expense`.

---

## POST /api/transfer

Transfers an amount between two accounts: decreases `fromAccount`, increases `toAccount`, creates one transaction. Handler: `transaction.handler.ts → transferBalance`.

**Request fields**: `fromAccountId`, `toAccountId`, `amount`. No `note` or `categoryId` — the backend uses `NOTION_TRANSFER_TRANSACTION_ID` automatically.

**Response fields**: `fromAccountId`, `toAccountId`, old/new balance for each account, `amount`.

---

## GET /api/expense · GET /api/income *(stubs)*

Not yet implemented. Both accept `startDate` and `endDate` query params but ignore them and return `{ transactions: [], total: 0 }`.

---

## Error Response Format

`{ success: false, error: { code, message } }`

| Code | HTTP | When |
|---|---|---|
| `SCHEMA_ERROR` | 500 | Notion property wrong type or missing |
| `QUERY_ERROR` | 400 | Bad request query parameter |
| `DATABASE_ERROR` | 500 | Notion page not found or update failed |
| `NOT_FOUND` | 404 | Route does not exist |
| Notion error codes | varies | Forwarded from Notion SDK |
