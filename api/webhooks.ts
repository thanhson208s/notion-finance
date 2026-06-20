import { VercelRequest, VercelResponse } from "@vercel/node";
import { handleWebhookRequest } from "./_handlers/webhook.handler";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  if (req.headers["x-telegram-bot-api-secret-token"] !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return handleWebhookRequest(req, res);
}
