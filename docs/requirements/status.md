# Implementation Status

Last updated: 2026-03-02

## Done ✅

**Backend:** GET /accounts, GET /categories, POST /expense, POST /income, POST /transfer, POST /adjustment — all fully implemented with error handling.

**Frontend:** AccountsPage (filter / sort / hide-empty + 4 inline forms), ExpenseForm, IncomeForm, TransferForm, AdjustmentForm, SigV4 fetch interceptor.

## Stubs ⚠️

| Item | State |
|---|---|
| `GET /api/expense` | Accepts params, always returns `[]` |
| `GET /api/income` | Accepts params, always returns `[]` |
| `ReportsPage.tsx` | Empty placeholder |
| `CardsPage.tsx` | Empty placeholder |
| `PromotionsPage.tsx` | Empty placeholder (intentional — no requirements yet) |

## TODO (priority order)

### 1. Transaction listing (backend)
- [ ] `GET /api/expense`: filter by FromAccount, date range, Notion cursor pagination
- [ ] `GET /api/income`: filter by ToAccount

### 2. Reports Page
- [ ] Decide on endpoint shape (reuse list endpoints or add a dedicated summary endpoint)
- [ ] ReportsPage: month picker, income / expense / net totals
- [ ] Category breakdown: group by `categoryId`, show amount + percentage
- [ ] Transaction list: paginated with filter controls

### 3. Cards Page
- [ ] Decide on data model for card metadata (extend Accounts DB or create a new DB)
- [ ] `GET /api/cards`: fetch Credit/PayLater accounts with card metadata
- [ ] CardsPage: list view with utilization % and due date countdown
- [ ] Card detail: transaction history via `linkedCardId`

## Known Issues

| File | Issue |
|---|---|
| `helper.ts:47` | `getQueryString(required: false)` throws `null` instead of returning it |
| `TransferForm.tsx` | Local response type has `toAccountId: number` — should be `string` |
| `frontend/App.ts` | `AccountType` is missing: Debt, Crypto, Loan, Fund, Bond, Stock — acceptable if Notion has no accounts of those types |
