import { VercelRequest, VercelResponse } from '@vercel/node'
import jwt from 'jsonwebtoken'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const { secret } = req.body ?? {}
  if (!secret || secret !== process.env.APP_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' })
  }

  const token = jwt.sign({ sub: 'owner' }, process.env.JWT_SECRET!, {
    algorithm: 'HS256',
    expiresIn: '30d',
  })

  return res.status(200).json({ token })
}
