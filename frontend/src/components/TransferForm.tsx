import { useState } from 'react'
import type { Account, AccountType } from '../App'
import {BanknoteArrowDown, BanknoteArrowUp, ArrowUpDown, Hash} from 'lucide-react';

type TransferResponse = {
  fromAccountId: string,
  toAccountId: number,
  amount: number,
  oldFromAccountBalance: number,
  newFromAccountBalance: number,
  oldToAccountBalance: number,
  newToAccountBalance: number,
}

type TransferError = {
  code: string,
  message: string
}

type TransferStatus = {
  status: 'success'
  data: TransferResponse
} | {
  status: 'error',
  data: TransferError
} | { status: 'idle' } | { status: 'loading' }

export default function TransferForm({accountId, accounts}: {
  accountId: string,
  accounts: Account[]
}) {
  const [ status, setStatus ] = useState<TransferStatus>({status: "idle"});
  const [ fromAccountId, setFromAccountId ] = useState<string>(accountId);
  const [ toAccountId, setToAccountId ] = useState<string>("");
  const [ amount, setAmount ] = useState<number>(0);
  const [ errors, setErrors ] = useState<{
    amount?: boolean,
    fromAccountId?: boolean,
    toAccountId?: boolean
  }>({});

  const accountTypes: AccountType[] = [];
  accounts.forEach(account => {
    if (!accountTypes.includes(account.type))
      accountTypes.push(account.type);
  });

  const switchFromTo = () => {
    if (accountId === fromAccountId) {
      setFromAccountId(toAccountId);
      setToAccountId(accountId);
    }

    if (accountId === toAccountId) {
      setToAccountId(fromAccountId);
      setFromAccountId(accountId);
    }
  }

  const submit = async() => {
    const errorAmount = !amount || amount <= 0;
    const errorFromAccountId = !fromAccountId || fromAccountId === "";
    const errorToAccountId = !toAccountId || toAccountId === "";

    setErrors({
      amount: errorAmount,
      fromAccountId: errorFromAccountId,
      toAccountId: errorToAccountId
    });

    if (!errorAmount && !errorFromAccountId && !errorToAccountId) {
      setStatus({status: 'loading'});
      try {
        const response = await fetch("https://finance.gootube.online/api/transfer", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount, fromAccountId, toAccountId
          })
        });

        if (!response.ok) {
          setStatus({status: 'error', data: await response.json() as TransferError});
          return;
        }

        setStatus({status: 'success', data: await response.json() as TransferResponse});
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
            setFromAccountId(accountId);
            setToAccountId("");
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
            setFromAccountId("");
            setToAccountId("");
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
        <button
          title="Switch"
          type="button"
          className={`switch-btn ${accountId === fromAccountId ? "" : "rotate-180"}`}
          onClick={switchFromTo}
        >
          <ArrowUpDown/>
        </button>
        <div className="form-col">
          <div className="form-row">
            <BanknoteArrowDown size={20}/>
            <select
              title="From Account"
              disabled={accountId === fromAccountId}
              value={accounts.find(account => account.id === fromAccountId)?.id ?? ""}
              onChange={(e) => setFromAccountId(e.target.value)}
              className={`${errors.fromAccountId ? 'input-error' : ''}`}
            >
              {(accountId === fromAccountId) ? 
              (
                <option value={accountId}>{
                  accounts.find(account => account.id === accountId)?.name
                }</option>
              ) : (<>
                <option value="">None</option>
                {accountTypes.map(accountType => {return (
                  <optgroup label={accountType} key={accountType}>
                    {accounts.filter(account => account.type === accountType && account.id !== toAccountId).map(account => {return (
                      <option value={account.id} key={account.id}>{`${account.name} (${account.balance.toLocaleString('vi-VN', {style: 'currency', currency: 'VND'})})`}</option>
                    )})}
                  </optgroup>
                )})}
              </>)}
            </select>
          </div>
          <div className="form-row">
            <BanknoteArrowUp size={20}/>
            <select
              title="To Account"
              disabled={accountId === toAccountId}
              value={accounts.find(account => account.id === toAccountId)?.id ?? ""}
              onChange={(e) => setToAccountId(e.target.value)}
              className={`${errors.toAccountId ? 'input-error' : ''}`}
            >
              {(accountId === toAccountId) ? 
              (
                <option value={accountId}>{
                  accounts.find(account => account.id === accountId)?.name
                }</option>
              ) : (<>
                <option value="">None</option>
                {accountTypes.map(accountType => {return (
                  <optgroup label={accountType} key={accountType}>
                    {accounts.filter(account => account.type === accountType && account.id !== fromAccountId).map(account => {return (
                      <option value={account.id} key={account.id}>{`${account.name} (${account.balance.toLocaleString('vi-VN', {style: 'currency', currency: 'VND'})})`}</option>
                    )})}
                  </optgroup>
                )})}
              </>)}
            </select>
          </div>
        </div>
      </div>

      <div className="form-row">
        <Hash size={24}/>
        <input
          type = "text"
          value = {amount.toLocaleString('vi-VN', {
            style: 'currency', currency: 'VND'
          })}
          onChange={() => {}}
          onKeyDown={(e) => {
            if (e.code === 'Backspace') setAmount(Math.floor(amount / 10))
            else if (e.code.match(/^Digit[0-9]$/g))
              setAmount(amount * 10 + parseInt(e.code.slice(-1)))
          }}
          placeholder='0'
          inputMode="numeric"
          className={`${errors.amount ? 'input-error' : ''}`}
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