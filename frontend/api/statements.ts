import { VercelRequest, VercelResponse } from '@vercel/node';
import { Connector } from './_lib/connector';
import { getStatements, addStatement, deleteStatement, previewStatement } from './_handlers/statement.handler';
import { handleError } from './_lib/error-handler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const connector = new Connector();
  const query = req.query as Record<string, string>;

  try {
    if (req.method === 'GET') {
      if (query['preview'] === '1') {
        const result = await previewStatement({ method: 'GET', path: req.url ?? '', query, body: undefined }, connector);
        return res.status(result.statusCode).json(result.body);
      }
      const result = await getStatements({ method: 'GET', path: req.url ?? '', query, body: undefined }, connector);
      return res.status(result.statusCode).json(result.body);
    }
    if (req.method === 'POST') {
      const result = await addStatement({ method: 'POST', path: req.url ?? '', query, body: req.body }, connector);
      return res.status(result.statusCode).json(result.body);
    }
    if (req.method === 'DELETE') {
      const result = await deleteStatement({ method: 'DELETE', path: req.url ?? '', query, body: undefined }, connector);
      return res.status(result.statusCode).json(result.body);
    }
    return res.status(405).send('Method Not Allowed');
  } catch (e) {
    handleError(e, res);
  }
}
