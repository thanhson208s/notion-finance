export type CategoryType = "Income" | "Expense" | "Financial"

export type Category = {
  name: string
  type: CategoryType
  monthlyBudget: number
}