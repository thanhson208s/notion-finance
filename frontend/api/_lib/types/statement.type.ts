export type Statement = {
  id: string
  cardId: string
  billingDate: number    // epoch ms — billing cycle end date
  spending: number
  cashback: number
  note: string
}
