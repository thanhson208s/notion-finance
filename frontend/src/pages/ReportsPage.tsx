import './ReportsPage.css'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownWideNarrow, ArrowUpDown, ArrowUpNarrowWide,
  BarChart2, Calendar, CalendarCheck,
  ChevronDown, ChevronRight,
  ListOrdered, TrendingDown, TrendingUp
} from 'lucide-react'
import { type Category, API_BASE } from '../App'
import { useAppContext } from '../contexts/AppContext'
import { TxItem, AdjustmentTxItem, TransferTxItem } from '../components/TxItems'                            
import { type Transaction, type CategoryItem, type TxType, fmtVND } from '../components/txUtils'   

// --- Types ---

type DateRangePreset = 'last-month' | 'this-month' | 'custom'
type Tab = 'expense' | 'income'
type SortKey = 'date' | 'amount'

type ReportsData = {
  totalIncome: number
  totalExpense: number
  netSavings: number
  transactions: Transaction[]
  expenseCategoryBreakdown: CategoryItem[]
  incomeCategoryBreakdown: CategoryItem[]
}

type CategoryGroup = {
  parent: CategoryItem
  children: CategoryItem[]
  groupTotal: number
}

// --- Constants ---

const COLORS = [
  '#195de6', '#e74c3c', '#2ecc71', '#f59e0b',
  '#9b59b6', '#1abc9c', '#e67e22', '#3498db',
  '#e91e63', '#00bcd4',
]

const R = 62
const CX = 70
const CY = 70
const SW = 12
const SW_RING = 16
const C = 2 * Math.PI * R

