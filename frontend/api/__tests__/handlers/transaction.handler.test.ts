import { describe, it, expect, vi } from 'vitest'
import { logExpense, logIncome, transferBalance, listExpenses, listIncomes, getTransaction, deleteTransaction, updateTransaction } from '../../_handlers/transaction.handler'
import { createMockConnector } from '../helpers/mockConnector'
import { QueryError } from '../../_lib/types/error'
import { Transaction } from '../../_lib/types/transaction.type'
import { Category } from '../../_lib/types/category.type'

const makeEvent = <T>(body?: T, query: Record<string, string> = {}) => ({
  method: 'POST',
  path: '/api/expense',
  query,
  body: body as T
})

const makeTx = (amount: number): Transaction => ({
  id: 'tx-1',
  timestamp: Date.now(),
  amount,
  categoryId: 'cat-1',
  note: ''
})

const mockCategory: Category = { id: 'cat-1', name: 'Food', type: 'Expense', parentId: null }

const makeAccount = (balance: number, totalTransactions: number | null = null) => ({
  balance, totalTransactions, lastTransactionDate: null, priorityScore: 0,
  id: 'acc-1', name: 'Test', type: 'Cash', linkedCardIds: [], cards: []
})

// Default overrides shared by most logExpense/logIncome tests
const defaultExpenseSetup = (overrides = {}) => createMockConnector({
  fetchAccount: vi.fn().mockResolvedValue(makeAccount(200)),
  fetchCategory: vi.fn().mockResolvedValue(mockCategory),
  addExpense: vi.fn().mockResolvedValue(makeTx(50)),
  updateAccountAfterTransaction: vi.fn().mockResolvedValue(makeAccount(150)),
  ...overrides
})

const defaultIncomeSetup = (overrides = {}) => createMockConnector({
  fetchAccount: vi.fn().mockResolvedValue(makeAccount(0)),
  fetchCategory: vi.fn().mockResolvedValue(mockCategory),
  addIncome: vi.fn().mockResolvedValue(makeTx(100)),
  updateAccountAfterTransaction: vi.fn().mockResolvedValue(makeAccount(100)),
  ...overrides
})

