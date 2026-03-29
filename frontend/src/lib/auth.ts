const TOKEN_KEY = 'finance_auth_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function isTokenValid(token: string): boolean {
  try {
    const b64url = token.split('.')[1]
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getToken()
  return fetch(input, {
    ...init,
    headers: {
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}

async function getApiErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    return (typeof data?.message === 'string' && data.message) ||
           (typeof data?.error === 'string' && data.error) ||
           fallback
  } catch {
    return fallback
  }
}

export async function parseApiResponse<T = unknown>(res: Response, fallback = 'Something went wrong'): Promise<T> {
  if (!res.ok) throw new Error(await getApiErrorMessage(res, fallback))
  return res.json() as Promise<T>
}
