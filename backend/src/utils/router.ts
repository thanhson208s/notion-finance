import { LambdaFunctionURLResult } from "aws-lambda"
import { err } from "./helper"
import { Connector } from "./connector"

export type RouteHandler<Req = undefined, Res = unknown> = (
  event: {
    method: string
    path: string
    query: Partial<Record<string, string>>
    body: Req
  }, connector: Connector
) => Promise<{ statusCode: number, body: unknown}>

export type RouteKey = `${string} ${string}`

export class Router {
  private connector: Connector
  private routes = new Map<RouteKey, RouteHandler<unknown, unknown>>

  constructor(connector: Connector) {
    this.connector = connector;
  }

  static normalizePath(path: string, addPrefix: boolean = false):string {
    const PREFIX = "/api";
    if (path.length > 1 && path.endsWith("/"))
      path = path.slice(0, -1);
    return addPrefix ? PREFIX + path : path;
  }

  static normalizeQuery(query: Record<string, string|undefined>): Partial<Record<string, string>> {
    const result: Partial<Record<string, string>> = {};
    for (const key in query) {
      const value = query[key];
      if (value !== undefined)
        result[key] = value;
    }
    return result;
  }

  register<Req, Res>(method: string, path: string, handler: RouteHandler<Req, Res>) {
    if (path.length <= 1 || !path.startsWith('/')) return;

    const key: RouteKey = `${method.toUpperCase()} ${Router.normalizePath(path, true)}`;
    this.routes.set(key, handler as RouteHandler<unknown, unknown>);
  }

  async resolve(method: string, path: string, query: Record<string, string|undefined>, body: unknown) {
    const key: RouteKey = `${method.toUpperCase()} ${Router.normalizePath(path)}`;
    const handler = this.routes.get(key);
    let res;
    if (!handler)
      res = err(404, "NOT_FOUND", "Route not found");
    else
      res = await handler({method, path, query: Router.normalizeQuery(query), body}, this.connector);
    return {
      statusCode: res.statusCode,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(res.body)
    } as LambdaFunctionURLResult;
  }
}