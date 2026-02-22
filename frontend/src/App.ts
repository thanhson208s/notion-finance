import { createContext, useContext } from 'react';

export type AccountType = "Cash" | "Bank" | "Credit" | "eWallet" | "Savings" | "PayLater" | "Prepaid"

export type Account = {
  id: string
  name: string
  type: AccountType
  balance: number
}

export type CategoryType = 'Income' | 'Expense' | 'Financial'

export type Category = {
  id: string
  name: string
  type: CategoryType
  parentId: string | null
}

export type AppState = {
  accounts: Account[]
}

export type AppAction =
  | { type: "update", accounts: Account[] }
  | { type: "filter", value: 'all' | 'assets' | 'liabilities' };

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