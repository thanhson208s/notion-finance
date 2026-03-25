export type Transaction = {
  id: string
  timestamp: number
  amount: number
  fromAccountId?: string
  toAccountId?: string
  categoryId: string
  note: string
  linkedCardId?: string
  cashback?: number
  discount?: number
}
