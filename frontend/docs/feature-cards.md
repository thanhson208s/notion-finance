# Feature: Cards Management

**Status**: ✅ DONE (v0.9.0)

---

## Business Description

Track credit and debit cards, their linked bank/wallet accounts, and annual fee obligations.

- Track card spending by billing cycle
- Track card spending relatively to required spending for free annual fee
- Track card promotions/vouchers (add, remove, filter)
- Track card cashback (actual/estimated) by billing cycle
- Track card linked services

---

## Business Rules

### Billing Cycles
- Each card has a `Billing Day` (end-of-cycle day, e.g., 20)
- Billing cycle: `(billingDay + 1)` of previous month → `billingDay` of current month
  - Example: billingDay = 20, today = Feb 15 → cycle Jan 21 – Feb 20
  - If today > billingDay → cycle shifts forward by one month
- Computed by `getBillingCycleDates(billingDay)` in `api/_lib/helper.ts`

### Cashback
- **Estimated**: flat `Cashback` field on each `Transaction` (VND). User manually sets this per eligible transaction. Frontend offers % or flat input and converts to flat before saving. Sum of all `cashback` values in a billing cycle = estimated cashback. Capped by `Cashback Cap` on the card.
- **Actual**: recorded manually as `CashbackStatement` entries (from bank statement). Stored in Cashback Statement Notion DB. Not all cards have cashback.

### Annual Fee Waiver
- `Required Spending` on Card DB = minimum cycle spending to waive annual fee
- `Last Charged Date` = when annual fee was last charged

---

## Notion Schema

### Card DB (existing + additions)

| Property | Type | Notes |
|---|---|---|
| `Name` | Title | |
| `Number` | Rich text | First 6 + last 4 digits |
| `Annual Fee` | Number | VND |
| `Spending Limit` | Number | Credit limit in VND |
| `Required Spending` | Number | Min spend per cycle to waive annual fee |
| `Last Charged Date` | Date | Last annual fee charge |
| `Billing Day` | Number | End day of billing cycle (e.g., 20) |
| `Linked Account` | Relation → Account DB | |
| `Image` | Files | Card image URL (stored in Vercel Blob) |
| `Linked Services` | Multi-select | e.g. Netflix, Spotify |
| `Cashback Cap` | Number | **NEW** — max cashback per billing cycle (VND) |

### Transaction DB (addition)

| Property | Type | Notes |
|---|---|---|
| `Cashback` | Number | **NEW** — flat cashback VND for this transaction. Null = not eligible. Frontend allows % input, converts to flat. |

### Statements DB (new — `NOTION_STATEMENT_DATABASE_ID`)

| Property | Type | Notes |
|---|---|---|
| `Name` | Title | Auto: `cashback-YYYY-MM` |
| `Card` | Relation → Card DB | |
| `Billing Date` | Date | Billing cycle end date |
| `Amount` | Number | Actual cashback in VND |
| `Note` | Rich text | Optional |

### Promotions DB (new — `NOTION_PROMOTION_DATABASE_ID`)

| Property | Type | Notes |
|---|---|---|
| `Name` | Title | Promotion description |
| `Card` | Relation → Card DB | Optional |
| `Expires At` | Date | Expiry date |
| `Type` | Select | Cashback / Discount / Voucher / Other |
| `Value` | Number | Discount amount or % (context-dependent) |
| `Is Used` | Checkbox | Marked when redeemed |
| `Note` | Rich text | Optional |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/cards` | All cards with current billing cycle spending + estimated cashback |
| `GET` | `/api/promotions?cardId=` | List promotions, optionally filtered by card |
| `POST` | `/api/promotions` | Create promotion |
| `DELETE` | `/api/promotions?id=` | Archive promotion |
| `GET` | `/api/statements?cardId=` | List statements, optionally filtered by card |
| `POST` | `/api/statements` | Add cashback statement |
| `DELETE` | `/api/statements?id=` | Archive cashback statement |

---

## Key Code Locations

| File | Purpose |
|---|---|
| `api/_lib/types/card.type.ts` | `Card`, `CardWithSpending` types |
| `api/_lib/types/promotion.type.ts` | `Promotion`, `PromotionType` types |
| `api/_lib/types/statement.type.ts` | `Statement` type |
| `api/_lib/helper.ts` | `getBillingCycleDates()`, `toISODateStr()` |
| `api/_lib/connector.ts` | `fetchAllCards()`, `fetchTransactionsByCard()`, promotion/statement CRUD |
| `api/_handlers/card.handler.ts` | `getCards` — fetches cards + spending in parallel |
| `api/_handlers/promotion.handler.ts` | `getPromotions`, `addPromotion`, `deletePromotion` |
| `api/_handlers/statement.handler.ts` | `getStatement`, `addStatement`, `deleteStatement` |
| `src/pages/CardsPage.tsx` | Card list with spending summaries |
| `src/pages/CardDetailPage.tsx` | Card detail: spending, cashback, services, fee, promotions |
| `src/pages/PromotionsPage.tsx` | All promotions with filter + add/delete |

---

## ENV Vars Required

```
NOTION_CARD_DATABASE_ID=<existing>
NOTION_PROMOTION_DATABASE_ID=<new>
NOTION_STATEMENT_DATABASE_ID=<new>
```

---
