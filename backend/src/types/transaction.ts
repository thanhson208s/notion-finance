import { Account } from "./account"
import { Category } from "./category"

export type Transaction = {
  id: string
  timestamp: number
  amount: number
  fromAccount?: Account
  toAccount?: Account
  category: Category
  discount?: number
  linkedCard?: string
  note: string
}