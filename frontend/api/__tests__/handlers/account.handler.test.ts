import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getAccounts, adjustBalance, setAccountActive, createAccount } from '../../_handlers/account.handler'
import { createMockConnector } from '../helpers/mockConnector'
import { Account } from '../../_lib/types/account.type'

const makeEvent = <T>(body?: T) => ({
  method: 'GET',
  path: '/api/accounts',
  query: {},
  body: body as T
})

describe('getAccounts()', () => {
  it('returns accounts array from connector', async () => {
    const accounts: Account[] = [
      { id: '1', name: 'Cash', type: 'Cash', balance: 100, active: true, note: '', totalTransactions: null, lastTransactionDate: null, priorityScore: 0, linkedCardIds: [] }
    ]
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue(accounts)
    })
    const result = await getAccounts(makeEvent(), connector)
    expect(result.body).toMatchObject({ accounts })
  })

  it('computes total as sum of all balances', async () => {
    const accounts: Account[] = [
      { id: '1', name: 'Cash', type: 'Cash', balance: 100, active: true, note: '', totalTransactions: null, lastTransactionDate: null, priorityScore: 0, linkedCardIds: [] },
      { id: '2', name: 'Credit', type: 'Credit', balance: 50, active: true, note: '', totalTransactions: null, lastTransactionDate: null, priorityScore: 0, linkedCardIds: [] }
    ]
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue(accounts)
    })
    const result = await getAccounts(makeEvent(), connector)
    expect((result.body).total).toBe(150)
  })

  it('computes totalOfAssets for asset-type accounts only', async () => {
    const accounts: Account[] = [
      { id: '1', name: 'Cash', type: 'Cash', balance: 200, active: true, note: '', totalTransactions: null, lastTransactionDate: null, priorityScore: 0, linkedCardIds: [] },
      { id: '2', name: 'Credit', type: 'Credit', balance: 50, active: true, note: '', totalTransactions: null, lastTransactionDate: null, priorityScore: 0, linkedCardIds: [] }
    ]
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue(accounts)
    })
    const result = await getAccounts(makeEvent(), connector)
    expect((result.body).totalOfAssets).toBe(200)
  })

  it('computes totalOfLiabilities for non-asset-type accounts only', async () => {
    const accounts: Account[] = [
      { id: '1', name: 'Cash', type: 'Cash', balance: 200, active: true, note: '', totalTransactions: null, lastTransactionDate: null, priorityScore: 0, linkedCardIds: [] },
      { id: '2', name: 'Debt', type: 'Debt', balance: 75, active: true, note: '', totalTransactions: null, lastTransactionDate: null, priorityScore: 0, linkedCardIds: [] }
    ]
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue(accounts)
    })
    const result = await getAccounts(makeEvent(), connector)
    expect((result.body).totalOfLiabilities).toBe(75)
  })

  it('returns zero totals when account list is empty', async () => {
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue([])
    })
    const result = await getAccounts(makeEvent(), connector)
    expect((result.body).total).toBe(0)
    expect((result.body).totalOfAssets).toBe(0)
    expect((result.body).totalOfLiabilities).toBe(0)
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
    expect((result.body).newBalance).toBe(150)
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

describe('setAccountActive()', () => {
  it('calls updateAccountActive with correct args and returns accountId and active', async () => {
    const updateAccountActive = vi.fn().mockResolvedValue({ id: 'acc-1', active: false })
    const connector = createMockConnector({ updateAccountActive })
    const result = await setAccountActive(makeEvent({ accountId: 'acc-1', active: false }), connector)
    expect(updateAccountActive).toHaveBeenCalledWith('acc-1', false)
    expect(result.body).toEqual({ accountId: 'acc-1', active: false })
  })

  it('returns active: true when activating', async () => {
    const connector = createMockConnector({
      updateAccountActive: vi.fn().mockResolvedValue({ id: 'acc-2', active: true })
    })
    const result = await setAccountActive(makeEvent({ accountId: 'acc-2', active: true }), connector)
    expect(result.body).toMatchObject({ active: true })
  })
})

describe('createAccount()', () => {
  it('calls createAccount with name, type, and empty note by default', async () => {
    const mockAccount: Account = { id: 'new-1', name: 'Savings', type: 'Savings', balance: 0, active: true, note: '', totalTransactions: null, lastTransactionDate: null, priorityScore: 0, linkedCardIds: [] }
    const createAccountMock = vi.fn().mockResolvedValue(mockAccount)
    const connector = createMockConnector({ createAccount: createAccountMock })
    const result = await createAccount(makeEvent({ name: 'Savings', type: 'Savings' }), connector)
    expect(createAccountMock).toHaveBeenCalledWith('Savings', 'Savings', '')
    expect(result.body).toEqual(mockAccount)
  })

  it('passes note to createAccount when provided', async () => {
    const mockAccount: Account = { id: 'new-2', name: 'Emergency Fund', type: 'Bank', balance: 0, active: true, note: 'for emergencies', totalTransactions: null, lastTransactionDate: null, priorityScore: 0, linkedCardIds: [] }
    const createAccountMock = vi.fn().mockResolvedValue(mockAccount)
    const connector = createMockConnector({ createAccount: createAccountMock })
    await createAccount(makeEvent({ name: 'Emergency Fund', type: 'Bank', note: 'for emergencies' }), connector)
    expect(createAccountMock).toHaveBeenCalledWith('Emergency Fund', 'Bank', 'for emergencies')
  })
})
