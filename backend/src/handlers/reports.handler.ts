import { CategoryBreakdown, GetReportsResponse } from "../types/response";
import { getQueryString, ok } from "../utils/helper";
import { RouteHandler } from "../utils/router";
import { Category } from "../types/category.type";
import { Transaction } from "../types/transaction.type";

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
  const startDate = getQueryString(event.query, "startDate", false) ?? undefined;
  const endDate   = getQueryString(event.query, "endDate",   false) ?? undefined;

  const [expenses, incomes, categories] = await Promise.all([
    connector.fetchTransactions('expense', startDate, endDate),
    connector.fetchTransactions('income',  startDate, endDate),
    connector.fetchCategories(null)
  ]);

  const categoryMap = new Map(categories.map(c => [c.id, c]));

  const expenseCategories = categories.filter(c => c.type === 'Expense');
  const incomeCategories  = categories.filter(c => c.type === 'Income');

  const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome  = incomes.reduce((sum, t) => sum + t.amount, 0);
  const netSavings   = totalIncome - totalExpense;

  return ok({
    totalIncome,
    totalExpense,
    netSavings,
    expenseCategoryBreakdown: buildBreakdown(expenses, expenseCategories, categoryMap),
    incomeCategoryBreakdown:  buildBreakdown(incomes,  incomeCategories,  categoryMap)
  } satisfies GetReportsResponse);
}
