# Feature: Cards Management

**Status**: ⚠️ PARTIAL (cards embedded in accounts API) / ⚠️ STUB (frontend — empty `CardsPage` component)

---

## Business Description

Track credit and debit cards, their linked bank/wallet accounts, and annual fee obligations.

---

## Current State

- **Notion schema**: Card database exists with `Name`, `annualFee`, `linkedAccount`, `Image` (URL) fields. Card images are stored in Vercel Blob and the URL is saved in the `Image` field manually.
- **Account DB**: `Linked cards` relation field is now read — `GET /api/accounts` fetches all linked cards and embeds them as `cards: { id, name, imageUrl }[]` on each account (2 Notion calls total).
- **Transaction DB**: `Linked card` relation field — `linkedCardId` accepted in `POST /api/expense` and `POST /api/income` and written to Notion (~~🐛 BUG #2~~ resolved in v1.3.0).
- **Frontend**: `CardsPage` is an empty stub. The bottom navigation bar links to `/cards`.

---

## Implemented

- Cards embedded in `GET /api/accounts` — each account returns `linkedCardIds: string[]` and `cards: CardSummary[]`
- `CardSummary = { id, name, imageUrl }` — defined in `api/_lib/types/account.type.ts`
- `Connector.fetchAllCards()` — queries Card DB (`NOTION_CARD_DATABASE_ID`), maps `Name` + `Image` fields

---

## Remaining Backlog

- `GET /api/cards` — dedicated endpoint listing all cards with `annualFee` and `linkedAccount`
- `POST /api/cards` — create a new card entry via API
- Card detail view: linked account, annual fee, annual fee due date
- Credit card statement cycle tracking

---

## Prerequisites

~~Fix 🐛 BUG #2 (`linkedCardId` not stored)~~ — resolved in v1.3.0.