// --- Helpers ---

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDateParams(preset: DateRangePreset, customStart: string, customEnd: string) {
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

function buildGroups(breakdown: CategoryItem[]): CategoryGroup[] {
  const grouped = new Map<string, CategoryGroup>()

  // Register top-level categories first
  breakdown.filter(c => c.parentId === c.categoryId).forEach(c => {
    grouped.set(c.categoryId, { parent: c, children: [], groupTotal: c.amount })
  })

  // Assign children (orphans treated as top-level)
  breakdown.filter(c => c.parentId !== c.categoryId).forEach(c => {
    if (grouped.has(c.parentId)) {
      const g = grouped.get(c.parentId)!
      g.children.push(c)
      g.groupTotal += c.amount
    } else {
      grouped.set(c.categoryId, { parent: c, children: [], groupTotal: c.amount })
    }
  })

  // Inject synthetic "Other" child for top-level groups that have real children
  grouped.forEach(g => {
    if (g.parent.categoryId === g.parent.parentId && g.children.length > 0) {
      g.children.push({
        categoryId: `${g.parent.categoryId}__other`,
        categoryName: 'Other',
        parentId: g.parent.categoryId,
        amount: g.parent.amount,
      })
    }
  })

  return Array.from(grouped.values())
    .sort((a, b) => b.groupTotal - a.groupTotal)
}

function buildColorMap(groups: CategoryGroup[]): Record<string, string> {
  const map: Record<string, string> = {}
  groups.forEach((g, i) => { map[g.parent.categoryId] = COLORS[i % COLORS.length] })
  return map
}

function fmtShort(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} tr`
  if (abs >= 1_000) return `${Math.round(n / 1_000)}K`
  return n.toLocaleString('vi-VN')
}

function getTxType(
  tx: Transaction,
  expenseCatIds: Set<string>,
  incomeCatIds: Set<string>
): TxType {
  if (tx.fromAccountId && tx.toAccountId) return 'Transfer'
  if (tx.fromAccountId && !tx.toAccountId && expenseCatIds.has(tx.categoryId)) return 'Expense'
  if (!tx.fromAccountId && tx.toAccountId && incomeCatIds.has(tx.categoryId)) return 'Income'
  return 'Adjustment'
}

// --- Component ---

export default function ReportsPage() {
  const { accounts, categories } = useAppContext()
  const [dateRange, setDateRange] = useState<DateRangePreset>('this-month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [tab, setTab] = useState<Tab>('expense')
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Transaction view state
  const [showTxView, setShowTxView] = useState(false)
  const [txTypeFilter, setTxTypeFilter] = useState<TxType>('Expense')
  const [txCategoryFilter, setTxCategoryFilter] = useState('all')
  const [txSort, setTxSort] = useState<SortKey>('date')
  const [txAmountDir, setTxAmountDir] = useState<'desc' | 'asc'>('desc')

  const isCustom = dateRange === 'custom'
  const dateInvalid = isCustom && !!customStart && !!customEnd && customEnd < customStart
  const { startDate: presetStart, endDate: presetEnd } = getDateParams(dateRange, customStart, customEnd)

  useEffect(() => {
    if (dateRange === 'custom' && (!customStart || !customEnd)) return
    if (dateInvalid) return

    const controller = new AbortController()
    setLoading(true)
    setFetchError(false)
    setSelectedGroup(null)
    setExpanded(null)
    setShowTxView(false)
    setTxTypeFilter('Expense')
    setTxCategoryFilter('all')
    setTxSort('date')
    setTxAmountDir('desc')

    const { startDate, endDate } = getDateParams(dateRange, customStart, customEnd)
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    const query = params.size ? `?${params.toString()}` : ''

    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/reports${query}`, { signal: controller.signal })
        if (!res.ok) throw new Error('Failed')
        setData(await res.json() as ReportsData)
      } catch (e) {
        if (e instanceof Error && e.name !== 'AbortError') setFetchError(true)
      } finally {
        setLoading(false)
      }
    })()

    return () => controller.abort()
  }, [dateRange, customStart, customEnd])

  const catMap = useMemo(() => {
    const map = new Map<string, Category>()
    categories.forEach(c => map.set(c.id, c))
    return map
  }, [categories])

  const breakdown = tab === 'expense'
    ? (data?.expenseCategoryBreakdown ?? [])
    : (data?.incomeCategoryBreakdown ?? [])
  const total = tab === 'expense' ? (data?.totalExpense ?? 0) : (data?.totalIncome ?? 0)
  const groups = buildGroups(breakdown)
  const colorMap = buildColorMap(groups)

  const toggleExpand = (id: string) => setExpanded(prev => prev === id ? null : id)

  const toggleSelect = (parentId: string) =>
    setSelectedGroup(prev => prev === parentId ? null : parentId)

  const navigateToTransactions = (categoryId: string) => {
    // Strip synthetic "__other" suffix — those map to the parent's real ID
    const realId = categoryId.endsWith('__other')
      ? categoryId.replace('__other', '')
      : categoryId

    // Map child category → parent so the dropdown filter (top-level only) works correctly
    const cat = catMap.get(realId)
    const filterCategoryId = cat?.parentId ?? realId

    setShowTxView(true)
    setTxTypeFilter(tab === 'expense' ? 'Expense' : 'Income')
    setTxCategoryFilter(filterCategoryId)
    setTxSort('date')
    setTxAmountDir('desc')
  }

  // Sub-donut when a group is expanded
  const expandedGroup = expanded ? groups.find(g => g.parent.categoryId === expanded) : null
  const showSubDonut = !!(expandedGroup && expandedGroup.groupTotal > 0)

  // Donut center
  const sel = selectedGroup ? groups.find(g => g.parent.categoryId === selectedGroup) : null
  const centerAmount = sel ? sel.groupTotal : total
  const centerLabel = sel
    ? (catMap.get(sel.parent.categoryId)?.name ?? sel.parent.categoryName).toUpperCase()
    : (tab === 'expense' ? 'TOTAL EXPENSE' : 'TOTAL INCOME')
  const centerPct = sel && total > 0 ? Math.round(sel.groupTotal / total * 100) : null

  // --- Transaction view memos ---

  const expenseCatIds = useMemo(() => {
    return new Set((data?.expenseCategoryBreakdown ?? []).map(c => c.categoryId))
  }, [data])

  const incomeCatIds = useMemo(() => {
    return new Set((data?.incomeCategoryBreakdown ?? []).map(c => c.categoryId))
  }, [data])

  const categoryOptions = useMemo(() => {
    if (txTypeFilter === 'System') return [
      { categoryId: 'Transfer', categoryName: 'Transfer', parentId: 'Transfer', amount: 0 },
      { categoryId: 'Adjustment', categoryName: 'Adjustment', parentId: 'Adjustment', amount: 0 },
    ]
    const source = txTypeFilter === 'Expense'
      ? (data?.expenseCategoryBreakdown ?? [])
      : (data?.incomeCategoryBreakdown ?? [])
    return source.filter(c => c.parentId === c.categoryId)
  }, [txTypeFilter, data])

  const filteredTxs = useMemo(() => {
    if (!data) return []
    let txs = data.transactions.filter(tx => {
      const type = getTxType(tx, expenseCatIds, incomeCatIds)
      if (txTypeFilter === 'System') {
        if (type !== 'Transfer' && type !== 'Adjustment') return false
        if (txCategoryFilter !== 'all' && type !== txCategoryFilter) return false
      } else {
        if (type !== txTypeFilter) return false
        if (txCategoryFilter !== 'all') {
          const cat = catMap.get(tx.categoryId)
          const parentId = cat?.parentId ?? tx.categoryId
          if (parentId !== txCategoryFilter && tx.categoryId !== txCategoryFilter) return false
        }
      }
      return true
    })
    if (txSort === 'date') {
      txs = [...txs].sort((a, b) => b.timestamp - a.timestamp)
    } else {
      txs = [...txs].sort((a, b) => txAmountDir === 'desc' ? b.amount - a.amount : a.amount - b.amount)
    }
    return txs.map(tx => ({ tx, type: getTxType(tx, expenseCatIds, incomeCatIds) }))
  }, [data, txTypeFilter, txCategoryFilter, txSort, txAmountDir, expenseCatIds, incomeCatIds, catMap])

  return (
    <main className="page reports-page">

      {/* ── Fixed filter bar ── */}
      <div className="reports-filter-bar">
        <div className="reports-date-pills">
          {(['last-month', 'this-month', 'custom'] as const).map(preset => (
            <button
              key={preset}
              className={`reports-pill${dateRange === preset ? ' reports-pill--active' : ''}`}
              onClick={() => { setDateRange(preset); setSelectedGroup(null) }}
            >
              {preset === 'last-month' ? 'Last month' : preset === 'this-month' ? 'This month' : 'Custom range'}
            </button>
          ))}
        </div>

        <div className="reports-date-inputs">
          <input
            title="Start Date" type="date"
            className={`reports-date-input${dateInvalid ? ' reports-date-input--invalid' : ''}`}
            value={isCustom ? customStart : (presetStart ?? '')}
            disabled={!isCustom}
            onChange={e => setCustomStart(e.target.value)}
          />
          <span className="reports-date-sep">→</span>
          <input
            title="End Date" type="date"
            className={`reports-date-input${dateInvalid ? ' reports-date-input--invalid' : ''}`}
            value={isCustom ? customEnd : (presetEnd ?? '')}
            disabled={!isCustom}
            onChange={e => setCustomEnd(e.target.value)}
          />
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="reports-state">
          <div className="circle-loading" />
        </div>
      )}

      {/* ── Error ── */}
      {!loading && fetchError && (
        <div className="reports-state reports-error-msg">Failed to load reports</div>
      )}

      {/* ── Content ── */}
      {!loading && !fetchError && data && (
        <>
          {showTxView ? (
            /* ── Transaction history view ── */
            <>
              {/* Filters */}
              <div className="tx-filters">
                <select
                  title="Type"
                  className="tx-select"
                  value={txTypeFilter}
                  onChange={e => {
                    setTxTypeFilter(e.target.value as TxType)
                    setTxCategoryFilter('all')
                  }}
                >
                  <option value="Expense">Expense</option>
                  <option value="Income">Income</option>
                  <option value="System">System</option>
                </select>

                <select
                  title="Category"
                  className="tx-select"
                  value={txCategoryFilter}
                  disabled={categoryOptions.length === 0}
                  onChange={e => setTxCategoryFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  {categoryOptions.map(c => (
                    <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>
                  ))}
                </select>

                <div className="tx-sort-group">
                  <button
                    title="Sort by date"
                    className={`tx-sort-btn${txSort === 'date' ? ' tx-sort-btn--active' : ''}`}
                    onClick={() => setTxSort('date')}
                  >
                    {txSort === 'date' ? <CalendarCheck size={15} /> : <Calendar size={15} />}
                  </button>
                  <button
                    title="Sort by amount"
                    className={`tx-sort-btn${txSort === 'amount' ? ' tx-sort-btn--active' : ''}`}
                    onClick={() => {
                      if (txSort === 'amount') {
                        setTxAmountDir(d => d === 'desc' ? 'asc' : 'desc')
                      } else {
                        setTxSort('amount')
                        setTxAmountDir('desc')
                      }
                    }}
                  >
                    {txSort === 'amount'
                      ? (txAmountDir === 'desc' ? <ArrowDownWideNarrow size={15} /> : <ArrowUpNarrowWide size={15} />)
                      : <ArrowUpDown size={15} />
                    }
                  </button>
                </div>
              </div>

              {/* Transaction list */}
              <div className="tx-list">
                {filteredTxs.length === 0 && (
                  <div className="reports-empty">No transactions for this filter</div>
                )}
                {filteredTxs.map(({ tx, type }) => {
                  if (type === 'Transfer')
                    return <TransferTxItem key={tx.id} tx={tx} accounts={accounts} catMap={catMap} />
                  if (type === 'Adjustment')
                    return <AdjustmentTxItem key={tx.id} tx={tx} accounts={accounts} catMap={catMap} />
                  return <TxItem key={tx.id} tx={tx} type={type} accounts={accounts} catMap={catMap} />
                })}
              </div>
            </>
          ) : (
            /* ── Report view ── */
            <>
              {/* Summary card */}
              <div className="reports-summary">
                <div className="reports-summary-label">NET SAVINGS</div>
                <div className={`reports-summary-amount${data.netSavings < 0 ? ' reports-summary-amount--neg' : ''}`}>
                  {fmtVND(data.netSavings)}
                </div>
                <div className="reports-summary-sub">
                  <span className="reports-summary-income">↑ {fmtVND(data.totalIncome)}</span>
                  <span className="reports-summary-expense">↓ {fmtVND(data.totalExpense)}</span>
                </div>
              </div>

              {/* Tab toggle */}
              <div className="reports-tabs">
                <button
                  className={`reports-tab${tab === 'expense' ? ' reports-tab--active' : ''}`}
                  onClick={() => { setTab('expense'); setSelectedGroup(null); setExpanded(null) }}
                >
                  <TrendingDown size={15} />
                  Expense
                </button>
                <button
                  className={`reports-tab${tab === 'income' ? ' reports-tab--active' : ''}`}
                  onClick={() => { setTab('income'); setSelectedGroup(null); setExpanded(null) }}
                >
                  <TrendingUp size={15} />
                  Income
                </button>
              </div>

              {/* Donut chart */}
              {groups.length > 0 ? (
                <div className="reports-donut-wrapper">
                  <svg viewBox="0 0 140 140" className="reports-donut-svg">
                    {/* Outer ring */}
                    <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={SW_RING} />
                    {/* Inner track */}
                    <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={SW} />

                    {/* Segments */}
                    <g transform={`rotate(-90 ${CX} ${CY})`}>
                      {(() => {
                        let offset = 0
                        if (showSubDonut) {
                          const segTotal = expandedGroup!.groupTotal
                          return expandedGroup!.children.map((child, i) => {
                            if (child.amount <= 0 || segTotal <= 0) return null
                            const pct = child.amount / segTotal
                            const dashLen = pct * C
                            const dashOff = -offset * C
                            offset += pct
                            return (
                              <circle key={child.categoryId}
                                cx={CX} cy={CY} r={R}
                                fill="none"
                                stroke={COLORS[i % COLORS.length]}
                                strokeWidth={SW}
                                strokeDasharray={`${dashLen} ${C}`}
                                strokeDashoffset={dashOff}
                                style={{ transition: 'opacity 0.2s' }}
                              />
                            )
                          })
                        }
                        return groups.map(g => {
                          if (g.groupTotal <= 0 || total <= 0) return null
                          const pct = g.groupTotal / total
                          const dashLen = pct * C
                          const dashOff = -offset * C
                          offset += pct
                          return (
                            <circle key={g.parent.categoryId}
                              cx={CX} cy={CY} r={R}
                              fill="none"
                              stroke={colorMap[g.parent.categoryId]}
                              strokeWidth={SW}
                              strokeDasharray={`${dashLen} ${C}`}
                              strokeDashoffset={dashOff}
                              opacity={selectedGroup && selectedGroup !== g.parent.categoryId ? 0.3 : 1}
                              style={{ transition: 'opacity 0.2s' }}
                            />
                          )
                        })
                      })()}
                    </g>

                    {/* Center label */}
                    <text x={CX} y={centerPct !== null ? 50 : 60}
                      textAnchor="middle" dominantBaseline="middle" className="donut-center-label">
                      {centerLabel}
                    </text>

                    {/* Center amount */}
                    <text x={CX} y={centerPct !== null ? 70 : 80}
                      textAnchor="middle" dominantBaseline="middle" className="donut-center-amount">
                      {fmtShort(centerAmount)}
                    </text>

                    {/* Center pct */}
                    {centerPct !== null && (
                      <text x={CX} y={88}
                        textAnchor="middle" dominantBaseline="middle" className="donut-center-pct">
                        {centerPct}%
                      </text>
                    )}
                  </svg>
                </div>
              ) : (
                <div className="reports-empty">No transactions for this period</div>
              )}

              {/* Category list */}
              <div className="reports-category-list">
                {groups.map(g => {
                  const color = colorMap[g.parent.categoryId]
                  const isExpanded = expanded === g.parent.categoryId
                  const isSelected = selectedGroup === g.parent.categoryId
                  const isDimmed = selectedGroup !== null && !isSelected && !isExpanded
                  const barPct = total > 0 ? (g.groupTotal / total) * 100 : 0

                  return (
                    <div key={g.parent.categoryId}
                      className={`reports-group${isDimmed ? ' reports-group--dimmed' : ''}`}
                    >
                      {/* Parent row: [content (name+amount+bar)] [chevron] */}
                      <div className="reports-parent-row" onClick={() => {
                        if (g.children.length > 0) {
                          toggleSelect(g.parent.categoryId)
                          toggleExpand(g.parent.categoryId)
                        } else {
                          navigateToTransactions(g.parent.categoryId)
                        }
                      }}>
                        <div className="reports-parent-body">
                          <div className="reports-parent-header">
                            <span className="reports-parent-name">{catMap.get(g.parent.categoryId)?.name ?? g.parent.categoryName}</span>
                            <span className="reports-parent-amount">{fmtVND(g.groupTotal)}</span>
                          </div>
                          <div className="reports-bar-track">
                            <div className="reports-bar-fill" style={{ width: `${barPct}%`, background: color }} />
                          </div>
                        </div>
                        {isExpanded
                          ? <ChevronDown size={16} className="reports-chevron" />
                          : <ChevronRight size={16} className="reports-chevron" />
                        }
                      </div>

                      {/* Children block */}
                      {isExpanded && g.children.length > 0 && (
                        <div className="reports-children-block">
                          {g.children.map((child, i) => {
                            const childPct = total > 0 ? (child.amount / total) * 100 : 0
                            const childColor = COLORS[i % COLORS.length]
                            return (
                              <div key={child.categoryId} className="reports-child-row"
                                onClick={() => navigateToTransactions(child.categoryId)}
                              >
                                <div className="reports-child-body">
                                  <div className="reports-child-header">
                                    <span className="reports-child-name">{catMap.get(child.categoryId)?.name ?? child.categoryName}</span>
                                    <span className="reports-child-amount">{fmtVND(child.amount)}</span>
                                  </div>
                                  <div className="reports-bar-track reports-bar-track--child">
                                    <div className="reports-bar-fill" style={{ width: `${childPct}%`, background: childColor }} />
                                  </div>
                                </div>
                                <ChevronRight size={14} className="reports-chevron reports-chevron--sm" />
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ── See all / See report toggle ── */}
      <div className="reports-see-all-wrapper">
        <button className="reports-see-all" onClick={() => setShowTxView(p => !p)}>
          {showTxView
            ? <><BarChart2 size={16} /> See financial report <ChevronRight size={16} className="reports-see-all-chevron" /></>
            : <><ListOrdered size={16} /> See all transactions <ChevronRight size={16} className="reports-see-all-chevron" /></>
          }
        </button>
      </div>

    </main>
  )
}
