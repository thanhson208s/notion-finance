import { vi } from 'vitest'
import { Connector } from '../../_lib/connector'

export function createMockConnector(overrides = {}): Connector {
  return {
    fetchAllAccounts: vi.fn(),
    fetchAccount: vi.fn(),
    fetchCategory: vi.fn(),
    updateAccountBalance: vi.fn(),
    updateAccountAfterTransaction: vi.fn(),
    fetchCategories: vi.fn(),
    fetchAllTransactions: vi.fn(),
    fetchTransactions: vi.fn(),
    addTransaction: vi.fn(),
    addExpense: vi.fn(),
    addIncome: vi.fn(),
    addTransfer: vi.fn(),
    fetchTransaction: vi.fn(),
    updateTransactionPage: vi.fn(),
    archiveTransaction: vi.fn(),
    ...overrides
  } as unknown as Connector
}
