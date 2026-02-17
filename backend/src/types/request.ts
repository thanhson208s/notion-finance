export type LogExpenseRequest = {
  account: string
  amount: number
  category: string
  note?: string
  timestamp?: number
  discount?: number
  linkedCard?: string
}