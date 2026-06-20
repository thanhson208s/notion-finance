import { Client } from "@upstash/qstash";

export async function publicWebhookJobMessage(dedupId: string, update: unknown): Promise<void> {
  const client = new Client({ token: process.env.QSTASH_TOKEN });
  await client.publishJSON({
    url: process.env.QSTASH_WORKER_URL as string,
    body: update,
    deduplicationId: dedupId,
    retries: parseInt(process.env.QSTASH_WORKER_RETRIES as string),
    timeout: parseInt(process.env.QSTASH_WORKER_TIMEOUT as string),
    headers: {
      "X-QStash-Worker-Secret": process.env.QSTASH_WORKER_SECRET as string
    }
  });
}
