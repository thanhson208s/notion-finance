#!/usr/bin/env npx tsx
/**
 * onReject.ts — Step 6 Reject handler
 *
 * Receives a telegramMessageId, finds the pending transaction row,
 * calls DELETE /api/transactions to reverse it, and edits the Telegram
 * message to mark it as rejected. Does NOT update hint CSV files.
 *
 * Usage:
 *   echo '{"telegramMessageId": 123456789}' | npx tsx script/onReject.ts
 *   npx tsx script/onReject.ts '{"telegramMessageId": 123456789}'
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID
 *
 * Optional env vars:
 *   API_BASE  — Finance API base URL (default: https://finance.gootube.online/api)
 *   DATA_DIR  — path to data directory (default: ./data relative to CWD)
 *   TIMEZONE  — IANA timezone string (default: Asia/Bangkok)
 */

import {
  API_BASE,
  buildConfirmationText,
  editMessageText,
  MAP_FILE,
  parseCsv,
  rewriteCsv,
  readStdin,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  MAP_TTL_HOURS,
  MAP_HEADERS
} from "./utils.ts";

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const token = TELEGRAM_BOT_TOKEN;
  const chatId = TELEGRAM_CHAT_ID;

  const rawMessageId = process.argv[2] ?? (await readStdin());
  const telegramMessageId = parseInt(rawMessageId);

  // 1. Load map and find matching row
  const allRows = parseCsv(MAP_FILE);
  const row = allRows.find((r) => r["messageId"] === rawMessageId);
  if (!row) {
    throw new Error(`No pending row found for messageId ${rawMessageId}`);
  }

  const { transactionId } = row as Record<string, string>;

  // 2. Call DELETE /api/transactions
  const deleteRes = await fetch(
    `${API_BASE}/transactions?id=${encodeURIComponent(transactionId)}`,
    { method: "DELETE" }
  );
  const deleteJson = (await deleteRes.json()) as {
    id?: string;
    success?: boolean;
    error?: { message: string };
  };

  if (!deleteRes.ok) {
    const reason = deleteJson.error?.message ?? `HTTP ${deleteRes.status}`;
    throw new Error(`DELETE transaction failed: ${reason}`);
  }

  // 3. Rewrite map: remove rejected row + expired rows
  const cutoff = Date.now() - MAP_TTL_HOURS * 3_600_000;
  const remaining = allRows.filter(
    (r) =>
      r["messageId"] !== rawMessageId &&
      Number(r["lastModified"]) >= cutoff
  );
  rewriteCsv(MAP_FILE, MAP_HEADERS, remaining);

  // 4. Edit Telegram message with status, remove inline keyboard
  const originalText = buildConfirmationText(row as Parameters<typeof buildConfirmationText>[0]);
  await editMessageText(
    token,
    chatId,
    telegramMessageId,
    originalText + "\n\n— ❌ Rejected"
  );

  console.log(
    JSON.stringify({ success: true, transactionId })
  );
}

main().catch((err: Error) => {
  console.error(JSON.stringify({ success: false, error: err.message }));
  process.exit(1);
});
