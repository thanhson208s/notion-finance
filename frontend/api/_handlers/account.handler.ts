import { isAssetType, type AccountType } from '../_lib/types/account.type';
import { AdjustBalanceRequest, SetAccountActiveRequest, CreateAccountRequest } from '../_lib/types/request';
import { AdjustBalanceResponse, GetAccountsResponse, SetAccountActiveResponse, CreateAccountResponse } from '../_lib/types/response'
import { ok } from '../_lib/helper'
import { RouteHandler } from '../_lib/router'

export const getAccounts: RouteHandler<undefined, GetAccountsResponse> = async(_event, connector) => {
  const accounts = await connector.fetchAllAccounts();
  const total = accounts.reduce((cur, next) => cur + next.balance, 0);
  const totalOfAssets = accounts.filter(account => isAssetType(account.type)).reduce((cur, next) => cur + next.balance, 0);
  const totalOfLiabilities = accounts.filter(account => !isAssetType(account.type)).reduce((cur, next) => cur + next.balance, 0);

  return ok({
    accounts,
    total,
    totalOfAssets,
    totalOfLiabilities
  } satisfies GetAccountsResponse);
}

export const setAccountActive: RouteHandler<SetAccountActiveRequest, SetAccountActiveResponse> = async(event, connector) => {
  const req = event.body;
  const account = await connector.updateAccountActive(req.accountId, req.active);
  return ok({
    accountId: account.id,
    active: account.active
  } satisfies SetAccountActiveResponse);
}

export const createAccount: RouteHandler<CreateAccountRequest, CreateAccountResponse> = async(event, connector) => {
  const req = event.body;
  const account = await connector.createAccount(req.name, req.type as AccountType, req.note ?? "");
  return ok(account satisfies CreateAccountResponse);
}

export const adjustBalance: RouteHandler<AdjustBalanceRequest, AdjustBalanceResponse> = async(event, connector) => {
  const req = event.body;
  const oldBalance = (await connector.fetchAccount(req.accountId)).balance;
  const delta = (await connector.addTransaction(
    oldBalance > req.balance ? req.accountId : null,
    oldBalance < req.balance ? req.accountId : null,
    Math.abs(oldBalance - req.balance),
    process.env.NOTION_ADJUSTMENT_TRANSACTION_ID as string,
    req.note,
    req.timestamp
  )).amount;
  const newBalance = (await connector.updateAccountBalance(req.accountId, req.balance)).balance;

  return ok({
    accountId: req.accountId,
    oldBalance,
    newBalance,
    delta,
    note: req.note
  } satisfies AdjustBalanceResponse);
}
