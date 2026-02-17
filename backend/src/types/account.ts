import { Currency } from "./common";

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
  name: string
  type: AccountType
  currency: Currency
  balance: number
  linkedCards: string[]
  isLiability: boolean
}