describe('logExpense()', () => {
  it('throws QueryError when amount <= 0 (zero)', async () => {
    const connector = createMockConnector()
    await expect(logExpense(makeEvent({ accountId: 'a', amount: 0, categoryId: 'c', note: '' }), connector))
      .rejects.toThrow(QueryError)
  })

  it('throws QueryError when amount <= 0 (negative)', async () => {
    const connector = createMockConnector()
    await expect(logExpense(makeEvent({ accountId: 'a', amount: -10, categoryId: 'c', note: '' }), connector))
      .rejects.toThrow(QueryError)
  })

  it('validates categoryId before writing (BUG #5)', async () => {
    const fetchCategory = vi.fn().mockResolvedValue(mockCategory)
    const connector = defaultExpenseSetup({ fetchCategory })
    await logExpense(makeEvent({ accountId: 'a', amount: 50, categoryId: 'cat-2', note: '' }), connector)
    expect(fetchCategory).toHaveBeenCalledWith('cat-2')
  })

  it('deducts amount from account balance', async () => {
    const connector = createMockConnector({
      fetchAccount: vi.fn().mockResolvedValue(makeAccount(500)),
      fetchCategory: vi.fn().mockResolvedValue(mockCategory),
      addExpense: vi.fn().mockResolvedValue(makeTx(100)),
      updateAccountAfterTransaction: vi.fn().mockResolvedValue(makeAccount(400))
    })
    const result = await logExpense(makeEvent({ accountId: 'a', amount: 100, categoryId: 'c', note: '' }), connector)
    expect(connector.updateAccountAfterTransaction).toHaveBeenCalledWith('a', 400, 1, expect.any(Number))
    expect((result.body).newBalance).toBe(400)
  })

  it('calls addExpense with correct args (no linkedCardId)', async () => {
    const addExpense = vi.fn().mockResolvedValue(makeTx(50))
    const connector = defaultExpenseSetup({ addExpense })
    await logExpense(makeEvent({ accountId: 'acc-1', amount: 50, categoryId: 'cat-2', note: 'lunch' }), connector)
    expect(addExpense).toHaveBeenCalledWith('acc-1', 50, 'cat-2', 'lunch', undefined, undefined)
  })

  it('passes linkedCardId to addExpense when provided (BUG #2)', async () => {
    const addExpense = vi.fn().mockResolvedValue(makeTx(50))
    const connector = defaultExpenseSetup({ addExpense })
    await logExpense(makeEvent({ accountId: 'acc-1', amount: 50, categoryId: 'cat-2', note: '', linkedCardId: 'card-1' }), connector)
    expect(addExpense).toHaveBeenCalledWith('acc-1', 50, 'cat-2', '', undefined, 'card-1')
  })

  it('passes timestamp to addExpense when provided', async () => {
    const addExpense = vi.fn().mockResolvedValue(makeTx(50))
    const connector = defaultExpenseSetup({ addExpense })
    await logExpense(makeEvent({ accountId: 'acc-1', amount: 50, categoryId: 'cat-2', note: '', timestamp: 1700000000000 }), connector)
    expect(addExpense).toHaveBeenCalledWith('acc-1', 50, 'cat-2', '', 1700000000000, undefined)
  })

  it('returns oldBalance, newBalance, amount, categoryId, note', async () => {
    const connector = createMockConnector({
      fetchAccount: vi.fn().mockResolvedValue(makeAccount(300)),
      fetchCategory: vi.fn().mockResolvedValue(mockCategory),
      addExpense: vi.fn().mockResolvedValue(makeTx(75)),
      updateAccountAfterTransaction: vi.fn().mockResolvedValue(makeAccount(225))
    })
    const result = await logExpense(makeEvent({ accountId: 'a', amount: 75, categoryId: 'cat-1', note: 'coffee' }), connector)
    const body = result.body
    expect(body.oldBalance).toBe(300)
    expect(body.newBalance).toBe(225)
    expect(body.amount).toBe(75)
    expect(body.categoryId).toBe('cat-1')
    expect(body.note).toBe('coffee')
  })

  it('passes timestamp to updateAccountAfterTransaction when provided', async () => {
    const updateAccountAfterTransaction = vi.fn().mockResolvedValue(makeAccount(150))
    const connector = defaultExpenseSetup({ updateAccountAfterTransaction })
    await logExpense(makeEvent({ accountId: 'acc-1', amount: 50, categoryId: 'cat-2', note: '', timestamp: 1700000000000 }), connector)
    expect(updateAccountAfterTransaction).toHaveBeenCalledWith('acc-1', expect.any(Number), expect.any(Number), 1700000000000)
  })

  it('uses Date.now() for updateAccountAfterTransaction when no timestamp', async () => {
    const updateAccountAfterTransaction = vi.fn().mockResolvedValue(makeAccount(150))
    const connector = defaultExpenseSetup({ updateAccountAfterTransaction })
    const before = Date.now()
    await logExpense(makeEvent({ accountId: 'acc-1', amount: 50, categoryId: 'cat-2', note: '' }), connector)
    const after = Date.now()
    const called = (updateAccountAfterTransaction.mock.calls[0] as unknown[])[3] as number
    expect(called).toBeGreaterThanOrEqual(before)
    expect(called).toBeLessThanOrEqual(after)
  })

  it('treats null totalTransactions as 0 and passes 1 as new total', async () => {
    const updateAccountAfterTransaction = vi.fn().mockResolvedValue(makeAccount(150))
    const connector = createMockConnector({
      fetchAccount: vi.fn().mockResolvedValue(makeAccount(200, null)),
      fetchCategory: vi.fn().mockResolvedValue(mockCategory),
      addExpense: vi.fn().mockResolvedValue(makeTx(50)),
      updateAccountAfterTransaction
    })
    await logExpense(makeEvent({ accountId: 'acc-1', amount: 50, categoryId: 'cat-2', note: '' }), connector)
    expect(updateAccountAfterTransaction).toHaveBeenCalledWith('acc-1', 150, 1, expect.any(Number))
  })
})

