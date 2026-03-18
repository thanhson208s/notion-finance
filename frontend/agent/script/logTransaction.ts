#!/usr/bin/env npx tsx
/**
 * logTransaction.ts — Steps 4 (clarification) + 5 + 6a/6b of the agent workflow
 *
 * Always called after inference (Step 4). Behaviour depends on `unclearFields`:
 *
 *   • unclearFields non-empty → sends a clarification message to Telegram and stops.
 *   • unclearFields empty     → calls the Finance API, then sends confirmation or error.
 *
 * Usage:
 *   echo '<json>' | npx tsx agent/script/logTransaction.ts
 *   npx tsx agent/script/logTransaction.ts '<json>'
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN — bot token from BotFather
 *   TELEGRAM_CHAT_ID   — target chat or user ID
 *
 * Optional env vars:
 *   TELEGRAM_TOPIC_ID — message_thread_id for a group topic (forum supergroup)
 *   API_BASE          — Finance API base URL (default: https://finance.gootube.online/api)
 *   DATA_DIR          — path to data directory (default: ./agent/data relative to CWD)
 *   TIMEZONE          — IANA timezone string (default: Asia/Bangkok)
 *
 * Output (stdout JSON):
 *   Clarification: { success: true, clarificationSent: true }
 *   Logged:        { success: true, telegramMessageId }
 *   Error:         { success: false, error: "..." }  (exit code 1)
 */

import {
  API_BASE,
  appendCsvRow,
  buildConfirmationText,
  CATEGORIES_FILE,
  formatTimestamp,
  MAP_FILE,
  MAP_HEADERS,
  optionalIntEnv,
  parseCsv,
  readStdin,
  requireEnv,
  sendMessage,
  setInlineKeyboard,
} from "./utils.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InferenceOutput {
  // Inference results — null means the field could not be confidently determined
  accountId: string | null;
  accountName: string | null;
  amount: number | null;
  categoryId: string | null;
  categoryName: string | null;
  note: string | null;
  timestamp: number | null;   // Unix ms
  cardId: string | null;
  cardName: string | null;    // display name, e.g. "MB MC"
  cardNumber: string | null;  // masked number, e.g. "530416******6119"

  // Refs — only meaningful when the corresponding field is not null
  accountRef: string;
  categoryRef: string;
  cardRef: string | null;
}

interface ApiSuccessResponse {
  transactionId: string;
  accountId: string;
  amount: number;
  categoryId: string;
  note: string;
}

interface ApiErrorResponse {
  success: false;
  error: { code: string; message: string };
}

// ─── Clarification message ────────────────────────────────────────────────────

function buildClarificationText(input: InferenceOutput, unclearFields: string[]): string {
  const unknown = "❓ unknown";
  const lines: string[] = ["⚠️ Please confirm or correct the following before logging:", ""];

  lines.push(`Amount  : ${input.amount !== null ? input.amount.toLocaleString("vi-VN") + " VND" : unknown}`);
  lines.push(`Account : ${input.accountName ?? unknown}`);
  if (input.cardId !== null && input.cardName !== null) {
    lines.push(`Card    : ${input.cardName} (${input.cardNumber ?? ""})`);
  }
  lines.push(`Category: ${input.categoryName ?? unknown}`);
  lines.push(`Note    : ${input.note ?? unknown}`);

  const timeStr = input.timestamp !== null
    ? formatTimestamp(input.timestamp)
    : unknown;
  lines.push(`Time    : ${timeStr}`);

  lines.push("");
  lines.push(`Unclear fields: ${unclearFields.join(", ")}`);
  lines.push("Please reply to this message with the missing or corrected information.");

  return lines.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  const chatId = requireEnv("TELEGRAM_CHAT_ID");
  const topicId = optionalIntEnv("TELEGRAM_TOPIC_ID");

  const rawJson = process.argv[2] ?? (await readStdin());
  const input = JSON.parse(rawJson.trim()) as InferenceOutput;

  // ── Derive type and unclearFields ─────────────────────────────────────────────
  const categories = parseCsv(CATEGORIES_FILE);
  const matchedCategory = input.categoryId
    ? categories.find((c) => c["id"] === input.categoryId)
    : undefined;
  const categoryType = matchedCategory?.["type"] ?? null;
  const type = categoryType === "Income" || categoryType === "Expense"
    ? categoryType
    : null;

  const unclearFields: string[] = [];
  if (input.amount === null)      unclearFields.push("amount");
  if (input.accountId === null)   unclearFields.push("account");
  if (input.categoryId === null)  unclearFields.push("category");
  if (type === null)              unclearFields.push("type");  // unresolved or System
  if (input.note === null)        unclearFields.push("note");
  if (input.timestamp === null)   unclearFields.push("timestamp");

  // ── Clarification path ────────────────────────────────────────────────────────
  if (unclearFields.length > 0) {
    await sendMessage(token, chatId, buildClarificationText(input, unclearFields), topicId);
    console.log(JSON.stringify({ success: true, clarificationSent: true }));
    return;
  }

  // ── Happy path: all fields confident ─────────────────────────────────────────
  const endpoint = type === "Expense" ? "expense" : "income";

  const requestBody: Record<string, unknown> = {
    accountId: input.accountId,
    amount: input.amount,
    categoryId: input.categoryId,
    note: input.note,
    timestamp: input.timestamp,
  };
  if (input.cardId !== null) {
    requestBody["linkedCardId"] = input.cardId;
  }

  const apiRes = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  // ── API failure (Step 6b) ─────────────────────────────────────────────────────
  if (!apiRes.ok) {
    const errJson = (await apiRes.json()) as ApiErrorResponse;
    const reason = errJson.error?.message ?? `HTTP ${apiRes.status}`;
    await sendMessage(
      token,
      chatId,
      `❌ Failed to log transaction.\nStatus: ${apiRes.status}\nReason: ${reason}`,
      topicId
    );
    throw new Error(`API error ${apiRes.status}: ${reason}`);
  }

  // ── API success (Step 6a) ─────────────────────────────────────────────────────
  const apiData = (await apiRes.json()) as ApiSuccessResponse;

  const messageText = buildConfirmationText({
    type: type as string,
    amount: apiData.amount.toString(),
    accountId: apiData.accountId,
    categoryId: apiData.categoryId,
    cardId: input.cardId ?? "-",
    note: apiData.note,
    timestamp: input.timestamp!.toString(),
  });

  const telegramMessageId = await sendMessage(token, chatId, messageText, topicId);
  await setInlineKeyboard(token, chatId, telegramMessageId);

  appendCsvRow(MAP_FILE, MAP_HEADERS, [
    telegramMessageId.toString(),
    apiData.transactionId,
    type!,
    apiData.amount.toString(),
    apiData.accountId,
    apiData.categoryId,
    input.cardId ?? "-",
    input.accountRef,
    input.categoryRef,
    input.cardRef ?? "-",
    apiData.note,
    input.timestamp!.toString(),
    Date.now().toString(),
  ]);

  console.log(JSON.stringify({ success: true, telegramMessageId }));
}

main().catch((err: Error) => {
  console.error(JSON.stringify({ success: false, error: err.message }));
  process.exit(1);
});
