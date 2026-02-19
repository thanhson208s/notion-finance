import { useEffect, useState } from "react"
import "./App.css"

type AccountType = "Cash" | "Bank" | "Credit" | "eWallet" | "Savings" | "PayLater" | "Prepaid"

type Account = {
  id: string
  name: string
  type: AccountType
  balance: number
}

type GetAccountsResponse = {
  accounts: Account[]
  total: number
  totalOfAssets: number
  totalOfLiabilities: number
}

const account2Class: Record<AccountType, string> = {
  Cash: "account-cash",
  Bank: "account-bank",
  Credit: "account-credit",
  eWallet: "account-ewallet",
  Savings: "account-savings",
  PayLater: "account-paylater",
  Prepaid: "account-prepaid"
}

function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        setAccounts(data.accounts);
      } catch(e) {
        if (e instanceof Error)
          console.log(e.message);
        setAccounts([]);
      }
    })();

    return () => {
      // controller.abort();
    };
  }, [])

  const handleExpense = (id: string) => {
    console.log("Expense for account:", id)
  }

  const handleIncome = (id: string) => {
    console.log("Income for account:", id)
  }

  const toggleCard = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  }

  return (
    <div className="app">
      <header className="header">
        <button className="icon-btn">☰</button>
        <h1 className="title">Finance</h1>
        <button className="icon-btn">?</button>
      </header>

      <main className="account-list">
        {accounts.map((account) => {
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
                  className="btn expense"
                  onClick={() =>
                    handleExpense(account.id)
                  }
                >
                  Expense
                </button>

                <button
                  className="btn income"
                  onClick={() =>
                    handleIncome(account.id)
                  }
                >
                  Income
                </button>
              </div>
            </div>
          )
        })}
      </main>
    </div>
  )
}

export default App
