import { LogExpenseRequest } from "../types/request";
import { LogExpenseResponse } from "../types/response";
import { ok } from "../utils/composer";
import { RouteHandler } from "../utils/router";

export const logExpense: RouteHandler<LogExpenseRequest, LogExpenseResponse> = async(event) => {
  return ok({
    oldBalance: 0,
    newBalance: 0,
    amount: 0
  } satisfies LogExpenseResponse);
}