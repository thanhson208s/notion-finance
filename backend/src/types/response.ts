import { Account } from "./account"
import { Transaction } from "./transaction"

export type ResponseSuccess<T> = {
  success: true
  data: T
}

export type ResponseError = {
  success: false
  error: {
    code: string
    message: string
  }
}

export type APIResponse<T> = ResponseSuccess<T> | ResponseError

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

export type TransferBalanceResponse = {
  
}