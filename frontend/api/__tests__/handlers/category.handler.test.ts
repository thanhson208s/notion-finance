import { describe, it, expect, vi } from 'vitest'
import { getCategories } from '../../_handlers/category.handler'
import { createMockConnector } from '../helpers/mockConnector'
import { Category } from '../../_lib/types/category.type'

const makeEvent = (query: Record<string, string> = {}) => ({
  method: 'GET',
  path: '/api/categories',
  query,
  body: undefined
})

const mockCategories: Category[] = [
  { id: 'c1', name: 'Food', type: 'Expense', parentId: null },
  { id: 'c2', name: 'Salary', type: 'Income', parentId: null }
]

describe('getCategories()', () => {
  it('calls fetchCategories with null when no type param', async () => {
    const fetchCategories = vi.fn().mockResolvedValue([])
    const connector = createMockConnector({ fetchCategories })
    await getCategories(makeEvent(), connector)
    expect(fetchCategories).toHaveBeenCalledWith(null)
  })

  it('calls fetchCategories with type when type param provided', async () => {
    const fetchCategories = vi.fn().mockResolvedValue([])
    const connector = createMockConnector({ fetchCategories })
    await getCategories(makeEvent({ type: 'Expense' }), connector)
    expect(fetchCategories).toHaveBeenCalledWith('Expense')
  })

  it('returns categories from connector', async () => {
    const connector = createMockConnector({
      fetchCategories: vi.fn().mockResolvedValue(mockCategories)
    })
    const result = await getCategories(makeEvent(), connector)
    expect((result.body).categories).toEqual(mockCategories)
  })

  it('returns empty array when connector returns empty', async () => {
    const connector = createMockConnector({
      fetchCategories: vi.fn().mockResolvedValue([])
    })
    const result = await getCategories(makeEvent(), connector)
    expect((result.body).categories).toEqual([])
  })
})
