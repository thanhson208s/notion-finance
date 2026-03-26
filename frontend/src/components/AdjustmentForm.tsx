import { useState } from 'react'
import { SlidersHorizontal, Equal, Plus, Minus, Check, X, Loader2 } from 'lucide-react'
import { API_BASE } from '../App'
import { apiFetch } from '../lib/auth'

type AdjustmentResponse = {
  accountId: string,
  oldBalance: number,
  newBalance: number,
  delta: number,
  note: string
}

type AdjustmentError = {
  code: string,
  message: string
}

type AdjustmentStatus = {
  status: 'success',
  data: AdjustmentResponse
} | {
  status: 'error',
  data: AdjustmentError
} | { status: 'idle' } | { status: 'loading' }

export default function AdjustmentForm({accountId, accountBalance, onSuccess, timestamp}: {
  accountId: string
  accountBalance: number
  onSuccess?: (newBalance: number) => void
  timestamp?: number
}) {
  const [ status, setStatus] = useState<AdjustmentStatus>({status: 'idle'});
  const [ delta, setDelta ] = useState<number>(0);
  const [ dir, setDir ] = useState<1 | -1>(1);
  const [ note, setNote ] = useState<string>("");
  const [ error, setError ] = useState<boolean>(false);

  const balance = accountBalance + delta * dir;
  const loading = status.status === 'loading'
  const resetToIdle = () => { if (!loading) setStatus({status: 'idle'}) }

  const reverse = () => {
    setDir(dir > 0 ? - 1: 1);
  }

  const submit = async() => {
    if (status.status === 'success' || status.status === 'error') { setStatus({status: 'idle'}); return }
    if (delta && delta !== 0) {
      setError(false);
      setStatus({status: 'loading'});
      try {
        const response = await apiFetch(`${API_BASE}/accounts?action=adjustment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            accountId, balance, note, timestamp
          })
        });

        if (!response.ok) {
          setStatus({status: 'error', data: await response.json() as AdjustmentError})
          return;
        }

        const data = await response.json() as AdjustmentResponse;
        setStatus({status: 'success', data});
        onSuccess?.(data.newBalance);
      } catch(e) {
        if (e instanceof Error)
          console.log(e.message);
        setStatus({status: 'idle'});
      }
    } else setError(true);
  }

  return (
    <form className="form-main">
      <div className="adjustment-divider">
        <div className="transfer-divider-line" />
        <button title="Switch" type="button" className="transfer-divider-btn" onClick={reverse}>
          {dir > 0 ? (<Plus size={18} />) : (<Minus size={18} />)}
        </button>
        <div className="transfer-divider-line" />
      </div>

      <div className="amount-display">
        <input
          type="text"
          value={Math.abs(accountBalance - balance).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
          onChange={() => {}}
          onKeyDown={(e) => {
            if (loading) return
            if (e.code === 'Backspace') { setDelta(Math.floor(delta / 10)); setError(false); resetToIdle() }
            else if (e.code.match(/^Digit[0-9]$/g)) { setDelta(delta * 10 + parseInt(e.code.slice(-1))); setError(false); resetToIdle() }
          }}
          placeholder='0 ₫'
          inputMode="numeric"
          disabled={loading}
          className={`amount-input-small${error ? ' amount-error' : ''}`}
        />
      </div>

      <div className="adjustment-divider">
        <div className="transfer-divider-line" />
        <button title="Switch" type="button" className="transfer-divider-btn" disabled>
          <Equal size={18} />
        </button>
        <div className="transfer-divider-line" />
      </div>

      <div className="input-amount-area">
        <div className="amount-display">
          <input
            type="text"
            value={balance.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
            onChange={() => {}}
            onKeyDown={(e) => {
              if (loading) return
              if (e.code === 'Backspace') { setDelta(Math.abs(Math.floor(balance / 10) - accountBalance)); setDir(Math.floor(balance / 10) >= accountBalance ? 1 : -1); setError(false); resetToIdle() }
              else if (e.code.match(/^Digit[0-9]$/g)) { setDelta(Math.abs(balance * 10 + parseInt(e.code.slice(-1)) - accountBalance)); setDir(balance * 10 + parseInt(e.code.slice(-1)) >= accountBalance ? 1 : -1); setError(false); resetToIdle() }
            }}
            placeholder='0 ₫'
            inputMode="numeric"
            disabled={loading}
            className={`amount-input-big${error ? ' amount-error' : ''}`}
          />
        </div>
      </div>

      <div className="form-row">
        <textarea
          rows={3}
          value={note}
          onChange={(e) => { setNote(e.target.value); resetToIdle() }}
          disabled={loading}
          placeholder='Note...'
        />
      </div>

      <div className="form-buttons">
        <button type="button" className="form-btn submit-btn-adjustment" onClick={submit} disabled={loading}>
          <span key={status.status} className="submit-btn-content">
            {status.status === 'loading' && <Loader2 size={20} className="icon-spin" />}
            {status.status === 'success' && <Check size={20} />}
            {status.status === 'error'   && <X size={20} />}
            {status.status === 'idle'    && <SlidersHorizontal size={20} />}
            <span>
              {status.status === 'loading' ? 'Processing...' :
               status.status === 'success' ? 'Success' :
               status.status === 'error'   ? 'Error' :
               'Adjust'}
            </span>
          </span>
        </button>
      </div>
    </form>
  )
}