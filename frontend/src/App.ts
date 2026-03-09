export const API_BASE = import.meta.env.VITE_API_BASE as string

export type AccountType =
  | "Cash"
  | "Bank"
  | "Credit"
  | "eWallet"
  | "Savings"
  | "PayLater"
  | "Prepaid"
  | "Gold"
  | "Loan"
  | "Fund"
  | "Bond"
  | "Stock"
  | "Debt"
  | "Crypto"

export type CardSummary = {
  id: string
  name: string
  imageUrl: string
}

export type Account = {
  id: string
  name: string
  type: AccountType
  balance: number
  totalTransactions: number | null
  lastTransactionDate: number | null
  priorityScore: number
  linkedCardIds: string[]
  cards: CardSummary[]
}

export type CategoryType = 'Income' | 'Expense' | 'Financial'

export type Category = {
  id: string
  name: string
  type: CategoryType
  parentId: string | null
}