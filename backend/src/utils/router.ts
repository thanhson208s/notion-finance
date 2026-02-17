import { LambdaFunctionURLResult } from "aws-lambda"
import { APIResponse } from "../types/response"
import { err } from "./composer"

function normalizePath(path: string, addPrefix: boolean = false):string {
  const PREFIX = "/api";
  if (path.length > 1 && path.endsWith("/"))
    path = path.slice(0, -1);
  return addPrefix ? PREFIX + path : path;
}

export type RouteHandler<Req = undefined, Res = unknown> = (
  event: {
    method: string
    path: string
    query: Record<string, string | undefined>
    body: Req
  }
) => Promise<{ statusCode: number, body: APIResponse<Res>}>

export type RouteKey = `${string} ${string}`

export class Router {
  private routes = new Map<RouteKey, RouteHandler<unknown, unknown>>

  register<Req, Res>(method: string, path: string, handler: RouteHandler<Req, Res>) {
    if (path.length <= 1 || !path.startsWith('/')) return;

    const key: RouteKey = `${method.toUpperCase()} ${normalizePath(path, true)}`;
    this.routes.set(key, handler as RouteHandler<unknown, unknown>);
  }

  async resolve(method: string, path: string, payload: Parameters<RouteHandler>[0]) {
    const key: RouteKey = `${method.toUpperCase()} ${normalizePath(path)}`;
    const handler = this.routes.get(key);
    let res;
    if (!handler)
      res = err(404, "NOT_FOUND", "Route not found");
    else res = await handler(payload);

    return {
      statusCode: res.statusCode,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(res.body)
    } as LambdaFunctionURLResult;
  }
}