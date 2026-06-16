import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendTelegramMessage } from '../../_lib/telegram'

describe('telegram helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'token')
    vi.stubEnv('TELEGRAM_CHAT_ID', '123')
  })

  it('includes reply_parameters when replying to a user message', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{"ok":true}', { status: 200 }))

    await sendTelegramMessage('hello', { parseMode: 'HTML', replyToMessageId: 42 })

    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)
    expect(body).toMatchObject({
      chat_id: '123',
      text: 'hello',
      parse_mode: 'HTML',
      reply_parameters: { message_id: 42 },
    })
  })
})
