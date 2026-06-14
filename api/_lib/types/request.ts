export type LogExpenseRequest = {
  accountId: string
  amount: number
  categoryId: string
  note: string
  timestamp?: number
  linkedCardId?: string
  cashback?: number
  discount?: number
}

export type LogIncomeRequest = {
  accountId: string
  amount: number
  categoryId: string
  note: string
  timestamp?: number
  linkedCardId?: string
  cashback?: number
  discount?: number
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
  cashback?: number | null
  discount?: number | null
}

export type AddPromotionRequest = {
  name: string
  cardId?: string
  category?: 'Shopping' | 'F&B' | 'Travel' | 'Entertain' | 'Digital'
  type: 'Cashback' | 'Discount'
  expiresAt?: number
  link?: string
}

export type UpdatePromotionRequest = {
  name: string
  cardId?: string
  category?: 'Shopping' | 'F&B' | 'Travel' | 'Entertain' | 'Digital'
  type: 'Cashback' | 'Discount'
  expiresAt?: number
  link?: string
}

export type AddStatementRequest = {
  cardId: string
  startDate: number
  endDate: number
}

export type SetAccountActiveRequest = {
  accountId: string
  active: boolean
}

export type CreateAccountRequest = {
  name: string
  type: string
  note?: string
}
