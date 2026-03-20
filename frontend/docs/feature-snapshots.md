# Feature: Monthly Account Balance Snapshots

**Status**: ✅ DONE (F-17)

---

## Overview

A Vercel cron job fires at the start of every month (07:00 Bangkok time) and creates a balance snapshot for each active account. Snapshots serve as monthly checkpoints of account balances, calculated from the previous snapshot and all intervening transactions.

If a calculated balance doesn't match the account's stored balance, a Telegram alert is sent.

---

## Cron Schedule

| Field | Value | Meaning |
|---|---|---|
| `schedule` | `0 0 1 * *` (UTC) | 00:00 UTC on days 1 = 07:00 Bangkok time |
| `path` | `/api/cron/snapshot` | Vercel cron endpoint |

---

## Snapshot Notion Database Schema

**ENV**: `NOTION_SNAPSHOT_DATABASE_ID`

| Property | Type | Value |
|---|---|---|
| `Name` | Title | `[account name]-[MM]-[YYYY]` e.g. `Cash-02-2026` |
| `Account` | Relation | Linked to Account database (single relation) |
| `Date` | Date | `00:00:00+07:00` on the 1st of the snapshot month |
| `Balance` | Number | Calculated balance at snapshot time |

---

## Balance Calculation

For each account, the snapshot balance is computed as:

```
newBalance = previousSnapshot.balance
           + sum(tx.amount where tx.toAccountId === account.id)    // income, transfers in
           - sum(tx.amount where tx.fromAccountId === account.id)  // expense, transfers out, adjustments out
```

Transactions are filtered to those with `Timestamp >= previousSnapshot.date`.

---

## Skip Rules

An account is **not** snapshotted when:

1. **No prior snapshot exists** — the first snapshot must be created manually in Notion. This bootstraps the calculation chain.
2. **No transactions since the last snapshot** — accounts with no activity are skipped to avoid redundant records.

---

## Mismatch Detection

After calculating `newBalance`, it is compared against `account.balance` (the live value stored in Notion):

- If `|calculatedBalance - account.balance| > 0.001` → mismatch detected
- A Telegram message is sent listing all mismatched accounts:

```
[Snapshot 01-02-2026] Balance mismatch detected:
• Cash: calculated=1500000, actual=1499999
```

Mismatches indicate that transactions may have been added, edited, or deleted without going through the standard API (e.g., manual Notion edits).

---

## Implementation

| File | Role |
|---|---|
| `api/cron/snapshot.ts` | Vercel cron endpoint (CRON_SECRET auth) |
| `api/_handlers/snapshot.handler.ts` | Business logic: `runSnapshot(connector, now?)` |
| `api/_lib/connector.ts` | `fetchLatestSnapshotForAccount`, `fetchTransactionsForAccount`, `createSnapshot` |
| `api/_lib/types/snapshot.type.ts` | `Snapshot` type |
| `api/_lib/types/response.ts` | `SnapshotAccountResult`, `SnapshotRunResponse` types |

---

## Manual Trigger (Testing)

```bash
curl -X GET https://<vercel-url>/api/cron/snapshot \
  -H "Authorization: Bearer <CRON_SECRET>"
```
