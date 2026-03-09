import { LogExpenseRequest, LogIncomeRequest, TransferBalanceRequest } from "../_lib/types/request";
import { ListIncomesResponse, LogIncomeResponse, ListExpensesResponse, LogExpenseResponse, TransferBalanceResponse } from "../_lib/types/response";
import { QueryError } from "../_lib/types/error";
import { getQueryString, ok } from "../_lib/helper";
import { RouteHandler } from "../_lib/router";

export const logExpense: RouteHandler<LogExpenseRequest, LogExpenseResponse> = async(event, connector) => {
  const req = event.body;
  if (req.amount <= 0) throw new QueryError("Amount must be a positive number");
  const oldAccount = await connector.fetchAccount(req.accountId);
  await connector.fetchCategory(req.categoryId);
  const amount = (await connector.addExpense(req.accountId, req.amount, req.categoryId, req.note, req.timestamp, req.linkedCardId)).amount;
  const newAccount = await connector.updateAccountAfterTransaction(
    req.accountId,
    oldAccount.balance - amount,
    (oldAccount.totalTransactions ?? 0) + 1,
    req.timestamp ?? Date.now()
  );

  return ok({
    accountId: req.accountId,
    oldBalance: oldAccount.balance,
    newBalance: newAccount.balance,
    amount,
    categoryId: req.categoryId,
    note: req.note
  } satisfies LogExpenseResponse);
}

export const listExpenses: RouteHandler<undefined, ListExpensesResponse> = async(event, connector) => {
  const startDate = getQueryString(event.query, "startDate", false) ?? undefined;
  const endDate = getQueryString(event.query, "endDate", false) ?? undefined;
  const transactions = await connector.fetchTransactions('expense', startDate, endDate);
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  return ok({ transactions, total } satisfies ListExpensesResponse);
}

export const logIncome: RouteHandler<LogIncomeRequest, LogIncomeResponse> = async(event, connector) => {
  const req = event.body;
  if (req.amount <= 0) throw new QueryError("Amount must be a positive number");
  const oldAccount = await connector.fetchAccount(req.accountId);
  await connector.fetchCategory(req.categoryId);
  const amount = (await connector.addIncome(req.accountId, req.amount, req.categoryId, req.note, req.timestamp, req.linkedCardId)).amount;
  const newAccount = await connector.updateAccountAfterTransaction(
    req.accountId,
    oldAccount.balance + amount,
    (oldAccount.totalTransactions ?? 0) + 1,
    req.timestamp ?? Date.now()
  );

  return ok({
    accountId: req.accountId,
    oldBalance: oldAccount.balance,
    newBalance: newAccount.balance,
    amount,
    categoryId: req.categoryId,
    note: req.note
  } satisfies LogIncomeResponse);
}

export const listIncomes: RouteHandler<undefined, ListIncomesResponse> = async(event, connector) => {
  const startDate = getQueryString(event.query, "startDate", false) ?? undefined;
  const endDate = getQueryString(event.query, "endDate", false) ?? undefined;
  const transactions = await connector.fetchTransactions('income', startDate, endDate);
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  return ok({ transactions, total } satisfies ListIncomesResponse);
}

export const transferBalance: RouteHandler<TransferBalanceRequest, TransferBalanceResponse> = async(event, connector) => {
  const req = event.body;
  if (req.amount <= 0) throw new QueryError("Amount must be a positive number");
  const oldFromAccountBalance = (await connector.fetchAccount(req.fromAccountId)).balance;
  const oldToAccountBalance = (await connector.fetchAccount(req.toAccountId)).balance;
  const amount = (await connector.addTransfer(req.fromAccountId, req.toAccountId, req.amount, req.timestamp)).amount;
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
