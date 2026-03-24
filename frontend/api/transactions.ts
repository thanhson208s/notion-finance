import { VercelRequest, VercelResponse } from '@vercel/node';
import { Connector } from './_lib/connector';
import { getTransaction, updateTransaction, deleteTransaction, listExpenses, logExpense, listIncomes, logIncome } from './_handlers/transaction.handler';
import { handleError } from './_lib/error-handler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const connector = new Connector();
  const query = req.query as Record<string, string>;

  try {
    if (req.method === 'GET') {
      if (query.id) {
        const result = await getTransaction({ method: 'GET', path: req.url ?? '', query, body: undefined }, connector);
        return res.status(result.statusCode).json(result.body);
      }
      if (query.type === 'expense') {
        const result = await listExpenses({ method: 'GET', path: req.url ?? '', query, body: undefined }, connector);
        return res.status(result.statusCode).json(result.body);
      }
      if (query.type === 'income') {
        const result = await listIncomes({ method: 'GET', path: req.url ?? '', query, body: undefined }, connector);
        return res.status(result.statusCode).json(result.body);
      }
      return res.status(400).json({ error: 'Missing query param: id or type' });
    }
    if (req.method === 'POST') {
      if (query.type === 'expense') {
        const result = await logExpense({ method: 'POST', path: req.url ?? '', query, body: req.body }, connector);
        return res.status(result.statusCode).json(result.body);
      }
      if (query.type === 'income') {
        const result = await logIncome({ method: 'POST', path: req.url ?? '', query, body: req.body }, connector);
        return res.status(result.statusCode).json(result.body);
      }
      return res.status(400).json({ error: 'Missing query param: type' });
    }
    if (req.method === 'PATCH') {
      const result = await updateTransaction({ method: 'PATCH', path: req.url ?? '', query, body: req.body }, connector);
      return res.status(result.statusCode).json(result.body);
    }
    if (req.method === 'DELETE') {
      const result = await deleteTransaction({ method: 'DELETE', path: req.url ?? '', query, body: undefined }, connector);
      return res.status(result.statusCode).json(result.body);
    }
    return res.status(405).send('Method Not Allowed');
  } catch (e) {
    handleError(e, res);
  }
}
