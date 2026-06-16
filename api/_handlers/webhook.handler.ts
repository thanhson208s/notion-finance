import { Connector, toISOStringWithTimezone } from "../_lib/connector";
import { deleteTransaction, logExpense, logIncome, updateTransaction } from "./transaction.handler";
import { inferReply, inferTransaction } from "../_lib/gemini";
import {
  sendTelegramMessage,
  getTelegramFilePath,
  downloadTelegramFileAsBase64,
  editMessageText
} from "../_lib/telegram";
import { TelegramMessage, TelegramMessageEntity, TelegramUpdate } from "../_lib/types/telegram.type";
import { LogExpenseRequest, LogIncomeRequest, UpdateTransactionRequest } from "../_lib/types/request";
import { QueryError } from "../_lib/types/error";
import { Category } from "../_lib/types/category.type";
import { Transaction } from "../_lib/types/transaction.type";
import { Card } from "../_lib/types/card.type";

export type WebhookOutcome =
  | { status: "ignored"; reason: string }
  | { status: "incomplete"; reason: string }
  | { status: "not_transaction"; reason: string }
  | { status: "logged"; transactionId: string }
  | { status: "updated"; transactionId: string }
  | { status: "deleted"; transactionId: string }
  | { status: "no_op"; reason: string }
  | { status: "error"; message: string };

function fmtVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getMessageTextAndEntities(message?: TelegramMessage): {
  text: string
  entities: TelegramMessageEntity[]
} {
  if (!message) return { text: "", entities: [] };
  if (message.text !== undefined) return { text: message.text, entities: message.entities ?? [] };
  return { text: message.caption ?? "", entities: message.caption_entities ?? [] };
}

function extractTransactionId(text: string, entities: TelegramMessageEntity[] = []): string | null {
  const codeEntity = entities.find(e => e.type === "code");
  if (codeEntity) {
    const value = text.slice(codeEntity.offset, codeEntity.offset + codeEntity.length).trim();
    if (value) return value;
  }

  return text.match(/<code>([^<]+)<\/code>/)?.[1] ?? null;
}

function isParentCategory(categoryId: string, categories: Category[]): boolean {
  return categories.some(c => c.parentId === categoryId);
}

function getCategoryLabel(categoryId: string, categories: Category[]): string {
  const category = categories.find(c => c.id === categoryId);
  if (!category) return categoryId;

  if (!category.parentId) return category.name;
  const parent = categories.find(c => c.id === category.parentId);
  return parent ? `${parent.name} > ${category.name}` : category.name;
}

function getTransactionDirection(transaction: Transaction): "Income" | "Expense" {
  if (transaction.fromAccountId) return "Expense";
  if (transaction.toAccountId) return "Income";
  throw new QueryError("Transaction has no account direction");
}

function getTransactionAccountId(transaction: Transaction): string {
  const accountId = transaction.fromAccountId ?? transaction.toAccountId;
  if (!accountId) throw new QueryError("Transaction has no account");
  return accountId;
}

function formatCardLabel(card: Card | null): string {
  return card ? `${card.name} (${card.number})` : `None`;
}

async function getTransactionCardLabel(transaction: Transaction, connector: Connector): Promise<string> {
  if (!transaction.linkedCardId) return formatCardLabel(null);
  return formatCardLabel(await connector.fetchCardById(transaction.linkedCardId));
}

function buildConfirmationMessage(input: {
  heading: string
  transactionId: string
  amount: number
  direction: "Income" | "Expense"
  accountName: string
  cardLabel: string
  categoryLabel: string
  note: string
  suggestion?: string
  edited?: boolean
}): string {
  const sign = input.direction === "Income" ? "+" : "-";
  const heading = input.edited ? `${input.heading} (edited)` : input.heading;
  const lines = [
    `<b>${escapeHtml(heading)}</b>: ${sign}${escapeHtml(fmtVND(input.amount))}`,
    `Account: ${escapeHtml(input.accountName)}`,
    `Card: ${escapeHtml(input.cardLabel)}`,
    `Category: ${escapeHtml(input.categoryLabel)}`,
    `Note: ${escapeHtml(input.note || "Empty")}`,
    `Tx: <code>${escapeHtml(input.transactionId)}</code>`,
  ];
  if (input.suggestion) lines.push(`\n💡 ${escapeHtml(input.suggestion)}`);
  return lines.join("\n");
}

