import './modal.css'
import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Account, AccountType } from '../App'
import { API_BASE, ACCOUNT_TYPES } from '../App'
import { apiFetch, parseApiResponse } from '../lib/auth'

const ANIM_MS = 500
const SUCCESS_MS = 1000

type BtnState = 'idle' | 'saving' | 'saved'

type Props = {
  onClose: () => void
  onAdded: (account: Account) => void
}

export function AddAccountModal({ onClose, onAdded }: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('Cash')
  const [note, setNote] = useState('')
  const [btnState, setBtnState] = useState<BtnState>('idle')
  const [closing, setClosing] = useState(false)

  const dismiss = (cb: () => void) => { setClosing(true); setTimeout(cb, ANIM_MS) }

  const submit = async () => {
    if (!name.trim()) return
    setBtnState('saving')
    try {
      const res = await apiFetch(`${API_BASE}/accounts?action=create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type, note: note.trim() })
      })
      const account = await parseApiResponse<Account>(res, 'Failed to create account')
      setBtnState('saved')
      setTimeout(() => dismiss(() => onAdded(account)), SUCCESS_MS)
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
        <h2 className="modal-title">New Account</h2>

        <div className="modal-field">
          <label className="modal-label">Name</label>
          <input
            className="modal-input"
            type="text"
            placeholder="e.g. Techcombank"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">Type</label>
          <select
            className="modal-select"
            title="Account type"
            value={type}
            onChange={e => setType(e.target.value as AccountType)}
            disabled={busy}
          >
            {ACCOUNT_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="modal-field">
          <label className="modal-label">Note <span style={{ textTransform: 'none', fontWeight: 400, color: '#475569' }}>(optional)</span></label>
          <textarea
            className="modal-textarea"
            placeholder="Any notes…"
            rows={2}
            value={note}
            onChange={e => setNote(e.target.value)}
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
            disabled={busy || !name.trim()}
          >
            <span key={btnState} className="modal-btn-content">
              {btnState === 'saving' && <Loader2 size={18} className="icon-spin" />}
              {btnState === 'saved' && <Check size={18} />}
              {btnState === 'saving' ? 'Saving...' : btnState === 'saved' ? 'Saved' : 'Add'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
