/**
 * utils.ts — shared utilities for agent scripts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";

// ─── Config ───────────────────────────────────────────────────────────────────

export const DATA_DIR = './data'
export const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.csv");
export const CATEGORIES_FILE = path.join(DATA_DIR, "categories.csv");
export const CARDS_FILE = path.join(DATA_DIR, "cards.csv");
export const ACCOUNT_HINTS_FILE = path.join(DATA_DIR, "account_hints.csv");
export const CATEGORY_HINTS_FILE = path.join(DATA_DIR, "category_hints.csv");
export const CARD_HINTS_FILE = path.join(DATA_DIR, "card_hints.csv");
export const MAP_FILE = path.join(DATA_DIR, "msg_tx_map.csv");

export const TIMEZONE = "Asia/Bangkok";
export const API_BASE = "https://finance.gootube.online/api";
export const CACHE_TTL_HOURS = 168;
export const MAP_TTL_HOURS = 72;

export const TELEGRAM_BOT_TOKEN = "7014099402:AAG15B_W2pW6k2gFRWZ_BJHSSdgJMpsSfRg";
export const TELEGRAM_CHAT_ID = "-1003418336602";
export const TELEGRAM_TOPIC_ID = 2;

export const MAP_HEADERS =
  "messageId,transactionId,type,amount,accountId,categoryId,cardId,accountRef,categoryRef,cardRef,note,timestamp,lastModified";

// ─── CSV ──────────────────────────────────────────────────────────────────────

/** Parse a CSV file into records. Handles double-quoted fields (RFC 4180). */
export function parseCsv(filePath: string): Record<string, string>[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) return [];
  const rows = parseCsvRows(content);
  if (rows.length < 2) return [];
  const headers = rows[0]!;
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]))
  );
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuote = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]!;
    if (inQuote) {
      if (ch === '"' && content[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // skip CR
    } else {
      field += ch;
    }
  }
  // flush last field/row
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

export function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function serializeCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

export function appendCsvRow(
  filePath: string,
  headers: string,
  fields: string[]
): void {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, headers + "\n");
  }
  fs.appendFileSync(filePath, serializeCsvRow(fields) + "\n");
}

export function rewriteCsv(
  filePath: string,
  headers: string,
  rows: Record<string, string>[]
): void {
  const headerKeys = headers.split(",");
  const lines = rows.map((r) =>
    serializeCsvRow(headerKeys.map((k) => r[k] ?? ""))
  );
  fs.writeFileSync(filePath, [headers, ...lines].join("\n") + "\n");
}

// ─── Hints upsert ─────────────────────────────────────────────────────────────

/**
 * Upsert hint rows into a two-column CSV (hint, <idColumn>).
 * Adds new rows; overwrites existing rows with conflicting ids.
 */
export function upsertHints(
  filePath: string,
  idColumn: string,
  entries: Array<{ hint: string; id: string }>
): void {
  const existing = parseCsv(filePath);
  const map = new Map(existing.map((r) => [r["hint"]!, r[idColumn]!]));
  for (const { hint, id } of entries) {
    map.set(hint, id);
  }
  const headers = `hint,${idColumn}`;
  const lines = Array.from(map.entries()).map(([h, id]) =>
    serializeCsvRow([h, id])
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, [headers, ...lines].join("\n") + "\n");
}

// ─── Timestamp ────────────────────────────────────────────────────────────────

export function formatTimestamp(unixMs: number): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(unixMs));
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

// ─── Telegram ─────────────────────────────────────────────────────────────────

export async function telegramRequest(
  token: string,
  method: string,
  body: object
): Promise<unknown> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    ok: boolean;
    description?: string;
    result?: unknown;
  };
  if (!json.ok) {
    throw new Error(`Telegram ${method} failed: ${json.description}`);
  }
  return json.result;
}

export async function sendMessage(
  token: string,
  chatId: string,
  text: string,
  topicId: number
): Promise<number> {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (topicId !== undefined) body["message_thread_id"] = topicId;
  const result = (await telegramRequest(token, "sendMessage", body)) as {
    message_id: number;
  };
  return result.message_id;
}

export async function setInlineKeyboard(
  token: string,
  chatId: string,
  messageId: number
): Promise<void> {
  await telegramRequest(token, "editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Accept", callback_data: `accept:${messageId}` },
          { text: "❌ Reject", callback_data: `reject:${messageId}` },
        ],
      ],
    },
  });
}

/** Edit a message's text and remove inline keyboard in one call. */
export async function editMessageText(
  token: string,
  chatId: string,
  messageId: number,
  text: string
): Promise<void> {
  await telegramRequest(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: { inline_keyboard: [] },
  });
}

// ─── Cache name lookups ───────────────────────────────────────────────────────

export function buildConfirmationText(row: {
  type: string;
  amount: string;
  accountId: string;
  categoryId: string;
  cardId: string;
  note: string;
  timestamp: string;
}): string {
  const accounts = parseCsv(ACCOUNTS_FILE);
  const categories = parseCsv(CATEGORIES_FILE);
  const cards = parseCsv(CARDS_FILE);

  const accountName =
    accounts.find((a) => a["id"] === row.accountId)?.["name"] ?? row.accountId;
  const categoryName =
    categories.find((c) => c["id"] === row.categoryId)?.["name"] ??
    row.categoryId;
  const card =
    row.cardId && row.cardId !== "-"
      ? (cards.find((c) => c["id"] === row.cardId) ?? null)
      : null;

  const lines: string[] = [
    "✅ Transaction logged",
    "",
    `Type    : ${row.type}`,
    `Amount  : ${Number(row.amount).toLocaleString("vi-VN")} VND`,
    `Account : ${accountName}`,
  ];
  if (card) lines.push(`Card    : ${card["name"]} (${card["number"]})`);
  lines.push(
    `Category: ${categoryName}`,
    `Note    : ${row.note}`,
    `Time    : ${formatTimestamp(Number(row.timestamp))}`
  );
  return lines.join("\n");
}

// ─── Stdin ────────────────────────────────────────────────────────────────────

export async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin });
    const lines: string[] = [];
    rl.on("line", (line: string) => lines.push(line));
    rl.on("close", () => resolve(lines.join("\n")));
  });
}
