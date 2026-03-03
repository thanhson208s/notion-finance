import './TransactionPage.css'
import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import TransferForm from '../components/TransferForm'
import type { Account } from '../App'

export default function TransferPage() {
  const { accountId } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const account = state?.account as Account | undefined
  const [accounts, setAccounts] = useState<Account[]>([])

  useEffect(() => {
    const controller = new AbortController()
    ;(async () => {
      try {
        const response = await fetch('https://finance.gootube.online/api/accounts', {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Failed to fetch accounts')
        const data = await response.json()
        setAccounts(data.accounts)
      } catch (e) {
        if (e instanceof Error) console.log(e.message)
        setAccounts([])
      }
    })()
    return () => controller.abort()
  }, [])

  return (
    <main className="page">
      <div className="transaction-header">
        <button type="button" aria-label="Back" className="back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={28} />
        </button>
        <h1 className="transaction-title">Transfer</h1>
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
        <TransferForm accountId={accountId!} accounts={accounts} />
      </div>
    </main>
  )
}
