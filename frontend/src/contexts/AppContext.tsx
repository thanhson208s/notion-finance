/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { API_BASE } from '../App'
import { apiFetch } from '../lib/auth'
import type { Account, Card, Category, ReportsData, DateRangePreset, Promotion } from '../App'
import { getDateParams } from '../App'

type Totals = { total: number; totalOfAssets: number; totalOfLiabilities: number }
type Reports = {
  thisMonthReport: ReportsData | null
  lastMonthReport: ReportsData | null
  customRangeReport: ReportsData | null
}

type AppState = {
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

const AppContext = createContext<AppState | null>(null)

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
  const thisMonthAbort = useRef<AbortController>(null)
  const lastMonthAbort = useRef<AbortController>(null)
  const customRangeAbort = useRef<AbortController>(null)

  const fetchAccounts = useCallback(async (signal?: AbortSignal) => {
    setAccountsLoading(true)
    try {
      const res = await apiFetch(`${API_BASE}/accounts`, { signal })
      if (!res.ok) throw new Error('Failed to fetch accounts')
      const data = await res.json()
      setAccounts(data.accounts)
      setTotals({ total: data.total, totalOfAssets: data.totalOfAssets, totalOfLiabilities: data.totalOfLiabilities })
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') toast.error('Failed to load accounts')
    } finally {
      if (!signal?.aborted) setAccountsLoading(false)
    }
  }, [])

  const fetchPromotions = useCallback(async (signal?: AbortSignal) => {
    setPromotionsLoading(true)
    try {
      const res = await apiFetch(`${API_BASE}/promotions`, { signal })
      if (!res.ok) throw new Error('Failed to fetch promotions')
      const data = await res.json()
      setPromotions(data.promotions ?? [])
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') toast.error('Failed to load promotions')
    } finally {
      if (!signal?.aborted) setPromotionsLoading(false)
    }
  }, [])

  const fetchCards = useCallback(async (signal?: AbortSignal) => {
    setCardsLoading(true)
    try {
      const res = await apiFetch(`${API_BASE}/cards`, { signal })
      if (!res.ok) throw new Error('Failed to fetch cards')
      const data = await res.json()
      setCards(data.cards)
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') toast.error('Failed to load cards')
    } finally {
      if (!signal?.aborted) setCardsLoading(false)
    }
  }, [])

  const fetchCategories = useCallback(async (signal?: AbortSignal) => {
    setCategoriesLoading(true)
    try {
      const res = await apiFetch(`${API_BASE}/categories`, { signal })
      if (!res.ok) throw new Error('Failed to fetch categories')
      const data = await res.json()
      setCategories(data.categories)
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') toast.error('Failed to load categories')
    } finally {
      if (!signal?.aborted) setCategoriesLoading(false)
    }
  }, [])

  const fetchReports = useCallback(async () => {
    if (dateRange === 'custom' && (!customStart || !customEnd) || customEnd < customStart) return
    let abortController
    switch(dateRange) {
      case 'this-month': 
        if (thisMonthAbort.current && !thisMonthAbort.current.signal.aborted)
          thisMonthAbort.current.abort()
        abortController = thisMonthAbort.current = new AbortController()
        setThisMonthLoading(true); break;
      case 'last-month':
        if (lastMonthAbort.current && !lastMonthAbort.current.signal.aborted)
          lastMonthAbort.current.abort()
        abortController = lastMonthAbort.current = new AbortController()
        setLastMonthLoading(true); break;
      case 'custom':
        if (customRangeAbort.current && !customRangeAbort.current.signal.aborted)
          customRangeAbort.current.abort()
        abortController = customRangeAbort.current = new AbortController()
        setCustomRangeLoading(true); break;
    }

    const { startDate, endDate } = getDateParams(dateRange, customStart, customEnd)
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    const query = params.size ? `?${params.toString()}` : '';
    try {
      // let abortController;
      // switch(dateRange) {
      //   case 'this-month':
      //     abortController = thisMonthAbort.current = new AbortController()
      //     break
      //   case 'last-month':
      //     abortController = lastMonthAbort.current = new AbortController()
      //     break
      //   case 'custom':
      //     abortController = customRangeAbort.current = new AbortController()
      //     break
      // }

      const res = await apiFetch(`${API_BASE}/reports${query}`, { signal: abortController?.signal })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json() as ReportsData
      setReports((cur) => ({
        thisMonthReport: dateRange === 'this-month' ? data : cur.thisMonthReport,
        lastMonthReport: dateRange === 'last-month' ? data : cur.lastMonthReport,
        customRangeReport: dateRange === 'custom' ? data : cur.customRangeReport
      }))  
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') toast.error('Failed to load reports')
    } finally {
      if (!abortController.signal.aborted)
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

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
