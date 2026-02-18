import { LogExpenseRequest, TransferBalanceRequest } from "../types/request";
import { ListExpensesResponse, LogExpenseResponse, TransferBalanceResponse } from "../types/response";
import { ok } from "../utils/helper";
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
  return ok({
    transactions: [],
    total: 0
  } satisfies ListExpensesResponse);
}

export const transferBalance: RouteHandler<TransferBalanceRequest, TransferBalanceResponse> = async(event) => {
  return ok({});
}