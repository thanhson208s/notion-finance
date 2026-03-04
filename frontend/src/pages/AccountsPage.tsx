import './AccountsPage.css'
import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Pencil
} from "lucide-react"
import { type Account, type AccountType, API_BASE } from '../App'

type GetAccountsResponse = {
  accounts: Account[]
  total: number
  totalOfAssets: number
  totalOfLiabilities: number
}

export default function AccountsPage() {
  const [ accounts, setAccounts ] = useState<Account[]>([]);
  const [ totals, setTotals ] = useState({ total: 0, totalOfAssets: 0, totalOfLiabilities: 0 });
  const [ activeCard, setActiveCard ] = useState<string | null>(null);
  const [ filter, setFilter ] = useState<"all" | "assets" | "liabilities">("all");
  const [ sort, setSort ] = useState<"balance" | "type">("balance");
  const [ hideEmpty, setHideEmpty ] = useState<boolean>(true);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navigate = useNavigate();

  const account2Class: Record<AccountType, string> = {
    Cash: "account-cash",
    Bank: "account-bank",
    Credit: "account-credit",
    eWallet: "account-ewallet",
    Savings: "account-savings",
    PayLater: "account-paylater",
    Prepaid: "account-prepaid",
    Gold: "account-gold",
    Loan: "account-loan",
    Fund: "account-fund",
    Bond: "account-bond",
    Stock: "account-stock",
    Debt: "account-debt",
    Crypto: "account-crypto",
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
    Loan: 8,
    Fund: 9,
    Bond: 10,
    Stock: 11,
    Debt: 12,
    Crypto: 13,
  }

  const type2Group: Record<AccountType, "asset" | "liability"> = {
    Cash: "asset",
    Bank: "asset",
    eWallet: "asset",
    Savings: "asset",
    Prepaid: "asset",
    Gold: "asset",
    Loan: "asset",
    Fund: "asset",
    Bond: "asset",
    Stock: "asset",
    Credit: "liability",
    PayLater: "liability",
    Debt: "liability",
    Crypto: "liability",
  }

  useEffect(() => {
    const controller = new AbortController();

    (async() => {
      try {
        const response = await fetch(
          `${API_BASE}/accounts`,
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
    if (!activeCard) return;
    const card = cardRefs.current[activeCard];
    if (!card) return;

    let timer: ReturnType<typeof setTimeout>;
    const centerCard = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const rect = card.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        window.scrollBy({ top: mid - window.innerHeight / 2, behavior: 'smooth' });
      }, 100);
    };

    const ro = new ResizeObserver(centerCard);
    ro.observe(card);
    centerCard();

    return () => {
      ro.disconnect();
      clearTimeout(timer);
    };
  }, [activeCard]);

  const toggleCard = (id: string) => {
    setActiveCard(prev => (prev === id ? null : id));
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
              className='account-card'
              onClick={() => toggleCard(account.id)}
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

              {activeCard === account.id && (
                <div
                  className="actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    title="Expense"
                    aria-label="Expense"
                    className="action-btn expense"
                    onClick={() => navigate(`/expense/${account.id}`, { state: { account } })}
                  >
                    <ArrowDownRight size={18}/>
                  </button>

                  <button
                    aria-label="Income"
                    className="action-btn income"
                    onClick={() => navigate(`/income/${account.id}`, { state: { account } })}
                  >
                    <ArrowUpRight size={18}/>
                  </button>

                  <button
                    aria-label="Transfer"
                    className="action-btn transfer"
                    onClick={() => navigate(`/transfer/${account.id}`, { state: { account } })}
                  >
                    <ArrowLeftRight size={18}/>
                  </button>

                  <button
                    aria-label="Adjustment"
                    className="action-btn adjustment"
                    onClick={() => navigate(`/adjustment/${account.id}`, { state: { account } })}
                  >
                    <Pencil size={18}/>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
