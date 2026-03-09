/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { API_BASE } from '../App'
import type { Account, Category } from '../App'

type Totals = { total: number; totalOfAssets: number; totalOfLiabilities: number }

type AppContextValue = {
  accounts: Account[]
  totals: Totals
  accountsLoading: boolean
  categories: Category[]
  categoriesLoading: boolean
  refetchAccounts: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [totals, setTotals] = useState<Totals>({ total: 0, totalOfAssets: 0, totalOfLiabilities: 0 })
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const fetchAccounts = useCallback(async (signal?: AbortSignal) => {
    setAccountsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/accounts`, { signal })
      if (!res.ok) throw new Error('Failed to fetch accounts')
      const data = await res.json()
      setAccounts(data.accounts)
      setTotals({ total: data.total, totalOfAssets: data.totalOfAssets, totalOfLiabilities: data.totalOfLiabilities })
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') console.log(e.message)
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  const fetchCategories = useCallback(async (signal?: AbortSignal) => {
    setCategoriesLoading(true)
    try {
      const res = await fetch(`${API_BASE}/categories`, { signal })
      if (!res.ok) throw new Error('Failed to fetch categories')
      const data = await res.json()
      setCategories(data.categories)
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') console.log(e.message)
    } finally {
      setCategoriesLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchAccounts(controller.signal)
    fetchCategories(controller.signal)
    return () => controller.abort()
  }, [fetchAccounts, fetchCategories])

  const refetchAccounts = useCallback(() => fetchAccounts(), [fetchAccounts])

  return (
    <AppContext.Provider value={{ accounts, totals, accountsLoading, categories, categoriesLoading, refetchAccounts }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider')
  return ctx
}
