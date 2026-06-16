import { VercelRequest, VercelResponse } from '@vercel/node';
import { Connector } from './_lib/connector';
import { processTelegramUpdate } from './_handlers/webhook.handler';
import { TelegramUpdate } from './_lib/types/telegram.type';

function parseUpdateBody(body: unknown): TelegramUpdate {
  if (typeof body === 'string') return JSON.parse(body) as TelegramUpdate;
  return body as TelegramUpdate;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // Telegram echoes the secret token registered via setWebhook on every call.
  if (req.headers['x-telegram-bot-api-secret-token'] !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Always acknowledge with 200 so Telegram does not retry; failures are
  // reported back to the chat inside the handler.
  try {
    const update = parseUpdateBody(req.body);
    const outcome = await processTelegramUpdate(update, new Connector());
    const message = update.message;
    console.info('[webhooks] processed update', {
      updateId: update.update_id,
      status: outcome.status,
      reason: 'reason' in outcome ? outcome.reason : undefined,
      error: 'message' in outcome ? outcome.message : undefined,
      transactionId: 'transactionId' in outcome ? outcome.transactionId : undefined,
      chatId: message?.chat?.id,
      threadId: message?.message_thread_id,
      messageId: message?.message_id,
      hasReply: Boolean(message?.reply_to_message),
      hasText: Boolean(message?.text || message?.caption),
      hasPhoto: Boolean(message?.photo?.length),
    });
  } catch (e) {
    console.error('Webhook processing error:', e);
  }
  return res.status(200).json({ ok: true });
}
