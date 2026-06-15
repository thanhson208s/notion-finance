import { Connector, toISOStringWithTimezone } from "../_lib/connector";
import { logExpense, logIncome } from "./transaction.handler";
import { inferTransaction } from "../_lib/gemini";
import {
  sendTelegramMessage,
  getTelegramFilePath,
  downloadTelegramFileAsBase64
} from "../_lib/telegram";
import { TelegramUpdate } from "../_lib/types/telegram.type";
import { LogExpenseRequest, LogIncomeRequest } from "../_lib/types/request";
import { QueryError } from "../_lib/types/error";

export type WebhookOutcome =
  | { status: "ignored"; reason: string }
  | { status: "incomplete"; reason: string }
  | { status: "not_transaction"; reason: string }
  | { status: "logged"; transactionId: string }
  | { status: "error"; message: string };

function fmtVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

export async function processTelegramUpdate(
  update: TelegramUpdate,
  connector: Connector
): Promise<WebhookOutcome> {
  const message = update?.message;
  if (!message) return { status: "ignored", reason: "no message" };

  // Restrict to the configured group + topic.
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const topicId = parseInt(process.env.TELEGRAM_TOPIC_ID ?? "0");
  if (String(message.chat?.id) !== String(chatId)) {
    return { status: "ignored", reason: "wrong chat" };
  }
  if ((message.message_thread_id ?? 0) !== topicId) {
    return { status: "ignored", reason: "wrong topic" };
  }

  try {
    const text = message.text ?? message.caption ?? "";

    // A Telegram message carries one image as several sizes; pick the largest
    // (last entry) and resolve it to inline data.
    let image: { data: string; mimeType: string } | null = null;
    if (message.photo && message.photo.length > 0) {
      const largest = message.photo[message.photo.length - 1];
      const filePath = await getTelegramFilePath(largest.file_id);
      image = await downloadTelegramFileAsBase64(filePath);
    }

    if (!text && !image) {
      return { status: "ignored", reason: "empty message" };
    }

    const [accounts, categories, cards] = await Promise.all([
      connector.fetchAllAccounts(),
      connector.fetchCategories(null),
      connector.fetchAllCards()
    ]);

    const now = toISOStringWithTimezone(Date.now(), "Asia/Bangkok");
    const inferred = await inferTransaction({ text, image, now, accounts, categories, cards });

    // Not a transaction at all — notify briefly and stop.
    if (inferred.kind === "not_transaction") {
      await sendTelegramMessage(`🤖 ${inferred.reason || "This doesn't look like a transaction, so nothing was logged."}`);
      return { status: "not_transaction", reason: inferred.reason };
    }

    // A transaction attempt missing critical info — ask for it and stop. Also
    // catches a model that returned kind=transaction but left a critical field null.
    if (
      inferred.kind === "incomplete" ||
      inferred.amount == null || inferred.amount <= 0 ||
      !inferred.accountId || !inferred.categoryId
    ) {
      await sendTelegramMessage(`❓ Couldn't log — ${inferred.reason || "missing critical details"}. Please resend with the missing info.`);
      return { status: "incomplete", reason: inferred.reason };
    }

    // Critical fields are guaranteed non-null past the guard above.
    const amount = inferred.amount;
    const accountId = inferred.accountId;
    const categoryId = inferred.categoryId;
    const note = inferred.note;
    
    const account = accounts.find(a => a.id === accountId);
    if (!account) throw new QueryError("Inferred account not found");

    // Determine direction from the category type (no extra Notion fetch).
    const category = categories.find(c => c.id === categoryId);
    if (!category) throw new QueryError("Inferred category not found");
    if (category.type === "System") {
      throw new QueryError(`Category "${category.name}" is a System category and cannot be logged here`);
    }

    let linkedCardId: string | undefined;
    if (inferred.linkedCardId) {
      const card = cards.find(c => c.id === inferred.linkedCardId);
      if (!card) throw new QueryError("Inferred card not found");
      linkedCardId = inferred.linkedCardId;
    }

    // Validate the inferred timestamp before converting; reject an unparseable
    // value. (When omitted, the connector defaults to the current time.)
    let timestamp: number | undefined;
    if (inferred.timestamp) {
      const ms = new Date(inferred.timestamp).getTime();
      if (Number.isNaN(ms)) throw new QueryError("Inferred timestamp invalid");
      timestamp = ms;
    }

    const body: LogExpenseRequest | LogIncomeRequest = {
      accountId,
      amount,
      categoryId,
      note,
      timestamp,
      linkedCardId
    };

    const event = { method: "POST", path: "/api/webhooks", query: {}, body };
    const result = category.type === "Income"
      ? await logIncome(event, connector)
      : await logExpense(event, connector);

    const transactionId = result.body.transactionId;
    const sign = category.type === "Income" ? "+" : "-";
    const lines = [
      `✅ Logged: ${sign}${fmtVND(amount)}`,
      `Account: ${account.name}`,
      `Category: ${category.name}`,
      `Note: ${note || 'Empty'}`,
      `Tx: ${transactionId}`,
    ];
    if (inferred.suggestion) lines.push(`\n💡 ${inferred.suggestion}`);
    await sendTelegramMessage(lines.join("\n"));

    return { status: "logged", transactionId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sendTelegramMessage(`⚠️ Could not log transaction: ${msg}`);
    return { status: "error", message: msg };
  }
}