describe('logIncome()', () => {
  it('throws QueryError when amount <= 0', async () => {
    const connector = createMockConnector()
    await expect(logIncome(makeEvent({ accountId: 'a', amount: -5, categoryId: 'c', note: '' }), connector))
      .rejects.toThrow(QueryError)
  })

  it('validates categoryId before writing (BUG #5)', async () => {
    const fetchCategory = vi.fn().mockResolvedValue(mockCategory)
    const connector = defaultIncomeSetup({ fetchCategory })
    await logIncome(makeEvent({ accountId: 'a', amount: 100, categoryId: 'sal', note: '' }), connector)
    expect(fetchCategory).toHaveBeenCalledWith('sal')
  })

  it('adds amount to account balance', async () => {
    const connector = createMockConnector({
      fetchAccount: vi.fn().mockResolvedValue(makeAccount(100)),
      fetchCategory: vi.fn().mockResolvedValue(mockCategory),
      addIncome: vi.fn().mockResolvedValue(makeTx(200)),
      updateAccountAfterTransaction: vi.fn().mockResolvedValue(makeAccount(300))
    })
    const result = await logIncome(makeEvent({ accountId: 'a', amount: 200, categoryId: 'c', note: '' }), connector)
    expect(connector.updateAccountAfterTransaction).toHaveBeenCalledWith('a', 300, 1, expect.any(Number))
    expect((result.body).newBalance).toBe(300)
  })

  it('calls addIncome with correct args', async () => {
    const addIncome = vi.fn().mockResolvedValue(makeTx(100))
    const connector = defaultIncomeSetup({ addIncome })
    await logIncome(makeEvent({ accountId: 'acc-2', amount: 100, categoryId: 'sal', note: 'salary', timestamp: 1700000000000 }), connector)
    expect(addIncome).toHaveBeenCalledWith('acc-2', 100, 'sal', 'salary', 1700000000000, undefined)
  })

  it('passes linkedCardId to addIncome when provided (BUG #2)', async () => {
    const addIncome = vi.fn().mockResolvedValue(makeTx(100))
    const connector = defaultIncomeSetup({ addIncome })
    await logIncome(makeEvent({ accountId: 'acc-2', amount: 100, categoryId: 'sal', note: '', linkedCardId: 'card-2' }), connector)
    expect(addIncome).toHaveBeenCalledWith('acc-2', 100, 'sal', '', undefined, 'card-2')
  })
})

describe('transferBalance()', () => {
  it('throws QueryError when amount <= 0', async () => {
    const connector = createMockConnector()
    await expect(transferBalance(makeEvent({ fromAccountId: 'a', toAccountId: 'b', amount: 0, note: "" }), connector))
      .rejects.toThrow(QueryError)
  })

  it('deducts from fromAccount and adds to toAccount', async () => {
    const updateAccountBalance = vi.fn()
      .mockResolvedValueOnce({ balance: 900 })
      .mockResolvedValueOnce({ balance: 1100 })
    const connector = createMockConnector({
      fetchAccount: vi.fn()
        .mockResolvedValueOnce({ balance: 1000 })
        .mockResolvedValueOnce({ balance: 1000 }),
      addTransfer: vi.fn().mockResolvedValue(makeTx(100)),
      updateAccountBalance
    })
    const result = await transferBalance(makeEvent({ fromAccountId: 'from', toAccountId: 'to', amount: 100, note: "" }), connector)
    expect(updateAccountBalance).toHaveBeenCalledWith('from', 900)
    expect(updateAccountBalance).toHaveBeenCalledWith('to', 1100)
    expect((result.body).newFromAccountBalance).toBe(900)
    expect((result.body).newToAccountBalance).toBe(1100)
  })

  it('passes timestamp to addTransfer when provided', async () => {
    const addTransfer = vi.fn().mockResolvedValue(makeTx(50))
    const connector = createMockConnector({
      fetchAccount: vi.fn().mockResolvedValue({ balance: 500 }),
      addTransfer,
      updateAccountBalance: vi.fn().mockResolvedValue({ balance: 450 })
    })
    await transferBalance(makeEvent({ fromAccountId: 'a', toAccountId: 'b', amount: 50, note: "", timestamp: 1700000000000 }), connector)
    expect(addTransfer).toHaveBeenCalledWith('a', 'b', 50, "", 1700000000000)
  })
})

describe('listExpenses()', () => {
  it('calls fetchTransactions with type="expense" and optional date params', async () => {
    const fetchTransactions = vi.fn().mockResolvedValue([])
    const connector = createMockConnector({ fetchTransactions })
    await listExpenses({ method: 'GET', path: '/api/expense', query: { startDate: '2024-01-01', endDate: '2024-01-31' }, body: undefined }, connector)
    expect(fetchTransactions).toHaveBeenCalledWith('expense', '2024-01-01', '2024-01-31')
  })

  it('computes total as sum of transaction amounts', async () => {
    const txs: Transaction[] = [makeTx(100), makeTx(50), makeTx(25)]
    const connector = createMockConnector({
      fetchTransactions: vi.fn().mockResolvedValue(txs)
    })
    const result = await listExpenses(makeEvent(undefined, {}), connector)
    expect((result.body).total).toBe(175)
  })

  it('passes undefined for missing date params', async () => {
    const fetchTransactions = vi.fn().mockResolvedValue([])
    const connector = createMockConnector({ fetchTransactions })
    await listExpenses(makeEvent(undefined, {}), connector)
    expect(fetchTransactions).toHaveBeenCalledWith('expense', undefined, undefined)
  })
})

