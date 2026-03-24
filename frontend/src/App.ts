export const API_BASE = import.meta.env.VITE_API_BASE as string

export type AccountType =
  | "Cash"
  | "Bank"
  | "Credit"
  | "eWallet"
  | "Savings"
  | "PayLater"
  | "Prepaid"
  | "Gold"
  | "Loan"
  | "Fund"
  | "Bond"
  | "Stock"
  | "Debt"
  | "Crypto"

export type Card = {
  id: string
  name: string
  number: string
  imageUrl: string
  annualFee: number | null
  spendingLimit: number | null
  requiredSpending: number | null
  lastChargedDate: number | null
  billingDay: number | null
  linkedAccountId: string | null
  linkedServices: string[]
  cashbackCap: number | null
  network: string | null
}

export type CardWithSpending = Card & {
  cycleStart: string | null
  cycleEnd: string | null
  currentCycleSpending: number
  currentCycleCashback: number
}

export type PromotionCategory = 'Shopping' | 'F&B' | 'Travel' | 'Entertain' | 'Digital'
export type PromotionType = 'Cashback' | 'Discount'

export type Promotion = {
  id: string
  name: string
  cardId: string | null
  category: PromotionCategory | null
  type: PromotionType
  expiresAt: number | null
  link: string | null
}

export type Statement = {
  id: string
  cardId: string
  billingDate: number
  spending: number
  cashback: number
  note: string
}

export type Account = {
  id: string
  name: string
  type: AccountType
  balance: number
  totalTransactions: number | null
  lastTransactionDate: number | null
  priorityScore: number
  linkedCardIds: string[]
}

export type CategoryType = 'Income' | 'Expense' | 'System'

export type Category = {
  id: string
  name: string
  type: CategoryType
  parentId: string | null
}

export type TxType = 'Income' | 'Expense' | 'Transfer' | 'Adjustment' | 'System'

export type Transaction = {
  id: string
  timestamp: number
  amount: number
  fromAccountId?: string
  toAccountId?: string
  categoryId: string
  note: string
  linkedCardId?: string
}

export type DateRangePreset = 'last-month' | 'this-month' | 'custom'

export type ReportsData = {
  totalIncome: number
  totalExpense: number
  netSavings: number
  transactions: Transaction[]
  expenseCategoryBreakdown: {categoryId: string, amount: number}[]
  incomeCategoryBreakdown: {categoryId: string, amount: number}[]
}

// --- Helpers ---

export function fmtVND(n: number) {
  return n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })
}

export function fmtTxDate(timestamp: number): { date: string; time: string } {
  const d = new Date(timestamp)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = String(d.getFullYear()).slice(-2)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return { date: `${day}/${month}/${year}`, time: `${hours}:${minutes}` }
}

export function fmtShort(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} tr`
  if (abs >= 1_000) return `${Math.round(n / 1_000)}K`
  return n.toLocaleString('vi-VN')
}

export function getAccountLabel(
  accountId: string | undefined,
  linkedCardId: string | undefined,
  accounts: Account[],
  cards: Card[] = []
): string {
  if (!accountId) return '—'
  const account = accounts.find(a => a.id === accountId)
  if (!account) return accountId
  if (linkedCardId) {
    const card = cards.find(c => c.id === linkedCardId)
    if (card) return `${account.name} · ${card.name}`
  }
  return account.name
}

export function getCategoryLabel(
  tx: Transaction,
  catMap: Map<string, Category>
): { catName: string; subName: string | null } {
  const cat = catMap.get(tx.categoryId)
  if (!cat) return { catName: tx.categoryId, subName: null }
  if (cat.parentId === null) return { catName: cat.name, subName: null }
  const parent = catMap.get(cat.parentId)
  return { catName: parent?.name ?? cat.name, subName: cat.name }
}

export function getTxType(
  tx: Transaction,
  expenseCatIds: Set<string>,
  incomeCatIds: Set<string>
): TxType {
  if (tx.fromAccountId && tx.toAccountId) return 'Transfer'
  if (tx.fromAccountId && !tx.toAccountId && expenseCatIds.has(tx.categoryId)) return 'Expense'
  if (!tx.fromAccountId && tx.toAccountId && incomeCatIds.has(tx.categoryId)) return 'Income'
  return 'Adjustment'
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getDateParams(preset: DateRangePreset, customStart: string, customEnd: string) {
  const now = new Date()
  if (preset === 'this-month') {
    return {
      startDate: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
      endDate: toISODate(now),
    }
  }
  if (preset === 'last-month') {
    return {
      startDate: toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      endDate: toISODate(new Date(now.getFullYear(), now.getMonth(), 0)),
    }
  }
  return { startDate: customStart || undefined, endDate: customEnd || undefined }
}