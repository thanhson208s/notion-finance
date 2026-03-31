import './modal.css'
import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Card, Category } from '../App'
import { API_BASE, fmtVND } from '../App'
import { apiFetch, parseApiResponse } from '../lib/auth'

const ANIM_MS = 500
const SUCCESS_MS = 1000

type BtnState = 'idle' | 'saving' | 'saved'

type Props = {
  card: Card
  categories: Category[]
  onClose: () => void
  onAdded: () => void
}

export function AddExpenseModal({ card, categories, onClose, onAdded }: Props) {
  const [amount, setAmount] = useState(0)
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [cashback, setCashback] = useState(0)
  const [cashbackMode, setCashbackMode] = useState<'flat' | 'pct'>('flat')
  const [discount, setDiscount] = useState(0)
  const [discountMode, setDiscountMode] = useState<'flat' | 'pct'>('flat')
  const [btnState, setBtnState] = useState<BtnState>('idle')
  const [closing, setClosing] = useState(false)

  const expenseCategories = categories.filter(c => c.type === 'Expense')
  const parents = expenseCategories.filter(c => c.parentId === null)
  const children = expenseCategories.filter(c => c.parentId !== null)

  const cashbackValue = cashbackMode === 'pct' ? Math.round(amount * cashback / 100) : cashback
  const discountValue = discountMode === 'pct' ? Math.round(amount * discount / 100) : discount

  const fmtAmount = (n: number) => n > 0 ? fmtVND(n) : ''

  const buildDigit = (setter: (fn: (prev: number) => number) => void) => (e: React.KeyboardEvent) => {
    if (e.code === 'Backspace') setter(p => Math.floor(p / 10))
    else if (e.code.match(/^Digit[0-9]$/)) setter(p => p * 10 + parseInt(e.code.slice(-1)))
  }

  const dismiss = (cb: () => void) => { setClosing(true); setTimeout(cb, ANIM_MS) }

  const submit = async () => {
    if (!amount || !categoryId) return
    setBtnState('saving')
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
      await parseApiResponse(res, 'Failed to save expense')
      setBtnState('saved')
      setTimeout(() => dismiss(onAdded), SUCCESS_MS)
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
        <h2 className="modal-title">New Expense</h2>

        <div className="modal-field">
          <label className="modal-label">Amount</label>
          <input
            title="Amount" className="modal-input modal-input--amount"
            type="text" inputMode="numeric" placeholder="0 ₫"
            value={fmtAmount(amount)} onChange={() => {}}
            onKeyDown={buildDigit(setAmount)}
            disabled={busy}
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">Category</label>
          <select
            title="Category" className="modal-select"
            value={categoryId} onChange={e => setCategoryId(e.target.value)}
            disabled={busy}
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

        <div className="modal-field">
          <label className="modal-label">Note</label>
          <input
            title="Note" className="modal-input"
            type="text" placeholder="Optional"
            value={note} onChange={e => setNote(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">Cashback</label>
          <div className="modal-input-row">
            <input
              title="Cashback" className="modal-input"
              type="text" inputMode="numeric"
              placeholder={cashbackMode === 'flat' ? '0 ₫' : '0'}
              value={cashbackMode === 'flat' ? fmtAmount(cashback) : (cashback > 0 ? cashback.toString() : '')}
              onChange={() => {}}
              onKeyDown={buildDigit(setCashback)}
              disabled={busy}
            />
            <button
              type="button" className="modal-mode-btn"
              onClick={() => { setCashbackMode(m => m === 'flat' ? 'pct' : 'flat'); setCashback(0) }}
              disabled={busy}
            >
              {cashbackMode === 'flat' ? '₫' : '%'}
            </button>
          </div>
          {cashbackMode === 'pct' && cashback > 0 && amount > 0 && (
            <span className="modal-computed">= {fmtVND(cashbackValue)}</span>
          )}
        </div>

        <div className="modal-field">
          <label className="modal-label">Discount</label>
          <div className="modal-input-row">
            <input
              title="Discount" className="modal-input"
              type="text" inputMode="numeric"
              placeholder={discountMode === 'flat' ? '0 ₫' : '0'}
              value={discountMode === 'flat' ? fmtAmount(discount) : (discount > 0 ? discount.toString() : '')}
              onChange={() => {}}
              onKeyDown={buildDigit(setDiscount)}
              disabled={busy}
            />
            <button
              type="button" className="modal-mode-btn"
              onClick={() => { setDiscountMode(m => m === 'flat' ? 'pct' : 'flat'); setDiscount(0) }}
              disabled={busy}
            >
              {discountMode === 'flat' ? '₫' : '%'}
            </button>
          </div>
          {discountMode === 'pct' && discount > 0 && amount > 0 && (
            <span className="modal-computed">= {fmtVND(discountValue)}</span>
          )}
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
            disabled={busy || !amount || !categoryId}
          >
            <span key={btnState} className="modal-btn-content">
              {btnState === 'saving' && <Loader2 size={18} className="icon-spin" />}
              {btnState === 'saved' && <Check size={18} />}
              {btnState === 'saving' ? 'Saving...' : btnState === 'saved' ? 'Saved' : 'Save'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
