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
  active: boolean
  note: string
  totalTransactions: number | null
  lastTransactionDate: number | null
  priorityScore: number
  linkedCardIds: string[]
}

export const PRIORITY_WEIGHT_FREQUENCY = 0.4
export const PRIORITY_WEIGHT_RECENCY = 0.6
export const PRIORITY_DECAY_HALF_LIFE_DAYS = 30

export function computePriorityScore(
  totalTransactions: number | null,
  lastTransactionDate: number | null,
  now = Date.now()
): number {
  const freqScore = Math.log(1 + (totalTransactions ?? 0))
  if (lastTransactionDate === null) return PRIORITY_WEIGHT_FREQUENCY * freqScore
  const daysSince = (now - lastTransactionDate) / 86_400_000
  const recencyScore = Math.pow(0.5, daysSince / PRIORITY_DECAY_HALF_LIFE_DAYS)
  return PRIORITY_WEIGHT_FREQUENCY * freqScore + PRIORITY_WEIGHT_RECENCY * recencyScore
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
