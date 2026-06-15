import { VercelRequest, VercelResponse } from '@vercel/node';
import { Connector } from './_lib/connector';
import { processTelegramUpdate } from './_handlers/webhook.handler';

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
    await processTelegramUpdate(req.body, new Connector());
  } catch (e) {
    console.error('Webhook processing error:', e);
  }
  return res.status(200).json({ ok: true });
}
