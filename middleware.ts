import { jwtVerify } from 'jose'

export const config = {
  matcher: ['/api/:path*'],
}

export default async function middleware(request: Request) {
  const url = new URL(request.url)

  // Pass through: login endpoint and Vercel cron jobs
  if (url.pathname === '/api/auth' || url.pathname.startsWith('/api/cron/')) {
    return
  }

  if (request.headers.get('x-cloudflare-secret') !== process.env.CF_SECRET) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    await jwtVerify(token, secret)
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
