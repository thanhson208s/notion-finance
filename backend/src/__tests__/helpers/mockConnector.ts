import { vi } from 'vitest'
import { Connector } from '../../utils/connector'

export function createMockConnector(overrides = {}): Connector {
  return {
    fetchAllAccounts: vi.fn(),
    fetchAccount: vi.fn(),
    fetchCategory: vi.fn(),
    updateAccountBalance: vi.fn(),
    fetchCategories: vi.fn(),
    fetchTransactions: vi.fn(),
    addTransaction: vi.fn(),
    addExpense: vi.fn(),
    addIncome: vi.fn(),
    addTransfer: vi.fn(),
    ...overrides
  } as unknown as Connector
}
