/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { API_BASE } from '../App'
import type { Account, Card, Category, ReportsData, DateRangePreset, Promotion } from '../App'
import { getDateParams } from '../App'

type Totals = { total: number; totalOfAssets: number; totalOfLiabilities: number }
type Reports = {
  thisMonthReport: ReportsData | null
  lastMonthReport: ReportsData | null
  customRangeReport: ReportsData | null
}

type AppContextValue = {
  accounts: Account[]
  totals: Totals
  accountsLoading: boolean
  categories: Category[]
  categoriesLoading: boolean
  reports: Reports
  thisMonthLoading: boolean
  lastMonthLoading: boolean
  customRangeLoading: boolean
  dateRange: DateRangePreset
  customStart: string
  customEnd: string
  cards: Card[]
  cardsLoading: boolean
  promotions: Promotion[]
  promotionsLoading: boolean

  updateAccount: (id: string, patch: Partial<Account>) => void
  addAccount: (account: Account) => void
  refetchAccounts: () => void
  refetchReports: (forced: boolean, reset: boolean, dateRange?: DateRangePreset, customStart?: string, customEnd?: string) => void
  refetchCards: () => void
  addPromotion: (p: Promotion) => void
  removePromotion: (id: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [totals, setTotals] = useState<Totals>({ total: 0, totalOfAssets: 0, totalOfLiabilities: 0 })
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [reports, setReports] = useState<Reports>({
    thisMonthReport: null,
    lastMonthReport: null,
    customRangeReport: null
  });
  const [thisMonthLoading, setThisMonthLoading] = useState(false);
  const [lastMonthLoading, setLastMonthLoading] = useState(false);
  const [customRangeLoading, setCustomRangeLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangePreset>("this-month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [cards, setCards] = useState<Card[]>([])
  const [cardsLoading, setCardsLoading] = useState(true)
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [promotionsLoading, setPromotionsLoading] = useState(true)
  
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
      if (!signal?.aborted) setAccountsLoading(false)
    }
  }, [])

  const fetchPromotions = useCallback(async (signal?: AbortSignal) => {
    setPromotionsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/promotions`, { signal })
      if (!res.ok) throw new Error('Failed to fetch promotions')
      const data = await res.json()
      setPromotions(data.promotions ?? [])
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') console.log(e.message)
    } finally {
      if (!signal?.aborted) setPromotionsLoading(false)
    }
  }, [])

  const fetchCards = useCallback(async (signal?: AbortSignal) => {
    setCardsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/cards`, { signal })
      if (!res.ok) throw new Error('Failed to fetch cards')
      const data = await res.json()
      setCards(data.cards)
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') console.log(e.message)
    } finally {
      if (!signal?.aborted) setCardsLoading(false)
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
      if (!signal?.aborted) setCategoriesLoading(false)
    }
  }, [])

  const fetchReports = useCallback(async () => {
    if (dateRange === 'custom' && (!customStart || !customEnd) || customEnd < customStart) return
    switch(dateRange) {
      case 'this-month': setThisMonthLoading(true); break;
      case 'last-month': setLastMonthLoading(true); break;
      case 'custom': setCustomRangeLoading(true); break;
    }

    const { startDate, endDate } = getDateParams(dateRange, customStart, customEnd)
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    const query = params.size ? `?${params.toString()}` : '';
    try {
      const res = await fetch(`${API_BASE}/reports${query}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json() as ReportsData
      setReports((cur) => ({
        thisMonthReport: dateRange === 'this-month' ? data : cur.thisMonthReport,
        lastMonthReport: dateRange === 'last-month' ? data : cur.lastMonthReport,
        customRangeReport: dateRange === 'custom' ? data : cur.customRangeReport
      }))  
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') console.log(e.message);
    } finally {
      switch(dateRange) {
        case 'this-month': setThisMonthLoading(false); break;
        case 'last-month': setLastMonthLoading(false); break;
        case 'custom': setCustomRangeLoading(false); break;
      }
    }
    
  }, [dateRange, customStart, customEnd])

  useEffect(() => {
    const controller = new AbortController()
    fetchAccounts(controller.signal)
    fetchCategories(controller.signal)
    fetchCards(controller.signal)
    fetchPromotions(controller.signal)
    return () => controller.abort()
  }, [fetchAccounts, fetchCategories, fetchCards, fetchPromotions])

  const updateAccount = useCallback((id: string, patch: Partial<Account>) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
  }, [])

  const addAccount = useCallback((account: Account) => {
    setAccounts(prev => [...prev, account])
  }, [])

  const refetchAccounts = useCallback(() => fetchAccounts(), [fetchAccounts])
  const refetchCards = useCallback(() => fetchCards(), [fetchCards])
  const addPromotion = useCallback((p: Promotion) => setPromotions(prev => [p, ...prev]), [])
  const removePromotion = useCallback((id: string) => setPromotions(prev => prev.filter(p => p.id !== id)), [])

  const refetchReports = useCallback((forced: boolean, reset: boolean, dateRange?: DateRangePreset, customStart?: string, customEnd?: string) => {
    if (dateRange) setDateRange(dateRange);
    if (customStart) setCustomStart((_customStart) => {
      if (_customStart !== customStart)
        setReports((cur) => ({
          thisMonthReport: cur.thisMonthReport,
          lastMonthReport: cur.lastMonthReport,
          customRangeReport: null
        }))
      return customStart;
    });
    if (customEnd) setCustomEnd((_customEnd) => {
      if (_customEnd !== customEnd)
        setReports((cur) => ({
          thisMonthReport: cur.thisMonthReport,
          lastMonthReport: cur.lastMonthReport,
          customRangeReport: null
        }))
      return customEnd;
    });
    if (reset) setReports({
      thisMonthReport: null,
      lastMonthReport: null,
      customRangeReport: null
    })
    if (forced) fetchReports();
  }, [fetchReports])

  return (
    <AppContext.Provider value={{ accounts, totals, accountsLoading, categories, categoriesLoading, reports, thisMonthLoading, lastMonthLoading, customRangeLoading, dateRange, customStart, customEnd, cards, cardsLoading, promotions, promotionsLoading, updateAccount, addAccount, refetchAccounts, refetchReports, refetchCards, addPromotion, removePromotion }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider')
  return ctx
}
