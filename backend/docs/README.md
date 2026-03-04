# Notion Finance — Documentation Index

Personal finance management webapp using Notion as the database layer.
Architecture: CloudFront → AWS Lambda (TypeScript) ↔ Notion API, with a React frontend on Vercel.

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
| Cards management (backlog) | [feature-cards.md](./feature-cards.md) |
| Budget management (backlog) | [feature-budget.md](./feature-budget.md) |
| Known bugs & issues | [known-issues.md](./known-issues.md) |
| Developer setup & conventions | [dev-guide.md](./dev-guide.md) |
| Changelog | [CHANGELOG.md](./CHANGELOG.md) |

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
| List expenses by date range | ✅ DONE | ❌ TODO |
| List incomes by date range | ✅ DONE | ❌ TODO |
| Reports (GET /api/reports) | ✅ DONE | ⚠️ STUB |
| Cards management | ❌ TODO | ⚠️ STUB |
| Budget management | ❌ TODO | ❌ TODO |
| Vouchers / promotions | ❌ TODO | ⚠️ STUB |
| Pagination (list endpoints) | ✅ DONE | ❌ TODO |

---

## Source of Truth Priority

Per `CLAUDE.md`:

1. `REQUIREMENTS.md` — high-level business requirements
2. `./docs/feature-*.md` — detailed feature specifications (this folder)
3. `src/` — implementation

When conflicts exist between these levels, follow the higher-priority document and document the conflict in `known-issues.md`.
