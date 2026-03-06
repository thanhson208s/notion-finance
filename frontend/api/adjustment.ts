import { VercelRequest, VercelResponse } from '@vercel/node';
import { Connector } from './_lib/connector';
import { adjustBalance } from './_handlers/account.handler';
import { handleError } from './_lib/error-handler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const connector = new Connector();
  try {
    const result = await adjustBalance({ method: 'POST', path: req.url ?? '', query: {}, body: req.body }, connector);
    return res.status(result.statusCode).json(result.body);
  } catch (e) {
    handleError(e, res);
  }
}
