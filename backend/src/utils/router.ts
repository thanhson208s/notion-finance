import { LambdaFunctionURLResult } from "aws-lambda"
import { APIResponse } from "../types/response"
import { err } from "./helper"
import { APIErrorCode, APIResponseError, Client } from "@notionhq/client"
import { Connector } from "./connector"

export type RouteHandler<Req = undefined, Res = unknown> = (
  event: {
    method: string
    path: string
    query: Partial<Record<string, string>>
    body: Req
  }, connector: Connector
) => Promise<{ statusCode: number, body: APIResponse<Res>}>

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
    else {
      try {
        res = await handler({method, path, query: Router.normalizeQuery(query), body}, this.connector);
      } catch(e) {
        if (e instanceof APIResponseError) {
          switch(e.code) {
            case APIErrorCode.ObjectNotFound:
              res = err(404, e.code, e.message);
              break;
            case APIErrorCode.InvalidJSON:
              res = err(400, e.code, e.message);
              break;
            case APIErrorCode.InternalServerError:
              res = err(500, e.code, e.message);
              break;
            case APIErrorCode.ServiceUnavailable:
              res = err(503, e.code, e.message);
              break;
            case APIErrorCode.Unauthorized:
              res = err(403, e.code, e.message);
              break;
            case APIErrorCode.ConflictError:
              res = err(409, e.code, e.message);
              break;
            case APIErrorCode.RateLimited:
              res = err(429, e.code, e.message);
              break;
            case APIErrorCode.InvalidRequest:
              res = err(400, e.code, e.message);
              break;
            case APIErrorCode.InvalidRequestURL:
              res = err(400, e.code, e.message);
              break;
            case APIErrorCode.ValidationError:
              res = err(400, e.code, e.message);
              break;
            case APIErrorCode.RestrictedResource:
              res = err(403, e.code, e.message);
              break;
          } 
        }
        else throw e;
      }
    }
    return {
      statusCode: res.statusCode,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(res.body)
    } as LambdaFunctionURLResult;
  }
}