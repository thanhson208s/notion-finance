import { GetAccountsResponse } from '../types/response'
import { ok } from '../utils/composer'
import { RouteHandler } from '../utils/router'

export const getAccounts: RouteHandler<undefined, GetAccountsResponse> = async(event) => {
  return ok({
    accounts: [],
    total: 0,
    totalOfAssets:0,
    totalOfLiabilities: 0
  } satisfies GetAccountsResponse);
}