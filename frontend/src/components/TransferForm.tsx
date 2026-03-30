import { useState } from 'react'
import type { Account, AccountType } from '../App'
import { API_BASE, fmtVND } from '../App'
import { apiFetch, parseApiResponse } from '../lib/auth'
import { toast } from 'sonner'
import { ChevronDown, ArrowUpDown, ArrowLeftRight, Check, X, Loader2 } from 'lucide-react';

type TransferResponse = {
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  oldFromAccountBalance: number,
  newFromAccountBalance: number,
  oldToAccountBalance: number,
  newToAccountBalance: number,
}

type TransferStatus = {
  status: 'success'
  data: TransferResponse
} | { status: 'error' } | { status: 'idle' } | { status: 'loading' }

export default function TransferForm({accountId, accounts, onTransferSuccess, timestamp}: {
  accountId: string,
  accounts: Account[]
  onTransferSuccess?: () => void
  timestamp?: number
}) {
  const [ status, setStatus ] = useState<TransferStatus>({status: "idle"});
  const [ fromAccountId, setFromAccountId ] = useState<string>(accountId);
  const [ toAccountId, setToAccountId ] = useState<string>("");
  const [ amount, setAmount ] = useState<number>(0);
  const [ note, setNote ] = useState<string>("");
  const [ errors, setErrors ] = useState<{ amount?: boolean, fromAccountId?: boolean, toAccountId?: boolean }>({});
  const [ openDropdown, setOpenDropdown ] = useState<'from' | 'to' | null>(null);

  const accountTypes: AccountType[] = [];
  accounts.forEach(account => {
    if (!accountTypes.includes(account.type))
      accountTypes.push(account.type);
  });

  const fromAccount = accounts.find(a => a.id === fromAccountId)
  const toAccount = accounts.find(a => a.id === toAccountId)

  const loading = status.status === 'loading'
  const resetToIdle = () => { if (!loading) setStatus({status: 'idle'}) }

  const switchFromTo = () => {
    setFromAccountId(toAccountId)
    setToAccountId(fromAccountId)
  }

  const selectFrom = (id: string) => {
    if (id === toAccountId) {
      setFromAccountId(id)
      setToAccountId(fromAccountId)
    } else {
      setFromAccountId(id)
    }
    setErrors(p => ({...p, fromAccountId: false}))
    setOpenDropdown(null)
    resetToIdle()
  }

  const selectTo = (id: string) => {
    if (id === fromAccountId) {
      setToAccountId(id)
      setFromAccountId(toAccountId)
    } else {
      setToAccountId(id)
    }
    setErrors(p => ({...p, toAccountId: false}))
    setOpenDropdown(null)
    resetToIdle()
  }

  const submit = async() => {
    if (status.status === 'success' || status.status === 'error') { setStatus({status: 'idle'}); return }
    const errorAmount = !amount || amount <= 0;
    const errorFromAccountId = !fromAccountId || fromAccountId === "";
    const errorToAccountId = !toAccountId || toAccountId === "";

    setErrors({ amount: errorAmount, fromAccountId: errorFromAccountId, toAccountId: errorToAccountId });

    if (!errorAmount && !errorFromAccountId && !errorToAccountId) {
      setStatus({status: 'loading'});
      try {
        const response = await apiFetch(`${API_BASE}/accounts?action=transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, fromAccountId, toAccountId, timestamp, note: note.trim() })
        });

        const data = await parseApiResponse<TransferResponse>(response, 'Something went wrong')
        setStatus({status: 'success', data});
        onTransferSuccess?.();
      } catch(e) {
        const msg = e instanceof Error ? e.message : 'Something went wrong'
        toast.error(msg)
        setStatus({status: 'error'});
      }
    }
  }

  return (
    <form className="form-main">
      {/* Backdrop to close dropdown on outside click */}
      {openDropdown && <div className="transfer-dropdown-backdrop" onClick={() => setOpenDropdown(null)} />}

      {/* From account card */}
      <div className="transfer-card-wrapper">
        <div
          className={`transfer-account-card${errors.fromAccountId ? ' transfer-card-error' : ''}`}
          onClick={() => setOpenDropdown(openDropdown === 'from' ? null : 'from')}
        >
          <span className="transfer-card-label">From</span>
          <div className="transfer-card-body">
            <div className="transfer-card-info">
              <div className="transfer-card-name-row">
                {fromAccount ? (
                  <>
                    <span className="transfer-card-name">{fromAccount.name}</span>
                    <span className={`account-type account-${fromAccount.type.toLowerCase()}`}>{fromAccount.type}</span>
                  </>
                ) : (
                  <span className="transfer-card-placeholder">— From —</span>
                )}
              </div>
              <span className="transfer-card-balance">
                {fmtVND(fromAccount?.balance ?? 0)}
              </span>
            </div>
            <ChevronDown size={20} className={`transfer-card-chevron${openDropdown === 'from' ? ' transfer-card-chevron-open' : ''}`} />
          </div>
        </div>
        {openDropdown === 'from' && (
          <div className="transfer-dropdown">
            {accounts.filter(a => a.id !== fromAccountId).sort((a, b) => b.priorityScore - a.priorityScore).map(a => (
              <div
                key={a.id}
                className={`transfer-dropdown-item${fromAccountId === a.id ? ' transfer-dropdown-item-selected' : ''}`}
                onClick={() => selectFrom(a.id)}
              >
                <div className="transfer-dropdown-name-row">
                  <span className="transfer-dropdown-name">{a.name}</span>
                  <span className={`account-type account-${a.type.toLowerCase()}`}>{a.type}</span>
                </div>
                <span className="transfer-dropdown-balance">
                  {fmtVND(a.balance)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Swap divider */}
      <div className="transfer-divider">
        <div className="transfer-divider-line" />
        <button title="Switch" type="button" className="transfer-divider-btn" onClick={switchFromTo}>
          <ArrowUpDown size={18} />
        </button>
        <div className="transfer-divider-line" />
      </div>

      {/* To account card */}
      <div className="transfer-card-wrapper">
        <div
          className={`transfer-account-card${errors.toAccountId ? ' transfer-card-error' : ''}`}
          onClick={() => setOpenDropdown(openDropdown === 'to' ? null : 'to')}
        >
          <span className="transfer-card-label">To</span>
          <div className="transfer-card-body">
            <div className="transfer-card-info">
              <div className="transfer-card-name-row">
                {toAccount ? (
                  <>
                    <span className="transfer-card-name">{toAccount.name}</span>
                    <span className={`account-type account-${toAccount.type.toLowerCase()}`}>{toAccount.type}</span>
                  </>
                ) : (
                  <span className="transfer-card-placeholder">— To —</span>
                )}
              </div>
              <span className="transfer-card-balance">
                {fmtVND(toAccount?.balance ?? 0)}
              </span>
            </div>
            <ChevronDown size={20} className={`transfer-card-chevron${openDropdown === 'to' ? ' transfer-card-chevron-open' : ''}`} />
          </div>
        </div>
        {openDropdown === 'to' && (
          <div className="transfer-dropdown">
            {accounts.filter(a => a.id !== toAccountId).sort((a, b) => b.priorityScore - a.priorityScore).map(a => (
              <div
                key={a.id}
                className={`transfer-dropdown-item${toAccountId === a.id ? ' transfer-dropdown-item-selected' : ''}`}
                onClick={() => selectTo(a.id)}
              >
                <div className="transfer-dropdown-name-row">
                  <span className="transfer-dropdown-name">{a.name}</span>
                  <span className={`account-type account-${a.type.toLowerCase()}`}>{a.type}</span>
                </div>
                <span className="transfer-dropdown-balance">
                  {fmtVND(a.balance)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="input-amount-area">
        <div className="amount-display">
          <input
            type="text"
            value={fmtVND(amount)}
            onChange={() => {}}
            onKeyDown={(e) => {
              if (loading) return
              if (e.code === 'Backspace') { setAmount(Math.floor(amount / 10)); setErrors(p => ({...p, amount: false})); resetToIdle() }
              else if (e.code.match(/^Digit[0-9]$/g)) { setAmount(amount * 10 + parseInt(e.code.slice(-1))); setErrors(p => ({...p, amount: false})); resetToIdle() }
            }}
            placeholder='0 ₫'
            inputMode="numeric"
            disabled={loading}
            className={`amount-input-big${errors.amount ? ' amount-error' : ''}`}
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
        <button type="button" className="form-btn submit-btn-transfer" onClick={submit} disabled={loading}>
          <span key={status.status} className="submit-btn-content">
            {status.status === 'loading' && <Loader2 size={20} className="icon-spin" />}
            {status.status === 'success' && <Check size={20} />}
            {status.status === 'error'   && <X size={20} />}
            {status.status === 'idle'    && <ArrowLeftRight size={20} />}
            <span>
              {status.status === 'loading' ? 'Processing...' :
               status.status === 'success' ? 'Success' :
               status.status === 'error'   ? 'Error' :
               'Transfer'}
            </span>
          </span>
        </button>
      </div>
    </form>
  )
}
