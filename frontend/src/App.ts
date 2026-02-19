import { createContext, useContext } from 'react';

export type AccountType = "Cash" | "Bank" | "Credit" | "eWallet" | "Savings" | "PayLater" | "Prepaid"

export type Account = {
  id: string
  name: string
  type: AccountType
  balance: number
}

export type AppState = {
  accounts: Account[]
}

export type AppAction =
  | { type: "update", accounts: Account[] }
  | { type: "expense", id: string, amount: number }
  | { type: "income", id: string, amount: number };

export const AppContext = createContext<{
  state: AppState,
  dispatch: React.Dispatch<AppAction>
} | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context)
    throw new Error("useApp must be inside AppProvider");
  return context;
}