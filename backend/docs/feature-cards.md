# Feature: Cards Management

**Status**: ❌ TODO (backend) / ⚠️ STUB (frontend — empty `CardsPage` component)

---

## Business Description

Track credit and debit cards, their linked bank/wallet accounts, and annual fee obligations.

---

## Current State

- **Notion schema**: The Card database exists (`id, name, annualFee, linkedAccount`). No backend handler or connector methods have been implemented for it.
- **Account DB**: Has a `linkedCards` relation field pointing to the Card database — not used in any handler.
- **Transaction DB**: Has a `Linked card` relation field — `linkedCardId` is accepted in `POST /api/expense` and `POST /api/income` request bodies but is never written to Notion (🐛 BUG #2).
- **Frontend**: `CardsPage` is an empty stub. The bottom navigation bar links to `/cards`.

---

## Planned Scope (Backlog)

- `GET /api/cards` — list all cards with linked account info and annual fee
- `POST /api/cards` — create a new card entry
- Card detail view: linked account, annual fee, annual fee due date
- Credit card statement cycle tracking
- Link cards to expense/income transactions (fix BUG #2 as part of this)

---

## Prerequisites

Fix 🐛 BUG #2 (`linkedCardId` not stored) before implementing card-transaction linking. See [known-issues.md](./known-issues.md#bug-2).
