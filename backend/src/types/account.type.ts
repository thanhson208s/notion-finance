export type AccountType =
  | "Cash"
  | "Prepaid"
  | "eWallet"
  | "Bank"
  | "Debt"
  | "Crypto"
  | "Loan"
  | "Savings"
  | "Gold"
  | "Credit"
  | "Fund"
  | "Bond"
  | "Stock"
  | "PayLater";

export type Account = {
  id: string
  name: string
  type: AccountType
  balance: number
}

export function createAccount(id: string, name: string, type: string, balance: number): Account {
  return {
    id,
    name,
    type: type as AccountType,
    balance
  } satisfies Account;
}

export function isAssetType(type: AccountType) {
  return type === "Cash"
    || type === "Prepaid"
    || type === "eWallet"
    || type === "Bank"
    || type === "Loan"
    || type === "Savings"
    || type === "Gold"
    || type === "Fund"
    || type === "Bond"
    || type === "Stock";
}