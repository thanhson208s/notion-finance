#!/usr/bin/env npx tsx
/**
 * onReject.ts — Step 6 Reject handler
 *
 * Receives a telegramMessageId, finds the pending transaction row,
 * calls DELETE /api/transactions to reverse it, and edits the Telegram
 * message to mark it as rejected. Does NOT update hint CSV files.
 *
 * Usage:
 *   echo '{"telegramMessageId": 123456789}' | npx tsx agent/onReject.ts
 *   npx tsx agent/onReject.ts '{"telegramMessageId": 123456789}'
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
  readStdin,
  requireEnv,
} from "./utils.ts";

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  const chatId = requireEnv("TELEGRAM_CHAT_ID");

  const rawJson = process.argv[2] ?? (await readStdin());
  const { telegramMessageId } = JSON.parse(rawJson.trim()) as {
    telegramMessageId: number;
  };
  const msgId = String(telegramMessageId);

  // 1. Load map and find matching row
  const allRows = parseCsv(MAP_FILE);
  const row = allRows.find((r) => r["messageId"] === msgId);
  if (!row) {
    throw new Error(`No pending row found for messageId ${msgId}`);
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

  // 3. Reconstruct original message text from map row + cache
  const originalText = buildConfirmationText(
    row as Parameters<typeof buildConfirmationText>[0]
  );

  // 4. Edit Telegram message with status, remove inline keyboard
  let statusSuffix: string;
  if (deleteRes.ok) {
    statusSuffix = "\n\n— ❌ Rejected & deleted";
  } else {
    const reason = deleteJson.error?.message ?? `HTTP ${deleteRes.status}`;
    statusSuffix = `\n\n— ❌ Rejection failed: ${reason}`;
  }

  await editMessageText(
    token,
    chatId,
    telegramMessageId,
    originalText + statusSuffix
  );

  if (!deleteRes.ok) {
    const reason = deleteJson.error?.message ?? `HTTP ${deleteRes.status}`;
    throw new Error(`DELETE transaction failed: ${reason}`);
  }

  console.log(
    JSON.stringify({ success: true, transactionId })
  );
}

main().catch((err: Error) => {
  console.error(JSON.stringify({ success: false, error: err.message }));
  process.exit(1);
});
