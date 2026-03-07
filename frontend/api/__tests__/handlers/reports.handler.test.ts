import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getReports } from '../../_handlers/reports.handler'
import { createMockConnector } from '../helpers/mockConnector'
import { Transaction } from '../../_lib/types/transaction.type'
import { Category, CategoryType } from '../../_lib/types/category.type'

const TRANSFER_ID   = 'transfer-cat-id'
const ADJUSTMENT_ID = 'adjustment-cat-id'

beforeEach(() => {
  process.env.NOTION_TRANSFER_TRANSACTION_ID   = TRANSFER_ID
  process.env.NOTION_ADJUSTMENT_TRANSACTION_ID = ADJUSTMENT_ID
})

const makeEvent = (query: Record<string, string> = {}) => ({
  method: 'GET',
  path: '/api/reports',
  query,
  body: undefined
})

const makeTx = (
  categoryId: string,
  amount: number,
  fromAccountId?: string,
  toAccountId?: string
): Transaction => ({
  id: `tx-${categoryId}-${amount}`,
  timestamp: Date.now(),
  amount,
  fromAccountId,
  toAccountId,
  categoryId,
  note: ''
})

const makeExpenseTx = (categoryId: string, amount: number) =>
  makeTx(categoryId, amount, 'acc-from', undefined)

const makeIncomeTx = (categoryId: string, amount: number) =>
  makeTx(categoryId, amount, undefined, 'acc-to')

const makeTransferTx = (amount: number) =>
  makeTx(TRANSFER_ID, amount, 'acc-from', 'acc-to')

const makeAdjustmentTx = (amount: number) =>
  makeTx(ADJUSTMENT_ID, amount, 'acc-from', undefined)

const makeCat = (id: string, name: string, parentId: string | null = null, type: CategoryType = 'Expense'): Category => ({
  id, name, type, parentId
})

const defaultConnector = (overrides = {}) => createMockConnector({
  fetchAllTransactions: vi.fn().mockResolvedValue([]),
  fetchCategories: vi.fn().mockResolvedValue([]),
  ...overrides
})

