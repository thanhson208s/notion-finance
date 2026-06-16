// Google AI Studio (Gemini) helper. Infers a single transaction from a
// Telegram message (text + optional images) plus the user's accounts,
// categories, and cards. Returns strict JSON via the model's structured output.

import { Account } from "./types/account.type";
import { Category } from "./types/category.type";
import { Card } from "./types/card.type";
import { InferredReply, InferredTransaction } from "./types/telegram.type";
import { QueryError } from "./types/error";

type TransactionInferInput = {
  text: string
  image: { data: string; mimeType: string } | null
  // Current timestamp (ISO 8601, Asia/Bangkok). Used as the base the model
  // overrides with any date/time explicitly stated in the message/image.
  now: string
  accounts: Account[]
  categories: Category[]
  cards: Card[]
};

type ReplyInferInput = {
  text: string
  now: string
  transaction: {
    amount: number
    categoryId: string
    timestamp: string
    note: string
  }
  categories: Category[]
};

// Response schema forces the model to return exactly these fields.
const TRANSACTION_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    kind: { type: "STRING", format: "enum", enum: ["transaction", "incomplete", "not_transaction"] },
    amount: { type: "INTEGER", nullable: true },
    categoryId: { type: "STRING", nullable: true },
    accountId: { type: "STRING", nullable: true },
    linkedCardId: { type: "STRING", nullable: true },
    timestamp: { type: "STRING" },
    note: { type: "STRING" },
    suggestion: { type: "STRING" },
    reason: { type: "STRING" }
  },
  required: ["kind", "amount", "categoryId", "accountId", "linkedCardId", "timestamp", "note", "suggestion", "reason"]
};

const REPLY_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    action: { type: "STRING", format: "enum", enum: ["edit", "delete", "none"] },
    amount: { type: "INTEGER", nullable: true },
    categoryId: { type: "STRING", nullable: true },
    timestamp: { type: "STRING", nullable: true },
    note: { type: "STRING", nullable: true },
    reason: { type: "STRING" }
  },
  required: ["action", "amount", "categoryId", "timestamp", "note", "reason"]
};

function formatCategories(categoriesInput: Category[]): string {
  const parentIds = new Set(categoriesInput.map(c => c.parentId).filter((id): id is string => !!id));
  const nameById = new Map(categoriesInput.map(c => [c.id, c.name]));
  return categoriesInput.map(c => {
    const selectable = parentIds.has(c.id) ? "no" : "yes";
    const parent = c.parentId ? (nameById.get(c.parentId) ?? "unknown") : "none";
    return `- id=${c.id} name="${c.name}" type=${c.type} parent="${parent}" selectable=${selectable} note="${c.note}"`;
  }).join("\n");
}

function buildTransactionPrompt(input: TransactionInferInput): string {
  const accounts = input.accounts.map(a => `- id=${a.id} name="${a.name}" type=${a.type}`).join("\n");

  const categories = formatCategories(input.categories);

  const cards = input.cards.map(c => `- id=${c.id} name="${c.name}" number=${c.number} linkedAccountId=${c.linkedAccountId ?? "none"}`).join("\n");

  return [
    "You are a personal-finance bookkeeping assistant. Read the user's Telegram message (text and/or receipt image), classify it, and when it is a transaction map it to the user's accounts, categories, and cards.",
    "Use every clue available — in the message text AND anywhere in the image (merchant names, logos, app/bank names, item lines, printed notes) — to make the best match.",
    "",
    "Return ONLY JSON matching the required schema. Rules:",
    "- kind: classify the message. \"transaction\" = you can confidently determine the amount, the account, AND the category. \"incomplete\" = it is clearly meant to record a spend/income but at least one of those three critical fields cannot be determined. \"not_transaction\" = it is not about recording money at all (greeting, question, chat, etc.).",
    "- amount: positive integer in VND. Strip currency symbols/separators (₫, VND, commas, dots) and round to an integer. Use null if it cannot be determined.",
    "- accountId: pick the account whose name (or type) best matches clues in the message/image — e.g. a wallet/bank/app name shown or a logo. Match primarily against the account name. If you also select a card (see linkedCardId), accountId MUST equal that card's linkedAccountId. Use null if it cannot be determined.",
    "- categoryId: pick the single best-fitting category by matching clues (merchant, items, purpose) against each category's name AND its note. The note lists example merchants/keywords that belong to that category, so weight it heavily. You may ONLY select a leaf category (selectable=yes). NEVER select a parent category (selectable=no) — parents are listed only to give context about their child subcategories. Use null if no category fits.",
    "- linkedCardId: pick the card whose name or number best matches clues in the message/image. A card `number` is shown as its first 6 digits + masked middle + last 4 digits (e.g. \"356587******6036\"). Match against: the card name; the first 6 digits (the bank/BIN prefix); or the last 4 digits — if any of these appear in the text or are visible on the card/receipt in the image. Use null when no card is clearly referenced; do NOT guess a card. A card belongs to exactly one account: if you select a card, set accountId to that card's linkedAccountId, and never pair a card with a different account.",
    `- timestamp: ISO 8601 with the Asia/Bangkok offset (YYYY-MM-DDTHH:mm:ss+07:00). The current time is ${input.now}. Start from the current time and override ONLY the date/time components explicitly stated in the message or visible in the image. Examples: a time with no date → today's date with that time; a date with no time → that date with the current time; neither → return the current time exactly. Always return a full timestamp; never null.`,
    "- note: a concise description of what the transaction was for (merchant and/or items/purpose). Do NOT include the amount, account, card, or date/time.",
    "- suggestion: when kind=transaction, a short natural-language remark (English) ONLY if you have something useful to add — e.g. propose a more fitting category/subcategory, warn that the amount or account looks wrong, or flag ambiguity. Empty string if you have nothing to add, or when kind != transaction.",
    "- reason: when kind=incomplete, briefly state which critical field is missing and what to provide (e.g. \"no account specified — which wallet/card?\"). When kind=not_transaction, briefly say why it isn't a transaction. Empty string when kind=transaction.",
    "",
    "ACCOUNTS:",
    accounts || "(none)",
    "",
    "CATEGORIES (select only selectable=yes leaves; selectable=no are parents shown for context):",
    categories || "(none)",
    "",
    "CARDS:",
    cards || "(none)",
    "",
    `MESSAGE: ${input.text || "(no text)"}`
  ].join("\n");
}

