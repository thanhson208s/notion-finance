import { LogExpenseRequest, LogIncomeRequest, TransferBalanceRequest } from "../types/request";
import { ListIncomesResponse, LogIncomeResponse, ListExpensesResponse, LogExpenseResponse, TransferBalanceResponse } from "../types/response";
import { getQueryString, ok } from "../utils/helper";
import { RouteHandler } from "../utils/router";

export const logExpense: RouteHandler<LogExpenseRequest, LogExpenseResponse> = async(event, connector) => {
  const req = event.body;
  const oldBalance = (await connector.fetchAccount(req.accountId)).balance;
  const amount = (await connector.addExpense(req.accountId, req.amount, req.categoryId, req.note)).amount;
  const newBalance = (await connector.updateAccountBalance(req.accountId, oldBalance - amount)).balance;

  return ok({
    accountId: req.accountId,
    oldBalance,
    newBalance,
    amount,
    categoryId: req.categoryId,
    note: req.note
  } satisfies LogExpenseResponse);
}

export const listExpenses: RouteHandler<undefined, ListExpensesResponse> = async(event, connector) => {
  const startDate = getQueryString(event.query, "startDate", true);
  const endDate = getQueryString(event.query, "endDate", true);

  return ok({
    transactions: [],
    total: 0
  } satisfies ListExpensesResponse);
}

export const logIncome: RouteHandler<LogIncomeRequest, LogIncomeResponse> = async(event, connector) => {
  const req = event.body;
  const oldBalance = (await connector.fetchAccount(req.accountId)).balance;
  const amount = (await connector.addIncome(req.accountId, req.amount, req.categoryId, req.note)).amount;
  const newBalance = (await connector.updateAccountBalance(req.accountId, oldBalance + amount)).balance;

  return ok({
    accountId: req.accountId,
    oldBalance,
    newBalance,
    amount,
    categoryId: req.categoryId,
    note: req.note
  } satisfies LogIncomeResponse);
}

export const listIncomes: RouteHandler<undefined, ListIncomesResponse> = async(event, connector) => {
  const startDate = getQueryString(event.query, "startDate", true);
  const endDate = getQueryString(event.query, "endDate", true);

  return ok({
    transactions: [],
    total: 0
  } satisfies ListIncomesResponse);
}

export const transferBalance: RouteHandler<TransferBalanceRequest, TransferBalanceResponse> = async(event, connector) => {
  const req = event.body;
  const oldFromAccountBalance = (await connector.fetchAccount(req.fromAccountId)).balance;
  const oldToAccountBalance = (await connector.fetchAccount(req.toAccountId)).balance;
  const amount = (await connector.addTransfer(req.fromAccountId, req.toAccountId, req.amount)).amount;
  const newFromAccountBalance = (await connector.updateAccountBalance(req.fromAccountId, oldFromAccountBalance - req.amount)).balance;
  const newToAccountBalance = (await connector.updateAccountBalance(req.toAccountId, oldToAccountBalance + req.amount)).balance;
  
  return ok({
    fromAccountId: req.fromAccountId,
    toAccountId: req.toAccountId,
    oldFromAccountBalance,
    newFromAccountBalance,
    oldToAccountBalance,
    newToAccountBalance,
    amount
  } satisfies TransferBalanceResponse);
}