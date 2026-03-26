import './CardDetailPage.css'
import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { API_BASE, fmtVND, fmtShort } from '../App'
import { apiFetch } from '../lib/auth'
import type { Card, CardWithSpending, Statement, Category } from '../App'
import { BadgePercent, CircleDollarSign, HandCoins, Info, List } from 'lucide-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDate(ms: number) {
  const d = new Date(ms)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function toInputDate(ms: number) {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const CARD_W = 90
const CARD_GAP = 14

function CardCarousel({ cards, currentId, onSelect }: {
  cards: Card[]
  currentId: string
  onSelect: (id: string) => void
}) {
  const n = cards.length
  const currentIndex = cards.findIndex(c => c.id === currentId)
  if (currentIndex === -1) return null

  const offset = currentIndex * (CARD_W + CARD_GAP) + CARD_W / 2

  const goPrev = () => onSelect(cards[(currentIndex - 1 + n) % n].id)
  const goNext = () => onSelect(cards[(currentIndex + 1) % n].id)

  return (
    <div className="carousel-wrapper">
      <div
        className="carousel-track"
        style={{ transform: `translateX(calc(50vw - ${offset}px))` }}
      >
        {cards.map((card) => {
          const isActive = card.id === currentId
          return (
            <div
              key={card.id}
              className={`carousel-item${isActive ? ' carousel-item-active' : ''}`}
              onClick={() => !isActive && onSelect(card.id)}
            >
              {card.imageUrl
                ? <img src={card.imageUrl} alt={card.name} className="carousel-img" />
                : <div className="carousel-img carousel-img-placeholder" />
              }
            </div>
          )
        })}
      </div>
      {n > 1 && (
        <>
          <button type="button" className="carousel-btn carousel-btn-prev" onClick={goPrev}>‹</button>
          <button type="button" className="carousel-btn carousel-btn-next" onClick={goNext}>›</button>
        </>
      )}
    </div>
  )
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="detail-bar-track">
      <div className="detail-bar-fill" style={{ width: `${pct}%`, background: color }} />
      <span className="detail-bar-pct">{Math.round(pct)}%</span>
    </div>
  )
}

function BenefitBar({ cashback, discount, annualFee }: { cashback: number; discount: number; annualFee: number }) {
  const grand = cashback + discount + annualFee
  const cashbackPct = grand > 0 ? (cashback / grand) * 100 : 0
  const discountPct = grand > 0 ? (discount / grand) * 100 : 0
  const feePct = grand > 0 ? (annualFee / grand) * 100 : 100

  return (
    <div className="benefit-bar-wrapper">
      <div className="benefit-bar-track">
        <div className="benefit-bar-cashback" style={{ width: `${cashbackPct}%` }} />
        <div className="benefit-bar-discount" style={{ width: `${discountPct}%` }} />
        <div className="benefit-bar-fee" style={{ width: `${feePct}%` }} />
      </div>
      <div className="benefit-bar-legend">
        <span className="benefit-bar-legend-item">
          <span className="benefit-dot benefit-dot-cashback" />
          {Math.round(cashbackPct)}% cashback
        </span>
        <span className="benefit-bar-legend-item">
          <span className="benefit-dot benefit-dot-discount" />
          {Math.round(discountPct)}% discount
        </span>
        <span className="benefit-bar-legend-item">
          <span className="benefit-dot benefit-dot-fee" />
          {Math.round(feePct)}% fee
        </span>
      </div>
    </div>
  )
}

type PreviewData = { spending: number; cashback: number; discount: number }

