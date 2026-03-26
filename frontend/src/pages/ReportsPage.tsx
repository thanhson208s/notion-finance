import './ReportsPage.css'
import { useEffect, useMemo, useState, useRef } from 'react'
import {
  ArrowDownWideNarrow, ArrowUpDown, ArrowUpNarrowWide,
  BarChart2, Calendar, CalendarCheck,
  ChevronDown, ChevronRight,
  ListOrdered, Search, TrendingDown, TrendingUp,
  Loader2, RefreshCw
} from 'lucide-react'
import { type Category, type DateRangePreset, API_BASE, CATEGORY_COLORS, getCategoryConfig } from '../App'
import { useAppContext } from '../contexts/AppContext'
import { TxItem, AdjustmentTxItem, TransferTxItem } from '../components/TxItems'
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal'
import { type Transaction, type TxType, fmtVND, fmtShort, getTxType, getDateParams } from '../App'
import { usePullToRefresh } from '../hooks/usePullToRefresh'

// --- Types ---

type Tab = 'expense' | 'income'
type SortKey = 'date' | 'amount'

export type CategoryItem = {
  categoryId: string
  categoryName: string
  parentId: string
  amount: number
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

function buildGroups(categories: Category[], breakdown: {categoryId: string, amount: number}[]): CategoryGroup[] {
  const grouped = new Map<string, CategoryGroup>()

  // Register top-level categories first
  categories.filter(c => c.parentId === null).forEach(c => {
    const amount = breakdown.find(b => b.categoryId === c.id)?.amount ?? 0
    grouped.set(c.id, { parent: {
      categoryId: c.id,
      categoryName: c.name,
      parentId: c.id,
      amount
    }, children: [], groupTotal: amount })
  })

  // Assign children (orphans treated as top-level)
  categories.filter(c => c.parentId !== null).forEach(c => {
    const amount = breakdown.find(b => b.categoryId === c.id)?.amount ?? 0
    if (grouped.has(c.parentId!)) {
      const g = grouped.get(c.parentId!)!
      g.children.push({
        categoryId: c.id,
        categoryName: c.name,
        parentId: c.parentId!,
        amount
      })
      g.groupTotal += amount
    } else {
      grouped.set(c.id, { parent: {
        categoryId: c.id,
        categoryName: c.name,
        parentId: c.id,
        amount
      }, children: [], groupTotal: amount })
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
  groups.forEach((g, i) => {
    map[g.parent.categoryId] = CATEGORY_COLORS[g.parent.categoryName] ?? COLORS[i % COLORS.length]
  })
  return map
}

// --- Component ---

export default function ReportsPage() {
  const { accounts, categories, cards, reports, thisMonthLoading, lastMonthLoading, customRangeLoading, dateRange, customStart, customEnd, refetchAccounts, refetchReports } = useAppContext()
  const [tab, setTab] = useState<Tab>('expense')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Transaction view state
  const [showTxView, setShowTxView] = useState(false)
  const [txTypeFilter, setTxTypeFilter] = useState<TxType>('Expense')
  const [txCategoryFilter, setTxCategoryFilter] = useState('all')
  const [txAccountFilter, setTxAccountFilter] = useState('all')
  const [txSearchInput, setTxSearchInput] = useState('')
  const [txSearchQuery, setTxSearchQuery] = useState('')
  const [txSort, setTxSort] = useState<SortKey>('date')
  const [txAmountDir, setTxAmountDir] = useState<'desc' | 'asc'>('desc')
  const [deleteTarget, setDeleteTarget] = useState<{ tx: Transaction; type: TxType } | null>(null)
  
  const pageRef = useRef<HTMLElement>(null)
  const { pullDistance, refreshing } = usePullToRefresh(() => {refetchReports(true, false)}, pageRef)

  const data = dateRange === 'this-month' ? reports.thisMonthReport : (dateRange === 'last-month' ? reports.lastMonthReport : reports.customRangeReport)

  const handleDeleteTx = async (txId: string) => {
    await fetch(`${API_BASE}/transactions?id=${txId}`, { method: 'DELETE' })
    refetchReports(true, true)
    refetchAccounts()
  }

  const isCustom = dateRange === 'custom'
  const dateInvalid = isCustom && !!customStart && !!customEnd && customEnd < customStart
  const { startDate: presetStart, endDate: presetEnd } = getDateParams(dateRange, customStart, customEnd)

  useEffect(() => {
    switch(dateRange) {
      case 'this-month':
        if (!thisMonthLoading && !reports.thisMonthReport)
          refetchReports(true, false)
        break;
      case 'last-month':
        if (!lastMonthLoading && !reports.lastMonthReport)
          refetchReports(true, false)
        break;
      case 'custom':
        if (!customRangeLoading && !reports.customRangeReport)
          refetchReports(true, false)
        break;
    }
  }, [dateRange, thisMonthLoading, lastMonthLoading, customRangeLoading, reports, refetchReports])

  const catMap = useMemo(() => {
    const map = new Map<string, Category>()
    categories.forEach(c => map.set(c.id, c))
    return map
  }, [categories])

  const breakdown = tab === 'expense'
    ? (data?.expenseCategoryBreakdown ?? [])
    : (data?.incomeCategoryBreakdown ?? [])
  const total = tab === 'expense' ? (data?.totalExpense ?? 0) : (data?.totalIncome ?? 0)
  const groups = buildGroups(categories.filter(c => (tab === 'expense' && c.type === 'Expense' || tab === 'income' && c.type === 'Income')), breakdown)
  const colorMap = buildColorMap(groups)

  const setDateRange = (dateRange: DateRangePreset) => {
    switch(dateRange) {
      case 'this-month':
        refetchReports(false, false, dateRange)
        break;
      case 'last-month':
        refetchReports(false, false, dateRange)
        break;
      case 'custom':
        refetchReports(false, false, dateRange)
        break;
    }
  }

  const setCustomStart = (customStart: string) => {
    refetchReports(false, false, undefined, customStart, undefined)
  }

  const setCustomEnd = (customEnd: string) => {
    refetchReports(false, false, undefined, undefined, customEnd)
  }

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
    return source.filter(c => categories.find(x => x.id === c.categoryId)?.parentId === null)
  }, [categories, txTypeFilter, data])

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
    if (txAccountFilter !== 'all') {
      txs = txs.filter(tx => tx.fromAccountId === txAccountFilter || tx.toAccountId === txAccountFilter)
    }
    if (txSearchQuery.trim() !== '') {
      const tokens = txSearchQuery.trim().toLowerCase().split(/\s+/)
      txs = txs.filter(tx => {
        const note = tx.note.toLowerCase()
        return tokens.every(token => note.includes(token))
      })
    }
    if (txSort === 'date') {
      txs = [...txs].sort((a, b) => b.timestamp - a.timestamp)
    } else {
      txs = [...txs].sort((a, b) => txAmountDir === 'desc' ? b.amount - a.amount : a.amount - b.amount)
    }
    return txs.map(tx => ({ tx, type: getTxType(tx, expenseCatIds, incomeCatIds) }))
  }, [data, txTypeFilter, txCategoryFilter, txAccountFilter, txSearchQuery, txSort, txAmountDir, expenseCatIds, incomeCatIds, catMap])

  return (
    <main className="page reports-page" ref={pageRef}>
      <div
        className="ptr-indicator"
        style={{ '--pull': `${pullDistance}px` } as React.CSSProperties}
        aria-hidden
      >
        {refreshing
          ? <Loader2 size={24} className="ptr-spin" />
          : <RefreshCw size={24} style={{ transform: `rotate(${pullDistance * 2}deg)` }} />
        }
      </div>

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
      {(dateRange === 'this-month' && thisMonthLoading || dateRange === 'last-month' && lastMonthLoading || dateRange === 'custom' && customRangeLoading) && (
        <div className="reports-state">
          <div className="circle-loading" />
        </div>
      )}

      {/* ── Content ── */}
      {(dateRange === 'this-month' && !thisMonthLoading || dateRange === 'last-month' && !lastMonthLoading || dateRange === 'custom' && !customRangeLoading) && (
        <>
          {showTxView ? (
            /* ── Transaction history view ── */
            <>
              {/* Search + Sort row */}
              <div className="tx-search-row">
                <input
                  className="tx-search-input"
                  type="text"
                  placeholder="Search notes…"
                  value={txSearchInput}
                  onChange={e => setTxSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') setTxSearchQuery(txSearchInput) }}
                />
                <button
                  title="Search"
                  className="tx-search-btn"
                  onClick={() => setTxSearchQuery(txSearchInput)}
                >
                  <Search size={16} />
                </button>
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
                      ? (txAmountDir === 'desc' ? <ArrowDownWideNarrow size={16} /> : <ArrowUpNarrowWide size={16} />)
                      : <ArrowUpDown size={16} />
                    }
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="tx-filters">
                <select
                  title="Account"
                  className="tx-select"
                  value={txAccountFilter}
                  onChange={e => setTxAccountFilter(e.target.value)}
                >
                  <option value="all">All accounts</option>
                  {Object.entries(
                    accounts.filter(a => a.active).reduce<Record<string, typeof accounts>>((acc, a) => {
                      ;(acc[a.type] ??= []).push(a)
                      return acc
                    }, {})
                  ).map(([type, accs]) => (
                    <optgroup key={type} label={type}>
                      {accs.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <select
                  title="Type"
                  className="tx-select"
                  value={txTypeFilter}
                  onChange={e => {
                    setTxTypeFilter(e.target.value as TxType)
                    setTxCategoryFilter('all')
                    setTxAccountFilter('all')
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
                  <option value="all">All categories</option>
                  {categoryOptions.map(c => (
                    <option key={c.categoryId} value={c.categoryId}>{categories.find(x => x.id === c.categoryId)?.name ?? c.categoryId}</option>
                  ))}
                </select>

              </div>

              {/* Transaction list */}
              <div className="tx-list">
                {filteredTxs.length === 0 && (
                  <div className="reports-empty">No transactions for this filter</div>
                )}
                {filteredTxs.map(({ tx, type }) => {
                  if (type === 'Transfer')
                    return <TransferTxItem key={tx.id} tx={tx} accounts={accounts} catMap={catMap} onDelete={() => setDeleteTarget({ tx, type })} />
                  if (type === 'Adjustment')
                    return <AdjustmentTxItem key={tx.id} tx={tx} accounts={accounts} cards={cards} catMap={catMap} onDelete={() => setDeleteTarget({ tx, type })} />
                  return <TxItem key={tx.id} tx={tx} type={type} accounts={accounts} cards={cards} catMap={catMap} onDelete={() => setDeleteTarget({ tx, type })} />
                })}
              </div>
            </>
          ) : (
            /* ── Report view ── */
            <>
              {/* Summary card */}
              <div className="reports-summary">
                <div className="reports-summary-label">NET SAVINGS</div>
                <div className={`reports-summary-amount${data?.netSavings ?? 0 < 0 ? ' reports-summary-amount--neg' : ''}`}>
                  {fmtVND(data?.netSavings ?? 0)}
                </div>
                <div className="reports-summary-sub">
                  <span className="reports-summary-income">↑ {fmtVND(data?.totalIncome ?? 0)}</span>
                  <span className="reports-summary-expense">↓ {fmtVND(data?.totalExpense ?? 0)}</span>
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
                  const catName = catMap.get(g.parent.categoryId)?.name ?? g.parent.categoryName
                  const catCfg = getCategoryConfig(catName)

                  return (
                    <div key={g.parent.categoryId}
                      className={`reports-group${isDimmed ? ' reports-group--dimmed' : ''}`}
                    >
                      {/* Parent row: [icon] [content (name+amount+bar)] [chevron] */}
                      <div className="reports-parent-row" onClick={() => {
                        if (g.children.length > 0) {
                          toggleSelect(g.parent.categoryId)
                          toggleExpand(g.parent.categoryId)
                        } else {
                          navigateToTransactions(g.parent.categoryId)
                        }
                      }}>
                        {catCfg && (
                          <div className="reports-cat-icon" style={{ color: catCfg.color }}><catCfg.Icon size={18} /></div>
                        )}
                        <div className="reports-parent-body">
                          <div className="reports-parent-header">
                            <span className="reports-parent-name">{catName}</span>
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

      {deleteTarget && (
        <ConfirmDeleteModal
          tx={deleteTarget.tx}
          type={deleteTarget.type}
          accounts={accounts}
          cards={cards}
          catMap={catMap}
          onConfirm={() => handleDeleteTx(deleteTarget.tx.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </main>
  )
}
