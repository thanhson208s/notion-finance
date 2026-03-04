# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Known Issues (not yet fixed)
- BUG #2: `linkedCardId` accepted in POST request bodies but never stored in Notion
- BUG #5: Account and category IDs not validated before use
- BUG #6: Zero test coverage; `pnpm test` not configured

---

## [1.1.0] - 2026-03-04

### Fixed

- fix(helper): `getQueryString()` and `getQueryBool()` with `required=false` now correctly return `null` instead of throwing (BUG #3)
- fix(validation): added `amount > 0` guard to `logExpense`, `logIncome`, `transferBalance` — negative amounts now return HTTP 400 (BUG #4)
- fix(timestamp): optional `timestamp` parameter is now forwarded through `addTransaction`, `addExpense`, `addIncome`, `addTransfer` and applied in Notion — transactions can be backdated (BUG #1)

### Added

- feat(transactions): implemented `GET /api/expense` with real Notion query — filters by `FromAccount is_not_empty`, excludes system categories, supports optional `startDate`/`endDate`, sorted by timestamp descending (F-07)
- feat(transactions): implemented `GET /api/income` with same logic using `ToAccount is_not_empty` (F-08)
- feat(connector): added `fetchTransactions(type, startDate?, endDate?)` method to `Connector`

---

## [1.0.0] - 2026-03-03

### Added

- `GET /api/accounts` — fetch all accounts with total, asset, and liability balance aggregation
- `POST /api/expense` — log expense transaction and deduct from account balance
- `POST /api/income` — log income transaction and add to account balance
- `POST /api/transfer` — transfer amount between two accounts with transaction audit trail
- `POST /api/adjustment` — set account to target balance with transaction audit trail
- `GET /api/categories` — list categories with optional type filter (`Income | Expense | Financial`)
- `GET /api/expense` (stub) — route registered, returns empty array
- `GET /api/income` (stub) — route registered, returns empty array
- Custom HTTP router with `/api` prefix normalization (`src/utils/router.ts`)
- Notion SDK wrapper (`src/utils/connector.ts`) with typed property extractors
- Custom error hierarchy: `SchemaError`, `QueryError`, `DatabaseError` (`src/types/error.ts`)
- Full error mapping in `main.ts`: Notion `APIResponseError` → HTTP status codes
- CloudFront + Lambda + Vercel infrastructure via `serverless.yml`
- TypeScript strict mode throughout
- React 19 frontend with account dashboard, expense/income/transfer/adjustment forms
- Dark theme mobile-first UI with filter, sort, and hide-empty-accounts controls