function buildDeletedMessage(input: {
  transaction: Transaction
  direction: "Income" | "Expense"
  accountName: string
  cardLabel: string
  categoryLabel: string
}): string {
  const sign = input.direction === "Income" ? "+" : "-";
  return [
    `<b>🗑 Deleted</b>: ${sign}${escapeHtml(fmtVND(input.transaction.amount))}`,
    `Account: ${escapeHtml(input.accountName)}`,
    `Card: ${escapeHtml(input.cardLabel)}`,
    `Category: ${escapeHtml(input.categoryLabel)}`,
    `Note: ${escapeHtml(input.transaction.note || "Empty")}`,
  ].join("\n");
}

async function sendNoOp(reason: string): Promise<WebhookOutcome> {
  await sendTelegramMessage(`<b>🤖 No action</b>\n${escapeHtml(reason)}`, { parseMode: "HTML" });
  return { status: "no_op", reason };
}

async function processReplyUpdate(
  message: TelegramMessage,
  text: string,
  connector: Connector
): Promise<WebhookOutcome> {
  const repliedTo = message.reply_to_message;
  const anchor = getMessageTextAndEntities(repliedTo);
  const transactionId = extractTransactionId(anchor.text, anchor.entities);

  if (!transactionId) {
    return { status: "ignored", reason: "reply without transaction id" };
  }

  if (!text) {
    return { status: "ignored", reason: "empty reply" };
  }

  const transaction = await connector.fetchTransaction(transactionId);
  const categories = await connector.fetchCategories(null);
  const currentCategory = categories.find(c => c.id === transaction.categoryId);
  if (!currentCategory) throw new QueryError("Transaction category not found");

  const direction = getTransactionDirection(transaction);
  if (currentCategory.type !== direction) {
    throw new QueryError("Transaction category does not match its account direction");
  }

  const account = await connector.fetchAccount(getTransactionAccountId(transaction));
  const now = toISOStringWithTimezone(Date.now(), "Asia/Bangkok");
  const action = await inferReply({
    text,
    now,
    transaction: {
      amount: transaction.amount,
      categoryId: transaction.categoryId,
      timestamp: toISOStringWithTimezone(transaction.timestamp, "Asia/Bangkok"),
      note: transaction.note
    },
    categories
  });

  if (action.action === "none") {
    return sendNoOp(action.reason || "This reply is not an edit or delete instruction.");
  }

  if (action.action === "delete") {
    await deleteTransaction({ method: "DELETE", path: "/api/webhooks", query: { id: transactionId }, body: undefined }, connector);
    const categoryLabel = getCategoryLabel(transaction.categoryId, categories);
    const cardLabel = await getTransactionCardLabel(transaction, connector);
    await editMessageText(
      repliedTo!.message_id,
      buildDeletedMessage({ transaction, direction, accountName: account.name, cardLabel, categoryLabel }),
      { parseMode: "HTML" }
    );
    await sendTelegramMessage(`<b>🗑 Deleted</b>\nDeleted transaction <code>${escapeHtml(transactionId)}</code>.`, { parseMode: "HTML" });
    return { status: "deleted", transactionId };
  }

  const hasAmount = action.amount !== null;
  const hasCategory = action.categoryId !== null;
  const hasTimestamp = action.timestamp !== null;
  const hasNote = action.note !== null;
  if (!hasAmount && !hasCategory && !hasTimestamp && !hasNote) {
    return sendNoOp("Nothing to change.");
  }

  const body: UpdateTransactionRequest = {};
  if (hasAmount) {
    if (action.amount == null || action.amount <= 0) throw new QueryError("Amount must be a positive number");
    body.amount = action.amount;
  }

  if (hasCategory) {
    if (!action.categoryId) throw new QueryError("Category is missing");
    const nextCategory = categories.find(c => c.id === action.categoryId);
    if (!nextCategory) throw new QueryError("Inferred category not found");
    if (isParentCategory(nextCategory.id, categories)) {
      throw new QueryError(`Category "${nextCategory.name}" is a parent category and cannot be selected`);
    }
    if (nextCategory.type === "System") {
      throw new QueryError(`Category "${nextCategory.name}" is a System category and cannot be selected`);
    }
    if (nextCategory.type !== direction) {
      throw new QueryError("Category type cannot change the transaction direction");
    }
    body.categoryId = action.categoryId;
  }

  if (hasTimestamp) {
    if (!action.timestamp) throw new QueryError("Timestamp is missing");
    const ms = new Date(action.timestamp).getTime();
    if (Number.isNaN(ms)) throw new QueryError("Inferred timestamp invalid");
    body.timestamp = ms;
  }

  if (hasNote) {
    body.note = action.note ?? "";
  }

  const result = await updateTransaction(
    { method: "PATCH", path: "/api/webhooks", query: { id: transactionId }, body },
    connector
  );
  const updated = result.body.transaction;
  const updatedCategoryLabel = getCategoryLabel(updated.categoryId, categories);
  const updatedCardLabel = await getTransactionCardLabel(updated, connector);
  await editMessageText(
    repliedTo!.message_id,
    buildConfirmationMessage({
      heading: "✅ Logged",
      transactionId: updated.id,
      amount: updated.amount,
      direction,
      accountName: account.name,
      cardLabel: updatedCardLabel,
      categoryLabel: updatedCategoryLabel,
      note: updated.note,
      edited: true
    }),
    { parseMode: "HTML" }
  );
  await sendTelegramMessage(`<b>✏️ Updated</b>\nUpdated transaction <code>${escapeHtml(transactionId)}</code>.`, { parseMode: "HTML" });
  return { status: "updated", transactionId };
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
    const replyAnchor = getMessageTextAndEntities(message.reply_to_message);
    const replyTransactionId = extractTransactionId(replyAnchor.text, replyAnchor.entities);
    const hasReplyTransactionId = Boolean(replyTransactionId);

    if (message.reply_to_message) {
      console.info("[webhooks] reply routing", {
        messageId: message.message_id,
        replyMessageId: message.reply_to_message.message_id,
        replyTextLength: replyAnchor.text.length,
        replyEntityTypes: replyAnchor.entities.map(e => e.type),
        hasReplyTransactionId,
        transactionId: replyTransactionId,
      });
    }

    if (message.reply_to_message && hasReplyTransactionId) {
      return await processReplyUpdate(message, text, connector);
    }

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
      await sendTelegramMessage(`<b>❓ Couldn't log</b>\n${escapeHtml(inferred.reason || "missing critical details")}. Please resend with the missing info.`, { parseMode: "HTML" });
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
    if (isParentCategory(category.id, categories)) {
      throw new QueryError(`Category "${category.name}" is a parent category and cannot be logged here`);
    }
    if (category.type === "System") {
      throw new QueryError(`Category "${category.name}" is a System category and cannot be logged here`);
    }

    let linkedCardId: string | undefined;
    let cardLabel = formatCardLabel(null);
    if (inferred.linkedCardId) {
      const card = cards.find(c => c.id === inferred.linkedCardId);
      if (!card) throw new QueryError("Inferred card not found");
      if (card.linkedAccountId && card.linkedAccountId !== accountId) {
        throw new QueryError("Inferred card does not belong to the inferred account");
      }
      linkedCardId = inferred.linkedCardId;
      cardLabel = formatCardLabel(card);
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
    await sendTelegramMessage(
      buildConfirmationMessage({
        heading: "✅ Logged",
        transactionId,
        amount,
        direction: category.type,
        accountName: account.name,
        cardLabel,
        categoryLabel: getCategoryLabel(category.id, categories),
        note,
        suggestion: inferred.suggestion
      }),
      { parseMode: "HTML" }
    );

    return { status: "logged", transactionId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const replyAnchor = getMessageTextAndEntities(message.reply_to_message);
    const action = extractTransactionId(replyAnchor.text, replyAnchor.entities) ? "process reply" : "log transaction";
    console.error(`[webhooks] could not ${action}`, e);
    try {
      await sendTelegramMessage(`<b>⚠️ Could not ${escapeHtml(action)}</b>\n${escapeHtml(msg)}`, { parseMode: "HTML" });
    } catch (sendError) {
      console.error("[webhooks] failed to send error notification", sendError);
    }
    return { status: "error", message: msg };
  }
}
