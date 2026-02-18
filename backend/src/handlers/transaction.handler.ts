import { LogExpenseRequest, LogIncomeRequest, TransferBalanceRequest } from "../types/request";
import { ListIncomesResponse, LogIncomeResponse, ListExpensesResponse, LogExpenseResponse, TransferBalanceResponse } from "../types/response";
import { getQueryString, ok } from "../utils/helper";
import { RouteHandler } from "../utils/router";

export const logExpense: RouteHandler<LogExpenseRequest, LogExpenseResponse> = async(event) => {
  const req = event.body;

  return ok({
    oldBalance: 0,
    newBalance: 0,
    amount: req.amount
  } satisfies LogExpenseResponse);
}

export const listExpenses: RouteHandler<undefined, ListExpensesResponse> = async(event) => {
  const startDate = getQueryString(event.query, "startDate");
  const endDate = getQueryString(event.query, "endDate");

  return ok({
    transactions: [],
    total: 0
  } satisfies ListExpensesResponse);
}

export const logIncome: RouteHandler<LogIncomeRequest, LogIncomeResponse> = async(event) => {
  const req = event.body;

  return ok({
    oldBalance: 0,
    newBalance: 0,
    amount: req.amount
  } satisfies LogIncomeResponse);
}

export const listIncomes: RouteHandler<undefined, ListIncomesResponse> = async(event) => {
  const startDate = getQueryString(event.query, "startDate");
  const endDate = getQueryString(event.query, "endDate");

  return ok({
    transactions: [],
    total: 0
  } satisfies ListIncomesResponse);
}

export const transferBalance: RouteHandler<TransferBalanceRequest, TransferBalanceResponse> = async(event) => {
  return ok({
    fromAccountId: "",
    toAccountId: ""
  } satisfies TransferBalanceResponse);
}