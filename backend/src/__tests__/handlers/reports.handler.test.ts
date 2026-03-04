import { describe, it, expect, vi } from 'vitest'
import { getReports } from '../../handlers/reports.handler'
import { createMockConnector } from '../helpers/mockConnector'
import { Transaction } from '../../types/transaction.type'
import { Category, CategoryType } from '../../types/category.type'

const makeEvent = (query: Record<string, string> = {}) => ({
  method: 'GET',
  path: '/api/reports',
  query,
  body: undefined
})

const makeTx = (categoryId: string, amount: number): Transaction => ({
  id: `tx-${categoryId}-${amount}`,
  timestamp: Date.now(),
  amount,
  categoryId,
  note: ''
})

const makeCat = (id: string, name: string, parentId: string | null = null, type: CategoryType = 'Expense'): Category => ({
  id, name, type, parentId
})

const defaultConnector = (overrides = {}) => createMockConnector({
  fetchTransactions: vi.fn().mockResolvedValue([]),
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
      expenseCategoryBreakdown: [],
      incomeCategoryBreakdown: []
    })
  })

  it('computes totals and netSavings correctly', async () => {
    const connector = defaultConnector({
      fetchTransactions: vi.fn()
        .mockResolvedValueOnce([makeTx('cat-1', 100), makeTx('cat-1', 50)]) // expenses
        .mockResolvedValueOnce([makeTx('cat-2', 200)])                        // incomes
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
      fetchTransactions: vi.fn()
        .mockResolvedValueOnce([makeTx('cat-1', 30), makeTx('cat-1', 70)]) // expenses
        .mockResolvedValueOnce([]),
      fetchCategories: vi.fn().mockResolvedValue([cat])
    })
    const result = await getReports(makeEvent(), connector)
    const breakdown = (result.body as any).expenseCategoryBreakdown
    expect(breakdown).toHaveLength(1)
    expect(breakdown[0]).toMatchObject({ categoryId: 'cat-1', categoryName: 'Food', amount: 100 })
  })

  it('sorts categoryBreakdown descending by amount', async () => {
    const cats = [makeCat('cat-a', 'A'), makeCat('cat-b', 'B')]
    const connector = defaultConnector({
      fetchTransactions: vi.fn()
        .mockResolvedValueOnce([makeTx('cat-a', 10), makeTx('cat-b', 90)]) // expenses
        .mockResolvedValueOnce([]),
      fetchCategories: vi.fn().mockResolvedValue(cats)
    })
    const result = await getReports(makeEvent(), connector)
    const breakdown = (result.body as any).expenseCategoryBreakdown
    expect(breakdown[0].amount).toBeGreaterThan(breakdown[1].amount)
    expect(breakdown[0].categoryId).toBe('cat-b')
  })

  it('passes startDate and endDate to fetchTransactions', async () => {
    const fetchTransactions = vi.fn().mockResolvedValue([])
    const connector = defaultConnector({ fetchTransactions })
    await getReports(makeEvent({ startDate: '2026-01-01', endDate: '2026-03-31' }), connector)
    expect(fetchTransactions).toHaveBeenCalledWith('expense', '2026-01-01', '2026-03-31')
    expect(fetchTransactions).toHaveBeenCalledWith('income', '2026-01-01', '2026-03-31')
  })

  it('uses categoryId as fallback name when category not found in map', async () => {
    const connector = defaultConnector({
      fetchTransactions: vi.fn()
        .mockResolvedValueOnce([makeTx('unknown-cat', 50)])
        .mockResolvedValueOnce([]),
      fetchCategories: vi.fn().mockResolvedValue([])
    })
    const result = await getReports(makeEvent(), connector)
    const breakdown = (result.body as any).expenseCategoryBreakdown
    expect(breakdown[0].categoryName).toBe('unknown-cat')
  })

  it('uses categoryId as parentId fallback when category.parentId is null', async () => {
    const cat = makeCat('cat-1', 'Food', null) // parentId is null
    const connector = defaultConnector({
      fetchTransactions: vi.fn()
        .mockResolvedValueOnce([makeTx('cat-1', 50)])
        .mockResolvedValueOnce([]),
      fetchCategories: vi.fn().mockResolvedValue([cat])
    })
    const result = await getReports(makeEvent(), connector)
    const breakdown = (result.body as any).expenseCategoryBreakdown
    expect(breakdown[0].parentId).toBe('cat-1')
  })

  it('sets parentId from category when Notion returns a parent', async () => {
    const cat = makeCat('cat-child', 'Sub Food', 'cat-parent')
    const connector = defaultConnector({
      fetchTransactions: vi.fn()
        .mockResolvedValueOnce([makeTx('cat-child', 50)])
        .mockResolvedValueOnce([]),
      fetchCategories: vi.fn().mockResolvedValue([cat])
    })
    const result = await getReports(makeEvent(), connector)
    const breakdown = (result.body as any).expenseCategoryBreakdown
    expect(breakdown[0].parentId).toBe('cat-parent')
  })

  it('includes expense categories with no transactions as amount 0', async () => {
    const cat = makeCat('cat-no-tx', 'Unused')
    const connector = defaultConnector({
      fetchTransactions: vi.fn().mockResolvedValue([]),
      fetchCategories: vi.fn().mockResolvedValue([cat])
    })
    const result = await getReports(makeEvent(), connector)
    const breakdown = (result.body as any).expenseCategoryBreakdown
    expect(breakdown).toHaveLength(1)
    expect(breakdown[0]).toMatchObject({ categoryId: 'cat-no-tx', amount: 0 })
  })

  it('builds separate breakdown for income and expense', async () => {
    const expCat = makeCat('cat-exp', 'Food')
    const incCat = makeCat('cat-inc', 'Salary', null, 'Income')
    const connector = defaultConnector({
      fetchTransactions: vi.fn()
        .mockResolvedValueOnce([makeTx('cat-exp', 100)]) // expenses
        .mockResolvedValueOnce([makeTx('cat-inc', 200)]), // incomes
      fetchCategories: vi.fn().mockResolvedValue([expCat, incCat])
    })
    const result = await getReports(makeEvent(), connector)
    const body = result.body as any
    expect(body.expenseCategoryBreakdown).toHaveLength(1)
    expect(body.expenseCategoryBreakdown[0].categoryId).toBe('cat-exp')
    expect(body.incomeCategoryBreakdown).toHaveLength(1)
    expect(body.incomeCategoryBreakdown[0].categoryId).toBe('cat-inc')
  })
})
