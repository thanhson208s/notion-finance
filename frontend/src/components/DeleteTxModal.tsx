import './modal.css'
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
      className={`modal-backdrop${closing ? ' modal-backdrop--closing' : ''}`}
      onClick={() => { if (!busy) dismiss(onCancel) }}
      onTouchStart={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      <div className={`modal-sheet${closing ? ' modal-sheet--closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <span className="modal-title modal-title--center">DELETE TRANSACTION?</span>

        <div className="modal-rows">
          <div className="modal-row">
            <span className="modal-row-label">Account</span>
            <span className="modal-row-value">{accountDisplay}</span>
          </div>

          <div className="modal-row">
            <span className="modal-row-label">Category</span>
            <span className="modal-row-value">{catName}{subName ? ` › ${subName}` : ''}</span>
          </div>

          {tx.note && (
            <div className="modal-row">
              <span className="modal-row-label">Note</span>
              <span className="modal-row-value">{tx.note}</span>
            </div>
          )}

          <div className="modal-row">
            <span className="modal-row-label">Date</span>
            <span className="modal-row-value">{date} · {time}</span>
          </div>

          <div className="modal-row">
            <span className="modal-row-label">Amount</span>
            <span className={`modal-row-value modal-row-amount modal-row-amount--${typeLower}`}>
              {amountDisplay}
            </span>
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
