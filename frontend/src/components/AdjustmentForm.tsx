import { useState } from 'react'
import { Hash } from 'lucide-react'

type AdjustmentResponse = {
  accountId: string,
  oldBalance: number,
  newBalance: number,
  delta: number,
  note: string
}

type AdjustmentError = {
  code: string,
  message: string
}

type AdjustmentStatus = {
  status: 'success',
  data: AdjustmentResponse
} | {
  status: 'error',
  data: AdjustmentError
} | { status: 'idle' } | { status: 'loading' }

export default function AdjustmentForm({accountId}: {
  accountId: string
}) {
  const [ status, setStatus] = useState<AdjustmentStatus>({status: 'idle'});
  const [ balance, setBalance ] = useState<number>(0);
  const [ note, setNote ] = useState<string>("");
  const [ error, setError ] = useState<boolean>(false);

  const submit = async() => {
    if (balance && balance > 0) {
      setError(false);
      setStatus({status: 'loading'});
      try {
        const response = await fetch("https://finance.gootube.online/api/adjustment", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            accountId, balance, note
          })
        });

        if (!response.ok) {
          setStatus({status: 'error', data: await response.json() as AdjustmentError})
          return;
        }

        setStatus({status: 'success', data: await response.json() as AdjustmentResponse});
      } catch(e) {
        if (e instanceof Error)
          console.log(e.message);
        setStatus({status: 'idle'});
      }
    } else setError(true);
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
            setBalance(0);
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
            setBalance(0);
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
        <Hash size={24}/>
        <input
          type = "text"
          value = {balance.toLocaleString('vi-VN', {
            style: 'currency', currency: 'VND'
          })}
          onChange={() => {}}
          onKeyDown={(e) => {
            if (e.code === 'Backspace') setBalance(Math.floor(balance / 10))
            else if (e.code.match(/^Digit[0-9]$/g))
              setBalance(balance * 10 + parseInt(e.code.slice(-1)))
          }}
          placeholder='0'
          inputMode="numeric"
          className={`${error ? 'input-error' : ''}`}
        />
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