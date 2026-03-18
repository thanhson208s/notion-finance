#!/usr/bin/env npx tsx
/**
 * onAccept.ts — Step 6 Accept handler
 *
 * Receives a telegramMessageId, finds the pending transaction row, updates
 * hint CSV files, rewrites msg_tx_map.csv (removing accepted + expired rows),
 * and edits the Telegram message to mark it as accepted.
 *
 * Usage:
 *   echo '{"telegramMessageId": 123456789}' | npx tsx script/onAccept.ts
 *   npx tsx script/onAccept.ts '{"telegramMessageId": 123456789}'
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
  rewriteCsv,
  upsertHints,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID
} from "./utils.ts";

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const token = TELEGRAM_BOT_TOKEN;
  const chatId = TELEGRAM_CHAT_ID;

  const rawMessageId = process.argv[2] ?? (await readStdin());
  const telegramMessageId = JSON.parse(rawMessageId);

  // 1. Load map and find matching row
  const allRows = parseCsv(MAP_FILE);
  const row = allRows.find((r) => r["messageId"] === rawMessageId);
  if (!row) {
    throw new Error(`No pending row found for messageId ${rawMessageId}`);
  }

  const { transactionId, accountId, categoryId, cardId, accountRef, categoryRef, cardRef } = row as Record<string, string>;

  // 2. Upsert hint CSV files
  const tokenize = (ref: string): Array<{ type: string; hint: string }> =>
    ref
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.includes(":"))
      .flatMap((s) => {
        const colon = s.indexOf(":");
        const type = s.slice(0, colon).trim().toLowerCase();
        const phrase = s.slice(colon + 1).trim().toLowerCase();
        return phrase ? [{ type, hint: phrase }] : [];
      });

  upsertHints(
    ACCOUNT_HINTS_FILE,
    "accountId",
    tokenize(accountRef).map(({ type, hint }) => ({ type, hint, id: accountId }))
  );

  upsertHints(
    CATEGORY_HINTS_FILE,
    "categoryId",
    tokenize(categoryRef).map(({ type, hint }) => ({ type, hint, id: categoryId }))
  );

  if (cardId && cardId !== "-" && cardRef && cardRef !== "-") {
    upsertHints(
      CARD_HINTS_FILE,
      "cardId",
      tokenize(cardRef).map(({ type, hint }) => ({ type, hint, id: cardId }))
    );
  }

  // 3. Rewrite map: remove accepted row + expired rows
  const cutoff = Date.now() - MAP_TTL_HOURS * 3_600_000;
  const remaining = allRows.filter(
    (r) =>
      r["messageId"] !== rawMessageId &&
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
