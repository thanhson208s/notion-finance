export type Transaction = {
  id: string
  timestamp: number
  amount: number
  fromAccountId?: string
  toAccountId?: string
  categoryId: string
  discount?: number
  linkedCardId?: string
  note?: string
}