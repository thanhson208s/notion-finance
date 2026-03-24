import { ok } from '../_lib/helper'
import { RouteHandler } from '../_lib/router'
import { GetStatementsResponse, AddStatementResponse, DeleteResponse } from '../_lib/types/response'
import { AddStatementRequest } from '../_lib/types/request'
import { QueryError } from '../_lib/types/error'

export const getStatements: RouteHandler<undefined, GetStatementsResponse> = async (event, connector) => {
  const cardId = event.query['cardId'] ?? undefined
  const statements = await connector.fetchStatements(cardId)
  return ok({ statements } satisfies GetStatementsResponse)
}

export const addStatement: RouteHandler<AddStatementRequest, AddStatementResponse> = async (event, connector) => {
  const req = event.body
  if (!req.cardId) throw new QueryError('cardId is required')
  if (!req.billingDate) throw new QueryError('billingMonth is required')
  if (req.spending == null || req.spending < 0) throw new QueryError('spending must be non-negative')
  if (req.cashback == null || req.cashback < 0) throw new QueryError('cashback must be non-negative')
  const statement = await connector.addStatement(req)
  return ok(statement satisfies AddStatementResponse)
}

export const deleteStatement: RouteHandler<undefined, DeleteResponse> = async (event, connector) => {
  const id = event.query['id']
  if (!id) throw new QueryError('id is required')
  await connector.deleteStatement(id)
  return ok({ id } satisfies DeleteResponse)
}
