import { QueryError } from "../types/error";

export const ok = (data: unknown) => ({
  statusCode: 200,
  body: data
})

export const err = <T>(statusCode: number, code: string, message: string) => ({
  statusCode,
  body: { code, message }
})

export function getQueryInt(query: Partial<Record<string, string>>, k: string): number {
  if (!(k in query))
    throw new QueryError(`Parameter ${k} is missing`);
  const value = parseInt(query[k] as string);
  if (Number.isNaN(value))
    throw new QueryError(`Parameter ${k} is not a number`);
  return value;
}

export function getQueryFloat(query: Partial<Record<string, string>>, k: string): number {
  if (!(k in query))
    throw new QueryError(`Parameter ${k} is missing`);
  const value = parseFloat(query[k] as string);
  if (Number.isNaN(value))
    throw new QueryError(`Parameter ${k} is not a number`);
  return value;
}

export function getQueryString(query: Partial<Record<string, string>>, k: string): string {
  if (!(k in query))
    throw new QueryError(`Parameter ${k} is missing`);
  return query[k] as string;
}

export function getQueryBool(query: Partial<Record<string, string>>, k: string, v: boolean = false): boolean {
  if (!(k in query))
    throw new QueryError(`Parameter ${k} is missing`);
  return Boolean(query[k]);
}