describe('getReports()', () => {
  it('returns zeros and empty breakdowns when no transactions', async () => {
    const connector = defaultConnector()
    const result = await getReports(makeEvent(), connector)
    expect(result.statusCode).toBe(200)
    expect(result.body).toMatchObject({
      totalIncome: 0,
      totalExpense: 0,
      netSavings: 0,
      transactions: [],
      expenseCategoryBreakdown: [],
      incomeCategoryBreakdown: []
    })
  })

  it('computes totals and netSavings correctly', async () => {
    const connector = defaultConnector({
      fetchAllTransactions: vi.fn().mockResolvedValue([
        makeExpenseTx('cat-1', 100),
        makeExpenseTx('cat-1', 50),
        makeIncomeTx('cat-2', 200)
      ])
    })
    const result = await getReports(makeEvent(), connector)
    expect(result.body).toMatchObject({
      totalExpense: 150,
      totalIncome: 200,
      netSavings: 50
    })
  })

  it('aggregates multiple transactions under the same category', async () => {
    const cat = makeCat('cat-1', 'Food')
    const connector = defaultConnector({
      fetchAllTransactions: vi.fn().mockResolvedValue([
        makeExpenseTx('cat-1', 30),
        makeExpenseTx('cat-1', 70)
      ]),
      fetchCategories: vi.fn().mockResolvedValue([cat])
    })
    const result = await getReports(makeEvent(), connector)
    const breakdown = (result.body).expenseCategoryBreakdown
    expect(breakdown).toHaveLength(1)
    expect(breakdown[0]).toMatchObject({ categoryId: 'cat-1', categoryName: 'Food', amount: 100 })
  })

  it('sorts categoryBreakdown descending by amount', async () => {
    const cats = [makeCat('cat-a', 'A'), makeCat('cat-b', 'B')]
    const connector = defaultConnector({
      fetchAllTransactions: vi.fn().mockResolvedValue([
        makeExpenseTx('cat-a', 10),
        makeExpenseTx('cat-b', 90)
      ]),
      fetchCategories: vi.fn().mockResolvedValue(cats)
    })
    const result = await getReports(makeEvent(), connector)
    const breakdown = (result.body).expenseCategoryBreakdown
    expect(breakdown[0].amount).toBeGreaterThan(breakdown[1].amount)
    expect(breakdown[0].categoryId).toBe('cat-b')
  })

  it('passes startDate and endDate to fetchAllTransactions with full datetime', async () => {
    const fetchAllTransactions = vi.fn().mockResolvedValue([])
    const connector = defaultConnector({ fetchAllTransactions })
    await getReports(makeEvent({ startDate: '2026-01-01', endDate: '2026-03-31' }), connector)
    expect(fetchAllTransactions).toHaveBeenCalledWith('2026-01-01T00:00:00', '2026-03-31T23:59:59')
  })

  it('uses categoryId as fallback name when category not found in map', async () => {
    const connector = defaultConnector({
      fetchAllTransactions: vi.fn().mockResolvedValue([makeExpenseTx('unknown-cat', 50)]),
      fetchCategories: vi.fn().mockResolvedValue([])
    })
    const result = await getReports(makeEvent(), connector)
    const breakdown = (result.body).expenseCategoryBreakdown
    expect(breakdown[0].categoryName).toBe('unknown-cat')
  })

  it('uses categoryId as parentId fallback when category.parentId is null', async () => {
    const cat = makeCat('cat-1', 'Food', null)
    const connector = defaultConnector({
      fetchAllTransactions: vi.fn().mockResolvedValue([makeExpenseTx('cat-1', 50)]),
      fetchCategories: vi.fn().mockResolvedValue([cat])
    })
    const result = await getReports(makeEvent(), connector)
    const breakdown = (result.body).expenseCategoryBreakdown
    expect(breakdown[0].parentId).toBe('cat-1')
  })

  it('sets parentId from category when Notion returns a parent', async () => {
    const cat = makeCat('cat-child', 'Sub Food', 'cat-parent')
    const connector = defaultConnector({
      fetchAllTransactions: vi.fn().mockResolvedValue([makeExpenseTx('cat-child', 50)]),
      fetchCategories: vi.fn().mockResolvedValue([cat])
    })
    const result = await getReports(makeEvent(), connector)
    const breakdown = (result.body).expenseCategoryBreakdown
    expect(breakdown[0].parentId).toBe('cat-parent')
  })

  it('includes expense categories with no transactions as amount 0', async () => {
    const cat = makeCat('cat-no-tx', 'Unused')
    const connector = defaultConnector({
      fetchAllTransactions: vi.fn().mockResolvedValue([]),
      fetchCategories: vi.fn().mockResolvedValue([cat])
    })
    const result = await getReports(makeEvent(), connector)
    const breakdown = (result.body).expenseCategoryBreakdown
    expect(breakdown).toHaveLength(1)
    expect(breakdown[0]).toMatchObject({ categoryId: 'cat-no-tx', amount: 0 })
  })

  it('builds separate breakdown for income and expense', async () => {
    const expCat = makeCat('cat-exp', 'Food')
    const incCat = makeCat('cat-inc', 'Salary', null, 'Income')
    const connector = defaultConnector({
      fetchAllTransactions: vi.fn().mockResolvedValue([
        makeExpenseTx('cat-exp', 100),
        makeIncomeTx('cat-inc', 200)
      ]),
      fetchCategories: vi.fn().mockResolvedValue([expCat, incCat])
    })
    const result = await getReports(makeEvent(), connector)
    const body = result.body
    expect(body.expenseCategoryBreakdown).toHaveLength(1)
    expect(body.expenseCategoryBreakdown[0].categoryId).toBe('cat-exp')
    expect(body.incomeCategoryBreakdown).toHaveLength(1)
    expect(body.incomeCategoryBreakdown[0].categoryId).toBe('cat-inc')
  })

  it('includes transfer transactions in transactions list but not in breakdowns', async () => {
    const connector = defaultConnector({
      fetchAllTransactions: vi.fn().mockResolvedValue([
        makeExpenseTx('cat-1', 50),
        makeTransferTx(200)
      ]),
      fetchCategories: vi.fn().mockResolvedValue([makeCat('cat-1', 'Food')])
    })
    const result = await getReports(makeEvent(), connector)
    const body = result.body
    expect(body.transactions).toHaveLength(2)
    expect(body.expenseCategoryBreakdown.every((b) => b.categoryId !== TRANSFER_ID)).toBe(true)
    expect(body.incomeCategoryBreakdown.every((b) => b.categoryId !== TRANSFER_ID)).toBe(true)
  })

  it('includes adjustment transactions in transactions list but not in breakdowns', async () => {
    const connector = defaultConnector({
      fetchAllTransactions: vi.fn().mockResolvedValue([
        makeIncomeTx('cat-2', 100),
        makeAdjustmentTx(30)
      ]),
      fetchCategories: vi.fn().mockResolvedValue([makeCat('cat-2', 'Salary', null, 'Income')])
    })
    const result = await getReports(makeEvent(), connector)
    const body = result.body
    expect(body.transactions).toHaveLength(2)
    expect(body.expenseCategoryBreakdown.every((b) => b.categoryId !== ADJUSTMENT_ID)).toBe(true)
    expect(body.incomeCategoryBreakdown.every((b) => b.categoryId !== ADJUSTMENT_ID)).toBe(true)
  })

  it('transactions list preserves order from fetchAllTransactions (date desc)', async () => {
    const t1 = { ...makeExpenseTx('cat-1', 10), id: 'tx-1', timestamp: 3000 }
    const t2 = { ...makeExpenseTx('cat-1', 20), id: 'tx-2', timestamp: 2000 }
    const t3 = { ...makeIncomeTx('cat-2', 30),  id: 'tx-3', timestamp: 1000 }
    const connector = defaultConnector({
      fetchAllTransactions: vi.fn().mockResolvedValue([t1, t2, t3])
    })
    const result = await getReports(makeEvent(), connector)
    const ids = (result.body).transactions.map((t: Transaction) => t.id)
    expect(ids).toEqual(['tx-1', 'tx-2', 'tx-3'])
  })
})
