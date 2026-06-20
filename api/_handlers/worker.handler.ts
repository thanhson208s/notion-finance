import { VercelRequest, VercelResponse } from "@vercel/node";
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
import {
  acquireWebhookJobLock,
  getWebhookJobStatus,
  releaseWebhookJobLock,
  setWebhookJobStatus
} from "../_lib/cache";

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

function formatCategoryLabel(categoryId: string, categories: Category[]): string {
  const category = categories.find(c => c.id === categoryId);
  if (!category) return categoryId;

  if (!category.parentId) return category.name;
  const parent = categories.find(c => c.id === category.parentId);
  return parent ? `${parent.name} > ${category.name}` : category.name;
}

function formatCardLabel(card: Card): string {
  return `${card.name} (${card.number})`;
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

async function sendNoOp(reason: string, replyToMessageId?: number): Promise<WebhookOutcome> {
  await sendTelegramMessage(
    `<b>🤖 No action</b>\n${escapeHtml(reason)}`,
    { parseMode: "HTML", replyToMessageId }
  );
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

  const account = await connector.fetchAccount((transaction.fromAccountId ?? transaction.toAccountId) as string);
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
    return sendNoOp(action.reason || "This reply is not an edit or delete instruction.", message.message_id);
  }

  if (action.action === "delete") {
    await deleteTransaction({ method: "DELETE", path: "/api/webhooks", query: { id: transactionId }, body: undefined }, connector);
    const categoryLabel = formatCategoryLabel(transaction.categoryId, categories);
    const cardLabel = transaction.linkedCardId ? formatCardLabel(await connector.fetchCardById(transaction.linkedCardId)) : 'None';
    await editMessageText(
      repliedTo!.message_id,
      buildDeletedMessage({ transaction, direction: currentCategory.type as 'Income' | 'Expense', accountName: account.name, cardLabel, categoryLabel }),
      { parseMode: "HTML" }
    );
    await sendTelegramMessage(
      `<b>🗑 Deleted</b>\nDeleted transaction <code>${escapeHtml(transactionId)}</code>.`,
      { parseMode: "HTML", replyToMessageId: message.message_id }
    );
    return { status: "deleted", transactionId };
  }

  const hasAmount = action.amount !== null;
  const hasCategory = action.categoryId !== null;
  const hasTimestamp = action.timestamp !== null;
  const hasNote = action.note !== null;
  if (!hasAmount && !hasCategory && !hasTimestamp && !hasNote) {
    return sendNoOp("Nothing to change.", message.message_id);
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
    if (categories.some(c => c.parentId === nextCategory.id)) {
      throw new QueryError(`Category "${nextCategory.name}" is a parent category and cannot be selected`);
    }
    if (nextCategory.type === "System") {
      throw new QueryError(`Category "${nextCategory.name}" is a System category and cannot be selected`);
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
  const updatedCategoryLabel = formatCategoryLabel(updated.categoryId, categories);
  const updatedCardLabel = updated.linkedCardId ? formatCardLabel(await connector.fetchCardById(updated.linkedCardId)) : 'None';
  await editMessageText(
    repliedTo!.message_id,
    buildConfirmationMessage({
      heading: "✅ Logged",
      transactionId: updated.id,
      amount: updated.amount,
      direction: (categories.find(c => c.id === updated.categoryId) as Category).type as 'Income' | 'Expense',
      accountName: account.name,
      cardLabel: updatedCardLabel,
      categoryLabel: updatedCategoryLabel,
      note: updated.note,
      edited: true
    }),
    { parseMode: "HTML" }
  );
  await sendTelegramMessage(
    `<b>✏️ Updated</b>\nUpdated transaction <code>${escapeHtml(transactionId)}</code>.`,
    { parseMode: "HTML", replyToMessageId: message.message_id }
  );
  return { status: "updated", transactionId };
}

export async function processTelegramUpdate(
  update: TelegramUpdate,
  connector: Connector
): Promise<WebhookOutcome> {
  const message = update?.message;
  if (!message) return { status: "ignored", reason: "no message" };

  // Restrict to the configured chat.
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (String(message.chat?.id) !== String(chatId)) {
    return { status: "ignored", reason: "wrong chat" };
  }

  const text = message.text ?? message.caption ?? "";
  const replyAnchor = getMessageTextAndEntities(message.reply_to_message);
  const replyTransactionId = extractTransactionId(replyAnchor.text, replyAnchor.entities);
  const hasReplyTransactionId = Boolean(replyTransactionId);

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
    await sendTelegramMessage(
      `🤖 ${inferred.reason || "This doesn't look like a transaction, so nothing was logged."}`,
      { replyToMessageId: message.message_id }
    );
    return { status: "not_transaction", reason: inferred.reason };
  }

  // A transaction attempt missing critical info — ask for it and stop. Also
  // catches a model that returned kind=transaction but left a critical field null.
  if (
    inferred.kind === "incomplete" ||
    inferred.amount == null || inferred.amount <= 0 ||
    !inferred.accountId || !inferred.categoryId
  ) {
    await sendTelegramMessage(
      `<b>❓ Couldn't log</b>\n${escapeHtml(inferred.reason || "missing critical details")}. Please resend with the missing info.`,
      { parseMode: "HTML", replyToMessageId: message.message_id }
    );
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
  if (categories.some(c => c.parentId === category.id)) {
    throw new QueryError(`Category "${category.name}" is a parent category and cannot be logged here`);
  }
  if (category.type === "System") {
    throw new QueryError(`Category "${category.name}" is a System category and cannot be logged here`);
  }

  let linkedCardId: string | undefined;
  let cardLabel = 'None';
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
      categoryLabel: formatCategoryLabel(category.id, categories),
      note,
      suggestion: inferred.suggestion
    }),
    { parseMode: "HTML", replyToMessageId: message.message_id }
  );

  return { status: "logged", transactionId };
}

