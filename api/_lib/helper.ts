import { QueryError } from "./types/error";

export function toISODateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getBillingCycleDates(billingDay: number, referenceDate = new Date()): { start: Date; end: Date } {
  const day = referenceDate.getDate()
  const month = referenceDate.getMonth()
  const year = referenceDate.getFullYear()

  if (day <= billingDay) {
    // Cycle: (billingDay+1) of previous month → billingDay of this month
    return {
      start: new Date(year, month - 1, billingDay + 1),
      end: new Date(year, month, billingDay)
    }
  } else {
    // Cycle: (billingDay+1) of this month → billingDay of next month
    return {
      start: new Date(year, month, billingDay + 1),
      end: new Date(year, month + 1, billingDay)
    }
  }
}

export const ok = <T>(data: T) => ({
  statusCode: 200,
  body: data
})

export const err = (statusCode: number, code: string, message: string) => ({
  statusCode,
  body: { code, message }
})

export function getQueryInt(query: Partial<Record<string, string>>, k: string, required: true): number;
export function getQueryInt(query: Partial<Record<string, string>>, k: string, required: false): number | null;
export function getQueryInt(query: Partial<Record<string, string>>, k: string, required: boolean) {
  if (!(k in query)) {
    if (required)
      throw new QueryError(`Parameter ${k} is missing`);
    else return null;
  }
  const value = parseInt(query[k] as string);
  if (Number.isNaN(value)) {
    if (required)
      throw new QueryError(`Parameter ${k} is not a number`);
    else return null;
  }
  return value;
}

export function getQueryFloat(query: Partial<Record<string, string>>, k: string, required: true): number;
export function getQueryFloat(query: Partial<Record<string, string>>, k: string, required: false): number | null;
export function getQueryFloat(query: Partial<Record<string, string>>, k: string, required: boolean) {
  if (!(k in query)) {
    if (required)
      throw new QueryError(`Parameter ${k} is missing`);
    else return null;
  }
  const value = parseFloat(query[k] as string);
  if (Number.isNaN(value)) {
    if (required)
      throw new QueryError(`Parameter ${k} is not a number`);
    else return null;
  }
  return value;
}

export function getQueryString(query: Partial<Record<string, string>>, k: string, required: true): string;
export function getQueryString(query: Partial<Record<string, string>>, k: string, required: false): string | null;
export function getQueryString(query: Partial<Record<string, string>>, k: string, required: boolean) {
  if (!(k in query)) {
    if (required)
      throw new QueryError(`Parameter ${k} is missing`);
    else return null;
  }
  return String(query[k]);
}

export function getQueryBool(query: Partial<Record<string, string>>, k: string, required: true): boolean;
export function getQueryBool(query: Partial<Record<string, string>>, k: string, required: false): boolean | null;
export function getQueryBool(query: Partial<Record<string, string>>, k: string, required: boolean) {
  if (!(k in query)) {
    if (required)
      throw new QueryError(`Parameter ${k} is missing`);
    else return null;
  }
  return Boolean(query[k]);
}
