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

  const [card, cardStatements] = await Promise.all([
    connector.fetchCardById(cardId),
    connector.fetchStatements(cardId)
  ])

  if (card.billingDay === null) {
    return ok({ ...card, cycleStart: null, cycleEnd: null, currentCycleSpending: 0, currentCycleCashback: 0 } satisfies GetCardDetailResponse)
  }

  const { start, end } = getBillingCycleDates(card.billingDay)
  const cycleStart = toISODateStr(start)
  const cycleEnd = toISODateStr(end)

  const stmt = cardStatements.find(s => {
    const d = new Date(s.billingDate)
    return d.getFullYear() === end.getFullYear()
      && d.getMonth() === end.getMonth()
      && d.getDate() === end.getDate()
  })

  return ok({
    ...card,
    cycleStart,
    cycleEnd,
    currentCycleSpending: stmt?.spending ?? 0,
    currentCycleCashback: stmt?.cashback ?? 0
  } satisfies GetCardDetailResponse)
}
