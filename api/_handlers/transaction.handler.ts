import { LogExpenseRequest, LogIncomeRequest, TransferBalanceRequest, UpdateTransactionRequest } from "../_lib/types/request";
import { ListIncomesResponse, LogIncomeResponse, ListExpensesResponse, LogExpenseResponse, TransferBalanceResponse, GetTransactionResponse, DeleteTransactionResponse, UpdateTransactionResponse, BalanceChange } from "../_lib/types/response";
import { QueryError } from "../_lib/types/error";
import { getQueryString, ok } from "../_lib/helper";
import { RouteHandler } from "../_lib/router";

export const logExpense: RouteHandler<LogExpenseRequest, LogExpenseResponse> = async(event, connector) => {
  const req = event.body;
  if (req.amount <= 0) throw new QueryError("Amount must be a positive number");
  const oldAccount = await connector.fetchAccount(req.accountId);
  await connector.fetchCategory(req.categoryId);
  const transaction = await connector.addExpense(req.accountId, req.amount, req.categoryId, req.note, req.timestamp, req.linkedCardId, req.cashback, req.discount);
  const newAccount = await connector.updateAccountAfterTransaction(
    req.accountId,
    oldAccount.balance - transaction.amount,
    (oldAccount.totalTransactions ?? 0) + 1,
    req.timestamp ?? Date.now()
  );

  return ok({
    transactionId: transaction.id,
    accountId: req.accountId,
    oldBalance: oldAccount.balance,
    newBalance: newAccount.balance,
    amount: transaction.amount,
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
  const transaction = await connector.addIncome(req.accountId, req.amount, req.categoryId, req.note, req.timestamp, req.linkedCardId, req.cashback, req.discount);
  const newAccount = await connector.updateAccountAfterTransaction(
    req.accountId,
    oldAccount.balance + transaction.amount,
    (oldAccount.totalTransactions ?? 0) + 1,
    req.timestamp ?? Date.now()
  );

  return ok({
    transactionId: transaction.id,
    accountId: req.accountId,
    oldBalance: oldAccount.balance,
    newBalance: newAccount.balance,
    amount: transaction.amount,
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

export const getTransaction: RouteHandler<undefined, GetTransactionResponse> = async(event, connector) => {
  const id = getQueryString(event.query, 'id', true);
  const transaction = await connector.fetchTransaction(id);
  return ok(transaction);
}

export const deleteTransaction: RouteHandler<undefined, DeleteTransactionResponse> = async(event, connector) => {
  const id = getQueryString(event.query, 'id', true);
  const transaction = await connector.fetchTransaction(id);
  const balanceChanges: BalanceChange[] = [];

  if (transaction.fromAccountId) {
    const account = await connector.fetchAccount(transaction.fromAccountId);
    const newBalance = account.balance + transaction.amount;
    await connector.updateAccountBalance(transaction.fromAccountId, newBalance);
    balanceChanges.push({ accountId: transaction.fromAccountId, oldBalance: account.balance, newBalance });
  }
  if (transaction.toAccountId) {
    const account = await connector.fetchAccount(transaction.toAccountId);
    const newBalance = account.balance - transaction.amount;
    await connector.updateAccountBalance(transaction.toAccountId, newBalance);
    balanceChanges.push({ accountId: transaction.toAccountId, oldBalance: account.balance, newBalance });
  }

  await connector.archiveTransaction(id);
  return ok({ id, balanceChanges } satisfies DeleteTransactionResponse);
}

export const updateTransaction: RouteHandler<UpdateTransactionRequest, UpdateTransactionResponse> = async(event, connector) => {
  const id = getQueryString(event.query, 'id', true);
  const req = event.body;

  if (req.amount !== undefined && req.amount <= 0)
    throw new QueryError("Amount must be a positive number");

  const oldTransaction = await connector.fetchTransaction(id);
  const balanceChanges: BalanceChange[] = [];

  if (req.amount !== undefined && req.amount !== oldTransaction.amount) {
    const delta = req.amount - oldTransaction.amount;
    if (oldTransaction.fromAccountId) {
      const account = await connector.fetchAccount(oldTransaction.fromAccountId);
      const newBalance = account.balance - delta;
      await connector.updateAccountBalance(oldTransaction.fromAccountId, newBalance);
      balanceChanges.push({ accountId: oldTransaction.fromAccountId, oldBalance: account.balance, newBalance });
    }
    if (oldTransaction.toAccountId) {
      const account = await connector.fetchAccount(oldTransaction.toAccountId);
      const newBalance = account.balance + delta;
      await connector.updateAccountBalance(oldTransaction.toAccountId, newBalance);
      balanceChanges.push({ accountId: oldTransaction.toAccountId, oldBalance: account.balance, newBalance });
    }
  }

  const transaction = await connector.updateTransactionPage(id, {
    amount: req.amount,
    note: req.note,
    categoryId: req.categoryId,
    timestamp: req.timestamp,
    linkedCardId: req.linkedCardId,
    cashback: req.cashback,
    discount: req.discount
  });

  return ok({ transaction, balanceChanges } satisfies UpdateTransactionResponse);
}

export const transferBalance: RouteHandler<TransferBalanceRequest, TransferBalanceResponse> = async(event, connector) => {
  const req = event.body;
  if (req.amount <= 0) throw new QueryError("Amount must be a positive number");
  const oldFromAccountBalance = (await connector.fetchAccount(req.fromAccountId)).balance;
  const oldToAccountBalance = (await connector.fetchAccount(req.toAccountId)).balance;
  const amount = (await connector.addTransfer(req.fromAccountId, req.toAccountId, req.amount, req.note, req.timestamp)).amount;
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