describe('listIncomes()', () => {
  it('calls fetchTransactions with type="income"', async () => {
    const fetchTransactions = vi.fn().mockResolvedValue([])
    const connector = createMockConnector({ fetchTransactions })
    await listIncomes(makeEvent(undefined, {}), connector)
    expect(fetchTransactions).toHaveBeenCalledWith('income', undefined, undefined)
  })
})

describe('getTransaction()', () => {
  it('throws QueryError if id is missing', async () => {
    const connector = createMockConnector()
    await expect(getTransaction({ method: 'GET', path: '/api/transactions', query: {}, body: undefined }, connector))
      .rejects.toThrow(QueryError)
  })

  it('fetches and returns the transaction', async () => {
    const tx = makeTx(100)
    const connector = createMockConnector({ fetchTransaction: vi.fn().mockResolvedValue(tx) })
    const result = await getTransaction({ method: 'GET', path: '/api/transactions', query: { id: 'tx-1' }, body: undefined }, connector)
    expect(connector.fetchTransaction).toHaveBeenCalledWith('tx-1')
    expect(result.body).toEqual(tx)
  })
})

describe('deleteTransaction()', () => {
  it('throws QueryError if id is missing', async () => {
    const connector = createMockConnector()
    await expect(deleteTransaction({ method: 'DELETE', path: '/api/transactions', query: {}, body: undefined }, connector))
      .rejects.toThrow(QueryError)
  })

  it('reverses expense balance (adds back to fromAccount)', async () => {
    const tx = { ...makeTx(50), fromAccountId: 'acc-from' }
    const updateAccountBalance = vi.fn().mockResolvedValue({ balance: 250 })
    const connector = createMockConnector({
      fetchTransaction: vi.fn().mockResolvedValue(tx),
      fetchAccount: vi.fn().mockResolvedValue(makeAccount(200)),
      updateAccountBalance,
      archiveTransaction: vi.fn()
    })
    const result = await deleteTransaction({ method: 'DELETE', path: '/api/transactions', query: { id: 'tx-1' }, body: undefined }, connector)
    expect(updateAccountBalance).toHaveBeenCalledWith('acc-from', 250)
    expect(result.body.balanceChanges).toEqual([{ accountId: 'acc-from', oldBalance: 200, newBalance: 250 }])
  })

  it('reverses income balance (subtracts from toAccount)', async () => {
    const tx = { ...makeTx(100), toAccountId: 'acc-to' }
    const updateAccountBalance = vi.fn().mockResolvedValue({ balance: 400 })
    const connector = createMockConnector({
      fetchTransaction: vi.fn().mockResolvedValue(tx),
      fetchAccount: vi.fn().mockResolvedValue(makeAccount(500)),
      updateAccountBalance,
      archiveTransaction: vi.fn()
    })
    const result = await deleteTransaction({ method: 'DELETE', path: '/api/transactions', query: { id: 'tx-1' }, body: undefined }, connector)
    expect(updateAccountBalance).toHaveBeenCalledWith('acc-to', 400)
    expect(result.body.balanceChanges).toEqual([{ accountId: 'acc-to', oldBalance: 500, newBalance: 400 }])
  })

  it('reverses transfer (both accounts)', async () => {
    const tx = { ...makeTx(200), fromAccountId: 'acc-from', toAccountId: 'acc-to' }
    const updateAccountBalance = vi.fn()
      .mockResolvedValueOnce({ balance: 1200 })
      .mockResolvedValueOnce({ balance: 800 })
    const connector = createMockConnector({
      fetchTransaction: vi.fn().mockResolvedValue(tx),
      fetchAccount: vi.fn()
        .mockResolvedValueOnce(makeAccount(1000))
        .mockResolvedValueOnce(makeAccount(1000)),
      updateAccountBalance,
      archiveTransaction: vi.fn()
    })
    const result = await deleteTransaction({ method: 'DELETE', path: '/api/transactions', query: { id: 'tx-1' }, body: undefined }, connector)
    expect(updateAccountBalance).toHaveBeenCalledWith('acc-from', 1200)
    expect(updateAccountBalance).toHaveBeenCalledWith('acc-to', 800)
    expect(result.body.balanceChanges).toHaveLength(2)
  })

  it('calls archiveTransaction with correct id', async () => {
    const tx = makeTx(50)
    const archiveTransaction = vi.fn()
    const connector = createMockConnector({
      fetchTransaction: vi.fn().mockResolvedValue(tx),
      archiveTransaction
    })
    await deleteTransaction({ method: 'DELETE', path: '/api/transactions', query: { id: 'tx-1' }, body: undefined }, connector)
    expect(archiveTransaction).toHaveBeenCalledWith('tx-1')
  })
})

