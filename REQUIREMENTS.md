# Requirements — Notion Finance

Personal finance management app. React frontend + API layer, both deployed on Vercel,
using Notion as the database.

---

## System Architecture

```
Vercel (finance.gootube.online)
  ├── /api/*  →  Node.js Serverless Functions (api/*.ts)  →  Notion API
  └── /*      →  React Frontend (Vite build)
```

- **Vercel**: single deployment serves both the frontend and API — no separate infrastructure
- **API**: Node.js serverless functions in `api/*.ts`; same-origin requests, no auth layer needed
- **Notion API**: Acts as the sole database layer — tables are created via the Notion UI; the backend only queries and updates records
- **Frontend**: React 19 + Vite + TypeScript, co-deployed with the API

Full infrastructure details: see [`docs/architecture.md`](./docs/architecture.md)

---

## Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict mode) |
| Runtime | Vercel Node.js serverless functions |
| Deployment | Vercel CLI (`vercel --prod`) |
| Database | Notion (via `@notionhq/client`) |
| Frontend | React 19 + Vite (same repo, same deployment) |

---

## Database Schema

Four Notion databases. Full schema with property names and types: [`docs/database-schema.md`](./docs/database-schema.md)

| Database | Key Fields |
|---|---|
| **Account** | `id`, `name`, `balance` (Number), `type` (Select) |
| **Category** | `id`, `name`, `type` (Select: Income/Expense/System), `parentId` (Relation, self-referential) |
| **Transaction** | `id`, `timestamp` (Date), `amount` (Number), `fromAccount` (Relation), `toAccount` (Relation), `category` (Relation), `note` (Text), `linkedCard` (Relation) |
| **Card** | `id`, `name`, `annualFee` (Number), `linkedAccount` (Relation) |

---

## Functional Requirements

### Phase 1 — Core (Current)

| # | Feature | Status |
|---|---|---|
| F-01 | List all accounts with balance aggregation (total, assets, liabilities) | ✅ Done |
| F-02 | Log an expense transaction and update the account balance | ✅ Done |
| F-03 | Log an income transaction and update the account balance | ✅ Done |
| F-04 | Transfer an amount between two accounts | ✅ Done |
| F-05 | Adjust an account to a target balance with an audit transaction | ✅ Done |
| F-06 | List categories, optionally filtered by type | ✅ Done |
| F-07 | List expense transactions within a date range | ✅ Done |
| F-08 | List income transactions within a date range | ✅ Done |

### Phase 2 — Reporting (Backlog)

| # | Feature | Status |
|---|---|---|
| F-09 | Spending and income summary for a selected date range | ✅ Done |
| F-10 | Category breakdown report | ✅ Done |
| F-11 | Pagination for transaction list endpoints | ✅ Done |
| F-12 | Account priority ranking based on recent transaction frequency | ✅ Done |

### Phase 3 — Extended Features (Backlog)

| # | Feature | Status |
|---|---|---|
| F-13 | Credit card management (list, track annual fees) | ❌ Todo |
| F-14 | Monthly budget allocation and tracking per category | ❌ Todo |
| F-15 | Voucher and promotions management | ❌ Todo |
| F-16 | Cash flow projection | ❌ Todo |
| F-17 | Periodic balance snapshot / screenshot archiving | ✅ Done |
| F-18 | Telegram webhook → LLM-inferred transaction logging | ✅ Done |

---

## Non-Functional Requirements

| Requirement | Specification |
|---|---|
| **Latency** | Vercel serverless functions — no fixed timeout; Notion API can be slow |
| **Security** | Same-origin API calls; no external auth layer required |
| **Timezone** | All timestamps stored in `Asia/Bangkok` (UTC+7) |
| **Currency** | Primary currency: VND |
| **Error handling** | All errors mapped to structured HTTP responses with `code` and `message` |
| **Testing** | Unit tests configured with Vitest — 88 tests passing |

---

## API Endpoints

Full reference with request/response schemas and known caveats: [`docs/api-reference.md`](./docs/api-reference.md)

| Method | Path | Feature | Status |
|---|---|---|---|
| GET | `/api/accounts` | F-01 | ✅ Done |
| GET | `/api/categories` | F-06 | ✅ Done |
| POST | `/api/expense` | F-02 | ✅ Done |
| GET | `/api/expense` | F-07 | ✅ Done |
| POST | `/api/income` | F-03 | ✅ Done |
| GET | `/api/income` | F-08 | ✅ Done |
| POST | `/api/transfer` | F-04 | ✅ Done |
| POST | `/api/adjustment` | F-05 | ✅ Done |
| GET | `/api/reports` | F-09, F-10 | ✅ Done |

---

## Known Issues

Seven known bugs are tracked with severity (P1–P3) and fix guidance.
Full registry: [`docs/known-issues.md`](./docs/known-issues.md)

| # | Severity | Summary |
|---|---|---|
| ~~BUG #1~~ | ~~P2~~ | ✅ Fixed — `timestamp` now forwarded to Notion |
| ~~BUG #2~~ | ~~P3~~ | ✅ Fixed — `linkedCardId` now stored in Notion `"Linked card"` relation |
| ~~BUG #3~~ | ~~P2~~ | ✅ Fixed — `getQueryString()` now returns null correctly |
| ~~BUG #4~~ | ~~P1~~ | ✅ Fixed — negative amount now returns HTTP 400 |
| ~~BUG #5~~ | ~~P2~~ | ✅ Fixed — categoryId validated via `fetchCategory` before use |
| ~~BUG #6~~ | ~~P3~~ | ✅ Fixed — 69 unit tests added, Vitest configured |
| ~~BUG #7~~ | ~~P2~~ | ✅ Fixed — `GET /api/expense` and `GET /api/income` now query Notion |

---

## Documentation

All detailed documentation is in [`./docs/`](./docs/README.md):

| File | Content |
|---|---|
| `docs/README.md` | Index and feature status matrix |
| `docs/architecture.md` | Infrastructure, request lifecycle, code layout |
| `docs/database-schema.md` | Notion DB tables with exact property names |
| `docs/api-reference.md` | Full endpoint reference |
| `docs/feature-accounts.md` | Accounts module spec |
| `docs/feature-transactions.md` | Transactions module spec |
| `docs/feature-categories.md` | Categories module spec |
| `docs/feature-reports.md` | Reports backlog spec |
| `docs/feature-cards.md` | Cards backlog spec |
| `docs/feature-budget.md` | Budget backlog spec |
| `docs/known-issues.md` | Bug registry |
| `docs/dev-guide.md` | Setup, ENV vars, conventions, deploy |
| `docs/CHANGELOG.md` | Version history |
