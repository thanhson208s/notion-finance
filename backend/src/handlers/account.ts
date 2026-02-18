import { GetAccountsResponse } from '../types/response'
import { ok } from '../utils/helper'
import { RouteHandler } from '../utils/router'

export const getAccounts: RouteHandler<undefined, GetAccountsResponse> = async(event, connector) => {
  return ok({
    accounts: [],
    total: 0,
    totalOfAssets:0,
    totalOfLiabilities: 0
  } satisfies GetAccountsResponse);
}