describe('updateTransaction()', () => {
  const makeUpdateEvent = (id: string, body: Record<string, unknown>, query: Record<string, string> = {}) => ({
    method: 'PATCH', path: '/api/transactions', query: { id, ...query }, body
  })

  it('throws QueryError if id is missing', async () => {
    const connector = createMockConnector()
    await expect(updateTransaction({ method: 'PATCH', path: '/api/transactions', query: {}, body: {} }, connector))
      .rejects.toThrow(QueryError)
  })

  it('throws QueryError if amount <= 0', async () => {
    const connector = createMockConnector()
    await expect(updateTransaction(makeUpdateEvent('tx-1', { amount: 0 }), connector))
      .rejects.toThrow(QueryError)
  })

  it('no balance change when only note/categoryId/timestamp updated', async () => {
    const tx = makeTx(100)
    const updateTransactionPage = vi.fn().mockResolvedValue(tx)
    const connector = createMockConnector({
      fetchTransaction: vi.fn().mockResolvedValue(tx),
      updateTransactionPage
    })
    const result = await updateTransaction(makeUpdateEvent('tx-1', { note: 'updated' }), connector)
    expect(connector.fetchAccount).not.toHaveBeenCalled()
    expect(result.body.balanceChanges).toEqual([])
  })

  it('reconciles expense balance when amount changes', async () => {
    const tx = { ...makeTx(100), fromAccountId: 'acc-from' }
    const updatedTx = { ...tx, amount: 150 }
    const updateAccountBalance = vi.fn().mockResolvedValue({ balance: 850 })
    const connector = createMockConnector({
      fetchTransaction: vi.fn().mockResolvedValue(tx),
      fetchAccount: vi.fn().mockResolvedValue(makeAccount(900)),
      updateAccountBalance,
      updateTransactionPage: vi.fn().mockResolvedValue(updatedTx)
    })
    const result = await updateTransaction(makeUpdateEvent('tx-1', { amount: 150 }), connector)
    // delta = 150 - 100 = 50; expense fromAccount: balance -= delta → 900 - 50 = 850
    expect(updateAccountBalance).toHaveBeenCalledWith('acc-from', 850)
    expect(result.body.balanceChanges).toEqual([{ accountId: 'acc-from', oldBalance: 900, newBalance: 850 }])
  })

  it('reconciles income balance when amount changes', async () => {
    const tx = { ...makeTx(100), toAccountId: 'acc-to' }
    const updatedTx = { ...tx, amount: 200 }
    const updateAccountBalance = vi.fn().mockResolvedValue({ balance: 600 })
    const connector = createMockConnector({
      fetchTransaction: vi.fn().mockResolvedValue(tx),
      fetchAccount: vi.fn().mockResolvedValue(makeAccount(500)),
      updateAccountBalance,
      updateTransactionPage: vi.fn().mockResolvedValue(updatedTx)
    })
    const result = await updateTransaction(makeUpdateEvent('tx-1', { amount: 200 }), connector)
    // delta = 200 - 100 = 100; income toAccount: balance += delta → 500 + 100 = 600
    expect(updateAccountBalance).toHaveBeenCalledWith('acc-to', 600)
    expect(result.body.balanceChanges).toEqual([{ accountId: 'acc-to', oldBalance: 500, newBalance: 600 }])
  })

  it('reconciles transfer balances when amount changes', async () => {
    const tx = { ...makeTx(100), fromAccountId: 'acc-from', toAccountId: 'acc-to' }
    const updatedTx = { ...tx, amount: 150 }
    const updateAccountBalance = vi.fn()
      .mockResolvedValueOnce({ balance: 950 })
      .mockResolvedValueOnce({ balance: 1050 })
    const connector = createMockConnector({
      fetchTransaction: vi.fn().mockResolvedValue(tx),
      fetchAccount: vi.fn()
        .mockResolvedValueOnce(makeAccount(1000))
        .mockResolvedValueOnce(makeAccount(1000)),
      updateAccountBalance,
      updateTransactionPage: vi.fn().mockResolvedValue(updatedTx)
    })
    const result = await updateTransaction(makeUpdateEvent('tx-1', { amount: 150 }), connector)
    // delta = 50; from: 1000 - 50 = 950, to: 1000 + 50 = 1050
    expect(updateAccountBalance).toHaveBeenCalledWith('acc-from', 950)
    expect(updateAccountBalance).toHaveBeenCalledWith('acc-to', 1050)
    expect(result.body.balanceChanges).toHaveLength(2)
  })
})
