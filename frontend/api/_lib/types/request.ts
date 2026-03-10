export type LogExpenseRequest = {
  accountId: string
  amount: number
  categoryId: string
  note: string
  timestamp?: number
  linkedCardId?: string
}

export type LogIncomeRequest = {
  accountId: string
  amount: number
  categoryId: string
  note: string
  timestamp?: number
  linkedCardId?: string
}

export type TransferBalanceRequest = {
  fromAccountId: string
  toAccountId: string
  amount: number
  timestamp?: number
  note: string
}

export type AdjustBalanceRequest = {
  accountId: string,
  balance: number
  note: string
  timestamp?: number
}

export type UpdateTransactionRequest = {
  amount?: number
  note?: string
  categoryId?: string
  timestamp?: number
  linkedCardId?: string | null
}
