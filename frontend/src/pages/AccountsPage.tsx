import './AccountsPage.css'
import { useEffect, useState, useRef } from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Pencil
} from "lucide-react"
import { type Account, type AccountType } from '../App'
import IncomeForm from '../components/IncomeForm'
import ExpenseForm from '../components/ExpenseForm'
import TransferForm from '../components/TransferForm'
import AdjustmentForm from '../components/AdjustmentForm'

type GetAccountsResponse = {
  accounts: Account[]
  total: number
  totalOfAssets: number
  totalOfLiabilities: number
}

export default function AccountsPage() {
  const [ accounts, setAccounts ] = useState<Account[]>([]);
  const [ totals, setTotals ] = useState({ total: 0, totalOfAssets: 0, totalOfLiabilities: 0 });
  const [ activeAccount, setActiveAccount ] = useState<{
    id: string,
    action: 'income' | 'expense' | 'transfer' | 'adjustment' | null
  } | null>(null);
  const [ filter, setFilter ] = useState<"all" | "assets" | "liabilities">("all");
  const [ sort, setSort ] = useState<"balance" | "type">("balance");
  const [ hideEmpty, setHideEmpty ] = useState<boolean>(true);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const account2Class: Record<AccountType, string> = {
    Cash: "account-cash",
    Bank: "account-bank",
    Credit: "account-credit",
    eWallet: "account-ewallet",
    Savings: "account-savings",
    PayLater: "account-paylater",
    Prepaid: "account-prepaid",
    Gold: "account-gold",
  }

  const type2Priority: Record<AccountType, number> = {
    Cash: 0,
    Bank: 1,
    eWallet: 2,
    Credit: 3,
    Savings: 4,
    PayLater: 5,
    Prepaid: 6,
    Gold: 7,
  }

  const type2Group: Record<AccountType, "asset" | "liability"> = {
    Cash: "asset",
    Bank: "asset",
    eWallet: "asset",
    Savings: "asset",
    Prepaid: "asset",
    Gold: "asset",
    Credit: "liability",
    PayLater: "liability",
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
        setAccounts(data.accounts);
        setTotals({ total: data.total, totalOfAssets: data.totalOfAssets, totalOfLiabilities: data.totalOfLiabilities });
      } catch(e) {
        if (e instanceof Error)
          console.log(e.message);
        setAccounts([]);
      }
    })();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!activeAccount) return;
    const card = cardRefs.current[activeAccount.id];
    if (card) card.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeAccount]);

  const handleExpense = (id: string) => {
    if (activeAccount?.action === 'expense')
      setActiveAccount({id, action: null});
    else setActiveAccount({id, action: 'expense'});
  }
  
  const handleIncome = (id: string) => {
    if (activeAccount?.action === 'income')
      setActiveAccount({id, action: null});
    else setActiveAccount({id, action: 'income'});
  }
  
  const handleTransfer = (id: string) => {
    if (activeAccount?.action === 'transfer')
      setActiveAccount({id, action: null});
    else setActiveAccount({id, action: 'transfer'});
  }
  
  const handleAdjustment = (id: string) => {
    if (activeAccount?.action === 'adjustment')
      setActiveAccount({id, action: null});
    else setActiveAccount({id, action: 'adjustment'});
  }

  const toggleCard = (id: string) => {
    setActiveAccount(prev => (prev?.id === id ? null : {id, action: null}));
  }

  const displayedTotal = filter === 'assets' ? totals.totalOfAssets
    : filter === 'liabilities' ? totals.totalOfLiabilities
    : totals.total;

  return (
    <main className="page">
      <div className="balance-header">
        <div className="balance-pill">
          {displayedTotal.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
        </div>
      </div>

      <div className="account-toolbar">
        <select className="account-select"
          title="filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as "all" | "assets" | "liabilities")}
        >
          <option value="all">All</option>
          <option value="assets">Assets</option>
          <option value="liabilities">Liabilities</option>
        </select>

        <select className="account-select"
          title="sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as "balance" | "type")}
        >
          <option value="balance">Balance</option>
          <option value="type">Group</option>
          {/* <option value="frequent">Recent</option> */}
        </select>

        <label className="account-checkbox">
          <div className="checkbox-wrapper">
            <label className="switch">
              <input
                title="Hide Empty"
                type="checkbox"
                checked={hideEmpty}
                onChange={(e) => setHideEmpty(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>
        </label>
      </div>

      <div className="account-list">
        {accounts.filter((account) => {
          if (hideEmpty && account.balance === 0) return false;
          if (filter === 'assets' && type2Group[account.type] !== 'asset') return false;
          if (filter === 'liabilities' && type2Group[account.type] !== 'liability') return false;
          return true;
        }).sort((a, b) => {
          if (sort === 'balance') {
            if (a.balance === 0 && b.balance !== 0) return 1;
            if (a.balance !== 0 && b.balance === 0) return -1;
            return b.balance - a.balance;
          } else {
            return type2Priority[a.type] - type2Priority[b.type];
          }
        }).map((account) => {
          return (
            <div
              key={account.id}
              className = 'account-card'
              onClick = {() => toggleCard(account.id)}
              ref={(el) => {cardRefs.current[account.id] = el}}
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

              {activeAccount?.id === account.id && (
                <div
                  className="actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    title="Expense"
                    aria-label="Expense"
                    className={`action-btn expense ${activeAccount?.action === 'expense' ? 'action-select' : ''}`}
                    onClick={() =>
                      handleExpense(account.id)
                    }
                  >
                    <ArrowDownRight size={18}/>
                  </button>

                  <button
                    aria-label="Income"
                    className={`action-btn income ${activeAccount?.action === 'income' ? 'action-select' : ''}`}
                    onClick={() =>
                      handleIncome(account.id)
                    }
                  >
                    <ArrowUpRight size={18}/>
                  </button>

                  <button
                    aria-label="Transfer"
                    className={`action-btn transfer ${activeAccount?.action === 'transfer' ? 'action-select' : ''}`}
                    onClick={() =>
                      handleTransfer(account.id)
                    }
                  >
                    <ArrowLeftRight size={18}/>
                  </button>

                  <button
                    aria-label="Adjustment"
                    className={`action-btn adjustment ${activeAccount?.action === 'adjustment' ? 'action-select' : ''}`}
                    onClick={() =>
                      handleAdjustment(account.id)
                    }
                  >
                    <Pencil size={18}/>
                  </button>
                </div>
              )}

              {activeAccount?.id === account.id && activeAccount.action && (
                <div className = 'form-wrapper' onClick={(e) => e.stopPropagation()}>
                  {activeAccount.action === 'expense' && (
                    <ExpenseForm accountId={account.id}/>
                  )}
                  {activeAccount.action === 'income' && (
                    <IncomeForm accountId={account.id}/>
                  )}
                  {activeAccount.action === 'transfer' && (
                    <TransferForm accountId={account.id} accounts={accounts}/>
                  )}
                  {activeAccount.action === 'adjustment' && (
                    <AdjustmentForm accountId={account.id}/>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}