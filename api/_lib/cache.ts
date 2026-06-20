import { Redis } from "@upstash/redis";

function getRedis(): Redis {
  return Redis.fromEnv();
}

export function getWebhookStateKey(updateId: number): string {
  return `telegram:update:${updateId}`;
}

export function getWebhookLockKey(updateId: number): string {
  return `telegram:lock:${updateId}`;
}

export async function getWebhookJobStatus(updateId: number): Promise<string | null> {
  return await getRedis().get<string>(getWebhookStateKey(updateId));
}

export async function setWebhookJobStatus(
  updateId: number,
  status: string
): Promise<void> {
  await getRedis().set(getWebhookStateKey(updateId), status, {
    ex: 86400
  });
}

export async function acquireWebhookJobLock(updateId: number): Promise<boolean> {
  const result = await getRedis().set(getWebhookLockKey(updateId), Date.now(), {
    nx: true,
    ex: 300
  });
  return result === "OK";
}

export async function releaseWebhookJobLock(updateId: number): Promise<void> {
  await getRedis().del(getWebhookLockKey(updateId));
}
