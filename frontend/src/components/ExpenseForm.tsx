import type { Category } from '../App'
import { API_BASE } from '../App'
import { useEffect, useState } from 'react'
import { TrendingDown } from 'lucide-react'

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

export default function ExpenseForm({accountId, onSuccess}: {
  accountId: string
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
      try {
        const response = await fetch(`${API_BASE}/expense`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            accountId, amount, categoryId, note
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
          }}
        >
          Try again
        </button>
      </div>
    )
  }

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
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder='Note...'
        />
      </div>

      <div className="form-buttons">
        <button type="button" className="form-btn submit-btn-expense" onClick={submit}>
          <TrendingDown size={20} /> Expense
        </button>
      </div>
    </form>
  )
}