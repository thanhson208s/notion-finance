import './DeleteTxModal.css'
import { useState, useCallback } from 'react'
import { Check, Loader2 } from 'lucide-react'
import type { Account, Card, Category } from '../App'
import { type Transaction, type TxType, fmtVND, fmtTxDate, getAccountLabel, getCategoryLabel } from '../App'

const ANIM_MS = 500
const SUCCESS_MS = 1000

type Props = {
  tx: Transaction
  type: TxType
  accounts: Account[]
  cards: Card[]
  catMap: Map<string, Category>
  onConfirm: () => Promise<void>
  onCancel: () => void
}

type BtnState = 'idle' | 'deleting' | 'deleted'

export function DeleteTxModal({ tx, type, accounts, cards, catMap, onConfirm, onCancel }: Props) {
  const [closing, setClosing] = useState(false)
  const [btnState, setBtnState] = useState<BtnState>('idle')
  const accountLabel = getAccountLabel(tx.fromAccountId ?? tx.toAccountId, tx.linkedCardId, accounts, cards)
  const { catName, subName } = getCategoryLabel(tx, catMap)
  const { date, time } = fmtTxDate(tx.timestamp)
  const typeLower = type.toLowerCase()

  const accountDisplay = type === 'Transfer'
    ? `${accounts.find(a => a.id === tx.fromAccountId)?.name ?? '—'} → ${accounts.find(a => a.id === tx.toAccountId)?.name ?? '—'}`
    : accountLabel

  const amountDisplay = type === 'Adjustment'
    ? `${tx.toAccountId ? '+' : '−'}${fmtVND(tx.amount)}`
    : fmtVND(tx.amount)

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

  return (
    <div
      className={`delete-modal-backdrop${closing ? ' delete-modal-backdrop--closing' : ''}`}
      onClick={() => { if (!busy) dismiss(onCancel) }}
      onTouchStart={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      <div className={`delete-modal-sheet${closing ? ' delete-modal-sheet--closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="delete-modal-handle" />
        <span className="delete-modal-title">DELETE TRANSACTION?</span>

        <div className="delete-modal-rows">
          <div className="delete-modal-row">
            <span className="delete-modal-label">Account</span>
            <span className="delete-modal-value">{accountDisplay}</span>
          </div>

          <div className="delete-modal-row">
            <span className="delete-modal-label">Category</span>
            <span className="delete-modal-value">{catName}{subName ? ` › ${subName}` : ''}</span>
          </div>

          {tx.note && (
            <div className="delete-modal-row">
              <span className="delete-modal-label">Note</span>
              <span className="delete-modal-value">{tx.note}</span>
            </div>
          )}

          <div className="delete-modal-row">
            <span className="delete-modal-label">Date</span>
            <span className="delete-modal-value">{date} · {time}</span>
          </div>

          <div className="delete-modal-row">
            <span className="delete-modal-label">Amount</span>
            <span className={`delete-modal-value delete-modal-amount delete-modal-amount--${typeLower}`}>
              {amountDisplay}
            </span>
          </div>
        </div>

        <button
          type="button"
          className={`delete-modal-btn delete-modal-btn--confirm${btnState === 'deleted' ? ' delete-modal-btn--deleted' : ''}`}
          onClick={handleDelete}
          disabled={busy}
        >
          <span key={btnState} className="delete-modal-btn-content">
            {btnState === 'deleting' && <Loader2 size={18} className="icon-spin" />}
            {btnState === 'deleted' && <Check size={18} />}
            {btnState === 'deleting' ? 'Deleting...' : btnState === 'deleted' ? 'Deleted' : 'Delete'}
          </span>
        </button>
      </div>
    </div>
  )
}
