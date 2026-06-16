import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processTelegramUpdate } from '../../_handlers/webhook.handler'
import { createMockConnector } from '../helpers/mockConnector'
import { inferReply, inferTransaction } from '../../_lib/gemini'
import { sendTelegramMessage, getTelegramFilePath, downloadTelegramFileAsBase64, editMessageText } from '../../_lib/telegram'
import { Category } from '../../_lib/types/category.type'
import { InferredReply, InferredTransaction, TelegramUpdate } from '../../_lib/types/telegram.type'

vi.mock('../../_lib/gemini', () => ({ inferTransaction: vi.fn(), inferReply: vi.fn() }))
vi.mock('../../_lib/telegram', () => ({
  sendTelegramMessage: vi.fn(),
  editMessageText: vi.fn(),
  getTelegramFilePath: vi.fn(),
  downloadTelegramFileAsBase64: vi.fn(),
}))

const inferMock = vi.mocked(inferTransaction)
const inferReplyMock = vi.mocked(inferReply)
const sendMock = vi.mocked(sendTelegramMessage)
const editMessageMock = vi.mocked(editMessageText)

const CHAT_ID = '12345'
const TOPIC_ID = 7

const expenseCat: Category = { id: 'cat-1', name: 'Food', type: 'Expense', parentId: null, note: '' }
const parentExpenseCat: Category = { id: 'cat-parent', name: 'Food', type: 'Expense', parentId: null, note: '' }
const childExpenseCat: Category = { id: 'cat-child', name: 'Cafe', type: 'Expense', parentId: 'cat-parent', note: '' }
const incomeCat: Category = { id: 'cat-2', name: 'Salary', type: 'Income', parentId: null, note: '' }
const systemCat: Category = { id: 'cat-sys', name: 'Transfer', type: 'System', parentId: null, note: '' }

const makeAccount = (balance: number) => ({
  id: 'acc-1', name: 'Momo', type: 'eWallet', balance,
  active: true, note: '', totalTransactions: 0, lastTransactionDate: null,
  priorityScore: 0, linkedCardIds: []
})

const makeCard = () => ({
  id: 'card-1',
  name: 'Visa Platinum',
  number: '411111******1111',
  imageUrl: '',
  annualFee: null,
  spendingLimit: null,
  requiredSpending: null,
  lastChargedDate: null,
  billingDay: null,
  linkedAccountId: 'acc-1',
  linkedServices: [],
  cashbackCap: null,
  network: null,
})

const makeTx = (amount: number, over = {}) => ({
  id: 'tx-1',
  timestamp: Date.now(),
  amount,
  fromAccountId: 'acc-1',
  categoryId: 'cat-1',
  note: '',
  ...over,
})

