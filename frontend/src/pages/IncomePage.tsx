import './TransactionPage.css'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import IncomeForm from '../components/IncomeForm'
import type { Account } from '../App'

export default function IncomePage() {
  const { accountId } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const account = state?.account as Account | undefined

  return (
    <main className="page">
      <div className="transaction-header">
        <button type="button" aria-label="Back" className="back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={28} />
        </button>
        <h1 className="transaction-title">Income</h1>
      </div>

      {account && (
        <div className="transaction-account">
          <div className="transaction-account-title">
            <span className="account-name">{account.name}</span>
            <span className={`account-type account-${account.type.toLowerCase()}`}>{account.type}</span>
          </div>
          <div className="account-balance">
            {account.balance.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
          </div>
        </div>
      )}

      <div className="transaction-body">
        <IncomeForm accountId={accountId!} />
      </div>
    </main>
  )
}
