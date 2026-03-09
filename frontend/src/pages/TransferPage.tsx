import './TransactionPage.css'
import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, CalendarDays } from 'lucide-react'
import TransferForm from '../components/TransferForm'
import type { Account } from '../App'
import { useAppContext } from '../contexts/AppContext'

const toDatetimeLocal = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const formatDateDisplay = (ms: number) =>
  new Date(ms).toLocaleString('vi-VN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  })

export default function TransferPage() {
  const { accountId } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const account = state?.account as Account | undefined
  const [balance, setBalance] = useState<number>(account?.balance ?? 0)
  const { accounts, updateAccountBalance } = useAppContext()
  const [timestamp, setTimestamp] = useState<number>(() => Date.now())

  const handleTransferSuccess = (fromId: string, fromBalance: number, toId: string, toBalance: number) => {
    updateAccountBalance(fromId, fromBalance)
    updateAccountBalance(toId, toBalance)
  }

  return (
    <main className="transaction-page">
      <div className="transaction-header">
        <button type="button" aria-label="Back" className="back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={28} />
        </button>
        <h1 className="transaction-title">Transfer</h1>

        <label className="header-datetime">
          <span className="datetime-label">{formatDateDisplay(timestamp)}</span>
          <CalendarDays size={20} />
          <input
            type="datetime-local"
            className="datetime-input-hidden"
            value={toDatetimeLocal(timestamp)}
            onChange={(e) => setTimestamp(e.target.value ? new Date(e.target.value).getTime() : Date.now())}
          />
        </label>
      </div>

      {account && (
        <div className="transaction-account">
          <div className="transaction-account-title">
            <span className="account-name">{account.name}</span>
            <span className={`account-type account-${account.type.toLowerCase()}`}>{account.type}</span>
          </div>
          <div className="account-balance">
            {balance.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
          </div>
        </div>
      )}

      <div className="transaction-body">
        <TransferForm accountId={accountId!} accounts={accounts} onSuccess={setBalance} onTransferSuccess={handleTransferSuccess} timestamp={timestamp} />
      </div>
    </main>
  )
}