function AddStatementModal({ cardId, defaultStartDate, defaultEndDate, onClose, onAdded }: {
  cardId: string
  defaultStartDate?: string
  defaultEndDate?: string
  onClose: () => void
  onAdded: (stmt: Statement) => void
}) {
  const [startDate, setStartDate] = useState(() => {
    if (defaultStartDate) return defaultStartDate
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    d.setDate(d.getDate() + 1)
    return toInputDate(d.getTime())
  })
  const [endDate, setEndDate] = useState(defaultEndDate ?? toInputDate(Date.now()))
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const startMs = startDate ? new Date(startDate).getTime() : NaN
  const endMs = endDate ? new Date(endDate).getTime() : NaN
  const datesValid = !isNaN(startMs) && !isNaN(endMs) && startMs < endMs

  const fetchPreview = async () => {
    if (!datesValid) return
    setPreviewLoading(true)
    try {
      const res = await apiFetch(`${API_BASE}/statements?preview=1&cardId=${cardId}&startDate=${startMs}&endDate=${endMs}`)
      if (!res.ok) throw new Error('Failed')
      setPreview(await res.json() as PreviewData)
    } catch {
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  // Auto-fetch preview on first open
  useEffect(() => { fetchPreview() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!datesValid) return
    setSaving(true)
    try {
      const res = await apiFetch(`${API_BASE}/statements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, startDate: startMs, endDate: endMs })
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json() as Statement
      onAdded(data)
    } catch {
      alert('Failed to add statement')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Add Statement</h2>
        <div className="modal-form">
          <div className="modal-field">
            <label className="modal-label">Start Date</label>
            <input
              title="Start Date" type="date"
              className={`modal-input${!startDate || (!isNaN(startMs) && !isNaN(endMs) && startMs >= endMs) ? ' modal-input-error' : ''}`}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="modal-field">
            <label className="modal-label">End Date</label>
            <input
              title="End Date" type="date"
              className={`modal-input${!endDate || (!isNaN(startMs) && !isNaN(endMs) && startMs >= endMs) ? ' modal-input-error' : ''}`}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-preview">
          {previewLoading ? (
            <div className="modal-preview-loading">Calculating…</div>
          ) : preview ? (
            <div className="modal-preview-rows">
              <div className="modal-preview-row">
                <span className="modal-preview-label">Spending</span>
                <span className="modal-preview-value">{fmtVND(preview.spending)}</span>
              </div>
              <div className="modal-preview-row">
                <span className="modal-preview-label">Cashback</span>
                <span className="modal-preview-value modal-preview-cashback">{fmtVND(preview.cashback)}</span>
              </div>
              <div className="modal-preview-row">
                <span className="modal-preview-label">Discount</span>
                <span className="modal-preview-value modal-preview-discount">{fmtVND(preview.discount)}</span>
              </div>
            </div>
          ) : (
            <div className="modal-preview-loading">Press Preview to calculate</div>
          )}
        </div>

        <p className="modal-hint">Spending, cashback and discount will be tallied from transactions linked to this card within the selected period.</p>
        <div className="modal-actions">
          <button type="button" className="modal-btn modal-btn-cancel" onClick={fetchPreview} disabled={previewLoading || !datesValid}>
            {previewLoading ? '…' : 'Preview'}
          </button>
          <button type="button" className="modal-btn modal-btn-submit" onClick={submit} disabled={saving || !datesValid}>
            {saving ? '…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddExpenseModal({ card, categories, onClose, onAdded }: {
  card: Card
  categories: Category[]
  onClose: () => void
  onAdded: () => void
}) {
  const [amount, setAmount] = useState(0)
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [cashback, setCashback] = useState(0)
  const [cashbackMode, setCashbackMode] = useState<'flat' | 'pct'>('flat')
  const [discount, setDiscount] = useState(0)
  const [discountMode, setDiscountMode] = useState<'flat' | 'pct'>('flat')
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)

  const expenseCategories = categories.filter(c => c.type === 'Expense')
  const parents = expenseCategories.filter(c => c.parentId === null)
  const children = expenseCategories.filter(c => c.parentId !== null)

  const cashbackValue = cashbackMode === 'pct' ? Math.round(amount * cashback / 100) : cashback
  const discountValue = discountMode === 'pct' ? Math.round(amount * discount / 100) : discount

  const fmtAmount = (n: number) => n > 0
    ? n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })
    : ''

  const buildDigit = (setter: (fn: (prev: number) => number) => void) => (e: React.KeyboardEvent) => {
    if (e.code === 'Backspace') setter(p => Math.floor(p / 10))
    else if (e.code.match(/^Digit[0-9]$/)) setter(p => p * 10 + parseInt(e.code.slice(-1)))
  }

  const close = () => { setClosing(true); setTimeout(onClose, 240) }

  const submit = async () => {
    if (!amount || !categoryId) return
    setSaving(true)
    try {
      const res = await apiFetch(`${API_BASE}/transactions?type=expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: card.linkedAccountId,
          amount,
          categoryId,
          note,
          linkedCardId: card.id,
          cashback: cashbackValue,
          discount: discountValue,
        })
      })
      if (!res.ok) throw new Error('Failed')
      onAdded()
    } catch {
      alert('Failed to save expense')
      setSaving(false)
    }
  }

  return (
    <div className={`expense-modal-backdrop${closing ? ' expense-modal-backdrop--closing' : ''}`} onClick={close}>
      <div className={`expense-modal-sheet${closing ? ' expense-modal-sheet--closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="expense-modal-handle" />
        <h2 className="expense-modal-title">New Expense</h2>

        <div className="expense-modal-field">
          <label className="expense-modal-label">Amount</label>
          <input
            title="Amount" className="expense-modal-input expense-modal-input--amount"
            type="text" inputMode="numeric" placeholder="0 ₫"
            value={fmtAmount(amount)} onChange={() => {}}
            onKeyDown={buildDigit(setAmount)}
          />
        </div>

        <div className="expense-modal-field">
          <label className="expense-modal-label">Category</label>
          <select
            title="Category" className="expense-modal-select"
            value={categoryId} onChange={e => setCategoryId(e.target.value)}
          >
            <option value="">Select category</option>
            {parents.map(p => {
              const kids = children.filter(c => c.parentId === p.id)
              if (kids.length === 0) return <option key={p.id} value={p.id}>{p.name}</option>
              return (
                <optgroup key={p.id} label={p.name}>
                  {kids.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              )
            })}
          </select>
        </div>

        <div className="expense-modal-field">
          <label className="expense-modal-label">Note</label>
          <input
            title="Note" className="expense-modal-input"
            type="text" placeholder="Optional"
            value={note} onChange={e => setNote(e.target.value)}
          />
        </div>

        <div className="expense-modal-field">
          <label className="expense-modal-label">Cashback</label>
          <div className="expense-modal-input-row">
            <input
              title="Cashback" className="expense-modal-input"
              type="text" inputMode="numeric"
              placeholder={cashbackMode === 'flat' ? '0 ₫' : '0'}
              value={cashbackMode === 'flat' ? fmtAmount(cashback) : (cashback > 0 ? cashback.toString() : '')}
              onChange={() => {}}
              onKeyDown={buildDigit(setCashback)}
            />
            <button type="button" className="expense-modal-mode-btn" onClick={() => { setCashbackMode(m => m === 'flat' ? 'pct' : 'flat'); setCashback(0) }}>
              {cashbackMode === 'flat' ? '₫' : '%'}
            </button>
          </div>
          {cashbackMode === 'pct' && cashback > 0 && amount > 0 && (
            <span className="expense-modal-computed">= {fmtVND(cashbackValue)}</span>
          )}
        </div>

        <div className="expense-modal-field">
          <label className="expense-modal-label">Discount</label>
          <div className="expense-modal-input-row">
            <input
              title="Discount" className="expense-modal-input"
              type="text" inputMode="numeric"
              placeholder={discountMode === 'flat' ? '0 ₫' : '0'}
              value={discountMode === 'flat' ? fmtAmount(discount) : (discount > 0 ? discount.toString() : '')}
              onChange={() => {}}
              onKeyDown={buildDigit(setDiscount)}
            />
            <button type="button" className="expense-modal-mode-btn" onClick={() => { setDiscountMode(m => m === 'flat' ? 'pct' : 'flat'); setDiscount(0) }}>
              {discountMode === 'flat' ? '₫' : '%'}
            </button>
          </div>
          {discountMode === 'pct' && discount > 0 && amount > 0 && (
            <span className="expense-modal-computed">= {fmtVND(discountValue)}</span>
          )}
        </div>

        <div className="expense-modal-actions">
          <button type="button" className="expense-modal-btn expense-modal-btn--cancel" onClick={close}>Cancel</button>
          <button
            type="button" className="expense-modal-btn expense-modal-btn--submit"
            onClick={submit} disabled={saving || !amount || !categoryId}
          >
            {saving ? '…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CardDetailPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { cards, cardsLoading, accounts, categories } = useApp()

  const sortedCards = useMemo(() => {
    const accountMap = new Map(accounts.map(a => [a.id, a]))
    return [...cards].sort((a, b) => {
      if (a.billingDay && !b.billingDay) return -1;
      if (!a.billingDay && b.billingDay) return 1;
      const accA = a.linkedAccountId ? accountMap.get(a.linkedAccountId) : null
      const accB = b.linkedAccountId ? accountMap.get(b.linkedAccountId) : null
      const isDebitA = !accA || accA.type !== 'Credit'
      const isDebitB = !accB || accB.type !== 'Credit'
      if (isDebitA !== isDebitB) return isDebitA ? 1 : -1
      return (accB?.priorityScore ?? 0) - (accA?.priorityScore ?? 0)
    })
  }, [cards, accounts])

  const card = id ? (sortedCards.find(c => c.id === id) ?? null) : (sortedCards[0] ?? null)
  const effectiveId = card?.id ?? null

  const [subPage, setSubPage] = useState<'overview' | 'statements'>('overview')
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [statementsCache, setStatementsCache] = useState<Record<string, Statement[]>>({})
  const [cardDetailCache, setCardDetailCache] = useState<Record<string, CardWithSpending>>({})
  const [showAddStatement, setShowAddStatement] = useState(false)

  const statementsLoading = !!effectiveId && !(effectiveId in statementsCache)
  const statements = effectiveId ? (statementsCache[effectiveId] ?? []) : []
  const cycleData = effectiveId ? (cardDetailCache[effectiveId] ?? null) : null

  useEffect(() => {
    if (!effectiveId || effectiveId in statementsCache) return
    apiFetch(`${API_BASE}/statements?cardId=${effectiveId}`)
      .then(r => r.json())
      .then(d => setStatementsCache(prev => ({ ...prev, [effectiveId]: d.statements ?? [] })))
      .catch(() => setStatementsCache(prev => ({ ...prev, [effectiveId]: [] })))
  }, [effectiveId, statementsCache])

  useEffect(() => {
    if (!effectiveId || effectiveId in cardDetailCache) return
    apiFetch(`${API_BASE}/cards?id=${effectiveId}`)
      .then(r => r.json())
      .then(d => setCardDetailCache(prev => ({ ...prev, [effectiveId]: d })))
      .catch(() => {})
  }, [effectiveId, cardDetailCache])

  if (cardsLoading || !card) {
    return (
      <main className="page detail-page">
        <div className="detail-header">
          <h1 className="detail-header-title">Loading...</h1>
          <span className="detail-header-number">••••••</span>
        </div>
        {!cardsLoading && <div className="detail-empty">No cards found</div>}
        {cardsLoading && <div className="carousel-wrapper">
          <div className="circle-loading" />
        </div>}
      </main>
    )
  }

  const maskedNumber = card?.number ? `${card.number.slice(0, 6)} •••••• ${card.number.slice(-4)}` : ''

  // Annual cycle: lastChargedDate → (lastChargedDate + 1 year - 1 day)
  const annualStart = card.lastChargedDate ? new Date(card.lastChargedDate) : null
  const annualEndExclusive = annualStart
    ? new Date(annualStart.getFullYear() + 1, annualStart.getMonth(), annualStart.getDate())
    : null
  const annualEnd = annualEndExclusive
    ? new Date(annualEndExclusive.getTime() - 86400000)
    : null

  // Statements within annual cycle: both startDate and endDate must fall within [annualStart, annualEndExclusive)
  const annualStatements = (annualStart && annualEndExclusive)
    ? statements.filter(s =>
        s.startDate >= annualStart.getTime() && s.endDate < annualEndExclusive.getTime()
      )
    : statements

  const annualSpending = annualStatements.reduce((sum, s) => sum + s.spending, 0) + (cycleData?.currentCycleSpending ?? 0)
  const annualCashback = annualStatements.reduce((sum, s) => sum + s.cashback, 0) + (cycleData?.currentCycleCashback ?? 0)
  const annualDiscount = annualStatements.reduce((sum, s) => sum + s.discount, 0) + (cycleData?.currentCycleDiscount ?? 0)

  return (
    <main className="page detail-page">
      <div className="detail-header">
        <div className="header-select-wrapper">
          <select
            title="Name"
            className="header-select"
            value={effectiveId ?? ''}
            onChange={e => navigate(`/cards/${e.target.value}`, { replace: true })}
          >
            {sortedCards.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {maskedNumber && <span className="detail-header-number">{maskedNumber}</span>}
      </div>

      <CardCarousel
        cards={sortedCards}
        currentId={effectiveId!}
        onSelect={(cardId) => navigate(`/cards/${cardId}`, { replace: true })}
      />

      <div className="detail-tabs">
        <button
          type="button"
          className={`detail-tab${subPage === 'overview' ? ' detail-tab--active' : ''}`}
          onClick={() => setSubPage('overview')}
        >
          <Info size={20}/>
          Overview
        </button>
        <button
          type="button"
          className={`detail-tab${subPage === 'statements' ? ' detail-tab--active' : ''}`}
          onClick={() => setSubPage('statements')}
        >
          <List size={20}/>
          Statements
        </button>
      </div>

      {subPage === 'overview' ? (
        <>
          {(card.annualFee || card.requiredSpending) && (
            <div className="detail-flat-section">
              <div className="detail-flat-heading">
                Annual
                {annualStart && annualEnd && (
                  <span className="annual-dates">
                    {fmtDate(annualStart.getTime())} – {fmtDate(annualEnd.getTime())}
                  </span>
                )}
              </div>

              {card.annualFee && (() => {
                const net = annualCashback + annualDiscount - card.annualFee
                const positive = net >= 0
                return (
                  <div className="annual-net-benefit">
                    <span className="annual-net-label">Net benefit</span>
                    <span className={`annual-net-value ${positive ? 'annual-net-positive' : 'annual-net-negative'}`}>
                      {positive ? '+' : '−'}{fmtVND(Math.abs(net))}
                    </span>
                  </div>
                )
              })()}

              {card.requiredSpending && (
                <div className="detail-stat">
                  <div className="detail-stat-row">
                    <span className="detail-stat-label">
                      Spending
                      <span className="cycle-cap"> / {fmtShort(card.requiredSpending)} required</span>
                    </span>
                    <span className="detail-stat-value">{fmtVND(annualSpending)}</span>
                  </div>
                  <ProgressBar value={annualSpending} max={card.requiredSpending} color="#22c55e" />
                </div>
              )}

              <div className="annual-benefit-rows">
                {card.annualFee && (
                  <div className="annual-benefit-row">
                    <span className="annual-benefit-label">
                      <CircleDollarSign size={16} color="#ef4444"/>
                      Annual fee
                    </span>
                    <span className="annual-benefit-fee">{fmtVND(card.annualFee)}</span>
                  </div>
                )}
                <div className="annual-benefit-row">
                  <span className="annual-benefit-label">
                    <HandCoins size={16} color="#22c55e"/>
                    Cashback
                  </span>
                  <span className="annual-benefit-cashback">{fmtVND(annualCashback)}</span>
                </div>
                <div className="annual-benefit-row">
                  <span className="annual-benefit-label">
                    <BadgePercent size={16} color="#f59e0b"/>
                    Discount
                  </span>
                  <span className="annual-benefit-discount">{fmtVND(annualDiscount)}</span>
                </div>
              </div>

              {card.annualFee && (
                <BenefitBar
                  cashback={annualCashback}
                  discount={annualDiscount}
                  annualFee={card.annualFee}
                />
              )}
            </div>
          )}

          {card.billingDay !== null && (
            <div className="detail-flat-section">
              <div className="detail-flat-heading">
                Current
                {cycleData?.cycleStart && cycleData?.cycleEnd && (
                  <span className="annual-dates">
                    {fmtDate(new Date(cycleData.cycleStart).getTime())} – {fmtDate(new Date(cycleData.cycleEnd).getTime())}
                  </span>
                )}
              </div>

              <div className="cycle-rows">
                <div className="cycle-row">
                  <span className="cycle-label">Spending</span>
                  <span className={`cycle-value ${!cycleData ? 'cycle-calculating' : ''}`}>
                    {cycleData ? fmtVND(cycleData.currentCycleSpending) : 'Calculating…'}
                  </span>
                </div>
                <div className="cycle-row">
                  <span className="cycle-label">
                    Cashback
                    {card.cashbackCap
                      ? <span className="cycle-cap"> / {fmtShort(card.cashbackCap)} cap</span>
                      : <span className="cycle-cap"> / No limit</span>
                    }
                  </span>
                  <span className={`cycle-value cycle-cashback ${!cycleData ? 'cycle-calculating' : ''}`}>
                    {cycleData ? (
                      <>
                        {fmtVND(cycleData.currentCycleCashback)}
                        {card.cashbackCap && cycleData.currentCycleCashback >= card.cashbackCap && (
                          <span className="cycle-cap-reached"> (capped)</span>
                        )}
                      </>
                    ) : 'Calculating…'}
                  </span>
                </div>
                <div className="cycle-row cycle-row-mt">
                  <span className="cycle-label">Discount</span>
                  <span className={`cycle-value cycle-discount ${!cycleData ? 'cycle-calculating' : ''}`}>
                    {cycleData ? fmtVND(cycleData.currentCycleDiscount) : 'Calculating…'}
                  </span>
                </div>
              </div>

              <button type="button" className="detail-add-btn" onClick={() => setShowAddExpense(true)}>+ New expense</button>
            </div>
          )}
        </>
      ) : (
        <div className="detail-flat-section">
          {statementsLoading ? (
            <div className="circle-loading"></div>
          ) : statements.length === 0 ? (
            <div className="detail-sub-empty">No statements yet</div>
          ) : (
            <div className="stmt-list">
              {statements.map(stmt => (
                <div key={stmt.id} className="stmt-item">
                  <div className="stmt-header">
                    <span className="stmt-period">
                      {fmtDate(stmt.startDate)} – {fmtDate(stmt.endDate)}
                    </span>
                    <span className="stmt-spending">{fmtVND(stmt.spending)}</span>
                  </div>
                  <div className="stmt-benefits">
                    <span className="stmt-cashback">
                      <HandCoins size={16}/>
                      {fmtShort(stmt.cashback)}
                    </span>
                    <span className="stmt-discount">
                      <BadgePercent size={16}/>
                      {fmtShort(stmt.discount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!statementsLoading && (card.billingDay === null || cycleData !== null) && (
            <button type="button" className="detail-add-btn" onClick={() => setShowAddStatement(true)}>
              + Add statement
            </button>
          )}
        </div>
      )}

      {showAddExpense && card.linkedAccountId && (
        <AddExpenseModal
          card={card}
          categories={categories}
          onClose={() => setShowAddExpense(false)}
          onAdded={() => {
            setCardDetailCache(prev => { const n = { ...prev }; delete n[card.id]; return n })
            setShowAddExpense(false)
          }}
        />
      )}

      {showAddStatement && (() => {
        // Last cycle: end = current cycle start - 1 day, start = same day one month earlier
        let lastCycleStart: string | undefined
        let lastCycleEnd: string | undefined
        if (cycleData?.cycleStart) {
          const currentStart = new Date(cycleData.cycleStart)
          const lastEnd = new Date(currentStart.getTime() - 86400000)
          const lastStart = new Date(lastEnd.getFullYear(), lastEnd.getMonth() - 1, lastEnd.getDate() + 1)
          lastCycleStart = toInputDate(lastStart.getTime())
          lastCycleEnd = toInputDate(lastEnd.getTime())
        }
        return (
          <AddStatementModal
            cardId={card.id}
            defaultStartDate={lastCycleStart}
            defaultEndDate={lastCycleEnd}
            onClose={() => setShowAddStatement(false)}
            onAdded={(stmt) => {
              setStatementsCache(prev => ({ ...prev, [card.id]: [stmt, ...(prev[card.id] ?? [])] }))
              setShowAddStatement(false)
            }}
          />
        )
      })()}
    </main>
  )
}
