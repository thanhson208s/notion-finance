import { ok } from '../_lib/helper'
import { RouteHandler } from '../_lib/router'
import { GetStatementsResponse, AddStatementResponse, DeleteResponse, PreviewStatementResponse } from '../_lib/types/response'
import { AddStatementRequest } from '../_lib/types/request'
import { QueryError } from '../_lib/types/error'

export const getStatements: RouteHandler<undefined, GetStatementsResponse> = async (event, connector) => {
  const cardId = event.query['cardId'] ?? undefined
  const statements = await connector.fetchStatements(cardId)
  return ok({ statements } satisfies GetStatementsResponse)
}

export const previewStatement: RouteHandler<undefined, PreviewStatementResponse> = async (event, connector) => {
  const cardId = event.query['cardId']
  const startDateRaw = event.query['startDate']
  const endDateRaw = event.query['endDate']
  if (!cardId) throw new QueryError('cardId is required')
  if (!startDateRaw) throw new QueryError('startDate is required')
  if (!endDateRaw) throw new QueryError('endDate is required')
  const startDate = Number(startDateRaw)
  const endDate = Number(endDateRaw)
  if (isNaN(startDate) || isNaN(endDate)) throw new QueryError('startDate and endDate must be numbers')
  if (startDate >= endDate) throw new QueryError('startDate must be before endDate')
  const result = await connector.previewStatement(cardId, startDate, endDate)
  return ok(result satisfies PreviewStatementResponse)
}

export const addStatement: RouteHandler<AddStatementRequest, AddStatementResponse> = async (event, connector) => {
  const req = event.body
  if (!req.cardId) throw new QueryError('cardId is required')
  if (!req.startDate) throw new QueryError('startDate is required')
  if (!req.endDate) throw new QueryError('endDate is required')
  if (req.startDate >= req.endDate) throw new QueryError('startDate must be before endDate')
  const statement = await connector.addStatement(req)
  return ok(statement satisfies AddStatementResponse)
}

export const deleteStatement: RouteHandler<undefined, DeleteResponse> = async (event, connector) => {
  const id = event.query['id']
  if (!id) throw new QueryError('id is required')
  await connector.deleteStatement(id)
  return ok({ id } satisfies DeleteResponse)
}
