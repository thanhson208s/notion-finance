import { VercelRequest, VercelResponse } from '@vercel/node';
import { Connector } from './_lib/connector';
import { getTransaction, updateTransaction, deleteTransaction } from './_handlers/transaction.handler';
import { handleError } from './_lib/error-handler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const connector = new Connector();
  const query = req.query as Record<string, string>;

  try {
    if (req.method === 'GET') {
      const result = await getTransaction({ method: 'GET', path: req.url ?? '', query, body: undefined }, connector);
      return res.status(result.statusCode).json(result.body);
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
