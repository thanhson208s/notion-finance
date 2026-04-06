import { VercelRequest, VercelResponse } from '@vercel/node';
import { Connector } from './_lib/connector';
import { getPromotions, addPromotion, deletePromotion, updatePromotion } from './_handlers/promotion.handler';
import { handleError } from './_lib/error-handler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const connector = new Connector();
  const query = Object.fromEntries(new URL(req.url ?? '', 'http://localhost').searchParams) as Record<string, string>;

  try {
    if (req.method === 'GET') {
      const result = await getPromotions({ method: 'GET', path: req.url ?? '', query, body: undefined }, connector);
      return res.status(result.statusCode).json(result.body);
    }
    if (req.method === 'POST') {
      const result = await addPromotion({ method: 'POST', path: req.url ?? '', query, body: req.body }, connector);
      return res.status(result.statusCode).json(result.body);
    }
    if (req.method === 'PATCH') {
      const result = await updatePromotion({ method: 'PATCH', path: req.url ?? '', query, body: req.body }, connector);
      return res.status(result.statusCode).json(result.body);
    }
    if (req.method === 'DELETE') {
      const result = await deletePromotion({ method: 'DELETE', path: req.url ?? '', query, body: undefined }, connector);
      return res.status(result.statusCode).json(result.body);
    }
    return res.status(405).send('Method Not Allowed');
  } catch (e) {
    handleError(e, res);
  }
}
