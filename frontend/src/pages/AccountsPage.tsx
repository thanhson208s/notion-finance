import './AccountsPage.css'
import { useEffect, useState } from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Pencil
} from "lucide-react"
import { useApp, type Account, type AccountType } from '../App'

type GetAccountsResponse = {
  accounts: Account[]
  total: number
  totalOfAssets: number
  totalOfLiabilities: number
}

export default function AccountsPage() {
  const { state, dispatch } = useApp();
  const [ expandedId, setExpandedId ] = useState<string | null>(null);
  const account2Class: Record<AccountType, string> = {
    Cash: "account-cash",
    Bank: "account-bank",
    Credit: "account-credit",
    eWallet: "account-ewallet",
    Savings: "account-savings",
    PayLater: "account-paylater",
    Prepaid: "account-prepaid"
  }

  useEffect(() => {
    const controller = new AbortController();
    
    (async() => {
      try {
        const response = await fetch(
          "https://finance.gootube.online/api/accounts",
          { signal: controller.signal }
        );

        if (!response.ok)
          throw new Error("Failed to fetch accounts");

        const data: GetAccountsResponse = await response.json();
        dispatch({ type: 'update', accounts: data.accounts });
      } catch(e) {
        if (e instanceof Error)
          console.log(e.message);
        dispatch({ type: 'update', accounts: [] });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [dispatch]);

  const handleExpense = (id: string) => {
    console.log("Expense for account:", id)
  }

  const handleIncome = (id: string) => {
    console.log("Income for account:", id)
  }

  const handleTransfer = (id: string) => {
    console.log("Transfer for account:", id)
  }

  const handleAdjustment = (id: string) => {
    console.log("Adjustment for account:", id)
  }

  const toggleCard = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  }

  return (
    <main className="page">
      <div className="account-list">
        {state.accounts.map((account) => {
          return (
            <div key={account.id}
              className={`account-card ${account.id === expandedId ? 'expanded' : ''}`}
              onClick = {() => toggleCard(account.id)}
            >
              <div className="account-info">
                <div className="account-title">
                  <span className="account-name">{account.name}</span>
                  <span className={`account-type ${account2Class[account.type]}`}>{account.type}</span>
                </div>

                <div className="account-balance">
                  {account.balance.toLocaleString("vi-VN", {
                    style: "currency",
                    currency: "VND",
                  })}
                </div>
              </div>

              <div
                className="actions"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  title="Expense"
                  aria-label="Expense"
                  className="action-btn expense"
                  onClick={() =>
                    handleExpense(account.id)
                  }
                >
                  <ArrowDownRight size={18}/>
                </button>

                <button
                  aria-label="Income"
                  className="action-btn income"
                  onClick={() =>
                    handleIncome(account.id)
                  }
                >
                  <ArrowUpRight size={18}/>
                </button>

                <button
                  aria-label="Transfer"
                  className="action-btn transfer"
                  onClick={() =>
                    handleTransfer(account.id)
                  }
                >
                  <ArrowLeftRight size={18}/>
                </button>

                <button
                  aria-label="Adjustment"
                  className="action-btn adjustment"
                  onClick={() =>
                    handleAdjustment(account.id)
                  }
                >
                  <Pencil size={18}/>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}