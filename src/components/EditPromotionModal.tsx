import './modal.css'
import { useState, useCallback } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Promotion, PromotionCategory, PromotionType } from '../App'
import { API_BASE } from '../App'
import { apiFetch, parseApiResponse } from '../lib/auth'

const ANIM_MS = 500
const SUCCESS_MS = 1000

const PROMO_TYPES: PromotionType[] = ['Cashback', 'Discount']
const PROMO_CATEGORIES: PromotionCategory[] = ['Shopping', 'F&B', 'Travel', 'Entertain', 'Digital']

type BtnState = 'idle' | 'saving' | 'saved'

type Props = {
  promotion: Promotion
  cards: { id: string; name: string }[]
  onClose: () => void
  onSaved: (p: Promotion) => void
}

function toDateInputValue(ms: number | null): string {
  if (ms == null) return ''
  return new Date(ms).toISOString().slice(0, 10)
}

export function EditPromotionModal({ promotion, cards, onClose, onSaved }: Props) {
  const [name, setName] = useState(promotion.name)
  const [cardId, setCardId] = useState(promotion.cardId ?? '')
  const [category, setCategory] = useState<PromotionCategory | ''>(promotion.category ?? '')
  const [type, setType] = useState<PromotionType>(promotion.type)
  const [expiresAt, setExpiresAt] = useState(toDateInputValue(promotion.expiresAt))
  const [link, setLink] = useState(promotion.link ?? '')
  const [btnState, setBtnState] = useState<BtnState>('idle')
  const [closing, setClosing] = useState(false)

  const dismiss = useCallback((cb: () => void) => { setClosing(true); setTimeout(cb, ANIM_MS) }, [])

  const dirty =
    name.trim() !== promotion.name ||
    (cardId || null) !== promotion.cardId ||
    (category || null) !== promotion.category ||
    type !== promotion.type ||
    (expiresAt ? new Date(expiresAt).getTime() : null) !== promotion.expiresAt ||
    (link.trim() || null) !== promotion.link

  const submit = async () => {
    if (!name.trim()) return
    setBtnState('saving')
    try {
      const res = await apiFetch(`${API_BASE}/promotions?id=${promotion.id}`, {
        method: 'PATCH',
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
      const data = await parseApiResponse<Promotion>(res, 'Failed to update promotion')
      setBtnState('saved')
      setTimeout(() => dismiss(() => onSaved(data)), SUCCESS_MS)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
      setBtnState('idle')
    }
  }

  const busy = btnState !== 'idle'

  return (
    <div
      className={`modal-backdrop${closing ? ' modal-backdrop--closing' : ''}`}
      onClick={() => { if (!busy) dismiss(onClose) }}
    >
      <div className={`modal-sheet${closing ? ' modal-sheet--closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="modal-title">Edit Promotion</h2>

        <div className="modal-field">
          <label className="modal-label">Name *</label>
          <input
            type="text" className="modal-input"
            placeholder="e.g. 5% cashback at grocery"
            value={name} onChange={e => setName(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">Card</label>
          <select title="Card" className="modal-select" value={cardId} onChange={e => setCardId(e.target.value)} disabled={busy}>
            <option value="">All cards / No card</option>
            {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="modal-field">
          <label className="modal-label">Category</label>
          <select title="Category" className="modal-select" value={category} onChange={e => setCategory(e.target.value as PromotionCategory | '')} disabled={busy}>
            <option value="">None</option>
            {PROMO_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="modal-field">
          <label className="modal-label">Type</label>
          <select title="Type" className="modal-select" value={type} onChange={e => setType(e.target.value as PromotionType)} disabled={busy}>
            {PROMO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="modal-field">
          <label className="modal-label">Expiry Date</label>
          <input
            title="Expiry Date" type="date" className="modal-input"
            value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">T&amp;C Link</label>
          <input
            type="url" className="modal-input"
            placeholder="Terms & conditions URL"
            value={link} onChange={e => setLink(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="modal-actions">
          <button
            type="button" className="modal-btn modal-btn--cancel"
            onClick={() => { if (!busy) dismiss(onClose) }}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`modal-btn modal-btn--submit${btnState === 'saved' ? ' modal-btn--saved' : ''}`}
            onClick={submit}
            disabled={busy || !name.trim() || !dirty}
          >
            <span key={btnState} className="modal-btn-content">
              {btnState === 'saving' && <Loader2 size={18} className="icon-spin" />}
              {btnState === 'saved' && <Check size={18} />}
              {btnState === 'saving' ? 'Saving...' : btnState === 'saved' ? 'Saved' : 'Save Changes'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
