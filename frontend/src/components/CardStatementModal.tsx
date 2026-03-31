import './modal.css'
import { useState, useEffect, useCallback } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Statement } from '../App'
import { API_BASE, fmtVND } from '../App'
import { apiFetch, parseApiResponse } from '../lib/auth'

const ANIM_MS = 500
const SUCCESS_MS = 1000

type BtnState = 'idle' | 'saving' | 'saved'
type PreviewData = { spending: number; cashback: number; discount: number }

function toInputDate(ms: number) {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type Props = {
  cardId: string
  defaultStartDate?: string
  defaultEndDate?: string
  onClose: () => void
  onAdded: (stmt: Statement) => void
}

export function CardStatementModal({ cardId, defaultStartDate, defaultEndDate, onClose, onAdded }: Props) {
  const [startDate, setStartDate] = useState(() => {
    if (defaultStartDate) return defaultStartDate
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    d.setDate(d.getDate() + 1)
    return toInputDate(d.getTime())
  })
  const [endDate, setEndDate] = useState(defaultEndDate ?? toInputDate(Date.now()))
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [btnState, setBtnState] = useState<BtnState>('idle')
  const [closing, setClosing] = useState(false)

  const startMs = startDate ? new Date(startDate).getTime() : NaN
  const endMs = endDate ? new Date(endDate).getTime() : NaN
  const datesValid = !isNaN(startMs) && !isNaN(endMs) && startMs < endMs

  const fetchPreview = useCallback(async () => {
    if (!datesValid) return
    setPreviewLoading(true)
    try {
      const res = await apiFetch(`${API_BASE}/statements?preview=1&cardId=${cardId}&startDate=${startMs}&endDate=${endMs}`)
      if (!res.ok) throw new Error('Failed')
      setPreview(await res.json() as PreviewData)
    } catch {
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [cardId, startMs, endMs, datesValid])

  useEffect(() => { fetchPreview() }, [fetchPreview])

  const dismiss = (cb: () => void) => { setClosing(true); setTimeout(cb, ANIM_MS) }

  const submit = async () => {
    if (!datesValid) return
    setBtnState('saving')
    try {
      const res = await apiFetch(`${API_BASE}/statements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, startDate: startMs, endDate: endMs })
      })
      const data = await parseApiResponse<Statement>(res, 'Failed to add statement')
      setBtnState('saved')
      setTimeout(() => dismiss(() => onAdded(data)), SUCCESS_MS)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
      setBtnState('idle')
    }
  }

  const busy = btnState !== 'idle'
  const dateError = !isNaN(startMs) && !isNaN(endMs) && startMs >= endMs

  return (
    <div
      className={`modal-backdrop${closing ? ' modal-backdrop--closing' : ''}`}
      onClick={() => { if (!busy) dismiss(onClose) }}
    >
      <div className={`modal-sheet${closing ? ' modal-sheet--closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="modal-title">Add Statement</h2>

        <div className="modal-field">
          <label className="modal-label">Start Date</label>
          <input
            title="Start Date" type="date"
            className={`modal-input${!startDate || dateError ? ' modal-input-error' : ''}`}
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">End Date</label>
          <input
            title="End Date" type="date"
            className={`modal-input${!endDate || dateError ? ' modal-input-error' : ''}`}
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="modal-preview">
          {previewLoading ? (
            <div className="modal-preview-loading">Calculating…</div>
          ) : preview ? (
            <div className="modal-preview-rows">
              <div className="modal-preview-row">
                <span className="modal-preview-label">Spending</span>
                <span className="modal-preview-value">{fmtVND(preview.spending)}</span>
              </div>
              <div className="modal-preview-row">
                <span className="modal-preview-label">Cashback</span>
                <span className="modal-preview-value modal-preview-value--cashback">{fmtVND(preview.cashback)}</span>
              </div>
              <div className="modal-preview-row">
                <span className="modal-preview-label">Discount</span>
                <span className="modal-preview-value modal-preview-value--discount">{fmtVND(preview.discount)}</span>
              </div>
            </div>
          ) : (
            <div className="modal-preview-loading">Select dates to preview</div>
          )}
        </div>

        <p className="modal-hint">Spending, cashback and discount will be tallied from transactions linked to this card within the selected period.</p>

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
            disabled={busy || !datesValid}
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
