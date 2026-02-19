import { Account } from "./account.type"
import { Transaction } from "./transaction.type"

export type GetAccountsResponse = {
  accounts: Account[]
  total: number,
  totalOfAssets: number,
  totalOfLiabilities: number
}

export type LogExpenseResponse = {
  oldBalance: number,
  newBalance: number,
  amount: number,
}

export type ListExpensesResponse = {
  transactions: Transaction[]
  total: number
}

export type LogIncomeResponse = {
  oldBalance: number,
  newBalance: number,
  amount: number
}

export type ListIncomesResponse = {
  transactions: Transaction[]
  total: number
}

export type TransferBalanceResponse = {
  fromAccountId: string
  toAccountId: string
}