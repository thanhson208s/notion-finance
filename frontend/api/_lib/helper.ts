import { QueryError } from "./types/error";

export const ok = (data: unknown) => ({
  statusCode: 200,
  body: data
})

export const err = (statusCode: number, code: string, message: string) => ({
  statusCode,
  body: { code, message }
})

export function getQueryInt<T extends boolean>(query: Partial<Record<string, string>>, k: string, required: T): T extends true ? number : (number | null) {
  if (!(k in query)) {
    if (required)
      throw new QueryError(`Parameter ${k} is missing`);
    else return null as any;
  }
  const value = parseInt(query[k] as string);
  if (Number.isNaN(value)) {
    if (required)
      throw new QueryError(`Parameter ${k} is not a number`);
    else return null as any;
  }
  return value;
}

export function getQueryFloat<T extends boolean>(query: Partial<Record<string, string>>, k: string, required: T): T extends true ? number : (number | null) {
  if (!(k in query)) {
    if (required)
      throw new QueryError(`Parameter ${k} is missing`);
    else return null as any;
  }
  const value = parseFloat(query[k] as string);
  if (Number.isNaN(value)) {
    if (required)
      throw new QueryError(`Parameter ${k} is not a number`);
    else return null as any;
  }
  return value;
}

export function getQueryString<T extends boolean>(query: Partial<Record<string, string>>, k: string, required: T): T extends true ? string : (string | null) {
  if (!(k in query)) {
    if (required)
      throw new QueryError(`Parameter ${k} is missing`);
    else return null as any;
  }
  return String(query[k]);
}

export function getQueryBool<T extends boolean>(query: Partial<Record<string, string>>, k: string, required: T): T extends true ? boolean : (boolean | null) {
  if (!(k in query)) {
    if (required)
      throw new QueryError(`Parameter ${k} is missing`);
    else return null as any
  }
  return Boolean(query[k]);
}
