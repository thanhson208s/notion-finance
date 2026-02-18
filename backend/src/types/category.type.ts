export type CategoryType = "Income" | "Expense" | "Financial"

export type Category = {
  id: string
  name: string
  type: CategoryType
  parentId: string | null
}

export function createCategory(id: string, name: string, type: string, parentId: string | null) {
  return {
    id,
    name,
    type: type as CategoryType,
    parentId
  } satisfies Category;
}