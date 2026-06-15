import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processTelegramUpdate } from '../../_handlers/webhook.handler'
import { createMockConnector } from '../helpers/mockConnector'
import { inferTransaction } from '../../_lib/gemini'
import { sendTelegramMessage, getTelegramFilePath, downloadTelegramFileAsBase64 } from '../../_lib/telegram'
import { Category } from '../../_lib/types/category.type'
import { InferredTransaction, TelegramUpdate } from '../../_lib/types/telegram.type'

vi.mock('../../_lib/gemini', () => ({ inferTransaction: vi.fn() }))
vi.mock('../../_lib/telegram', () => ({
  sendTelegramMessage: vi.fn(),
  getTelegramFilePath: vi.fn(),
  downloadTelegramFileAsBase64: vi.fn(),
}))

const inferMock = vi.mocked(inferTransaction)
const sendMock = vi.mocked(sendTelegramMessage)

const CHAT_ID = '12345'
const TOPIC_ID = 7

const expenseCat: Category = { id: 'cat-1', name: 'Food', type: 'Expense', parentId: null, note: '' }
const incomeCat: Category = { id: 'cat-2', name: 'Salary', type: 'Income', parentId: null, note: '' }
const systemCat: Category = { id: 'cat-sys', name: 'Transfer', type: 'System', parentId: null, note: '' }

const makeAccount = (balance: number) => ({
  id: 'acc-1', name: 'Momo', type: 'eWallet', balance,
  active: true, note: '', totalTransactions: 0, lastTransactionDate: null,
  priorityScore: 0, linkedCardIds: []
})

const makeTx = (amount: number) => ({ id: 'tx-1', timestamp: Date.now(), amount, categoryId: 'cat-1', note: '' })

const makeConnector = (categories: Category[]) => createMockConnector({
  fetchAllAccounts: vi.fn().mockResolvedValue([makeAccount(200)]),
  fetchCategories: vi.fn().mockResolvedValue(categories),
  fetchAllCards: vi.fn().mockResolvedValue([]),
  fetchAccount: vi.fn().mockResolvedValue(makeAccount(200)),
  fetchCategory: vi.fn().mockResolvedValue(categories[0]),
  addExpense: vi.fn().mockResolvedValue(makeTx(50)),
  addIncome: vi.fn().mockResolvedValue(makeTx(100)),
  updateAccountAfterTransaction: vi.fn().mockResolvedValue(makeAccount(150)),
})

const makeUpdate = (updateId: number, over: Partial<TelegramUpdate['message']> = {}): TelegramUpdate => ({
  update_id: updateId,
  message: {
    message_id: updateId,
    chat: { id: Number(CHAT_ID) },
    message_thread_id: TOPIC_ID,
    text: '50k coffee momo',
    ...over,
  },
})

const inferred = (over: Partial<InferredTransaction> = {}): InferredTransaction => ({
  kind: 'transaction', amount: 50, categoryId: 'cat-1', accountId: 'acc-1', linkedCardId: null,
  timestamp: '2026-06-15T12:00:00+07:00', note: 'coffee', suggestion: '', reason: '', ...over,
})

