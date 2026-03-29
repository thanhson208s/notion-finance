import './AccountsPage.css'
import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Pencil,
  Loader2,
  RefreshCw,
  Power,
  Plus
} from "lucide-react"
import { type Account, type AccountType, API_BASE, ACCOUNT_TYPES, fmtVND } from '../App'
import { apiFetch } from '../lib/auth'
import { useApp } from '../contexts/AppContext'
import { usePullToRefresh } from '../hooks/usePullToRefresh'

export default function AccountsPage() {
  const { accounts, totals, accountsLoading, updateAccount, addAccount, refetchAccounts } = useApp();
  const [ activeCard, setActiveCard ] = useState<string | null>(null);
  const [ activationView, setActivationView ] = useState(false);
  const [ togglingId, setTogglingId ] = useState<string | null>(null);
  const [ showAddModal, setShowAddModal ] = useState(false);
  const [ addName, setAddName ] = useState('');
  const [ addType, setAddType ] = useState<AccountType>('Cash');
  const [ addNote, setAddNote ] = useState('');
  const [ addSubmitting, setAddSubmitting ] = useState(false);
  const [ addError, setAddError ] = useState<string | null>(null);
  const [ filter, setFilter ] = useState<"all" | "assets" | "liabilities">("all");
  const [ filteredTypes, setFilteredTypes ] = useState<AccountType[]>([]);
  const [ sort, setSort ] = useState<"relevance" | "balance" | "type">("relevance");
  const [ typeDropdownOpen, setTypeDropdownOpen ] = useState(false);
  const [ hideEmpty, setHideEmpty ] = useState<boolean>(true);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pageRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const { pullDistance, refreshing } = usePullToRefresh(refetchAccounts, pageRef);

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
    Crypto: "asset",
    Credit: "liability",
    PayLater: "liability",
    Debt: "liability",
  }

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

  const openAddModal = () => {
    setAddName(''); setAddType('Cash'); setAddNote(''); setAddError(null);
    setShowAddModal(true);
  }

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) { setAddError('Name is required'); return; }
    setAddSubmitting(true);
    setAddError(null);
    try {
      const res = await apiFetch(`${API_BASE}/accounts?action=create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addName.trim(), type: addType, note: addNote.trim() })
      });
      if (!res.ok) { setAddError('Failed to create account'); return; }
      const account: Account = await res.json();
      addAccount(account);
      setShowAddModal(false);
    } catch {
      setAddError('Failed to create account');
    } finally {
      setAddSubmitting(false);
    }
  }

  const toggleType = (type: AccountType) => {
    setFilteredTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }

  const toggleCard = (id: string) => {
    setActiveCard(prev => (prev === id ? null : id));
  }

  const handleToggleActivation = async (account: Account) => {
    if (togglingId) return;
    setTogglingId(account.id);
    try {
      const res = await apiFetch(`${API_BASE}/accounts?action=set-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.id, active: !account.active })
      });
      if (res.ok) {
        const data = await res.json();
        updateAccount(account.id, { active: data.active });
      }
    } finally {
      setTogglingId(null);
    }
  }

  const displayedTotal = filter === 'assets' ? totals.totalOfAssets
    : filter === 'liabilities' ? totals.totalOfLiabilities
    : totals.total;
  const displayedAccounts = accounts.filter((account) => {
    if (!activationView && !account.active) return false;
    if (!activationView && hideEmpty && account.balance === 0) return false;
    if (filter === 'assets' && type2Group[account.type] !== 'asset') return false;
    if (filter === 'liabilities' && type2Group[account.type] !== 'liability') return false;
    return true;
  });
  const displayedTypes: AccountType[] = [];
  displayedAccounts.forEach(account => {
    if (!displayedTypes.includes(account.type))
      displayedTypes.push(account.type);
  });

  return (
    <main className="page" ref={pageRef}>
      <div
        className="ptr-indicator"
        style={{ '--pull': `${pullDistance}px` } as React.CSSProperties}
        aria-hidden
      >
        {refreshing
          ? <Loader2 size={24} className="ptr-spin" />
          : <RefreshCw size={24} style={{ transform: `rotate(${pullDistance * 2}deg)` }} />
        }
      </div>
      <div className="balance-header">
        <button
          type="button"
          className={`header-btn${activationView ? ' header-btn--active' : ''}`}
          onClick={() => { setActivationView(v => !v); setActiveCard(null); }}
          aria-label="Manage activation"
        >
          <Power size={17} />
        </button>

        <div className="balance-pill">
          {fmtVND(displayedTotal)}
        </div>

        <button
          type="button"
          className="header-btn"
          onClick={openAddModal}
          aria-label="Add account"
        >
          <Plus size={17} />
        </button>
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

        <div className="account-multiselect-wrapper">
          <button
            type="button"
            className={`account-select account-multiselect-btn${filteredTypes.length > 0 ? ' account-multiselect-btn--active' : ''}`}
            onClick={() => setTypeDropdownOpen(v => !v)}
          >
            {filteredTypes.length === 0 ? 'Type' : filteredTypes.length === 1 ? filteredTypes[0] : `${filteredTypes.length} types`}
          </button>
          {typeDropdownOpen && (
            <>
              <div className="account-multiselect-backdrop" onClick={() => setTypeDropdownOpen(false)} />
              <div className="account-multiselect-dropdown">
                {displayedTypes.map(type => (
                  <label key={type} className="account-multiselect-option">
                    <input
                      type="checkbox"
                      checked={filteredTypes.includes(type)}
                      onChange={() => toggleType(type)}
                    />
                    <span>{type}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <select className="account-select"
          title="sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as "relevance" | "balance" | "type")}
        >
          <option value="relevance">Relevance</option>
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

      {accountsLoading ? (
        <div className="accounts-loading">
          <div className="circle-loading" />
        </div>
      ) : (
      <div className="account-list">
        {displayedAccounts.filter(account => {
          return filteredTypes.length === 0 || filteredTypes.includes(account.type);
        }).sort((a, b) => {
          if (sort === 'relevance') {
            return b.priorityScore - a.priorityScore;
          } else if (sort === 'balance') {
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
              className={`account-card${activationView ? (togglingId === account.id ? ' account-card--loading' : account.active ? ' account-card--on' : ' account-card--off') : ''}`}
              onClick={() => activationView ? handleToggleActivation(account) : toggleCard(account.id)}
              ref={(el) => {cardRefs.current[account.id] = el}}
            >
              <div className="account-info">
                <div className="account-title">
                  <span className="account-name">{account.name}</span>
                  <span className={`account-type ${account2Class[account.type]}`}>{account.type}</span>
                </div>

                <div className="account-balance">
                  {fmtVND(account.balance)}
                </div>
              </div>

              {!activationView && activeCard === account.id && (
                <div
                  className="actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    title="Expense"
                    aria-label="Expense"
                    className="action-btn expense"
                    onClick={() => navigate(`/expense/${account.id}`, { state: { account }, replace: true })}
                  >
                    <ArrowDownRight size={18}/>
                  </button>

                  <button
                    aria-label="Income"
                    className="action-btn income"
                    onClick={() => navigate(`/income/${account.id}`, { state: { account }, replace: true })}
                  >
                    <ArrowUpRight size={18}/>
                  </button>

                  <button
                    aria-label="Transfer"
                    className="action-btn transfer"
                    onClick={() => navigate(`/transfer/${account.id}`, { state: { account }, replace: true })}
                  >
                    <ArrowLeftRight size={18}/>
                  </button>

                  <button
                    aria-label="Adjustment"
                    className="action-btn adjustment"
                    onClick={() => navigate(`/adjustment/${account.id}`, { state: { account }, replace: true })}
                  >
                    <Pencil size={18}/>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">New Account</h2>

            <form onSubmit={handleAddAccount} className="modal-form">
              <div className="modal-field">
                <label className="modal-label">Name</label>
                <input
                  className={`modal-input${addError && !addName.trim() ? ' input-error' : ''}`}
                  type="text"
                  placeholder="e.g. Techcombank"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label className="modal-label">Type</label>
                <select
                  className="modal-select"
                  title="Account type"
                  value={addType}
                  onChange={e => setAddType(e.target.value as AccountType)}
                >
                  {(ACCOUNT_TYPES).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="modal-field">
                <label className="modal-label">Note <span className="modal-label-optional">(optional)</span></label>
                <textarea
                  className="modal-textarea"
                  placeholder="Any notes…"
                  rows={2}
                  value={addNote}
                  onChange={e => setAddNote(e.target.value)}
                />
              </div>

              {addError && <p className="modal-error">{addError}</p>}

              <div className="modal-actions">
                <button type="button" className="modal-btn modal-btn--cancel" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="modal-btn modal-btn--submit" disabled={addSubmitting}>
                  {addSubmitting ? <Loader2 size={16} className="ptr-spin" /> : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
