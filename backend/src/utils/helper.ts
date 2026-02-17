import { ResponseError, ResponseSuccess } from "../types/response"

export const ok = <T>(data: T) => ({
  statusCode: 200,
  body: {
    success: true,
    data
  } satisfies ResponseSuccess<T>
})

export const err = <T>(statusCode: number, code: string, message: string) => ({
  statusCode,
  body: {
    success: false,
    error: { code, message }
  } satisfies ResponseError
})

export function getQueryInt(query: Partial<Record<string, string>>, k: string, v: number = 0): number {
  if (!(k in query)) return v;
  const value = parseInt(query[k] as string);
  if (Number.isNaN(value)) return v;
  return value;
}

export function getQueryFloat(query: Partial<Record<string, string>>, k: string, v: number = 0): number {
  if (!(k in query)) return v;
  const value = parseFloat(query[k] as string);
  if (Number.isNaN(value)) return v;
  return value;
}

export function getQueryString(query: Partial<Record<string, string>>, k: string, v: string = ""): string {
  if (!(k in query)) return v;
  return query[v] as string;
}

export function getQueryBool(query: Partial<Record<string, string>>, k: string, v: boolean = false): boolean {
  if (!(k in query)) return v;
  const value = Boolean(query[k]);
  return value;
}