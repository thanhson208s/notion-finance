import { VercelRequest, VercelResponse } from '@vercel/node';
import { Connector } from './_lib/connector';
import { getCategories } from './_handlers/category.handler';
import { handleError } from './_lib/error-handler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  const connector = new Connector();
  const query = req.query as Record<string, string>;

  try {
    const result = await getCategories({ method: 'GET', path: req.url ?? '', query, body: undefined }, connector);
    return res.status(result.statusCode).json(result.body);
  } catch (e) {
    handleError(e, res);
  }
}
