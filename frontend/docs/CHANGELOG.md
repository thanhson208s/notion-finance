# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [FE-0.5.0] - 2026-03-09

### Changed

- feat(reports): `GET /api/reports` now includes `accounts: Account[]` in response — fetched in parallel with transactions and categories
- feat(reports-ui): add transaction history toggle to `ReportsPage` — floating pill button switches between financial report and full transaction list
- feat(reports-ui): transaction list supports type filter (Income/Expense/Transfer/Adjustment), top-level category filter, and sort by date or amount
- feat(reports-ui): account names resolved from `data.accounts` (no extra fetch required)

---

## [FE-0.4.0] - 2026-03-07

### Changed

- feat(accounts): `GET /api/accounts` now returns `linkedCardIds: string[]` and `cards: CardSummary[]` per account — cards fetched from Card DB in a single extra Notion call (2 total)
- feat(connector): added `fetchAllCards()`, `mapPageToCardSummary()`, `getRelationsProperty()`, `getFileProperty()` to `Connector`
- feat(types): added `CardSummary` type and `linkedCardIds`/`cards` fields to `Account` type in `account.type.ts`

---

## [FE-0.3.0] - 2026-03-06

### Changed

- refactor(api): migrated backend runtime from AWS Lambda + CloudFront to Vercel Node.js serverless functions
- refactor(api): converted all handlers from Web API `(req: Request): Promise<Response>` to `(req: VercelRequest, res: VercelResponse)` using `@vercel/node`
- refactor(api): replaced `moment-timezone` with native `Intl.DateTimeFormat` for Edge compatibility
- refactor(api): moved error handling to per-route `handleError(e, res)` — removed central router/main.ts pattern
- fix(config): removed `"type": "module"` from `package.json` to fix ESM resolution error on Vercel Node.js runtime
- fix(config): changed `VITE_API_BASE` from absolute CloudFront URL to `/api` (relative); local dev uses `.env.local`
- chore(deps): added `@vercel/node` dev dependency; removed AWS/Serverless Framework dependencies

---

## [1.5.0] - 2026-03-05

### Changed

- feat(reports): `GET /api/reports` now returns a `transactions` array containing all transactions in the date range (expense, income, transfer, adjustment), sorted by `timestamp` descending
- refactor(reports): reduced Notion API calls from 3 to 2 by replacing separate expense/income fetches with a single `fetchAllTransactions` call; expense/income classification is done in-memory
- feat(connector): added `fetchAllTransactions(startDate?, endDate?)` method to `Connector` class

---

## [FE-0.2.0] - 2026-03-04

### Added (Frontend)

- feat(reports): implemented `ReportsPage` at `/reports` — date range selector (last month / this month / custom), net savings summary card, expense/income tab toggle, SVG donut chart, collapsible category list with progress bars
- feat(reports): pure SVG donut chart with multi-segment rendering and click-to-highlight interaction
- fix(accounts): added missing `AccountType` values — `Loan`, `Fund`, `Bond`, `Stock`, `Debt`, `Crypto` — with correct asset/liability classification and CSS badge colors
- refactor(api): replaced hardcoded API URLs with `API_BASE` from `VITE_API_BASE` env variable across all pages and components
- chore(cleanup): removed unused `Header.tsx` and `Header.css` components

---

## [1.4.0] - 2026-03-04

### Added

- feat(reports): `GET /api/reports` endpoint — returns `totalIncome`, `totalExpense`, `netSavings`, `expenseCategoryBreakdown`, `incomeCategoryBreakdown` with optional `startDate`/`endDate` query params (F-09, F-10)
- feat(reports): `CategoryBreakdown` and `GetReportsResponse` types in `src/types/response.ts`

### Tests

- Added 9 new test cases for `reports.handler.ts` — total: 82 tests

---

## [1.3.0] - 2026-03-04

### Fixed

- fix(connector): added `fetchCategory(categoryId)` for pre-flight existence check — prevents malformed Notion records when an invalid categoryId is passed (BUG #5)
- fix(connector): added `linkedCardId?: string` parameter to `addTransaction()`, `addExpense()`, `addIncome()` — now writes `"Linked card"` relation to Notion when provided (BUG #2)
- fix(handlers): `logExpense` and `logIncome` now validate `categoryId` via `fetchCategory` and forward `req.linkedCardId`

### Tests

- Added 4 new test cases covering BUG #5 (category validation) and BUG #2 (linkedCardId forwarding) — total: 73 tests

---

## [1.2.1] - 2026-03-04

### Fixed

- fix(connector): `fetchTransactions`, `fetchAllAccounts`, `fetchCategories` now fetch all pages via cursor loop — previously truncated at 100 results (F-11)
- refactor(connector): extracted private `queryAllPages` helper to handle Notion cursor pagination in a single place

---

## [1.2.0] - 2026-03-04

### Added

- feat(tests): added Vitest test suite with 69 unit tests across 6 test files (BUG #6)
  - `src/__tests__/utils/helper.test.ts` — covers `ok`, `err`, `getQueryInt`, `getQueryFloat`, `getQueryString`, `getQueryBool`
  - `src/__tests__/utils/router.test.ts` — covers `normalizePath`, `normalizeQuery`, route registration and resolution
  - `src/__tests__/types/account.type.test.ts` — covers `isAssetType()` for all 14 `AccountType` values
  - `src/__tests__/handlers/account.handler.test.ts` — covers `getAccounts`, `adjustBalance`
  - `src/__tests__/handlers/transaction.handler.test.ts` — covers all 5 transaction handlers
  - `src/__tests__/handlers/category.handler.test.ts` — covers `getCategories`
- chore(package): added `"test": "vitest run"` and `"test:watch": "vitest"` scripts

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
