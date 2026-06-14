import { getQueryString, ok } from '../_lib/helper'
import { RouteHandler } from '../_lib/router'
import { GetPromotionsResponse, AddPromotionResponse, DeleteResponse, UpdatePromotionResponse } from '../_lib/types/response'
import { AddPromotionRequest, UpdatePromotionRequest } from '../_lib/types/request'
import { QueryError } from '../_lib/types/error'

export const getPromotions: RouteHandler<undefined, GetPromotionsResponse> = async (event, connector) => {
  const cardId = event.query['cardId'] ?? undefined
  const promotions = await connector.fetchPromotions(cardId)
  return ok({ promotions } satisfies GetPromotionsResponse)
}

export const addPromotion: RouteHandler<AddPromotionRequest, AddPromotionResponse> = async (event, connector) => {
  const req = event.body
  if (!req.name) throw new QueryError('name is required')
  if (!['Cashback', 'Discount'].includes(req.type))
    throw new QueryError('type must be Cashback or Discount')
  const promotion = await connector.addPromotion(req)
  return ok(promotion satisfies AddPromotionResponse)
}

export const updatePromotion: RouteHandler<UpdatePromotionRequest, UpdatePromotionResponse> = async (event, connector) => {
  const id = getQueryString(event.query, 'id', true)
  const req = event.body
  if (!['Cashback', 'Discount'].includes(req.type))
    throw new QueryError('type must be Cashback or Discount')
  const promotion = await connector.updatePromotion(id, req)
  return ok(promotion satisfies UpdatePromotionResponse)
}

export const deletePromotion: RouteHandler<undefined, DeleteResponse> = async (event, connector) => {
  const id = event.query['id']
  if (!id) throw new QueryError('id is required')
  await connector.deletePromotion(id)
  return ok({ id } satisfies DeleteResponse)
}
