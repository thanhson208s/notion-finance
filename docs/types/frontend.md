# Types — Frontend

All types are in `frontend/src/`. This doc summarizes semantics — read the source for exact shapes.

## Shared Types (`App.ts`)

`AccountType` — simplified 8-value subset of the backend enum: Cash, Bank, Credit, eWallet, Savings, PayLater, Prepaid, Gold. (Debt, Crypto, Loan, Fund, Bond, Stock are omitted — not displayed in the UI.)

`Account` and `Category` / `CategoryType` — same shapes as backend.

## Account Metadata (`AccountsPage.tsx`)

Three `Record<AccountType, ...>` lookup maps used when rendering account cards:

| Map | Type | Purpose |
|---|---|---|
| `account2Class` | `Record<AccountType, string>` | CSS class for the type badge, e.g. `"account-bank"` |
| `type2Priority` | `Record<AccountType, number>` | Display sort order — Cash (0) first, Gold (7) last |
| `type2Group` | `Record<AccountType, "asset" \| "liability">` | Asset/liability classification — Cash, Bank, eWallet, Savings, Prepaid, Gold → asset; Credit, PayLater → liability |
