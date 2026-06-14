export type CategoryType = "Income" | "Expense" | "System"

export type Category = {
  id: string
  name: string
  type: CategoryType
  parentId: string | null
  note: string
}
