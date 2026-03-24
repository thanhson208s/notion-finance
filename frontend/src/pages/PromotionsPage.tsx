import './PromotionsPage.css'
import { useState, useEffect } from 'react'
import { useAppContext } from '../contexts/AppContext'
import { API_BASE } from '../App'
import { SwipeableRow } from '../components/SwipeableRow'
import type { Promotion, PromotionCategory, PromotionType } from '../App'

const PROMO_TYPES: PromotionType[] = ['Cashback', 'Discount']
const PROMO_CATEGORIES: PromotionCategory[] = ['Shopping', 'F&B', 'Travel', 'Entertain', 'Digital']

type Filter = 'all' | 'active' | 'expired'

function AddPromotionModal({ cards, onClose, onAdded }: {
  cards: { id: string; name: string }[]
  onClose: () => void
  onAdded: (p: Promotion) => void
}) {
  const [name, setName] = useState('')
  const [cardId, setCardId] = useState('')
  const [category, setCategory] = useState<PromotionCategory | ''>('')
  const [type, setType] = useState<PromotionType>('Cashback')
  const [expiresAt, setExpiresAt] = useState('')
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/promotions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          cardId: cardId || undefined,
          category: category || undefined,
          type,
          expiresAt: expiresAt ? new Date(expiresAt).getTime() : undefined,
          link: link.trim() || undefined
        })
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json() as Promotion
      onAdded(data)
    } catch {
      alert('Failed to add promotion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Add Promotion</h2>
        <div className="modal-form">
          <div className="modal-field">
            <label className="modal-label">Name *</label>
            <input type="text" className="modal-input" placeholder="e.g. 5% cashback at grocery" value={name}
              onChange={e => setName(e.target.value)} />
          </div>
          <div className="modal-field">
            <label className="modal-label">Card</label>
            <select title="Card Id" className="modal-select" value={cardId} onChange={e => setCardId(e.target.value)}>
              <option value="">All cards / No card</option>
              {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="modal-field">
            <label className="modal-label">Category</label>
            <select title="Category" className="modal-select" value={category} onChange={e => setCategory(e.target.value as PromotionCategory | '')}>
              <option value="">None</option>
              {PROMO_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="modal-field">
            <label className="modal-label">Type</label>
            <select title="Type" className="modal-select" value={type} onChange={e => setType(e.target.value as PromotionType)}>
              {PROMO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="modal-field">
            <label className="modal-label">Expiry Date</label>
            <input title="Expiry Date" type="date" className="modal-input" value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)} />
          </div>
          <div className="modal-field">
            <label className="modal-label">Link</label>
            <input type="url" className="modal-input" placeholder="Terms & policy URL" value={link}
              onChange={e => setLink(e.target.value)} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="modal-btn modal-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-btn modal-btn-submit" onClick={submit} disabled={loading || !name.trim()}>
            {loading ? '…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PromotionItem({ promotion, cardName, now }: { promotion: Promotion; cardName?: string; now: number }) {
  const isExpired = promotion.expiresAt ? promotion.expiresAt < now : false
  const statusLabel = isExpired ? 'Expired' : 'Active'
  const statusClass = isExpired ? 'promo-expired' : 'promo-active'

  return (
    <div className="promo-item">
      <div className="promo-item-header">
        <span className="promo-name">{promotion.name}</span>
        <span className={`promo-status ${statusClass}`}>{statusLabel}</span>
      </div>
      <div className="promo-item-meta">
        {cardName && <span className="promo-card">{cardName}</span>}
        {promotion.category && <span className="promo-category">{promotion.category}</span>}
        <span className="promo-type-badge">{promotion.type}</span>
        {promotion.expiresAt && (
          <span className={`promo-expiry ${isExpired ? 'expired' : ''}`}>
            {isExpired ? 'Expired' : 'Exp'} {new Date(promotion.expiresAt).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
          </span>
        )}
        {promotion.link && (
          <a className="promo-link" href={promotion.link} target="_blank" rel="noopener noreferrer">T&C</a>
        )}
      </div>
    </div>
  )
}

export default function PromotionsPage() {
  const { cards } = useAppContext()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('active')
  const [cardFilter, setCardFilter] = useState<string>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [now] = useState(Date.now)

  useEffect(() => {
    fetch(`${API_BASE}/promotions`)
      .then(r => r.json())
      .then(d => setPromotions(d.promotions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API_BASE}/promotions?id=${id}`, { method: 'DELETE' })
      setPromotions(prev => prev.filter(p => p.id !== id))
    } catch {
      alert('Failed to delete')
    }
  }

  const filtered = promotions.filter(p => {
    if (cardFilter !== 'all' && p.cardId !== cardFilter) return false
    if (filter === 'expired') return p.expiresAt != null && p.expiresAt < now
    if (filter === 'active') return !p.expiresAt || p.expiresAt >= now
    return true
  })

  const cardMap = new Map(cards.map(c => [c.id, c.name]))

  return (
    <main className="page promos-page">
      <div className="promos-header">
        <h1 className="promos-title">Promotions</h1>
      </div>

      <div className="promos-filters">
        <div className="filter-chips">
          {(['active', 'all', 'expired'] as Filter[]).map(f => (
            <button key={f} className={`filter-chip ${filter === f ? 'filter-chip-active' : ''}`}
              onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {cards.length > 0 && (
          <select title="Card select" className="promos-card-select" value={cardFilter} onChange={e => setCardFilter(e.target.value)}>
            <option value="all">All cards</option>
            {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="promos-empty">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="promos-empty">No promotions</div>
      ) : (
        <div className="promos-list">
          {filtered.map(p => (
            <SwipeableRow key={p.id} onDelete={() => handleDelete(p.id)}>
              <PromotionItem promotion={p} cardName={p.cardId ? cardMap.get(p.cardId) : undefined} now={now} />
            </SwipeableRow>
          ))}
        </div>
      )}

      <button className="promos-fab" onClick={() => setShowAdd(true)}>+</button>

      {showAdd && (
        <AddPromotionModal
          cards={cards.map(c => ({ id: c.id, name: c.name }))}
          onClose={() => setShowAdd(false)}
          onAdded={(p) => {
            setPromotions(prev => [p, ...prev])
            setShowAdd(false)
          }}
        />
      )}
    </main>
  )
}
