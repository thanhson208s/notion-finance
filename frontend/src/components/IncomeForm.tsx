import type { Category } from '../App'
import { useEffect, useState } from 'react'

type LogIncomeResponse = {
  accountId: string,
  oldBalance: number,
  newBalance: number,
  amount: number,
  categoryId: string,
  note: string
}

type LogIncomeError = {
  code: string,
  message: string
}

type LogExpenseStatus = {
  status: 'success',
  data: LogIncomeResponse
} | {
  status: 'error',
  data: LogIncomeError
} | { status: 'idle' } | { status: 'loading' };

export default function IncomeForm({accountId}: {
  accountId: string
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
          "https://finance.gootube.online/api/categories?" + new URLSearchParams({
            type: "Income"
          }).toString(),
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
    let errorAmount = false
    if (!amount || amount <= 0) {
      errorAmount = true;
    }

    let errorCategoryId = false;
    if (!categoryId || categoryId === "") {
      errorCategoryId = true;
    }

    setErrors({
      amount: errorAmount,
      categoryId: errorCategoryId
    });

    if (!errorAmount && !errorCategoryId) {
      setStatus({status: 'loading'});
      try {
        const response = await fetch("https://finance.gootube.online/api/income", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            accountId, amount, categoryId, note
          })
        });

        if (!response.ok) {
          setStatus({status: 'error', data: await response.json() as LogIncomeError})
          return;
        }

        setStatus({status: 'success', data: await response.json() as LogIncomeResponse});
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
          className='form-btn retry-btn'
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
          className='form-btn retry-btn'
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
      <div className="form-row">
        <label>Amount</label>
        <input
          type = "text"
          value = {amount.toLocaleString('vi-VN', {
            style: 'currency', currency: 'VND'
          })}
          onChange={(e) => setAmount(parseInt(e.target.value.replace(/[^\d]/g, "")))}
          onKeyDown={(e) => {if (e.code === 'Backspace') setAmount(Math.floor(amount / 10))}}
          placeholder='0'
          className={`${errors.amount ? 'input-error' : ''}`}
        />
      </div>

      <div className="form-row">
        <label>Category</label>
        <select
          title="Category"
          value={categories.find(category => category.id === categoryId)?.name ?? ""}
          onChange={(e) => setCategoryId(e.target.value)}
          className={`${errors.categoryId ? 'input-error' : ''}`}
        >
          <option value="">None</option>
          {categories.filter(category => category.parentId === null).map(category => {
            const subCategories = categories.filter(sub => sub.parentId === category.id);
            if (subCategories.length > 0) {
              subCategories.push({
                id: category.id,
                name: category.name,
                type: category.type,
                parentId: category.id
              } satisfies Category);
              return (<optgroup label={category.name}>
                {subCategories.map(sub => {return(
                  <option value={sub.id}>{sub.name}</option>
                )})}
              </optgroup>);
            } else {
              return (<option value={category.id}>{category.name}</option>);
            }
          })}
        </select>
      </div>

      <div className="form-row">
        <textarea 
          rows={3}
          value = {note}
          onChange={(e) => setNote(e.target.value)}
          placeholder='Note...'
        />
      </div>

      <div className="form-buttons">
        <button
          type="button"
          className='form-btn submit-btn'
          onClick={submit}
        >
          Submit
        </button>
      </div>
    </form>
  )
}