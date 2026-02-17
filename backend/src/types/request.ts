export type LogExpenseRequest = {
  account: string
  amount: number
  category: string
  note?: string
  timestamp?: number
  discount?: number
  linkedCard?: string
}

export type TransferBalanceRequest = {
  fromAccount: string,
  toAccount: string,
  amount: number
  note?: string
  timestamp?: number
}