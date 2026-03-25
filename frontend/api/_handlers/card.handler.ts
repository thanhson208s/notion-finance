import { getBillingCycleDates, toISODateStr, ok } from '../_lib/helper'
import { RouteHandler } from '../_lib/router'
import { GetCardsResponse, GetCardDetailResponse } from '../_lib/types/response'
import { QueryError } from '../_lib/types/error'

export const getCards: RouteHandler<undefined, GetCardsResponse> = async (_event, connector) => {
  const cards = await connector.fetchAllCards()
  return ok({ cards } satisfies GetCardsResponse)
}

export const getCardDetail: RouteHandler<undefined, GetCardDetailResponse> = async (event, connector) => {
  const cardId = event.query['id']
  if (!cardId) throw new QueryError('id is required')

  const card = await connector.fetchCardById(cardId)

  if (card.billingDay === null) {
    return ok({ ...card, cycleStart: null, cycleEnd: null, currentCycleSpending: 0, currentCycleCashback: 0, currentCycleDiscount: 0 } satisfies GetCardDetailResponse)
  }

  const { start, end } = getBillingCycleDates(card.billingDay)
  const cycleStart = toISODateStr(start)
  const cycleEnd = toISODateStr(end)

  const transactions = (await connector.fetchTransactionsByCard(cardId, `${cycleStart}T00:00:00+07:00`, `${cycleEnd}T23:59:59+07:00`))
    .filter(t => t.fromAccountId !== undefined && t.toAccountId === undefined && t.categoryId !== process.env.NOTION_ADJUSTMENT_TRANSACTION_ID)

  const currentCycleSpending = transactions.reduce((sum, t) => sum + t.amount, 0)
  const currentCycleCashback = transactions.reduce((sum, t) => sum + (t.cashback ?? 0), 0)
  const currentCycleDiscount = transactions.reduce((sum, t) => sum + (t.discount ?? 0), 0)

  return ok({
    ...card,
    cycleStart,
    cycleEnd,
    currentCycleSpending,
    currentCycleCashback,
    currentCycleDiscount
  } satisfies GetCardDetailResponse)
}
