import { VercelRequest, VercelResponse } from '@vercel/node';
import { Connector } from './_lib/connector';
import { processTelegramUpdate } from './_handlers/webhook.handler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // Telegram echoes the secret token registered via setWebhook on every call.
  const received = req.headers['x-telegram-bot-api-secret-token'];
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  // TEMP debug — does not print the secret, only presence/length/match.
  console.log('[webhook auth]', JSON.stringify({
    receivedPresent: received !== undefined,
    receivedType: Array.isArray(received) ? 'array' : typeof received,
    receivedLen: typeof received === 'string' ? received.length : null,
    expectedPresent: expected !== undefined,
    expectedLen: typeof expected === 'string' ? expected.length : null,
    match: received === expected,
    receivedHead: typeof received === 'string' ? received.slice(0, 4) : null,
    expectedHead: typeof expected === 'string' ? expected.slice(0, 4) : null,
  }));
  if (received !== expected) {
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
