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
5. A formatted confirmation notification is posted back to the same group/topic.

**Editing/deleting by reply:** a user can **reply** to a transaction's confirmation message in natural language to edit it (e.g. "change to 60k", "should be the Cafe category") or delete it (e.g. "delete this"). This branch is detected up front and handled separately — see [Editing or deleting a logged transaction (via reply)](#editing-or-deleting-a-logged-transaction-via-reply).

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
| `message.text` / `message.caption` | String | Free-text transaction description, or the edit instruction when replying |
| `message.photo[]` | Array | Receipt images — array of sizes; use the largest `file_id` |
| `message.reply_to_message` | Message | May be present for explicit replies or forum-topic context. It routes to the [edit/delete flow](#editing-or-deleting-a-logged-transaction-via-reply) only when its `text` carries the transaction ID inside `<code>...</code>` |

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
| **Not a transaction** | `kind = not_transaction` | Post `🤖 No action` with `<reason>` to the topic; do **not** log. Outcome `no_op`. |
| **Incomplete** | `kind = incomplete`, **or** `amount`/`accountId`/`categoryId` is null or `amount <= 0` (even if the model said `transaction`) | Post `❓ Couldn't log — <reason>. Please resend with the missing info.`; do **not** log. Outcome `incomplete`. |
| **Transaction** | `kind = transaction` and all critical fields present | Proceed to logging below. |

Critical fields are **amount, account, category** (card is optional; timestamp is always derived). The route still returns HTTP 200 in every case.

---

## Transaction Logging

Reuse the existing transaction flow — do not duplicate balance logic:

1. Validate that `accountId` and `categoryId` returned by the LLM exist in the loaded reference data; if `linkedCardId` is non-null, validate that it exists and belongs to the inferred account.
2. Resolve the timestamp: parse the model's ISO 8601 string to epoch milliseconds and pass it to `addExpense`/`addIncome`. The model always returns a full timestamp (current time with any stated date/time substituted in), so no null handling is needed. An unparseable timestamp is treated as an error and the transaction is not logged.
3. Determine direction from the category `type`: `Expense` → `addExpense(...)`, `Income` → `addIncome(...)` (see `api/_handlers/transaction.handler.ts`). The model's `note` is stored as the transaction note.
4. The connector creates the transaction (ID format `${categoryId}-${Date.now()}-${amount}`) and the handler updates the account balance via `updateAccountAfterTransaction(...)` — expense decreases, income increases.

As with the existing handlers, the create + balance-update is **not atomic**.

---

## Confirmation Notification

After a successful log, post a confirmation to the same group/topic using `sendTelegramMessage()` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_TOPIC_ID`). Webhook notifications use Telegram HTML `parse_mode`: headings are bold, dynamic content is HTML-escaped, and the transaction ID is rendered as monospace.

Example:

```html
<b>✅ Logged</b>: -50,000₫
Account: Momo
Card: Visa Platinum (411111******1111)
Category: Food > Cafe
Note: Highlands coffee
Tx: <code>170c3752-...-1718000000000-50000</code>
💡 Consider the Cafe subcategory
```

The `Card:` line shows `Card: name (number)` when a linked card is used, or `Card: "None"` otherwise. For categories with parents, the display label is `Parent > Child`; otherwise it is just the category name. The `Note:` line shows `Empty` when there is no note, and the `💡` line is appended when the model returned a non-empty `suggestion`.

On failure (LLM could not produce valid JSON, IDs invalid, or Notion error), post an error message to the same topic instead so the user knows the message was not logged.

---

## Editing or deleting a logged transaction (via reply)

A user can **reply** to a confirmation message with a natural-language instruction to either edit (e.g. "make it 60k", "wrong category, it's coffee", "yesterday 8pm") or delete it (e.g. "delete this", "remove", "that's wrong, scrap it"). This is checked **before** the normal new-transaction flow.

> **Why reply-based, not "delete the message":** the Telegram **Bot API has no update for message deletion** in groups (only `deleted_business_messages`, which applies to connected Telegram Business DMs — not a group/topic). A bot therefore cannot detect a user deleting the log message, so deletion is driven by a **reply** instead. See [Known Constraints](#known-constraints).

For **edits**, only **amount, note, category, and timestamp** can be changed; the **account and linked card are not editable** by reply (the account determines the transaction's direction and balance side).

### Flow

1. **Detect the reply edit/delete case.** An update with `message.reply_to_message` is routed to the reply handler only when the replied-to message text contains a transaction ID inside `<code>...</code>` (the confirmation always includes it). If Telegram includes `reply_to_message` without that code-tagged transaction ID, the update is treated as a normal new transaction message.
2. **Extract & query.** Parse `transactionId` from the first `<code>...</code>` block in the replied-to text and load it with `connector.fetchTransaction(id)`. The transaction's account is `fromAccountId` (expense) or `toAccountId` (income).
3. **Load reference data.** `connector.fetchCategories(null)` only (account and card are fixed, so neither accounts nor cards are needed).
4. **Infer the intent.** Send Gemini the reply text **plus the transaction's current fields** (amount, category, note, timestamp) and the categories list. The model returns `action` = `edit` / `delete` / `none`, plus the changed fields for an edit. See [Reply inference contract](#reply-inference-contract).
5. **Branch on `action`:**
   - **`none`** → reply `🤖 No action` with the reason; do nothing.
   - **`delete`** → go to [Delete](#delete-branch).
   - **`edit`** → validate & apply ([Edit](#edit-branch)).

### Edit branch

1. **Validate** (defensive, like the logging path):
   - If all change fields are `null` → treat as `none` ("nothing to change").
   - **amount** (if set) must be `> 0`.
   - **categoryId** (if set) must exist, be a `selectable=yes` leaf, not `System`, and be the **same type** (`Income`/`Expense`) as the transaction's existing direction — cross-type changes are rejected.
   - **timestamp** (if set) must parse to a valid epoch (validate before converting).
2. **Apply** by reusing the `updateTransaction` handler (`api/_handlers/transaction.handler.ts`) — pass `id` via `query` and only the changed fields in the body. It already reconciles account balances when `amount` changes (via `updateAccountBalance`) and writes the rest through `connector.updateTransactionPage`.
3. **Edit the original message** — rebuild the confirmation from the updated transaction and `editMessageText(reply_to_message.message_id, newText)` (helper in `api/_lib/telegram.ts`), with an `(edited)` marker. The transaction ID remains inside `<code>...</code>` so further edits/deletes remain possible.
4. **Confirm** — send a separate bold `✏️ Updated` message on success. On validation/Notion failure, send a bold warning and do not mutate the original confirmation.

### Delete branch

1. **Apply** by reusing the existing `deleteTransaction` handler (`api/_handlers/transaction.handler.ts:79`) — pass `id` via `query`. It already **reverses both account balances** and soft-deletes via `connector.archiveTransaction`.
2. **Tombstone the original message** — `editMessageText(reply_to_message.message_id, "<b>🗑 Deleted</b>: <original summary>")`. The confirmation is kept (not removed) so chat history stays readable; the code-tagged transaction ID is removed so it can't be edited/deleted again.
3. **Confirm** — send a separate bold `🗑 Deleted` message on success. On failure, send a bold warning and leave the original confirmation unchanged.

### Reply inference contract

A separate Gemini call (`inferReply` in `api/_lib/gemini.ts`) with its own schema. The edit fields are **nullable**, where `null` means **leave unchanged** — the model fills only the fields the user explicitly wants changed (and leaves them all `null` for `delete`/`none`):

```json
{
  "action": "edit | delete | none",
  "amount": 60000,
  "categoryId": null,
  "timestamp": null,
  "note": null,
  "reason": ""
}
```

- `action` — `edit` (change one or more fields), `delete` (remove the transaction), or `none` (the reply isn't an edit/delete instruction — a comment, a question, etc.).
- `amount` / `categoryId` / `timestamp` / `note` — for `action=edit`, the **new** value when the user wants it changed, otherwise `null` (unchanged); all `null` for `delete`/`none`. Same field semantics as the [main contract](#llm-inference-google-ai-studio--gemini) (amount = positive VND integer; categoryId = `selectable=yes` leaf; timestamp = full ISO 8601 `+07:00`).
- `reason` — explanation when `action` is `none` (or `delete`, for the confirmation); otherwise a short optional remark.

---

## Implementation

| File | Role |
|---|---|
| `api/webhooks.ts` | Webhook route — validates `X-Telegram-Bot-Api-Secret-Token`, parses the update, always returns 200 |
| `api/_handlers/webhook.handler.ts` | Business logic: filter chat/topic → route replies to edit/delete/no-op only, otherwise new transaction logging → load reference data → call LLM → reuse `logExpense`/`logIncome`, `updateTransaction` (edit), or `deleteTransaction` (delete) → notify |
| `api/_lib/gemini.ts` | `inferTransaction` (new logs) and `inferReply` (reply edit/delete intent) — Google AI Studio requests returning strict JSON via `responseSchema` |
| `api/_lib/telegram.ts` | Shared Telegram helpers: `sendTelegramMessage`, `editMessageText` (edit + delete tombstone), optional HTML `parse_mode`, `getTelegramFilePath`, `downloadTelegramFileAsBase64` (also used by `snapshot.handler.ts`) |
| `api/_lib/types/telegram.type.ts` | `TelegramUpdate` / `TelegramMessage` (incl. `reply_to_message`) / `InferredTransaction` / `InferredReply` types |
| `api/_handlers/transaction.handler.ts` | Reused: `logExpense` / `logIncome` (new transaction logging + balance update); `updateTransaction` (edit — balance reconcile + field update); `deleteTransaction` (delete — balance reverse + archive) |
| `api/_lib/connector.ts` | Reused: `fetchAllAccounts`, `fetchCategories`, `fetchAllCards`, `fetchAccount`, `fetchCategory`, `addExpense`, `addIncome`, `updateAccountAfterTransaction`; for edit/delete `fetchTransaction`, `updateTransactionPage`, `updateAccountBalance`, `archiveTransaction` |
| `middleware.ts` | `/api/webhooks` added to the auth bypass list |
| `api/__tests__/handlers/webhook.handler.test.ts` | Unit tests (filtering, expense/income, timestamp parse, System reject, no-op/not-transaction, incomplete, image, error, ignored replies, reply-edit, reply-delete, not-an-edit/delete) |

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
- **Message deletion is not detectable**: the Telegram Bot API sends no update when a user deletes a message in a group (only `deleted_business_messages` for connected Telegram Business DMs, which doesn't apply here). So a transaction **cannot** be deleted by deleting its log message — deletion is done by **replying** "delete" to the confirmation instead.
- **Edit/delete depends on the code-tagged transaction ID**: the reply flow finds the transaction by parsing the first `<code>...</code>` block from the replied-to message, so the transaction ID must remain wrapped in `<code>` in every confirmation and edited confirmation. After a delete, the message is tombstoned and the code-tagged ID is removed so it can't be acted on again. A `reply_to_message` without that anchor is treated as normal new-transaction logging, which prevents Telegram forum-topic metadata from blocking fresh logs.
- **Edit scope**: only amount, note, category, and timestamp are editable by reply; the account and the linked card cannot be changed this way, and a category can only change within the transaction's existing Income/Expense direction.
- **`allowed_updates`**: replies arrive as ordinary `message` updates, so the existing `["message"]` registration already covers them — no `setWebhook` change is needed.
