#!/usr/bin/env npx tsx
/**
 * onAccept.ts — Step 6 Accept handler
 *
 * Receives a telegramMessageId, finds the pending transaction row, updates
 * hint CSV files, rewrites msg_tx_map.csv (removing accepted + expired rows),
 * and edits the Telegram message to mark it as accepted.
 *
 * Usage:
 *   echo '{"telegramMessageId": 123456789}' | npx tsx agent/onAccept.ts
 *   npx tsx agent/onAccept.ts '{"telegramMessageId": 123456789}'
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID
 *
 * Optional env vars:
 *   DATA_DIR  — path to data directory (default: ./data relative to CWD)
 *   TIMEZONE  — IANA timezone string (default: Asia/Bangkok)
 */

import {
  ACCOUNT_HINTS_FILE,
  buildConfirmationText,
  CARD_HINTS_FILE,
  CATEGORY_HINTS_FILE,
  editMessageText,
  MAP_FILE,
  MAP_HEADERS,
  MAP_TTL_HOURS,
  parseCsv,
  readStdin,
  requireEnv,
  rewriteCsv,
  upsertHints,
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

  const { transactionId, accountId, categoryId, cardId, accountRef, categoryRef, cardRef } = row as Record<string, string>;

  // 2. Upsert hint CSV files
  const tokenize = (ref: string) =>
    ref
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);

  upsertHints(
    ACCOUNT_HINTS_FILE,
    "accountId",
    tokenize(accountRef).map((hint) => ({ hint, id: accountId }))
  );

  upsertHints(
    CATEGORY_HINTS_FILE,
    "categoryId",
    tokenize(categoryRef).map((hint) => ({ hint, id: categoryId }))
  );

  if (cardId && cardId !== "-" && cardRef && cardRef !== "-") {
    upsertHints(
      CARD_HINTS_FILE,
      "cardId",
      tokenize(cardRef).map((hint) => ({ hint, id: cardId }))
    );
  }

  // 3. Rewrite map: remove accepted row + expired rows
  const cutoff = Date.now() - MAP_TTL_HOURS * 3_600_000;
  const remaining = allRows.filter(
    (r) =>
      r["messageId"] !== msgId &&
      Number(r["lastModified"]) >= cutoff
  );
  rewriteCsv(MAP_FILE, MAP_HEADERS, remaining);

  // 4. Edit Telegram message: append "— ✅ Accepted", remove inline keyboard
  const originalText = buildConfirmationText(row as Parameters<typeof buildConfirmationText>[0]);
  await editMessageText(
    token,
    chatId,
    telegramMessageId,
    originalText + "\n\n— ✅ Accepted"
  );

  console.log(
    JSON.stringify({
      success: true,
      transactionId
    })
  );
}

main().catch((err: Error) => {
  console.error(JSON.stringify({ success: false, error: err.message }));
  process.exit(1);
});
