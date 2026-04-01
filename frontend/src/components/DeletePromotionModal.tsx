import './modal.css'
import { useState, useCallback } from 'react'
import { Check, Loader2 } from 'lucide-react'
import type { Promotion } from '../App'

const ANIM_MS = 500
const SUCCESS_MS = 1000

type BtnState = 'idle' | 'deleting' | 'deleted'

type Props = {
  promotion: Promotion
  cardName?: string
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export function DeletePromotionModal({ promotion, cardName, onConfirm, onCancel }: Props) {
  const [closing, setClosing] = useState(false)
  const [btnState, setBtnState] = useState<BtnState>('idle')

  const dismiss = useCallback((cb: () => void) => {
    setClosing(true)
    setTimeout(cb, ANIM_MS)
  }, [])

  const handleDelete = async () => {
    setBtnState('deleting')
    try {
      await onConfirm()
      setBtnState('deleted')
      setTimeout(() => dismiss(onCancel), SUCCESS_MS)
    } catch {
      setBtnState('idle')
    }
  }

  const busy = btnState !== 'idle'

  const expiryLabel = promotion.expiresAt == null
    ? '—'
    : new Date(promotion.expiresAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div
      className={`modal-backdrop${closing ? ' modal-backdrop--closing' : ''}`}
      onClick={() => { if (!busy) dismiss(onCancel) }}
      onTouchStart={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      <div className={`modal-sheet${closing ? ' modal-sheet--closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <span className="modal-title modal-title--center">DELETE PROMOTION?</span>

        <div className="modal-rows">
          <div className="modal-row">
            <span className="modal-row-label">Name</span>
            <span className="modal-row-value">{promotion.name}</span>
          </div>

          <div className="modal-row">
            <span className="modal-row-label">Type</span>
            <span className="modal-row-value">{promotion.type}</span>
          </div>

          {promotion.category && (
            <div className="modal-row">
              <span className="modal-row-label">Category</span>
              <span className="modal-row-value">{promotion.category}</span>
            </div>
          )}

          <div className="modal-row">
            <span className="modal-row-label">Card</span>
            <span className="modal-row-value">{cardName ?? '—'}</span>
          </div>

          <div className="modal-row">
            <span className="modal-row-label">Expires</span>
            <span className="modal-row-value">{expiryLabel}</span>
          </div>
        </div>

        <button
          type="button"
          className={`modal-btn modal-btn--danger modal-btn--full${btnState === 'deleted' ? ' modal-btn--saved' : ''}`}
          onClick={handleDelete}
          disabled={busy}
        >
          <span key={btnState} className="modal-btn-content">
            {btnState === 'deleting' && <Loader2 size={18} className="icon-spin" />}
            {btnState === 'deleted' && <Check size={18} />}
            {btnState === 'deleting' ? 'Deleting...' : btnState === 'deleted' ? 'Deleted' : 'Delete'}
          </span>
        </button>
      </div>
    </div>
  )
}
