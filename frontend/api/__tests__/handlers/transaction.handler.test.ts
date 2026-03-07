import { describe, it, expect, vi } from 'vitest'
import { logExpense, logIncome, transferBalance, listExpenses, listIncomes } from '../../_handlers/transaction.handler'
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

// Default overrides shared by most logExpense/logIncome tests
const defaultExpenseSetup = (overrides = {}) => createMockConnector({
  fetchAccount: vi.fn().mockResolvedValue({ balance: 200 }),
  fetchCategory: vi.fn().mockResolvedValue(mockCategory),
  addExpense: vi.fn().mockResolvedValue(makeTx(50)),
  updateAccountBalance: vi.fn().mockResolvedValue({ balance: 150 }),
  ...overrides
})

const defaultIncomeSetup = (overrides = {}) => createMockConnector({
  fetchAccount: vi.fn().mockResolvedValue({ balance: 0 }),
  fetchCategory: vi.fn().mockResolvedValue(mockCategory),
  addIncome: vi.fn().mockResolvedValue(makeTx(100)),
  updateAccountBalance: vi.fn().mockResolvedValue({ balance: 100 }),
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
      fetchAccount: vi.fn().mockResolvedValue({ balance: 500 }),
      fetchCategory: vi.fn().mockResolvedValue(mockCategory),
      addExpense: vi.fn().mockResolvedValue(makeTx(100)),
      updateAccountBalance: vi.fn().mockResolvedValue({ balance: 400 })
    })
    const result = await logExpense(makeEvent({ accountId: 'a', amount: 100, categoryId: 'c', note: '' }), connector)
    expect((connector.updateAccountBalance)).toHaveBeenCalledWith('a', 400)
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
      fetchAccount: vi.fn().mockResolvedValue({ balance: 300 }),
      fetchCategory: vi.fn().mockResolvedValue(mockCategory),
      addExpense: vi.fn().mockResolvedValue(makeTx(75)),
      updateAccountBalance: vi.fn().mockResolvedValue({ balance: 225 })
    })
    const result = await logExpense(makeEvent({ accountId: 'a', amount: 75, categoryId: 'cat-1', note: 'coffee' }), connector)
    const body = result.body
    expect(body.oldBalance).toBe(300)
    expect(body.newBalance).toBe(225)
    expect(body.amount).toBe(75)
    expect(body.categoryId).toBe('cat-1')
    expect(body.note).toBe('coffee')
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
      fetchAccount: vi.fn().mockResolvedValue({ balance: 100 }),
      fetchCategory: vi.fn().mockResolvedValue(mockCategory),
      addIncome: vi.fn().mockResolvedValue(makeTx(200)),
      updateAccountBalance: vi.fn().mockResolvedValue({ balance: 300 })
    })
    const result = await logIncome(makeEvent({ accountId: 'a', amount: 200, categoryId: 'c', note: '' }), connector)
    expect((connector.updateAccountBalance)).toHaveBeenCalledWith('a', 300)
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
    await expect(transferBalance(makeEvent({ fromAccountId: 'a', toAccountId: 'b', amount: 0 }), connector))
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
    const result = await transferBalance(makeEvent({ fromAccountId: 'from', toAccountId: 'to', amount: 100 }), connector)
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
    await transferBalance(makeEvent({ fromAccountId: 'a', toAccountId: 'b', amount: 50, timestamp: 1700000000000 }), connector)
    expect(addTransfer).toHaveBeenCalledWith('a', 'b', 50, 1700000000000)
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
