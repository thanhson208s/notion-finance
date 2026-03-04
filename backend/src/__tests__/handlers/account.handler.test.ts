import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getAccounts, adjustBalance } from '../../handlers/account.handler'
import { createMockConnector } from '../helpers/mockConnector'
import { Account } from '../../types/account.type'

const makeEvent = (body?: unknown) => ({
  method: 'GET',
  path: '/api/accounts',
  query: {},
  body: body as any
})

describe('getAccounts()', () => {
  it('returns accounts array from connector', async () => {
    const accounts: Account[] = [
      { id: '1', name: 'Cash', type: 'Cash', balance: 100 }
    ]
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue(accounts)
    })
    const result = await getAccounts(makeEvent(), connector)
    expect(result.body).toMatchObject({ accounts })
  })

  it('computes total as sum of all balances', async () => {
    const accounts: Account[] = [
      { id: '1', name: 'Cash', type: 'Cash', balance: 100 },
      { id: '2', name: 'Credit', type: 'Credit', balance: 50 }
    ]
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue(accounts)
    })
    const result = await getAccounts(makeEvent(), connector)
    expect((result.body as any).total).toBe(150)
  })

  it('computes totalOfAssets for asset-type accounts only', async () => {
    const accounts: Account[] = [
      { id: '1', name: 'Cash', type: 'Cash', balance: 200 },
      { id: '2', name: 'Credit', type: 'Credit', balance: 50 }
    ]
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue(accounts)
    })
    const result = await getAccounts(makeEvent(), connector)
    expect((result.body as any).totalOfAssets).toBe(200)
  })

  it('computes totalOfLiabilities for non-asset-type accounts only', async () => {
    const accounts: Account[] = [
      { id: '1', name: 'Cash', type: 'Cash', balance: 200 },
      { id: '2', name: 'Debt', type: 'Debt', balance: 75 }
    ]
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue(accounts)
    })
    const result = await getAccounts(makeEvent(), connector)
    expect((result.body as any).totalOfLiabilities).toBe(75)
  })

  it('returns zero totals when account list is empty', async () => {
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue([])
    })
    const result = await getAccounts(makeEvent(), connector)
    expect((result.body as any).total).toBe(0)
    expect((result.body as any).totalOfAssets).toBe(0)
    expect((result.body as any).totalOfLiabilities).toBe(0)
  })
})

describe('adjustBalance()', () => {
  beforeEach(() => {
    process.env.NOTION_ADJUSTMENT_TRANSACTION_ID = 'adj-cat-id'
  })

  it('sets newBalance to target balance', async () => {
    const connector = createMockConnector({
      fetchAccount: vi.fn().mockResolvedValue({ balance: 100 }),
      addTransaction: vi.fn().mockResolvedValue({ amount: 50 }),
      updateAccountBalance: vi.fn().mockResolvedValue({ balance: 150 })
    })
    const result = await adjustBalance(makeEvent({ accountId: 'acc-1', balance: 150, note: 'adj', timestamp: undefined }), connector)
    expect((result.body as any).newBalance).toBe(150)
  })

  it('creates adjustment transaction with correct args when decreasing (oldBalance > target)', async () => {
    const addTransaction = vi.fn().mockResolvedValue({ amount: 30 })
    const connector = createMockConnector({
      fetchAccount: vi.fn().mockResolvedValue({ balance: 130 }),
      addTransaction,
      updateAccountBalance: vi.fn().mockResolvedValue({ balance: 100 })
    })
    await adjustBalance(makeEvent({ accountId: 'acc-1', balance: 100, note: 'decrease', timestamp: undefined }), connector)
    expect(addTransaction).toHaveBeenCalledWith('acc-1', null, 30, 'adj-cat-id', 'decrease', undefined)
  })

  it('creates adjustment transaction with correct args when increasing (oldBalance < target)', async () => {
    const addTransaction = vi.fn().mockResolvedValue({ amount: 50 })
    const connector = createMockConnector({
      fetchAccount: vi.fn().mockResolvedValue({ balance: 100 }),
      addTransaction,
      updateAccountBalance: vi.fn().mockResolvedValue({ balance: 150 })
    })
    await adjustBalance(makeEvent({ accountId: 'acc-1', balance: 150, note: 'increase', timestamp: undefined }), connector)
    expect(addTransaction).toHaveBeenCalledWith(null, 'acc-1', 50, 'adj-cat-id', 'increase', undefined)
  })
})
