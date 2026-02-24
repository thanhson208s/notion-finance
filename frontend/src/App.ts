export type AccountType = "Cash" | "Bank" | "Credit" | "eWallet" | "Savings" | "PayLater" | "Prepaid"

export type Account = {
  id: string
  name: string
  type: AccountType
  balance: number
}

export type CategoryType = 'Income' | 'Expense' | 'Financial'

export type Category = {
  id: string
  name: string
  type: CategoryType
  parentId: string | null
}