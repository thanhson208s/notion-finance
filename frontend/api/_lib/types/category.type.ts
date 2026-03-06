export type CategoryType = "Income" | "Expense" | "Financial"

export type Category = {
  id: string
  name: string
  type: CategoryType
  parentId: string | null
}
