import { VercelRequest, VercelResponse } from '@vercel/node';
import { Connector } from './_lib/connector';
import { logIncome, listIncomes } from './_handlers/transaction.handler';
import { handleError } from './_lib/error-handler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const connector = new Connector();
  const query = req.query as Record<string, string>;

  try {
    if (req.method === 'GET') {
      const result = await listIncomes({ method: 'GET', path: req.url ?? '', query, body: undefined }, connector);
      return res.status(result.statusCode).json(result.body);
    }
    if (req.method === 'POST') {
      const result = await logIncome({ method: 'POST', path: req.url ?? '', query, body: req.body }, connector);
      return res.status(result.statusCode).json(result.body);
    }
    return res.status(405).send('Method Not Allowed');
  } catch (e) {
    handleError(e, res);
  }
}
