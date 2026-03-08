import type { Category, CardSummary, AccountType } from '../App'
import { API_BASE } from '../App'
import { useEffect, useState } from 'react'
import { TrendingDown } from 'lucide-react'

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

type LogExpenseResponse = {
  accountId: string,
  oldBalance: number,
  newBalance: number,
  amount: number,
  categoryId: string,
  note: string
}

type LogExpenseError = {
  code: string,
  message: string
}

type LogExpenseStatus = {
  status: 'success',
  data: LogExpenseResponse
} | {
  status: 'error',
  data: LogExpenseError
} | { status: 'idle' } | { status: 'loading' };

export default function ExpenseForm({accountId, cards, accountType, onSuccess}: {
  accountId: string
  cards: CardSummary[]
  accountType?: AccountType
  onSuccess?: (newBalance: number) => void
}) {
  const [ status, setStatus ] = useState<LogExpenseStatus>({status: 'idle'});
  const [ categories, setCategories ] = useState<Category[]>([]);
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

  useEffect(() => {
    const controller = new AbortController();

    (async() => {
      try {
        const response = await fetch(
          `${API_BASE}/categories?` + new URLSearchParams({ type: "Expense" }).toString(),
          { signal: controller.signal }
        );

        if (!response.ok)
          throw new Error("Failed to fetch accounts");

        const data: {categories: Category[]} = await response.json();
        setCategories(data.categories);
      } catch(e) {
        if (e instanceof Error)
          console.log(e.message);
        setCategories([]);
      }
    })();

    return () => {
      controller.abort();
    };
  }, []);

  const submit = async () => {
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
        const response = await fetch(`${API_BASE}/expense`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            accountId, amount, categoryId, note, linkedCardId: selectedCardId
          })
        });

        if (!response.ok) {
          setStatus({status: 'error', data: await response.json() as LogExpenseError})
          return;
        }

        const data = await response.json() as LogExpenseResponse;
        setStatus({status: 'success', data});
        onSuccess?.(data.newBalance);
      } catch(e) {
        if (e instanceof Error)
          console.log(e.message);
        setStatus({status: 'idle'});
      }
    }
  }

  if (status.status === 'loading') {
    return (
      <div className='submit-state'>
        <div className='circle-loading'></div>
      </div>
    )
  }

  if (status.status === 'success') {
    return (
      <div className='submit-state'>
        <div className='circle-state circle-success'>✓</div>

        <button
          className='form-btn log-again-btn'
          onClick={() => {
            setStatus({status: "idle"});
            setAmount(0);
            setCategoryId("");
            setNote("");
            setCardIndex(accountType === 'Credit' && cards.length > 0 ? 0 : -1);
          }}
        >
          Log again
        </button>
      </div>
    )
  }

  if (status.status === 'error') {
    return (
      <div className='submit-state'>
        <div className='circle-state circle-error'>✕</div>

        <button
          className='form-btn try-again-btn'
          onClick={() => {
            setStatus({status: "idle"});
            setAmount(0);
            setCategoryId("");
            setNote("");
            setCardIndex(accountType === 'Credit' && cards.length > 0 ? 0 : -1);
          }}
        >
          Try again
        </button>
      </div>
    )
  }

  const prevIndex = cardIndex === -1 ? cards.length - 1 : cardIndex - 1
  const nextIndex = cardIndex === cards.length - 1 ? -1 : cardIndex + 1

  return (
    <form className="form-main">
      <div className="amount-display">
        <input
          type="text"
          value={amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
          onChange={() => {}}
          onKeyDown={(e) => {
            if (e.code === 'Backspace') { setAmount(Math.floor(amount / 10)); setErrors(p => ({...p, amount: false})) }
            else if (e.code.match(/^Digit[0-9]$/g)) { setAmount(amount * 10 + parseInt(e.code.slice(-1))); setErrors(p => ({...p, amount: false})) }
          }}
          placeholder='0 ₫'
          inputMode="numeric"
          className={`amount-input-big${errors.amount ? ' amount-error' : ''}`}
        />
      </div>

      <div className="category-display">
        <select
          title="Category"
          value={categories.find(category => category.id === categoryId)?.id ?? ""}
          onChange={(e) => { setCategoryId(e.target.value); setErrors(p => ({...p, categoryId: false})) }}
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
        <textarea className="form-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder='Note...'
        />
      </div>

      <div className="card-select-section">
        <div className="card-mini" onClick={() => cards.length > 0 && accountType !== 'Credit' && setCardIndex(prevIndex)}>
          {cards.length > 0 && accountType !== 'Credit' && (prevIndex < 0 ? <EmptyCard /> : <img src={cards[prevIndex].imageUrl} alt={cards[prevIndex].name} className="card-img" />)}
        </div>
        <div className="card-main">
          <div className="card-slot">
            {cardIndex < 0 ? <EmptyCard /> : <img src={cards[cardIndex].imageUrl} alt={cards[cardIndex].name} className="card-img" />}
          </div>
          <span className="card-name-label">{cardIndex < 0 ? 'None' : cards[cardIndex].name}</span>
        </div>
        <div className="card-mini" onClick={() => cards.length > 0 && accountType !== 'Credit' && setCardIndex(nextIndex)}>
          {cards.length > 0 && accountType !== 'Credit' && (nextIndex < 0 ? <EmptyCard /> : <img src={cards[nextIndex].imageUrl} alt={cards[nextIndex].name} className="card-img" />)}
        </div>
      </div>

      <div className="form-buttons">
        <button type="button" className="form-btn submit-btn-expense" onClick={submit}>
          <TrendingDown size={24} />
          <span>Expense</span>
        </button>
      </div>
    </form>
  )
}