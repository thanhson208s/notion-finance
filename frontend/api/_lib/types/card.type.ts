export type Card = {
  id: string
  name: string
  number: string
  imageUrl: string
  annualFee: number | null
  spendingLimit: number | null
  requiredSpending: number | null
  lastChargedDate: number | null
  billingDay: number | null
  linkedAccountId: string | null
  linkedServices: string[]
  cashbackCap: number | null
  network: string | null
}

export type CardWithSpending = Card & {
  cycleStart: string | null             // YYYY-MM-DD, null for debit cards
  cycleEnd: string | null               // YYYY-MM-DD, null for debit cards
  currentCycleSpending: number
  currentCycleCashback: number
  currentCycleDiscount: number
}
