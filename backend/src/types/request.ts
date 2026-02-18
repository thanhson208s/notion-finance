export type LogExpenseRequest = {
  accountId: string
  amount: number
  categoryId: string
  note?: string
  timestamp?: number
  discount?: number
  linkedCardId?: string
}

export type LogIncomeRequest = {
  accountId: string
  amount: number
  categoryId: string
  note?: string
  timestamp?: number
  linkedCardId?: string
}

export type TransferBalanceRequest = {
  fromAccountId: string
  toAccountId: string
  amount: number
  note?: string
  timestamp?: number
}

export type AdjustBalanceRequest = {
  accountId: string,
  newBalance: number
  note: string
  timestamp?: number
}