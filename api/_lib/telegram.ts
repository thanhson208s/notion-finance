// Shared Telegram Bot API helpers. Used by the webhook handler and the cron
// run reports (snapshot/archive). All sends target the configured group/topic.

const TELEGRAM_API = "https://api.telegram.org";

export async function sendTelegramMessage(text: string): Promise<void> {
  await fetch(`${TELEGRAM_API}/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      message_thread_id: parseInt(process.env.TELEGRAM_TOPIC_ID ?? "0"),
      text
    })
  });
}

// Resolves a Telegram file_id to a downloadable file_path via getFile.
export async function getTelegramFilePath(fileId: string): Promise<string> {
  const res = await fetch(
    `${TELEGRAM_API}/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`
  );
  const json = (await res.json()) as { ok: boolean; result?: { file_path?: string } };
  if (!json.ok || !json.result?.file_path) {
    throw new Error(`Telegram getFile failed for file_id ${fileId}`);
  }
  return json.result.file_path;
}

// Downloads a Telegram file and returns it as base64 plus its MIME type,
// ready to be passed to a multimodal LLM as inline data.
export async function downloadTelegramFileAsBase64(
  filePath: string
): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(
    `${TELEGRAM_API}/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`
  );
  if (!res.ok) throw new Error(`Telegram file download failed: ${res.status}`);
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { data: buffer.toString("base64"), mimeType };
}
