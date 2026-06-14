export type PromotionCategory = 'Shopping' | 'F&B' | 'Travel' | 'Entertain' | 'Digital'
export type PromotionType = 'Discount' | 'Cashback'

export type Promotion = {
  id: string
  name: string
  cardId: string | null
  category: PromotionCategory | null
  type: PromotionType
  expiresAt: number | null
  link: string | null
}
