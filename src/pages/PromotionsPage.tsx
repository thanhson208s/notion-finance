import './PromotionsPage.css'
import { useState, useRef, useEffect } from 'react'
import { useApp } from '../contexts/AppContext'
import { API_BASE } from '../App'
import { apiFetch, parseApiResponse } from '../lib/auth'
import { SwipeableRow } from '../components/SwipeableRow'
import type { Promotion, PromotionCategory, PromotionType } from '../App'
import { Plane, Utensils, ShoppingBag, Tv, Smartphone, Tag, Plus } from 'lucide-react'
import { AddPromotionModal } from '../components/AddPromotionModal'
import { EditPromotionModal } from '../components/EditPromotionModal'
import { DeletePromotionModal } from '../components/DeletePromotionModal'

const PROMO_CATEGORIES: PromotionCategory[] = ['Shopping', 'F&B', 'Travel', 'Entertain', 'Digital']

const CATEGORY_ICON: Record<PromotionCategory, React.ReactNode> = {
  Travel:    <Plane size={16} />,
  'F&B':     <Utensils size={16} />,
  Shopping:  <ShoppingBag size={16} />,
  Entertain: <Tv size={16} />,
  Digital:   <Smartphone size={16} />,
}

const CATEGORY_COLOR: Record<PromotionCategory, string> = {
  Travel:    '#60a5fa',
  'F&B':     '#fb923c',
  Shopping:  '#a78bfa',
  Entertain: '#f472b6',
  Digital:   '#34d399',
}

function PromotionItem({ promotion, cardName, now }: {
  promotion: Promotion
  cardName?: string
  now: number
}) {
  const nameRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = nameRef.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const overflow = el.scrollWidth - parent.clientWidth
    if (overflow > 0) {
      el.style.setProperty('--scroll-px', `-${overflow}px`)
      el.classList.add('promo-name--scroll')
    } else {
      el.classList.remove('promo-name--scroll')
    }
  }, [promotion.name])

  const isExpired = promotion.expiresAt != null && promotion.expiresAt < now
  const daysLeft = promotion.expiresAt != null
    ? Math.ceil((promotion.expiresAt - now) / (1000 * 60 * 60 * 24))
    : null

  const icon = promotion.category ? CATEGORY_ICON[promotion.category] : <Tag size={16} />
  const iconColor = promotion.category ? CATEGORY_COLOR[promotion.category] : '#64748b'

  const expiryLabel = promotion.expiresAt == null ? null
    : isExpired ? 'Expired'
    : daysLeft != null && daysLeft <= 3 ? `${daysLeft}d left`
    : new Date(promotion.expiresAt).toLocaleDateString('en', { day: 'numeric', month: 'short' })

  const expiryClass = isExpired ? ' promo-days--expired'
    : daysLeft != null && daysLeft <= 3 ? ' promo-days--warn'
    : ''

  return (
    <div className={`promo-item promo-item--${promotion.type.toLowerCase()}`}>
      <div className="promo-icon-col" style={{ color: iconColor }}>
        {icon}
      </div>
      <div className="promo-content">
        <div className="promo-name-track">
          <span ref={nameRef} className="promo-name">
            {promotion.name}
          </span>
        </div>
        <div className="promo-meta">
          <span className="promo-card">{cardName ?? '—'}</span>
          {promotion.link && (
            <a className="promo-link" href={promotion.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>T&C</a>
          )}
          {expiryLabel && (
            <span className={`promo-days${expiryClass}`}>{expiryLabel}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PromotionsPage() {
  const { cards, promotions, promotionsLoading, addPromotion, removePromotion, updatePromotion } = useApp()
  const [typeFilter, setTypeFilter] = useState<'all' | PromotionType>('all')
  const [cardFilter, setCardFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<PromotionCategory | 'all'>('all')
  const [showExpired, setShowExpired] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [deletingPromotion, setDeletingPromotion] = useState<Promotion | null>(null)
  const [now] = useState(Date.now)

  const handleDelete = async (id: string) => {
    const res = await apiFetch(`${API_BASE}/promotions?id=${id}`, { method: 'DELETE' })
    await parseApiResponse(res, 'Failed to delete promotion')
    removePromotion(id)
  }

  const filtered = promotions.filter(p => {
    const expired = p.expiresAt != null && p.expiresAt < now
    if (!showExpired && expired) return false
    if (cardFilter !== 'all' && p.cardId !== cardFilter) return false
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false
    if (typeFilter !== 'all' && p.type !== typeFilter) return false
    return true
  })

  const cardMap = new Map(cards.map(c => [c.id, c.name]))

  return (
    <main className="page promos-page">
      <div className="promos-filters">
        {/* Card select */}
        <select
          title="Card"
          className={`promo-filter-pill promo-filter-select${cardFilter !== 'all' ? ' promo-filter-pill--active' : ''}`}
          value={cardFilter}
          onChange={e => setCardFilter(e.target.value)}
        >
          <option value="all">All cards</option>
          {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {/* Category select */}
        <select
          title="Category"
          className={`promo-filter-pill promo-filter-select${categoryFilter !== 'all' ? ' promo-filter-pill--active' : ''}`}
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value as PromotionCategory | 'all')}
        >
          <option value="all">Category</option>
          {PROMO_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Type select */}
        <select
          title="Type"
          className={`promo-filter-pill promo-filter-select${typeFilter !== 'all' ? ' promo-filter-pill--active' : ''}`}
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as 'all' | PromotionType)}
        >
          <option value="all">All types</option>
          <option value="Cashback">Cashback</option>
          <option value="Discount">Discount</option>
        </select>

        {/* Show expired toggle */}
        <label className="promo-expired-toggle">
          <input
            type="checkbox"
            checked={showExpired}
            onChange={e => setShowExpired(e.target.checked)}
          />
          <span>Expired</span>
        </label>
      </div>

      {promotionsLoading ? (
        <div className="promos-loading">
          <div className="circle-loading" />
        </div>
      ) : (
        <div className="promos-list">
          {filtered.map(p => (
            <SwipeableRow key={p.id} onEdit={() => setEditingPromotion(p)} onDelete={() => setDeletingPromotion(p)}>
              <PromotionItem
                promotion={p}
                cardName={p.cardId ? cardMap.get(p.cardId) : undefined}
                now={now}
              />
            </SwipeableRow>
          ))}
          <button title="Add promotion" type="button" className="promo-add-card" onClick={() => setShowAdd(true)}>
            <Plus size={20} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {showAdd && (
        <AddPromotionModal
          cards={cards.map(c => ({ id: c.id, name: c.name }))}
          onClose={() => setShowAdd(false)}
          onAdded={(p) => {
            addPromotion(p)
            setShowAdd(false)
          }}
        />
      )}

      {editingPromotion && (
        <EditPromotionModal
          promotion={editingPromotion}
          cards={cards.map(c => ({ id: c.id, name: c.name }))}
          onClose={() => setEditingPromotion(null)}
          onSaved={(p) => {
            updatePromotion(p)
            setEditingPromotion(null)
          }}
        />
      )}

      {deletingPromotion && (
        <DeletePromotionModal
          promotion={deletingPromotion}
          cardName={deletingPromotion.cardId ? cardMap.get(deletingPromotion.cardId) : undefined}
          onConfirm={() => handleDelete(deletingPromotion.id)}
          onCancel={() => setDeletingPromotion(null)}
        />
      )}

    </main>
  )
}
