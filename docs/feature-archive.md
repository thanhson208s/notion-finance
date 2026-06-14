# Feature: Transaction Archive

**Status**: ✅ DONE (F-18)

---

## Overview

A Vercel cron job fires every day at 00:00 UTC and moves transactions older than 3 calendar months from the main Transaction database into per-month Archive pages. Each Archive page holds an inline child Notion database that mirrors the Transaction DB schema.

This keeps the live Transaction DB small and query-fast while preserving full historical data in Notion.

---

## Cron Schedule

| Field | Value | Meaning |
|---|---|---|
| `schedule` | `0 0 * * *` (UTC) | 00:00 UTC daily |
| `path` | `/api/cron/archive` | Vercel cron endpoint |

---

## Archive Notion Database Schema

**ENV**: `NOTION_ARCHIVE_DATABASE_ID`

One page per calendar month. Created automatically on first archive run for that month.

| Property | Notion Type | Notes |
|---|---|---|
| `Name` | Title | `[MM]-[YYYY]` e.g. `11-2025` |
| `Month` | Number | Calendar month (1–12) |
| `Year` | Number | Calendar year e.g. `2025` |
| `Count` | Number | Total archived transactions for this month |
| `Debit` | Number | Sum of amounts where `FromAccount` is set (expense / transfer-out) |
| `Credit` | Number | Sum of amounts where `ToAccount` is set (income / transfer-in) |
| `Transactions DB` | Rich text | Notion database ID of the inline child DB under this page |

---

## Archive Logic

```
cutoff = now - 3 calendar months (midnight UTC)

1. Fetch all transactions from main Transaction DB where Timestamp < cutoff
2. Group transactions by (Bangkok-timezone month, year)
3. For each (month, year) bucket:
   a. fetchArchive(month, year) → find existing Archive page or null
   b. If null: createArchivePage(month, year) → new Archive page
   c. Read Transactions DB id from archive page (Transactions DB property)
   d. If empty: createArchiveTransactionDb(archivePageId) → inline child DB
              setArchiveTransactionsDb(archiveId, newDbId)
   e. For each transaction in bucket:
      - addTransactionToArchiveDb(dbId, tx)
      - trash transaction in main DB (in_trash: true)
   f. updateArchiveStats(archiveId, count, debitDelta, creditDelta, current)
4. Send full Telegram run report
```

### Bangkok Timezone Bucketing

Transactions are grouped by the calendar month in **Asia/Bangkok** timezone (`UTC+7`). A transaction timestamped `2025-11-30T20:00:00Z` (UTC) is `2025-12-01T03:00:00+07:00` in Bangkok and therefore belongs to the **December 2025** bucket.

---

## Cutoff Calculation

The cutoff is always set to midnight UTC on the same calendar day **3 months ago**:

```
cutoff = new Date(now)
cutoff.setUTCMonth(cutoff.getUTCMonth() - 3)
cutoff.setUTCHours(0, 0, 0, 0)
```

Example: if today is 2026-03-21, cutoff = 2025-12-21T00:00:00Z.

---

## Idempotency

The cron is safe to re-run:

- `fetchArchive(month, year)` queries the Archive DB by `Month` and `Year` before creating a new page — existing pages are reused.
- The inline child DB ID is read from `Transactions DB` on the archive page — if already set, no new DB is created.
- Transactions already trashed (`in_trash: true`) are not returned by Notion queries, so they will not be double-archived.

---

## Telegram Run Report

A full report is always sent after each cron run, regardless of how many transactions were archived:

```
[Archive 2026-03-21] Run complete
Cutoff: 2025-12-21 | Fetched: 42 | Archived: 42

Buckets:
• 11-2025: 20 transactions (new archive)
• 10-2025: 22 transactions (existing archive)
```

---

## Connector Methods

All Notion calls go through `api/_lib/connector.ts`:

| Method | Description |
|---|---|
| `fetchOldTransactions(before: string)` | Query main Transaction DB for all pages with `Timestamp < before` (ISO string) |
| `fetchArchive(month: number, year: number)` | Query Archive DB filtered by `Month` and `Year` properties; returns first match or `null` |
| `createArchivePage(month: number, year: number)` | Create a new Archive page with `Name`, `Month`, `Year` set |
| `createArchiveTransactionDb(archivePageId: string)` | Create an inline child DB under the archive page via `databases.create` |
| `setArchiveTransactionsDb(archiveId: string, dbId: string)` | Write the inline DB ID to the `Transactions DB` rich-text property of the archive page |
| `addTransactionToArchiveDb(dbId: string, tx: Transaction)` | Create a page in the inline DB mirroring the transaction's properties |
| `updateArchiveStats(archiveId, countDelta, debitDelta, creditDelta, current)` | Increment `Count`, `Debit`, `Credit` on the archive page |

---

## Implementation Files

| File | Role |
|---|---|
| `api/cron/archive.ts` | Vercel cron endpoint (CRON_SECRET auth) |
| `api/_handlers/archive.handler.ts` | Business logic: `runArchive(connector, now?)` |
| `api/_lib/connector.ts` | Archive connector methods (see table above) |
| `api/_lib/types/archive.type.ts` | `Archive` type: `id, name, month, year, count, debit, credit, transactionsDbId` |
| `api/__tests__/handlers/archive.handler.test.ts` | 6 unit tests |

---

## Manual Trigger (Testing)

```bash
curl -X GET https://finance.gootube.online/api/cron/archive \
  -H "Authorization: Bearer <CRON_SECRET>"
```

---

## Known Constraints

- **Non-atomic per bucket**: if the cron is interrupted mid-bucket, some transactions may have been trashed in the main DB but not yet added to the archive DB. Re-running the cron will not re-process already-trashed transactions (Notion hides them). Monitor the Telegram report for `totalFetched` vs `totalArchived` discrepancies.
- **Inline DB schema**: `createArchiveTransactionDb` must replicate the required Transaction DB properties. If the main Transaction DB schema changes, the inline DB creation logic must be updated.
