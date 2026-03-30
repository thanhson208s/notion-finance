import type { Category, Card, AccountType } from '../App'
import { API_BASE, fmtVND } from '../App'
import { apiFetch, parseApiResponse } from '../lib/auth'
import { useState } from 'react'
import { toast } from 'sonner'
import { TrendingUp, TrendingDown, Check, X, Loader2 } from 'lucide-react'
import { useApp } from '../contexts/AppContext'

function EmptyCard() {
  return (
    <div className="card-empty">
      <svg width="100%" height="100%" viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="158" height="98" rx="8" ry="8"
          fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="6 4" />
        <line x1="20" y1="20" x2="140" y2="80" stroke="currentColor" strokeWidth="1" />
        <line x1="140" y1="20" x2="20" y2="80" stroke="currentColor" strokeWidth="1" />
      </svg>
    </div>
  )
}

type TransactionResponse = {
  accountId: string,
  oldBalance: number,
  newBalance: number,
  amount: number,
  categoryId: string,
  note: string
}

type TransactionStatus = {
  status: 'success',
  data: TransactionResponse
} | { status: 'error' } | { status: 'idle' } | { status: 'loading' };

export default function TransactionForm({accountId, cards, accountType, type, onSuccess, timestamp}: {
  accountId: string
  cards: Card[]
  accountType?: AccountType
  type: 'Income' | 'Expense'
  onSuccess?: (newBalance: number) => void
  timestamp?: number
}) {
  const { categories: allCategories } = useApp();
  const categories = allCategories.filter(c => c.type === type);
  const [ status, setStatus ] = useState<TransactionStatus>({status: 'idle'});
  const [ amount, setAmount ] = useState<number>(0);
  const [ categoryId, setCategoryId ] = useState<string>("");
  const [ note, setNote ] = useState<string>("");
  const [ errors, setErrors ] = useState<{
    amount?: boolean,
    categoryId?: boolean
  }>({});
  const [ cardIndex, setCardIndex ] = useState<number>(() =>
    accountType === 'Credit' && cards.length > 0 ? 0 : -1
  );
  const resetToIdle = () => {
    if (status.status !== 'loading') setStatus({status: 'idle'});
  }

  const submit = async () => {
    if (status.status === 'success' || status.status === 'error') { setStatus({status: 'idle'}); return }
    const errorAmount = !amount || amount <= 0;
    const errorCategoryId = !categoryId || categoryId === "";

    setErrors({
      amount: errorAmount,
      categoryId: errorCategoryId
    });

    if (!errorAmount && !errorCategoryId) {
      setStatus({status: 'loading'});
      const selectedCardId = cardIndex >= 0 ? cards[cardIndex].id : undefined;
      try {
        const response = await apiFetch(`${API_BASE}/transactions?type=${type.toLowerCase()}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            accountId, amount, categoryId, note, linkedCardId: selectedCardId, timestamp
          })
        });

        const data = await parseApiResponse<TransactionResponse>(response, 'Something went wrong')
        setStatus({status: 'success', data});
        onSuccess?.(data.newBalance);
      } catch(e) {
        const msg = e instanceof Error ? e.message : 'Something went wrong'
        toast.error(msg)
        setStatus({status: 'error'});
      }
    }
  }

  const loading = status.status === 'loading';
  const prevIndex = cardIndex === -1 ? cards.length - 1 : cardIndex - 1
  const nextIndex = cardIndex === cards.length - 1 ? -1 : cardIndex + 1
  const Icon = type === 'Income' ? TrendingUp : TrendingDown

  return (
    <form className="form-main">
      <div className="input-amount-area">
        <div className="amount-display">
          <input
            type="text"
            value={fmtVND(amount)}
            onChange={() => {}}
            onKeyDown={(e) => {
              if (loading) return;
              if (e.code === 'Backspace') { setAmount(Math.floor(amount / 10)); setErrors(p => ({...p, amount: false})); resetToIdle(); }
              else if (e.code.match(/^Digit[0-9]$/g)) { setAmount(amount * 10 + parseInt(e.code.slice(-1))); setErrors(p => ({...p, amount: false})); resetToIdle(); }
            }}
            placeholder='0 ₫'
            inputMode="numeric"
            disabled={loading}
            className={`amount-input-big${errors.amount ? ' amount-error' : ''}`}
          />
        </div>
      </div>

      <div className="category-display">
        <select
          title="Category"
          value={categories.find(category => category.id === categoryId)?.id ?? ""}
          onChange={(e) => { setCategoryId(e.target.value); setErrors(p => ({...p, categoryId: false})); resetToIdle(); }}
          disabled={loading}
          className={`category-select-borderless${errors.categoryId ? ' category-error' : ''}`}
        >
          <option value="">— Category —</option>
          {categories.filter(category => category.parentId === null).map(category => {
            const subCategories = categories.filter(sub => sub.parentId === category.id);
            if (subCategories.length > 0) {
              subCategories.push({
                id: category.id,
                name: category.name,
                type: category.type,
                parentId: category.id
              } satisfies Category);
              return (<optgroup label={category.name} key={category.id}>
                {subCategories.map(sub => (<option value={sub.id} key={sub.id}>{sub.name}</option>))}
              </optgroup>);
            } else {
              return (<option value={category.id} key={category.id}>{category.name}</option>);
            }
          })}
        </select>
      </div>

      <div className="form-row">
        <textarea
          rows={3}
          value={note}
          onChange={(e) => { setNote(e.target.value); resetToIdle(); }}
          disabled={loading}
          placeholder='Note...'
        />
      </div>

      <div className={`card-select-section${loading ? ' disabled' : ''}`}>
        <div className="card-mini" onClick={() => { if (cards.length > 0 && accountType !== 'Credit') { setCardIndex(prevIndex); resetToIdle(); } }}>
          {cards.length > 0 && accountType !== 'Credit' && (prevIndex < 0 ? <EmptyCard /> : <img src={cards[prevIndex].imageUrl} alt={cards[prevIndex].name} className="card-img" />)}
        </div>
        <div className="card-main">
          <div className="card-slot">
            {cardIndex < 0 ? <EmptyCard /> : <img src={cards[cardIndex].imageUrl} alt={cards[cardIndex].name} className="card-img" />}
          </div>
          <span className="card-name-label">{cardIndex < 0 ? 'None' : cards[cardIndex].name}</span>
        </div>
        <div className="card-mini" onClick={() => { if (cards.length > 0 && accountType !== 'Credit') { setCardIndex(nextIndex); resetToIdle(); } }}>
          {cards.length > 0 && accountType !== 'Credit' && (nextIndex < 0 ? <EmptyCard /> : <img src={cards[nextIndex].imageUrl} alt={cards[nextIndex].name} className="card-img" />)}
        </div>
      </div>

      <div className="form-buttons">
        <button type="button" className={`form-btn submit-btn-${type.toLowerCase()}`} onClick={submit} disabled={loading}>
          <span key={status.status} className="submit-btn-content">
            {status.status === 'loading' && <Loader2 size={20} className="icon-spin" />}
            {status.status === 'success' && <Check size={20} />}
            {status.status === 'error'   && <X size={20} />}
            {status.status === 'idle'    && <Icon size={20} />}
            <span>
              {status.status === 'loading' ? 'Processing...' :
               status.status === 'success' ? 'Success' :
               status.status === 'error'   ? 'Error' :
               type}
            </span>
          </span>
        </button>
      </div>
    </form>
  )
}
