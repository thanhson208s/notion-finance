import { Account } from "./account.type"
import { Category } from "./category.type"
import { Transaction } from "./transaction.type"

export type GetAccountsResponse = {
  accounts: Account[]
  total: number,
  totalOfAssets: number,
  totalOfLiabilities: number
}

export type GetCategoriesResponse = {
  categories: Category[]
}

export type LogExpenseResponse = {
  accountId: string,
  oldBalance: number,
  newBalance: number,
  amount: number,
  categoryId: string,
  note: string
}

export type ListExpensesResponse = {
  transactions: Transaction[]
  total: number
}

export type LogIncomeResponse = {
  accountId: string,
  oldBalance: number,
  newBalance: number,
  amount: number,
  categoryId: string,
  note: string
}

export type ListIncomesResponse = {
  transactions: Transaction[]
  total: number
}

export type TransferBalanceResponse = {
  fromAccountId: string
  toAccountId: string
  oldFromAccountBalance: number,
  newFromAccountBalance: number,
  oldToAccountBalance: number,
  newToAccountBalance: number,
  amount: number
}

export type AdjustBalanceResponse = {
  accountId: string,
  oldBalance: number,
  newBalance: number,
  delta: number,
  note: string
}

export type CategoryBreakdown = {
  categoryId: string
  amount: number
}

export type GetTransactionResponse = Transaction

export type BalanceChange = { accountId: string; oldBalance: number; newBalance: number }

export type DeleteTransactionResponse = {
  id: string
  balanceChanges: BalanceChange[]
}

export type UpdateTransactionResponse = {
  transaction: Transaction
  balanceChanges: BalanceChange[]
}

export type GetReportsResponse = {
  totalIncome: number
  totalExpense: number
  netSavings: number
  transactions: Transaction[]
  expenseCategoryBreakdown: CategoryBreakdown[]
  incomeCategoryBreakdown: CategoryBreakdown[]
}
