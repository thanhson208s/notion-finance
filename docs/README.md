# Notion Finance — Documentation Index

Personal finance management webapp using Notion as the database layer.

---

## Navigation

| Topic | File |
|---|---|
| System architecture & infrastructure | [architecture.md](./architecture.md) |
| Notion database schema | [database-schema.md](./database-schema.md) |
| HTTP API reference | [api-reference.md](./api-reference.md) |
| Accounts feature | [feature-accounts.md](./feature-accounts.md) |
| Transactions (Expense/Income/Transfer/Adjustment) | [feature-transactions.md](./feature-transactions.md) |
| Categories feature | [feature-categories.md](./feature-categories.md) |
| Reports | [feature-reports.md](./feature-reports.md) |
| Monthly snapshots (cron) | [feature-snapshots.md](./feature-snapshots.md) |
| Transaction archive (cron) | [feature-archive.md](./feature-archive.md) |
| Cards management (backlog) | [feature-cards.md](./feature-cards.md) |
| Budget management (backlog) | [feature-budget.md](./feature-budget.md) |
| Developer setup & conventions | [dev-guide.md](./dev-guide.md) |

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ DONE | Fully implemented |
| ⚠️ STUB | Route/page exists, returns hardcoded/empty data |
| ❌ TODO | Planned, no code exists yet |
| 🐛 BUG | Known defect — see [known-issues.md](./known-issues.md) |

---

## Feature Status Matrix

| Feature | Backend | Frontend |
|---|---|---|
| Get all accounts | ✅ DONE | ✅ DONE |
| Log expense | ✅ DONE | ✅ DONE |
| Log income | ✅ DONE | ✅ DONE |
| Transfer between accounts | ✅ DONE | ✅ DONE |
| Adjust account balance | ✅ DONE | ✅ DONE |
| Get categories | ✅ DONE | ✅ DONE (embedded in forms) |
| List expenses by date range | ✅ DONE | ✅ DONE |
| List incomes by date range | ✅ DONE | ✅ DONE |
| Reports (GET /api/reports) | ✅ DONE | ✅ DONE |
| Cards management | ✅ TODO | ✅ STUB |
| Vouchers / promotions | ✅ TODO | ✅ STUB |
| Budget management | ❌ TODO | ❌ TODO |
| Pagination (list endpoints) | ❌ DONE | ❌ TODO |
| Monthly balance snapshots (cron) | ✅ DONE | N/A |
| Transaction archive (cron) | ✅ DONE | N/A |