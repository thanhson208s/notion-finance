import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleWebhookRequest } from "../../_handlers/webhook.handler";
import { publishWebhookJobMessage } from "../../_lib/qstash";
import { TelegramUpdate } from "../../_lib/types/telegram.type";

vi.mock("../../_lib/qstash", () => ({
  publicWebhookJobMessage: vi.fn(),
}));

const publishMock = vi.mocked(publishWebhookJobMessage);

function makeResponse() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    status: vi.fn(function (this: { statusCode: number }, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function (this: { body: unknown }, body: unknown) {
      this.body = body;
      return this;
    }),
    send: vi.fn(function (this: { body: unknown }, body: unknown) {
      this.body = body;
      return this;
    }),
  };
}

const makeUpdate = (over: Partial<TelegramUpdate["message"]> = {}): TelegramUpdate => ({
  update_id: 123,
  message: {
    message_id: 123,
    chat: { id: 42 },
    text: "50k coffee momo",
    ...over,
  },
});

describe("handleWebhookRequest()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "telegram-secret");
    vi.stubEnv("TELEGRAM_CHAT_ID", "42");
    publishMock.mockResolvedValue(undefined);
  });

  it("publishes valid Telegram updates to QStash and returns 200", async () => {
    const req = {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "telegram-secret" },
      body: makeUpdate(),
    };
    const res = makeResponse();

    await handleWebhookRequest(req as never, res as never);

    expect(publishMock).toHaveBeenCalledWith("update.update_id", makeUpdate());
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("returns 500 when enqueue fails so Telegram can retry", async () => {
    publishMock.mockRejectedValue(new Error("qstash unavailable"));
    const req = {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "telegram-secret" },
      body: makeUpdate(),
    };
    const res = makeResponse();

    await handleWebhookRequest(req as never, res as never);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ ok: false });
  });

  it("acknowledges updates without messages without enqueueing", async () => {
    const req = {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "telegram-secret" },
      body: { update_id: 123 },
    };
    const res = makeResponse();

    await handleWebhookRequest(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(publishMock).not.toHaveBeenCalled();
  });

  it("acknowledges wrong-chat updates without enqueueing", async () => {
    const req = {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "telegram-secret" },
      body: makeUpdate({ chat: { id: 999 } }),
    };
    const res = makeResponse();

    await handleWebhookRequest(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(publishMock).not.toHaveBeenCalled();
  });
});
