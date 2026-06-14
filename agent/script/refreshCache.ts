#!/usr/bin/env npx tsx
/**
 * refreshCache.ts — Step 1 (pre-step) of the agent workflow
 *
 * Checks if accounts.csv, categories.csv, and cards.csv are fresh.
 * If any file is missing or older than CACHE_TTL_HOURS, fetches fresh data
 * from the Finance API and overwrites all three files.
 *
 * Usage:
 *   npx tsx script/refreshCache.ts
 *
 * Optional env vars:
 *   API_BASE  — Finance API base URL (default: https://finance.gootube.online/api)
 *   DATA_DIR  — path to data directory (default: ./data relative to CWD)
 *
 * Output (stdout JSON):
 *   { success: true, refreshed: true }
 *   { success: true, refreshed: false }
 */

import * as fs from "node:fs";
import {
  ACCOUNTS_FILE,
  API_BASE,
  CACHE_TTL_HOURS,
  CARDS_FILE,
  CATEGORIES_FILE,
  DATA_DIR,
  parseCsv,
  serializeCsvRow,
} from "./utils.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccountResponse {
  id: string;
  name: string;
  type: string;
  balance: number;
  priorityScore: number;
  cards: CardResponse[];
}

interface CardResponse {
  id: string;
  name: string;
  number?: string;
}

interface CategoryResponse {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  note?: string;
}

// ─── TTL check ────────────────────────────────────────────────────────────────

function isCacheFresh(): boolean {
  for (const file of [ACCOUNTS_FILE, CATEGORIES_FILE, CARDS_FILE]) {
    if (!fs.existsSync(file)) return false;
  }

  // Read updatedAt from the first data row of accounts.csv
  const rows = parseCsv(ACCOUNTS_FILE);
  if (rows.length === 0) return false;

  const updatedAt = rows[0]!["updatedAt"];
  if (!updatedAt) return false;

  const ageMs = Date.now() - new Date(updatedAt).getTime();
  return ageMs < CACHE_TTL_HOURS * 3_600_000;
}

// ─── CSV writers ──────────────────────────────────────────────────────────────

function writeAccountsCsv(accounts: AccountResponse[], updatedAt: string): void {
  const headers = "updatedAt,id,name,type,balance,priorityScore";
  const lines = accounts.map((a) =>
    serializeCsvRow([
      updatedAt,
      a.id,
      a.name,
      a.type,
      a.balance.toString(),
      a.priorityScore.toString(),
    ])
  );
  fs.writeFileSync(ACCOUNTS_FILE, [headers, ...lines].join("\n") + "\n");
}

function writeCategoriesCsv(categories: CategoryResponse[], updatedAt: string): void {
  const headers = "updatedAt,id,name,type,parentId,note";
  const lines = categories.map((c) =>
    serializeCsvRow([
      updatedAt,
      c.id,
      c.name,
      c.type,
      c.parentId ?? "null",
      c.note ?? "",
    ])
  );
  fs.writeFileSync(CATEGORIES_FILE, [headers, ...lines].join("\n") + "\n");
}

function writeCardsCsv(
  accounts: AccountResponse[],
  updatedAt: string
): number {
  const headers = "updatedAt,id,accountId,name,number";
  const lines: string[] = [];
  for (const account of accounts) {
    for (const card of account.cards) {
      lines.push(
        serializeCsvRow([
          updatedAt,
          card.id,
          account.id,
          card.name,
          card.number ?? "",
        ])
      );
    }
  }
  fs.writeFileSync(CARDS_FILE, [headers, ...lines].join("\n") + "\n");
  return lines.length;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (isCacheFresh()) {
    console.log(
      JSON.stringify({ success: true, refreshed: false })
    );
    return;
  }

  // Fetch accounts and categories in parallel
  const [accountsRes, categoriesRes] = await Promise.all([
    fetch(`${API_BASE}/accounts`),
    fetch(`${API_BASE}/categories`),
  ]);

  if (!accountsRes.ok)
    throw new Error(`GET /accounts failed: HTTP ${accountsRes.status}`);
  if (!categoriesRes.ok)
    throw new Error(`GET /categories failed: HTTP ${categoriesRes.status}`);

  const { accounts } = (await accountsRes.json()) as {
    accounts: AccountResponse[];
  };
  const { categories } = (await categoriesRes.json()) as {
    categories: CategoryResponse[];
  };

  // Use ISO timestamp as updatedAt for all rows
  const updatedAt = new Date().toISOString();

  fs.mkdirSync(DATA_DIR, { recursive: true });
  writeAccountsCsv(accounts, updatedAt);
  writeCategoriesCsv(categories, updatedAt);
  writeCardsCsv(accounts, updatedAt);

  console.log(
    JSON.stringify({
      success: true, refreshed: true
    })
  );
}

main().catch((err: Error) => {
  console.error(JSON.stringify({ success: false, error: err.message }));
  process.exit(1);
});
