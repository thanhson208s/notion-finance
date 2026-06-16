// Minimal subset of the Telegram Bot API objects this app consumes.
// Full reference: https://core.telegram.org/bots/api#update

export type TelegramPhoto = {
  file_id: string
  file_unique_id?: string
  width?: number
  height?: number
  file_size?: number
}

export type TelegramChat = {
  id: number
  type?: string
}

export type TelegramMessageEntity = {
  type: string
  offset: number
  length: number
}

export type TelegramMessage = {
  message_id: number
  chat: TelegramChat
  message_thread_id?: number
  text?: string
  caption?: string
  entities?: TelegramMessageEntity[]
  caption_entities?: TelegramMessageEntity[]
  photo?: TelegramPhoto[]
  reply_to_message?: TelegramMessage
}

export type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
}

// Structured output the Gemini model must return for a single message.
export type InferredTransaction = {
  // Classification of the incoming message:
  // - transaction: a complete, loggable transaction
  // - incomplete: a transaction attempt missing critical info (amount/account/category)
  // - not_transaction: not a transaction at all (chatter, question, etc.)
  kind: "transaction" | "incomplete" | "not_transaction"
  // Critical fields — null when the model cannot determine them (e.g. incomplete
  // or not_transaction).
  amount: number | null
  categoryId: string | null
  accountId: string | null
  linkedCardId: string | null
  // Full ISO 8601 with the Asia/Bangkok offset. Derived from the current time,
  // overridden by any date/time explicitly stated in the message/image.
  timestamp: string
  // Concise description of the transaction; stored as the transaction note.
  note: string
  // Optional natural-language remark when kind=transaction (better category,
  // warning, ambiguity). Empty string when there is nothing to add.
  suggestion: string
  // User-facing explanation when kind != transaction (what's missing, or why the
  // message was not a transaction). Empty string when kind=transaction.
  reason: string
}

export type InferredReply = {
  action: "edit" | "delete" | "none"
  amount: number | null
  categoryId: string | null
  timestamp: string | null
  note: string | null
  reason: string
}