function buildReplyPrompt(input: ReplyInferInput): string {
  const categories = formatCategories(input.categories);

  return [
    "You are a personal-finance bookkeeping assistant. The user replied to a previously logged transaction confirmation.",
    "Classify the reply as an edit request, delete request, or no-op. Return ONLY JSON matching the required schema.",
    "",
    "Rules:",
    "- action: \"edit\" when the user asks to change amount, category, timestamp, or note. \"delete\" when the user asks to remove/scrap/delete the transaction. \"none\" for comments, questions, thanks, or anything that is not an edit/delete instruction.",
    "- For action=edit, fill ONLY the fields the user explicitly wants changed. Use null for unchanged fields.",
    "- amount: positive integer in VND. Strip currency symbols/separators and round to an integer. Use null when unchanged.",
    "- categoryId: select only a selectable=yes leaf category. Use null when unchanged.",
    `- timestamp: ISO 8601 with Asia/Bangkok offset (YYYY-MM-DDTHH:mm:ss+07:00). Current time is ${input.now}. Start from the transaction timestamp and override only date/time components explicitly stated in the reply. Use null when unchanged.`,
    "- note: the new transaction note only when explicitly changed. Use an empty string only when the user clearly wants to clear the note. Use null when unchanged.",
    "- reason: for none, explain briefly why nothing will change. For delete, briefly summarize the delete intent. For edit, keep empty unless there is a useful warning.",
    "",
    "CURRENT TRANSACTION:",
    `amount=${input.transaction.amount}`,
    `categoryId=${input.transaction.categoryId}`,
    `timestamp=${input.transaction.timestamp}`,
    `note="${input.transaction.note}"`,
    "",
    "CATEGORIES (select only selectable=yes leaves; selectable=no are parents shown for context):",
    categories || "(none)",
    "",
    `REPLY: ${input.text || "(no text)"}`
  ].join("\n");
}

export async function inferTransaction(input: TransactionInferInput): Promise<InferredTransaction> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL_ID;

  const parts: object[] = [{ text: buildTransactionPrompt(input) }];
  if (input.image) {
    parts.push({ inlineData: { mimeType: input.image.mimeType, data: input.image.data } });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: TRANSACTION_RESPONSE_SCHEMA
        }
      })
    }
  );

  if (!res.ok) {
    throw new QueryError(`Gemini request failed: ${res.status}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  };
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new QueryError("Gemini returned no content");

  let parsed: InferredTransaction;
  try {
    parsed = JSON.parse(raw) as InferredTransaction;
  } catch {
    throw new QueryError("Gemini returned invalid JSON");
  }
  return parsed;
}

export async function inferReply(input: ReplyInferInput): Promise<InferredReply> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL_ID;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildReplyPrompt(input) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: REPLY_RESPONSE_SCHEMA
        }
      })
    }
  );

  if (!res.ok) {
    throw new QueryError(`Gemini request failed: ${res.status}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  };
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new QueryError("Gemini returned no content");

  let parsed: InferredReply;
  try {
    parsed = JSON.parse(raw) as InferredReply;
  } catch {
    throw new QueryError("Gemini returned invalid JSON");
  }
  return parsed;
}
