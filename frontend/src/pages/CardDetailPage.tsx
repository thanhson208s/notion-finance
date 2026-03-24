import './CardDetailPage.css'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppContext } from '../contexts/AppContext'
import { API_BASE, fmtVND, fmtShort, toISODate } from '../App'
import type { Card, Statement } from '../App'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDate(ms: number) {
  const d = new Date(ms)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
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

function AddStatementModal({ cardId, onClose, onAdded }: {
  cardId: string
  onClose: () => void
  onAdded: (stmt: Statement) => void
}) {
  const [spending, setSpending] = useState('')
  const [cashback, setCashback] = useState('')
  const [billingDate, setBillingDate] = useState(() => toISODate(new Date()).slice(0, 10))
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const spendingAmt = parseFloat(spending)
    const cashbackAmt = parseFloat(cashback) || 0
    if (!spendingAmt || spendingAmt < 0) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/statements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId,
          billingDate: new Date(billingDate).getTime(),
          spending: spendingAmt,
          cashback: cashbackAmt,
          note: note.trim() || undefined
        })
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json() as Statement
      onAdded(data)
    } catch {
      alert('Failed to add statement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Add Statement</h2>
        <div className="modal-form">
          <div className="modal-field">
            <label className="modal-label">Billing Date</label>
            <input title="Billing Date" type="date" className="modal-input" value={billingDate}
              onChange={e => setBillingDate(e.target.value)} />
          </div>
          <div className="modal-field">
            <label className="modal-label">Spending (VND)</label>
            <input type="number" className="modal-input" placeholder="0" value={spending}
              onChange={e => setSpending(e.target.value)} />
          </div>
          <div className="modal-field">
            <label className="modal-label">Cashback (VND)</label>
            <input type="number" className="modal-input" placeholder="0" value={cashback}
              onChange={e => setCashback(e.target.value)} />
          </div>
          <div className="modal-field">
            <label className="modal-label">Note</label>
            <input type="text" className="modal-input" placeholder="Optional" value={note}
              onChange={e => setNote(e.target.value)} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="modal-btn modal-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-btn modal-btn-submit" onClick={submit} disabled={loading}>
            {loading ? '…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CardDetailPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { cards, cardsLoading } = useAppContext()

  const card = id ? (cards.find(c => c.id === id) ?? null) : (cards[0] ?? null)
  const effectiveId = card?.id ?? null

  const [statementsState, setStatementsState] = useState<{ cardId: string; stmts: Statement[] } | null>(null)
  const [showAddStatement, setShowAddStatement] = useState(false)

  const statementsLoading = !effectiveId || statementsState?.cardId !== effectiveId
  const statements = statementsState?.cardId === effectiveId ? statementsState!.stmts : []

  useEffect(() => {
    if (!effectiveId) return
    fetch(`${API_BASE}/statements?cardId=${effectiveId}`)
      .then(r => r.json())
      .then(d => setStatementsState({ cardId: effectiveId, stmts: d.statements ?? [] }))
      .catch(() => setStatementsState({ cardId: effectiveId, stmts: [] }))
  }, [effectiveId])

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

  const annualStart = card.lastChargedDate ? new Date(card.lastChargedDate) : null
  const annualEnd = annualStart
    ? new Date(annualStart.getFullYear() + 1, annualStart.getMonth(), annualStart.getDate())
    : null

  const annualSpending = (annualStart && annualEnd)
    ? statements.reduce((sum, s) =>
        s.billingDate >= annualStart.getTime() && s.billingDate <= annualEnd.getTime()
          ? sum + s.spending
          : sum
      , 0)
    : statements.reduce((sum, s) => sum + s.spending, 0)

  return (
    <main className="page detail-page">
      <div className="detail-header">
        <h1 className="detail-header-title">{card!.name}</h1>
        {maskedNumber && <span className="detail-header-number">{maskedNumber}</span>}
      </div>

      <CardCarousel
        cards={cards}
        currentId={effectiveId!}
        onSelect={(cardId) => navigate(`/cards/${cardId}`)}
      />

      {(card.annualFee || card.requiredSpending) && (
        <div className="detail-section">
          <div className="detail-section-title">
            Annual
            {annualStart && annualEnd && (
            <span className="annual-dates">
              {fmtDate(annualStart.getTime())} – {fmtDate(annualEnd.getTime())}
            </span>
          )}
          </div>

          {card.annualFee && (
            <div className="annual-fee-row">
              <span className="annual-fee-label">Annual fee</span>
              <span className="annual-fee-value">{fmtVND(card.annualFee)}</span>
            </div>
          )}

          {card.requiredSpending && (
            <div className="detail-stat">
              <div className="detail-stat-row">
                <span className="detail-stat-label">Spending / Requirement</span>
                <span className="detail-stat-value">
                  {fmtShort(annualSpending)} / {fmtShort(card.requiredSpending)}
                </span>
              </div>
              <ProgressBar value={annualSpending} max={card.requiredSpending} color="#22c55e" />
            </div>
          )}
        </div>
      )}

      <div className="detail-section">
        <div className="detail-section-title">Statements</div>

        {statementsLoading ? (
          <div className="detail-sub-empty">Loading…</div>
        ) : statements.length === 0 ? (
          <div className="detail-sub-empty">No statements yet</div>
        ) : (
          <div className="stmt-list">
            {statements.map(stmt => {
              const d = new Date(stmt.billingDate)
              return (
                <div key={stmt.id} className="stmt-item">
                  <span className="stmt-date">{MONTHS[d.getMonth()]} {d.getFullYear()}</span>
                  <span className="stmt-spend">
                    <span className="stmt-icon stmt-icon-spend" />
                    {fmtShort(stmt.spending)}
                  </span>
                  <span className="stmt-cash">
                    <span className="stmt-icon stmt-icon-cash" />
                    {fmtShort(stmt.cashback)}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <button className="detail-add-btn" onClick={() => setShowAddStatement(true)}>
          + Add statement
        </button>
      </div>

      {showAddStatement && (
        <AddStatementModal
          cardId={card.id}
          onClose={() => setShowAddStatement(false)}
          onAdded={(stmt) => {
            setStatementsState(prev => prev ? { ...prev, stmts: [stmt, ...prev.stmts] } : { cardId: card.id, stmts: [stmt] })
            setShowAddStatement(false)
          }}
        />
      )}
    </main>
  )
}
