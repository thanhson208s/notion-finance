import './EditTxModal.css'
import { useState, useCallback } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Account, Card, Category } from '../App'
import { type Transaction, type TxType, API_BASE, fmtVND, fmtTxDate, getAccountLabel } from '../App'
import { apiFetch, parseApiResponse } from '../lib/auth'

const ANIM_MS = 500
const SUCCESS_MS = 1000

type Props = {
  tx: Transaction
  type: TxType
  accounts: Account[]
  cards: Card[]
  catMap: Map<string, Category>
  categories: Category[]
  onSave: () => void
  onCancel: () => void
}

type BtnState = 'idle' | 'saving' | 'saved'

function catTypeForTx(type: TxType): 'Income' | 'Expense' | 'System' {
  if (type === 'Income') return 'Income'
  if (type === 'Expense') return 'Expense'
  return 'System'
}

export function EditTxModal({ tx, type, accounts, cards, categories, onSave, onCancel }: Props) {
  const [closing, setClosing] = useState(false)
  const [btnState, setBtnState] = useState<BtnState>('idle')
  const [categoryId, setCategoryId] = useState(tx.categoryId)
  const [note, setNote] = useState(tx.note)

  const accountLabel = type === 'Transfer'
    ? `${accounts.find(a => a.id === tx.fromAccountId)?.name ?? '—'} → ${accounts.find(a => a.id === tx.toAccountId)?.name ?? '—'}`
    : getAccountLabel(tx.fromAccountId ?? tx.toAccountId, tx.linkedCardId, accounts, cards)

  const { date, time } = fmtTxDate(tx.timestamp)
  const typeLower = type.toLowerCase()

  const amountDisplay = type === 'Adjustment'
    ? `${tx.toAccountId ? '+' : '−'}${fmtVND(tx.amount)}`
    : fmtVND(tx.amount)

  const targetCatType = catTypeForTx(type)
  const parentCats = categories.filter(c => c.parentId === null && c.type === targetCatType)
  const childrenOf = (parentId: string) => categories.filter(c => c.parentId === parentId)

  const dismiss = useCallback((cb: () => void) => {
    setClosing(true)
    setTimeout(cb, ANIM_MS)
  }, [])

  const handleSave = async () => {
    setBtnState('saving')
    try {
      const res = await apiFetch(`${API_BASE}/transactions?id=${tx.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, note: note.trim() }),
      })
      await parseApiResponse(res, 'Failed to update transaction')
      setBtnState('saved')
      setTimeout(() => dismiss(onSave), SUCCESS_MS)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
      setBtnState('idle')
    }
  }

  const dirty = categoryId !== tx.categoryId || note.trim() !== tx.note.trim()
  const busy = btnState !== 'idle'

  return (
    <div
      className={`edit-modal-backdrop${closing ? ' edit-modal-backdrop--closing' : ''}`}
      onClick={() => { if (!busy) dismiss(onCancel) }}
      onTouchStart={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      <div className={`edit-modal-sheet${closing ? ' edit-modal-sheet--closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="edit-modal-handle" />
        <span className="edit-modal-title">EDIT TRANSACTION</span>

        <div className="edit-modal-rows">
          <div className="edit-modal-row">
            <span className="edit-modal-label">Account</span>
            <span className="edit-modal-value">{accountLabel}</span>
          </div>
          <div className="edit-modal-row">
            <span className="edit-modal-label">Date</span>
            <span className="edit-modal-value">{date} · {time}</span>
          </div>
          <div className="edit-modal-row">
            <span className="edit-modal-label">Amount</span>
            <span className={`edit-modal-value edit-modal-amount edit-modal-amount--${typeLower}`}>
              {amountDisplay}
            </span>
          </div>
        </div>

        <div className="edit-modal-fields">
          <div className="edit-modal-field">
            <label className="edit-modal-field-label">Category</label>
            <select
              title="Category"
              className="edit-modal-select"
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              disabled={busy}
            >
              {parentCats.map(parent => {
                const children = childrenOf(parent.id)
                if (children.length === 0) {
                  return <option key={parent.id} value={parent.id}>{parent.name}</option>
                }
                return (
                  <optgroup key={parent.id} label={parent.name}>
                    {children.map(child => (
                      <option key={child.id} value={child.id}>{child.name}</option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
          </div>

          <div className="edit-modal-field">
            <label className="edit-modal-field-label">Note</label>
            <textarea
              className="edit-modal-textarea"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note..."
              rows={3}
              disabled={busy}
            />
          </div>
        </div>

        <button
          type="button"
          className={`edit-modal-btn${btnState === 'saved' ? ' edit-modal-btn--saved' : ''}`}
          onClick={handleSave}
          disabled={busy || !dirty}
        >
          <span key={btnState} className="edit-modal-btn-content">
            {btnState === 'saving' && <Loader2 size={18} className="icon-spin" />}
            {btnState === 'saved' && <Check size={18} />}
            {btnState === 'saving' ? 'Saving...' : btnState === 'saved' ? 'Saved' : 'Save Changes'}
          </span>
        </button>
      </div>
    </div>
  )
}