export async function handleWorkerRequest(req: VercelRequest, res: VercelResponse) {
  const update = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as TelegramUpdate;
  const updateId = update.update_id;

  const errorMessage = (error: unknown):string => error instanceof Error ? error.message : String(error);

  const existing = await getWebhookJobStatus(updateId);
  if (existing) {
    console.info("[worker] outcome", {
      updateId,
      status: "skipped",
      reason: "already terminal",
      terminalStatus: existing,
    });
    return res.status(200).json({ ok: true });
  }

  try {
    const locked = await acquireWebhookJobLock(updateId);
    if (!locked) {
      console.info("[worker] outcome", {
        updateId,
        status: "skipped",
        reason: "lock exists",
      });
      return res.status(200).json({ ok: true });
    }
  } catch (error) {
    console.info("[worker] lock acquire failed", {
      updateId,
      error: errorMessage(error),
    });
  }

  try {
    const outcome = await processTelegramUpdate(update, new Connector());
    
    try {
      await setWebhookJobStatus(updateId, 'succeeded');
    } catch (stateError) {
      console.info("[worker] set status failed", {
        updateId,
        error: errorMessage(stateError),
      });
    }

    console.info("[worker] outcome", {
      updateId,
      status: outcome.status,
      reason: "reason" in outcome ? outcome.reason : undefined,
      transactionId: "transactionId" in outcome ? outcome.transactionId : undefined,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    const permanent = error instanceof QueryError;
    const retryCount = Number.parseInt(req.headers["upstash-retried"] as string ?? "0", 10);
    const finalAttempt = retryCount >= parseInt(process.env.QSTASH_WORKER_RETRIES as string);
    const message = update.message;

    if (!permanent && !finalAttempt) {
      console.info("[worker] outcome", {
        updateId,
        status: "retrying",
        retry: retryCount,
        error: errorMessage(error),
      });
      return res.status(500).json({ ok: false });
    }

    await sendTelegramMessage(
      `<b>⚠️ Could not process</b>\n${escapeHtml(error instanceof Error ? error.message : String(error))}`,
      { parseMode: "HTML", replyToMessageId: message?.message_id }
    );

    try {
      await setWebhookJobStatus(updateId, 'failed');
    } catch (stateError) {
      console.info("[worker] set status failed", {
        updateId,
        error: errorMessage(stateError),
      });
    }

    console.info("[worker] outcome", {
      updateId,
      status: "failed",
      permanent,
      finalAttempt,
      error: errorMessage(error),
    });

    return res.status(200).json({ ok: true });
  } finally {
    try {
      await releaseWebhookJobLock(updateId);
    } catch (error) {
      console.info("[worker] lock release failed", {
        updateId,
        error: errorMessage(error),
      });
    }
  }
}
