import { VercelRequest, VercelResponse } from '@vercel/node';
import { Connector } from '../_lib/connector';
import { runArchive } from '../_handlers/archive.handler';
import { handleError } from '../_lib/error-handler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const connector = new Connector();
  try {
    const result = await runArchive(connector);
    return res.status(200).json(result);
  } catch (e) {
    handleError(e, res);
  }
}
