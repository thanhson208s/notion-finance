import { VercelResponse } from '@vercel/node';
import { APIErrorCode, APIResponseError } from '@notionhq/client';
import { SchemaError, QueryError } from './types/error';

function sendError(res: VercelResponse, status: number, code: string, message: string): void {
  res.status(status).json({ success: false, error: { code, message } });
}

export function handleError(e: unknown, res: VercelResponse): void {
  if (e instanceof APIResponseError) {
    const map: Partial<Record<string, number>> = {
      [APIErrorCode.InternalServerError]: 500,
      [APIErrorCode.ServiceUnavailable]: 503,
      [APIErrorCode.ConflictError]: 409,
      [APIErrorCode.RateLimited]: 429,
      [APIErrorCode.InvalidRequestURL]: 400,
      [APIErrorCode.ValidationError]: 400,
      [APIErrorCode.InvalidRequest]: 400,
      [APIErrorCode.InvalidJSON]: 400,
      [APIErrorCode.RestrictedResource]: 403,
      [APIErrorCode.Unauthorized]: 403,
      [APIErrorCode.ObjectNotFound]: 404,
    };
    return sendError(res, map[e.code] ?? 500, e.code, e.message);
  }
  if (e instanceof SchemaError) return sendError(res, 500, e.code, e.message);
  if (e instanceof QueryError) return sendError(res, 400, e.code, e.message);
  const str = e instanceof Error
    ? JSON.stringify({ name: e.name, message: e.message })
    : String(e);
  console.error('Unexpected error:', str);
  sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error');
}