describe('processTelegramUpdate()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('TELEGRAM_CHAT_ID', CHAT_ID)
    vi.stubEnv('TELEGRAM_TOPIC_ID', String(TOPIC_ID))
  })

  it('ignores updates with no message', async () => {
    const res = await processTelegramUpdate({ update_id: 100 } as TelegramUpdate, makeConnector([expenseCat]))
    expect(res.status).toBe('ignored')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('ignores updates from the wrong chat', async () => {
    const update = makeUpdate(101, {})
    update.message!.chat.id = 999
    const res = await processTelegramUpdate(update, makeConnector([expenseCat]))
    expect(res).toMatchObject({ status: 'ignored', reason: 'wrong chat' })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('ignores updates from the wrong topic', async () => {
    const res = await processTelegramUpdate(makeUpdate(102, { message_thread_id: 999 }), makeConnector([expenseCat]))
    expect(res).toMatchObject({ status: 'ignored', reason: 'wrong topic' })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('logs an expense and sends a confirmation', async () => {
    inferMock.mockResolvedValue(inferred({ amount: 50, categoryId: 'cat-1' }))
    const connector = makeConnector([expenseCat])
    const res = await processTelegramUpdate(makeUpdate(103), connector)
    expect(res).toMatchObject({ status: 'logged', transactionId: 'tx-1' })
    expect(connector.addExpense).toHaveBeenCalled()
    expect(connector.addIncome).not.toHaveBeenCalled()
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('✅ Logged'))
  })

  it("uses the model's note as the transaction note and appends a suggestion", async () => {
    inferMock.mockResolvedValue(inferred({ note: 'Highlands coffee', suggestion: 'Consider the Cafe subcategory' }))
    const connector = makeConnector([expenseCat])
    await processTelegramUpdate(makeUpdate(110), connector)
    expect(connector.addExpense).toHaveBeenCalledWith('acc-1', 50, 'cat-1', 'Highlands coffee', expect.any(Number), undefined, undefined, undefined)
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('💡 Consider the Cafe subcategory'))
  })

  it('notifies and does not log when input is not a transaction', async () => {
    inferMock.mockResolvedValue(inferred({ kind: 'not_transaction', amount: null, accountId: null, categoryId: null, reason: 'Just a greeting' }))
    const connector = makeConnector([expenseCat])
    const res = await processTelegramUpdate(makeUpdate(111, { text: 'hello everyone' }), connector)
    expect(res).toMatchObject({ status: 'not_transaction' })
    expect(connector.addExpense).not.toHaveBeenCalled()
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('Just a greeting'))
  })

  it('notifies and does not log when a transaction is missing critical info', async () => {
    inferMock.mockResolvedValue(inferred({ kind: 'incomplete', accountId: null, reason: 'no account specified' }))
    const connector = makeConnector([expenseCat])
    const res = await processTelegramUpdate(makeUpdate(112, { text: '50k coffee' }), connector)
    expect(res).toMatchObject({ status: 'incomplete' })
    expect(connector.addExpense).not.toHaveBeenCalled()
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('no account specified'))
  })

  it('treats kind=transaction with a null critical field as incomplete', async () => {
    inferMock.mockResolvedValue(inferred({ kind: 'transaction', amount: null, reason: 'amount unclear' }))
    const connector = makeConnector([expenseCat])
    const res = await processTelegramUpdate(makeUpdate(113), connector)
    expect(res.status).toBe('incomplete')
    expect(connector.addExpense).not.toHaveBeenCalled()
  })

  it('logs an income when the category type is Income', async () => {
    inferMock.mockResolvedValue(inferred({ categoryId: 'cat-2' }))
    const connector = makeConnector([incomeCat])
    const res = await processTelegramUpdate(makeUpdate(104), connector)
    expect(res.status).toBe('logged')
    expect(connector.addIncome).toHaveBeenCalled()
    expect(connector.addExpense).not.toHaveBeenCalled()
  })

  it('parses an explicit ISO timestamp into epoch ms', async () => {
    inferMock.mockResolvedValue(inferred({ timestamp: '2026-03-18T20:24:00+07:00' }))
    const connector = makeConnector([expenseCat])
    await processTelegramUpdate(makeUpdate(105), connector)
    const expectedMs = new Date('2026-03-18T20:24:00+07:00').getTime()
    expect(connector.addExpense).toHaveBeenCalledWith('acc-1', 50, 'cat-1', expect.any(String), expectedMs, undefined, undefined, undefined)
  })

  it('rejects System categories', async () => {
    inferMock.mockResolvedValue(inferred({ categoryId: 'cat-sys' }))
    const connector = makeConnector([systemCat])
    const res = await processTelegramUpdate(makeUpdate(106), connector)
    expect(res.status).toBe('error')
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('⚠️'))
  })

  it('reports an error when inference fails', async () => {
    inferMock.mockRejectedValue(new Error('Gemini returned invalid JSON'))
    const connector = makeConnector([expenseCat])
    const res = await processTelegramUpdate(makeUpdate(107), connector)
    expect(res).toMatchObject({ status: 'error' })
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('Could not log'))
  })

  it('downloads the largest photo and passes it to the LLM', async () => {
    inferMock.mockResolvedValue(inferred())
    vi.mocked(getTelegramFilePath).mockResolvedValue('photos/file_2.jpg')
    vi.mocked(downloadTelegramFileAsBase64).mockResolvedValue({ data: 'BASE64', mimeType: 'image/jpeg' })
    const connector = makeConnector([expenseCat])
    await processTelegramUpdate(makeUpdate(109, {
      text: undefined,
      caption: 'lunch',
      photo: [{ file_id: 'small' }, { file_id: 'large' }],
    }), connector)
    expect(getTelegramFilePath).toHaveBeenCalledWith('large')
    expect(inferMock).toHaveBeenCalledWith(expect.objectContaining({
      image: { data: 'BASE64', mimeType: 'image/jpeg' },
    }))
  })
})
