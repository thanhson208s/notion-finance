import { VercelRequest, VercelResponse } from "@vercel/node";
import { publishWebhookJobMessage } from "../_lib/qstash";
import { TelegramUpdate } from "../_lib/types/telegram.type";

export async function handleWebhookRequest(req: VercelRequest, res: VercelResponse) {
  try {
    const update = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as TelegramUpdate;
    const message = update.message;

    if (!message) {
      console.info("[webhooks] outcome", {
        updateId: update.update_id,
        status: "ignored",
        reason: "no message",
      });
      return res.status(200).json({ ok: true });
    }

    if (String(message.chat?.id) !== String(process.env.TELEGRAM_CHAT_ID)) {
      console.info("[webhooks] outcome", {
        updateId: update.update_id,
        status: "ignored",
        reason: "wrong chat",
        chatId: message.chat?.id,
        messageId: message.message_id,
      });
      return res.status(200).json({ ok: true });
    }

    await publishWebhookJobMessage(`telegram:job:${update.update_id}`, update);
    console.info("[webhooks] outcome", {
      updateId: update.update_id,
      status: "queued",
      chatId: message?.chat?.id,
      messageId: message?.message_id,
      hasReply: Boolean(message?.reply_to_message),
      hasText: Boolean(message?.text || message?.caption),
      hasPhoto: Boolean(message?.photo?.length),
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.info("[webhooks] outcome", {
      status: "error",
      error: e instanceof Error ? e.message : String(e)
    });
    return res.status(500).json({ ok: false });
  }
}
