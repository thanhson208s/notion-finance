# Feature: Telegram Webhook Transaction Logging

**Status**: ✅ DONE (F-18)

---

## Overview

A Telegram bot receives messages (text and/or images) posted in a single pre-configured group + forum topic. Each message is parsed by a Google AI Studio (Gemini) LLM into a structured transaction, logged to Notion, and confirmed back in the same chat.

This replaces the retired self-hosted agent under `agent/` with a simpler server-side flow. There is **no Accept/Reject step** — the transaction is logged immediately and a confirmation message is sent.

End-to-end flow:

1. Telegram pushes an update to `POST /api/webhooks` (text + optional images), restricted to the configured group/topic.
2. The handler loads accounts, categories, and cards from Notion.
3. The message content plus the reference lists are sent to the Gemini endpoint, which returns a JSON object `{ kind, amount, categoryId, accountId, linkedCardId, timestamp, note, suggestion, reason }`.
4. The transaction is logged to Notion (balance updated).
5. A confirmation notification is posted back to the same group/topic.

---

## Endpoint & Auth

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/api/webhooks` |
| Handler | `api/webhooks.ts` → `api/_handlers/webhook.handler.ts` |

Telegram cannot send the `x-cloudflare-secret` header or a JWT, so the default middleware checks must not apply to this route:

- `/api/webhooks` is added to the bypass list in `middleware.ts` (alongside `/api/auth` and `/api/cron/*`).
- Authenticate instead by validating Telegram's `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET`. Reject with HTTP 401 if it does not match. The secret is registered with Telegram via `setWebhook` (see [Setup](#setup-setwebhook)).

**Group/topic filtering**: ignore any update whose `message.chat.id` does not equal `TELEGRAM_CHAT_ID` or whose `message.message_thread_id` does not equal `TELEGRAM_TOPIC_ID`. Filtered updates are acknowledged with HTTP 200 (no action). Always respond `200` promptly so Telegram does not retry the delivery.

---

## Telegram Update Schema

Fields consumed from the incoming [Telegram Update](https://core.telegram.org/bots/api#update) object:

| Field | Type | Use |
|---|---|---|
| `message.message_id` | Number | Logging |
| `message.chat.id` | Number | Must equal `TELEGRAM_CHAT_ID` |
| `message.message_thread_id` | Number | Must equal `TELEGRAM_TOPIC_ID` |
| `message.text` / `message.caption` | String | Free-text transaction description |
| `message.photo[]` | Array | Receipt images — array of sizes; use the largest `file_id` |

**Image handling**: a `photo` entry only carries a `file_id`. To pass the image to Gemini: call `getFile` (`https://api.telegram.org/bot<token>/getFile?file_id=...`) to get a `file_path`, download from `https://api.telegram.org/file/bot<token>/<file_path>`, then send it to the LLM as inline base64 data.

---

## Reference Data

Loaded fresh from Notion per message via the `Connector` (`api/_lib/connector.ts`):

| Method | Provides |
|---|---|
| `fetchAllAccounts()` | `{ id, name, type, balance, ... }[]` |
| `fetchCategories(null)` | `{ id, name, type, parentId, note }[]` — both Income and Expense |
| `fetchAllCards()` | `{ id, accountId, name, number }[]` |

These lists are embedded in the LLM prompt so the model can resolve names/hints to IDs. Categories are annotated with `parent` and `selectable` flags: a category that is the parent of any other is marked `selectable=no` and shown for context only; the model may only choose a `selectable=yes` leaf subcategory.

> **Caching (optional enhancement)**: the old agent cached these in CSV files with a 168h TTL. That approach does not port to Vercel — the serverless filesystem is ephemeral and not shared across invocations. If reference-data fetch latency becomes a problem, use an in-memory module-level cache with a short TTL (only warm lambdas benefit). Default behavior is fetch-fresh per message.

---

## LLM Inference (Google AI Studio / Gemini)

The handler sends a single request to the Gemini API containing:

- The message text/caption.
- The image (if any) as an inline base64 part.
- The current timestamp (ISO 8601, `Asia/Bangkok`) as the base for date/time resolution.
- The accounts, categories, and cards lists.
- A system prompt instructing the model to return **only** strict JSON.

**Output contract:**

```json
{
  "kind": "transaction | incomplete | not_transaction",
  "amount": 50000,
  "categoryId": "170c3752-...",
  "accountId": "16cc3752-...",
  "linkedCardId": "2fcc3752-... | null",
  "timestamp": "2026-06-15T20:24:00+07:00",
  "note": "Highlands coffee",
  "suggestion": "",
  "reason": ""
}
```

- `kind` — classification of the message: `transaction` (amount + account + category all confidently determined), `incomplete` (a transaction attempt missing a critical field), or `not_transaction` (not about money). See [Rejected & incomplete input](#rejected--incomplete-input).
- `amount` — positive integer (VND), currency symbols/separators stripped. `null` if it cannot be determined.
- `accountId` — chosen by matching clues in the message/image (wallet/bank/app name, logo) against each account's **name** (and type). `null` if it cannot be determined.
- `categoryId` — chosen by matching clues (merchant, items, purpose) against each category's **name** and **note** (the note lists example merchants/keywords). Must be a `selectable=yes` **leaf** subcategory — parent categories are never selected. `null` if no category fits.
- `linkedCardId` — chosen by matching clues against each card's **name** or **number** (shown as first 6 digits + masked + last 4, e.g. `356587******6036`): the card name, the first-6 BIN prefix, or the last-4 digits. `null` when no card is clearly referenced. **Constraint:** a card belongs to exactly one account — when a `linkedCardId` is selected, `accountId` must equal that card's `linkedAccountId`.
- `timestamp` — a **full** ISO 8601 value with the `Asia/Bangkok` offset (`YYYY-MM-DDTHH:mm:ss+07:00`), never null. The handler passes the **current time** to the model as a base; the model overrides only the date/time components explicitly stated in the message or visible in an image. So a time with no date keeps today's date; a date with no time uses the current time; a message with neither yields the current time exactly.
- `note` — concise description of the transaction (merchant/items/purpose); stored as the Notion transaction note. Excludes amount, account, card, and date/time.
- `suggestion` — when `kind=transaction`, an optional short natural-language remark (better-fitting category, possible wrong amount/account, ambiguity); empty string when there's nothing to add. Appended to the confirmation message, not stored.
- `reason` — when `kind` is `incomplete` or `not_transaction`, the user-facing explanation (what's missing, or why it isn't a transaction); empty string when `kind=transaction`.

The LLM replaces the old agent's rule-based hint matching. Model and endpoint are configurable via env (`GEMINI_API_KEY`, `GEMINI_MODEL_ID`) — the specific model is chosen at implementation time.

---

## Rejected & incomplete input

Before logging, the handler branches on the model's `kind` (and defensively re-checks the critical fields):

| Case | Condition | Action |
|---|---|---|
| **Not a transaction** | `kind = not_transaction` | Post `🤖 <reason>` to the topic; do **not** log. Outcome `not_transaction`. |
| **Incomplete** | `kind = incomplete`, **or** `amount`/`accountId`/`categoryId` is null or `amount <= 0` (even if the model said `transaction`) | Post `❓ Couldn't log — <reason>. Please resend with the missing info.`; do **not** log. Outcome `incomplete`. |
| **Transaction** | `kind = transaction` and all critical fields present | Proceed to logging below. |

Critical fields are **amount, account, category** (card is optional; timestamp is always derived). The route still returns HTTP 200 in every case.

---

## Transaction Logging

Reuse the existing transaction flow — do not duplicate balance logic:

1. Validate that `accountId` and `categoryId` returned by the LLM exist (`fetchAccount`, `fetchCategory`); if `linkedCardId` is non-null, validate it too.
2. Resolve the timestamp: parse the model's ISO 8601 string to epoch milliseconds and pass it to `addExpense`/`addIncome`. The model always returns a full timestamp (current time with any stated date/time substituted in), so no null handling is needed; as a defensive fallback an unparseable value is omitted, letting `addExpense`/`addIncome` default to `Date.now()`.
3. Determine direction from the category `type`: `Expense` → `addExpense(...)`, `Income` → `addIncome(...)` (see `api/_handlers/transaction.handler.ts`). The model's `note` is stored as the transaction note.
4. The connector creates the transaction (ID format `${categoryId}-${Date.now()}-${amount}`) and the handler updates the account balance via `updateAccountAfterTransaction(...)` — expense decreases, income increases.

As with the existing handlers, the create + balance-update is **not atomic**.

---

## Confirmation Notification

After a successful log, post a confirmation to the same group/topic using the existing `sendTelegramMessage()` pattern in `api/_handlers/snapshot.handler.ts` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_TOPIC_ID`).

Example:

```
✅ Logged: -50,000₫
Account: Momo
Category: Food
Note: Highlands coffee
Tx: 170c3752-...-1718000000000-50000
💡 Consider the Cafe subcategory
```

The `Note:` line is shown when the model returned a note, and the `💡` line is appended when the model returned a non-empty `suggestion`.

On failure (LLM could not produce valid JSON, IDs invalid, or Notion error), post an error message to the same topic instead so the user knows the message was not logged.

---

## Implementation

| File | Role |
|---|---|
| `api/webhooks.ts` | Webhook route — validates `X-Telegram-Bot-Api-Secret-Token`, parses the update, always returns 200 |
| `api/_handlers/webhook.handler.ts` | Business logic: filter chat/topic → load reference data → call LLM → reuse `logExpense`/`logIncome` → notify |
| `api/_lib/gemini.ts` | Wraps the Google AI Studio request (text + inline images → strict JSON via `responseSchema`) |
| `api/_lib/telegram.ts` | Shared Telegram helpers: `sendTelegramMessage`, `getTelegramFilePath`, `downloadTelegramFileAsBase64` (also used by `snapshot.handler.ts`) |
| `api/_lib/types/telegram.type.ts` | `TelegramUpdate` / `TelegramMessage` / `InferredTransaction` types |
| `api/_handlers/transaction.handler.ts` | Reused: `logExpense` / `logIncome` (validation + balance update) |
| `api/_lib/connector.ts` | Reused: `fetchAllAccounts`, `fetchCategories`, `fetchAllCards`, `fetchAccount`, `fetchCategory`, `addExpense`, `addIncome`, `updateAccountAfterTransaction` |
| `middleware.ts` | `/api/webhooks` added to the auth bypass list |
| `api/__tests__/handlers/webhook.handler.test.ts` | Unit tests (filtering, expense/income, timestamp parse, System reject, not_transaction, incomplete, image, error) |

---

## Environment Variables

| Variable | Type | Description |
|---|---|---|
| `TELEGRAM_WEBHOOK_SECRET` | Secret | Validated against the `X-Telegram-Bot-Api-Secret-Token` header on every webhook call |
| `GEMINI_API_KEY` | Secret | Google AI Studio API key |
| `GEMINI_MODEL_ID` | String | Gemini model id (chosen at implementation) |

Reused existing variables: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_TOPIC_ID`, `NOTION_API_KEY`, `NOTION_ACCOUNT_DATABASE_ID`, `NOTION_CATEGORY_DATABASE_ID`, `NOTION_CARD_DATABASE_ID`, `NOTION_TRANSACTION_DATABASE_ID`.

---

## Setup (setWebhook)

Register the webhook with Telegram, including the secret token Telegram will echo back on every call:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://finance.gootube.online/api/webhooks",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message"]
  }'
```

To stop delivery: `POST .../deleteWebhook`.

---

## Known Constraints

- **No deduplication**: Telegram retries deliveries until it receives a 200. The route always returns 200 promptly (failures are reported to the chat, not surfaced as non-200), so retries are unlikely; there is no dedup guard, so a retry after a slow success could double-log.
- **No persistent cache**: reference data is fetched fresh per message (see [Reference Data](#reference-data)).
- **LLM mis-inference**: the model may pick the wrong account/category or misread an amount. There is no Accept/Reject confirmation, so corrections happen manually in Notion (or via the app).
- **Non-atomic balance update**: matches existing transaction handlers — a failure between transaction creation and balance update leaves state inconsistent.
