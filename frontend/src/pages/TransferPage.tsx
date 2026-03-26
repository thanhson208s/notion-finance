import './TransactionPage.css'
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, CalendarDays } from 'lucide-react'
import TransferForm from '../components/TransferForm'
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
  const { accounts, refetchAccounts, refetchReports } = useAppContext()
  const [timestamp, setTimestamp] = useState<number>(() => Date.now())

  const handleTransferSuccess = () => {
    refetchAccounts();
    refetchReports(false, true)
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

      <div className="transaction-body">
        <TransferForm accountId={accountId!} accounts={accounts.filter(a => a.active)} onTransferSuccess={handleTransferSuccess} timestamp={timestamp} />
      </div>
    </main>
  )
}
