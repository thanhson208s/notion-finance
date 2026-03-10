import type { Account, Category } from '../App'

// --- Types ---

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

export type CategoryItem = {
  categoryId: string
  categoryName: string
  parentId: string
  amount: number
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

export function getAccountLabel(
  accountId: string | undefined,
  linkedCardId: string | undefined,
  accounts: Account[]
): string {
  if (!accountId) return '—'
  const account = accounts.find(a => a.id === accountId)
  if (!account) return accountId
  if (linkedCardId) {
    const card = account.cards.find(c => c.id === linkedCardId)
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

export const CATEGORY_COLORS: Record<string, string> = {
  'Food':           '#f97316',
  'Entertainment':  '#a855f7',
  'Hobbies':        '#ec4899',
  'Transportation': '#3b82f6',
  'Pet':            '#10b981',
  'Household':      '#14b8a6',
  'Gift':           '#f43f5e',
  'Salary':         '#22c55e',
  'Interest':       '#60a5fa',
  'Cashback':       '#fbbf24',
  'Refund':         '#94a3b8',
}

export const TYPE_COLORS: Record<TxType, string> = {
  'Income':     '#10b981',
  'Expense':    '#ef4444',
  'Transfer':   '#3b82f6',
  'Adjustment': '#64748b',
  'System':     '#64748b',
}
