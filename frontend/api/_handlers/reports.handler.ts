import { CategoryBreakdown, GetReportsResponse } from "../_lib/types/response";
import { getQueryString, ok } from "../_lib/helper";
import { RouteHandler } from "../_lib/router";
import { Category } from "../_lib/types/category.type";
import { Transaction } from "../_lib/types/transaction.type";

function buildBreakdown(transactions: Transaction[], allCategories: Category[], categoryMap: Map<string, Category>): CategoryBreakdown[] {
  const totals = new Map<string, number>(allCategories.map(c => [c.id, 0]));
  for (const t of transactions) {
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
  }
  return [...totals.entries()]
    .map(([categoryId, amount]) => {
      const cat = categoryMap.get(categoryId);
      return {
        categoryId,
        categoryName: cat?.name ?? categoryId,
        parentId: cat?.parentId ?? categoryId,
        amount
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export const getReports: RouteHandler<undefined, GetReportsResponse> = async (event, connector) => {
  const startDateRaw = getQueryString(event.query, "startDate", false) ?? undefined;
  const endDateRaw   = getQueryString(event.query, "endDate",   false) ?? undefined;

  const startDate = startDateRaw ? `${startDateRaw}T00:00:00` : undefined;
  const endDate   = endDateRaw   ? `${endDateRaw}T23:59:59`   : undefined;

  const TRANSFER_ID   = process.env.NOTION_TRANSFER_TRANSACTION_ID as string;
  const ADJUSTMENT_ID = process.env.NOTION_ADJUSTMENT_TRANSACTION_ID as string;

  const [categories, allTransactions, accounts] = await Promise.all([
    connector.fetchCategories(null),
    connector.fetchAllTransactions(startDate, endDate),
    connector.fetchAllAccounts()
  ]);

  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const expenseCategories = categories.filter(c => c.type === 'Expense');
  const incomeCategories  = categories.filter(c => c.type === 'Income');

  const isSystemCategory = (t: Transaction) =>
    t.categoryId === TRANSFER_ID || t.categoryId === ADJUSTMENT_ID;

  const expenses = allTransactions.filter(t =>  t.fromAccountId && !t.toAccountId && !isSystemCategory(t));
  const incomes  = allTransactions.filter(t => !t.fromAccountId &&  t.toAccountId && !isSystemCategory(t));

  const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome  = incomes.reduce((sum, t)  => sum + t.amount, 0);
  const netSavings   = totalIncome - totalExpense;

  return ok({
    totalIncome,
    totalExpense,
    netSavings,
    transactions: allTransactions,
    accounts,
    expenseCategoryBreakdown: buildBreakdown(expenses, expenseCategories, categoryMap),
    incomeCategoryBreakdown:  buildBreakdown(incomes,  incomeCategories,  categoryMap)
  } satisfies GetReportsResponse);
}