const makeConnector = (categories: Category[], overrides = {}) => createMockConnector({
  fetchAllAccounts: vi.fn().mockResolvedValue([makeAccount(200)]),
  fetchCategories: vi.fn().mockResolvedValue(categories),
  fetchAllCards: vi.fn().mockResolvedValue([]),
  fetchCardById: vi.fn().mockResolvedValue(makeCard()),
  fetchAccount: vi.fn().mockResolvedValue(makeAccount(200)),
  fetchCategory: vi.fn().mockResolvedValue(categories[0]),
  addExpense: vi.fn().mockResolvedValue(makeTx(50)),
  addIncome: vi.fn().mockResolvedValue(makeTx(100)),
  updateAccountAfterTransaction: vi.fn().mockResolvedValue(makeAccount(150)),
  fetchTransaction: vi.fn().mockResolvedValue(makeTx(50)),
  updateAccountBalance: vi.fn().mockResolvedValue(makeAccount(150)),
  updateTransactionPage: vi.fn().mockResolvedValue(makeTx(60, { amount: 60 })),
  archiveTransaction: vi.fn().mockResolvedValue(undefined),
  ...overrides,
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

const inferredReply = (over: Partial<InferredReply> = {}): InferredReply => ({
  action: 'edit', amount: 60, categoryId: null, timestamp: null, note: null, reason: '', ...over,
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
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('<b>✅ Logged</b>'), { parseMode: 'HTML' })
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('Card: &quot;None&quot;'), { parseMode: 'HTML' })
  })

  it('shows linked card name and number in confirmation', async () => {
    inferMock.mockResolvedValue(inferred({ linkedCardId: 'card-1' }))
    const connector = makeConnector([expenseCat], {
      fetchAllCards: vi.fn().mockResolvedValue([makeCard()]),
    })
    await processTelegramUpdate(makeUpdate(122), connector)
    expect(connector.addExpense).toHaveBeenCalledWith('acc-1', 50, 'cat-1', 'coffee', expect.any(Number), 'card-1', undefined, undefined)
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('Card: Visa Platinum (411111******1111)'), { parseMode: 'HTML' })
  })

  it("uses the model's note as the transaction note and appends a suggestion", async () => {
    inferMock.mockResolvedValue(inferred({ note: 'Highlands coffee', suggestion: 'Consider the Cafe subcategory' }))
    const connector = makeConnector([expenseCat])
    await processTelegramUpdate(makeUpdate(110), connector)
    expect(connector.addExpense).toHaveBeenCalledWith('acc-1', 50, 'cat-1', 'Highlands coffee', expect.any(Number), undefined, undefined, undefined)
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('💡 Consider the Cafe subcategory'), { parseMode: 'HTML' })
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
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('no account specified'), { parseMode: 'HTML' })
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
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('⚠️'), { parseMode: 'HTML' })
  })

  it('reports an error when inference fails', async () => {
    inferMock.mockRejectedValue(new Error('Gemini returned invalid JSON'))
    const connector = makeConnector([expenseCat])
    const res = await processTelegramUpdate(makeUpdate(107), connector)
    expect(res).toMatchObject({ status: 'error' })
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('Could not log'), { parseMode: 'HTML' })
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

  it('logs normally when Telegram includes reply_to_message without a transaction id anchor', async () => {
    inferMock.mockResolvedValue(inferred())
    const connector = makeConnector([expenseCat])
    const res = await processTelegramUpdate(makeUpdate(114, {
      text: '50k coffee momo',
      reply_to_message: {
        message_id: 1,
        chat: { id: Number(CHAT_ID) },
        message_thread_id: TOPIC_ID,
        text: 'hello',
      },
    }), connector)
    expect(res).toMatchObject({ status: 'logged', transactionId: 'tx-1' })
    expect(inferMock).toHaveBeenCalled()
    expect(inferReplyMock).not.toHaveBeenCalled()
    expect(connector.addExpense).toHaveBeenCalled()
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('<b>✅ Logged</b>'), { parseMode: 'HTML' })
  })

  it('ignores an empty reply without notifying or inferring', async () => {
    const connector = makeConnector([expenseCat])
    const res = await processTelegramUpdate(makeUpdate(121, {
      text: undefined,
      reply_to_message: {
        message_id: 1,
        chat: { id: Number(CHAT_ID) },
        message_thread_id: TOPIC_ID,
        text: '✅ Logged\n<code>tx-1</code>',
      },
    }), connector)
    expect(res).toMatchObject({ status: 'ignored', reason: 'empty reply' })
    expect(inferMock).not.toHaveBeenCalled()
    expect(inferReplyMock).not.toHaveBeenCalled()
    expect(connector.fetchTransaction).not.toHaveBeenCalled()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('reply none sends no-op and does not mutate', async () => {
    inferReplyMock.mockResolvedValue(inferredReply({ action: 'none', amount: null, reason: 'just a comment' }))
    const connector = makeConnector([expenseCat])
    const res = await processTelegramUpdate(makeUpdate(115, {
      text: 'nice',
      reply_to_message: {
        message_id: 1,
        chat: { id: Number(CHAT_ID) },
        message_thread_id: TOPIC_ID,
        text: '✅ Logged\n<code>tx-1</code>',
      },
    }), connector)
    expect(res.status).toBe('no_op')
    expect(connector.updateTransactionPage).not.toHaveBeenCalled()
    expect(connector.archiveTransaction).not.toHaveBeenCalled()
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('just a comment'), { parseMode: 'HTML' })
  })

  it('reply edit amount reuses updateTransaction balance reconciliation and edits the confirmation', async () => {
    inferReplyMock.mockResolvedValue(inferredReply({ amount: 60 }))
    const fetchTransaction = vi.fn().mockResolvedValue(makeTx(50))
    const updateAccountBalance = vi.fn().mockResolvedValue(makeAccount(140))
    const updateTransactionPage = vi.fn().mockResolvedValue(makeTx(60, { amount: 60, note: 'coffee' }))
    const connector = makeConnector([expenseCat], { fetchTransaction, updateAccountBalance, updateTransactionPage })
    const res = await processTelegramUpdate(makeUpdate(116, {
      text: 'make it 60k',
      reply_to_message: {
        message_id: 99,
        chat: { id: Number(CHAT_ID) },
        message_thread_id: TOPIC_ID,
        text: '✅ Logged\n<code>tx-1</code>',
      },
    }), connector)
    expect(res).toMatchObject({ status: 'updated', transactionId: 'tx-1' })
    expect(updateAccountBalance).toHaveBeenCalledWith('acc-1', 190)
    expect(updateTransactionPage).toHaveBeenCalledWith('tx-1', expect.objectContaining({ amount: 60 }))
    expect(editMessageMock).toHaveBeenCalledWith(99, expect.stringContaining('<b>✅ Logged (edited)</b>'), { parseMode: 'HTML' })
    expect(editMessageMock).toHaveBeenCalledWith(99, expect.stringContaining('Card: &quot;None&quot;'), { parseMode: 'HTML' })
    expect(editMessageMock).toHaveBeenCalledWith(99, expect.stringContaining('Tx: <code>tx-1</code>'), { parseMode: 'HTML' })
  })

  it('reply edit rejects parent, System, and cross-direction categories', async () => {
    const replyUpdate = makeUpdate(117, {
      text: 'wrong category',
      reply_to_message: {
        message_id: 99,
        chat: { id: Number(CHAT_ID) },
        message_thread_id: TOPIC_ID,
        text: '✅ Logged\n<code>tx-1</code>',
      },
    })

    inferReplyMock.mockResolvedValue(inferredReply({ amount: null, categoryId: 'cat-parent' }))
    let connector = makeConnector([parentExpenseCat, childExpenseCat], {
      fetchTransaction: vi.fn().mockResolvedValue(makeTx(50, { categoryId: 'cat-child' })),
    })
    let res = await processTelegramUpdate(replyUpdate, connector)
    expect(res.status).toBe('error')
    expect(connector.updateTransactionPage).not.toHaveBeenCalled()

    vi.clearAllMocks()
    inferReplyMock.mockResolvedValue(inferredReply({ amount: null, categoryId: 'cat-sys' }))
    connector = makeConnector([expenseCat, systemCat])
    res = await processTelegramUpdate(replyUpdate, connector)
    expect(res.status).toBe('error')
    expect(connector.updateTransactionPage).not.toHaveBeenCalled()

    vi.clearAllMocks()
    inferReplyMock.mockResolvedValue(inferredReply({ amount: null, categoryId: 'cat-2' }))
    connector = makeConnector([expenseCat, incomeCat])
    res = await processTelegramUpdate(replyUpdate, connector)
    expect(res.status).toBe('error')
    expect(connector.updateTransactionPage).not.toHaveBeenCalled()
  })

  it('reply edit rejects invalid timestamps', async () => {
    inferReplyMock.mockResolvedValue(inferredReply({ amount: null, timestamp: 'not-a-date' }))
    const connector = makeConnector([expenseCat])
    const res = await processTelegramUpdate(makeUpdate(118, {
      text: 'yesterday at nope',
      reply_to_message: {
        message_id: 99,
        chat: { id: Number(CHAT_ID) },
        message_thread_id: TOPIC_ID,
        text: '✅ Logged\n<code>tx-1</code>',
      },
    }), connector)
    expect(res.status).toBe('error')
    expect(connector.updateTransactionPage).not.toHaveBeenCalled()
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('Inferred timestamp invalid'), { parseMode: 'HTML' })
  })

  it('reply delete archives the transaction and tombstones the original message without a Tx anchor', async () => {
    inferReplyMock.mockResolvedValue(inferredReply({ action: 'delete', amount: null, reason: 'delete it' }))
    const archiveTransaction = vi.fn().mockResolvedValue(undefined)
    const connector = makeConnector([expenseCat], { archiveTransaction })
    const res = await processTelegramUpdate(makeUpdate(119, {
      text: 'delete this',
      reply_to_message: {
        message_id: 99,
        chat: { id: Number(CHAT_ID) },
        message_thread_id: TOPIC_ID,
        text: '✅ Logged\n<code>tx-1</code>',
      },
    }), connector)
    expect(res).toMatchObject({ status: 'deleted', transactionId: 'tx-1' })
    expect(archiveTransaction).toHaveBeenCalledWith('tx-1')
    expect(editMessageMock).toHaveBeenCalledWith(99, expect.stringContaining('<b>🗑 Deleted</b>'), { parseMode: 'HTML' })
    const tombstoneText = editMessageMock.mock.calls[0][1]
    expect(tombstoneText).not.toContain('Tx:')
    expect(tombstoneText).not.toContain('<code>')
  })

  it('formats Telegram confirmations with HTML Tx and parent > child category labels', async () => {
    inferMock.mockResolvedValue(inferred({ categoryId: 'cat-child' }))
    const connector = makeConnector([parentExpenseCat, childExpenseCat])
    await processTelegramUpdate(makeUpdate(120), connector)
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('<b>✅ Logged</b>'), { parseMode: 'HTML' })
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('Tx: <code>tx-1</code>'), { parseMode: 'HTML' })
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('Category: Food &gt; Cafe'), { parseMode: 'HTML' })
  })
})
