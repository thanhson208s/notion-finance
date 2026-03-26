import { VercelRequest, VercelResponse } from '@vercel/node';
import { Connector } from './_lib/connector';
import { getAccounts, adjustBalance, setAccountActive, createAccount } from './_handlers/account.handler';
import { transferBalance } from './_handlers/transaction.handler';
import { handleError } from './_lib/error-handler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const connector = new Connector();
  const query = req.query as Record<string, string>;

  try {
    if (req.method === 'GET') {
      const result = await getAccounts({ method: 'GET', path: req.url ?? '', query, body: undefined }, connector);
      return res.status(result.statusCode).json(result.body);
    }
    if (req.method === 'POST') {
      if (query.action === 'transfer') {
        const result = await transferBalance({ method: 'POST', path: req.url ?? '', query, body: req.body }, connector);
        return res.status(result.statusCode).json(result.body);
      }
      if (query.action === 'adjustment') {
        const result = await adjustBalance({ method: 'POST', path: req.url ?? '', query, body: req.body }, connector);
        return res.status(result.statusCode).json(result.body);
      }
      if (query.action === 'set-active') {
        const result = await setAccountActive({ method: 'POST', path: req.url ?? '', query, body: req.body }, connector);
        return res.status(result.statusCode).json(result.body);
      }
      if (query.action === 'create') {
        const result = await createAccount({ method: 'POST', path: req.url ?? '', query, body: req.body }, connector);
        return res.status(result.statusCode).json(result.body);
      }
      return res.status(400).json({ error: 'Missing query param: action' });
    }
    return res.status(405).send('Method Not Allowed');
  } catch (e) {
    handleError(e, res);
  }
}
