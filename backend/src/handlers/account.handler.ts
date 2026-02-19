import { isAssetType } from '../types/account.type';
import { GetAccountsResponse } from '../types/response'
import { ok } from '../utils/helper'
import { RouteHandler } from '../utils/router'

export const getAccounts: RouteHandler<undefined, GetAccountsResponse> = async(event, connector) => {
  const accounts = await connector.fetchAllAccounts();
  let total = accounts.reduce((cur, next) => cur + next.balance, 0);
  let totalOfAssets = accounts.filter(account => isAssetType(account.type)).reduce((cur, next) => cur + next.balance, 0);
  let totalOfLiabilities = accounts.filter(account => !isAssetType(account.type)).reduce((cur, next) => cur + next.balance, 0);

  return ok({
    accounts,
    total,
    totalOfAssets,
    totalOfLiabilities
  } satisfies GetAccountsResponse);
}