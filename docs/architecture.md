# System Architecture

## Overview

```
Browser
  │
  ▼
Cloudflare (finance.gootube.online)
  ├── WAF Managed Rules  — OWASP & CF ruleset
  ├── Bot Management     — block malicious bots
  └── Proxy
        │
        │  (injects x-cf-secret header)
        ▼
Vercel (blocks requests without x-cf-secret)
  ├── /api/*  ──► Node.js Serverless Functions (api/*.ts)
  │                        │
  │                        ▼
  │                   Notion API
  │
  └── /* ──────► React Frontend (Vite build)
```

---

## Infrastructure Components

### Cloudflare

- **Role**: Reverse proxy and security layer in front of Vercel
- **DNS**: `finance.gootube.online` is proxied through Cloudflare (orange cloud)
- **WAF**: Managed rules enabled — Cloudflare OWASP Core Ruleset + Cloudflare Managed Ruleset
- **Bot Management**: Bot Fight Mode enabled to block automated/malicious traffic
- **Origin protection**: Cloudflare injects a secret header (`x-cloudflare-secret`) on every proxied request. Vercel middleware rejects any request missing this header with HTTP 403, preventing direct access to the Vercel deployment URL.

### Vercel Deployment

- **Domain**: `finance.gootube.online`
- **Platform**: Vercel — single deployment serves both the React frontend and the API
- **Frontend**: static Vite build served for all non-API paths
- **API**: Node.js serverless functions in `api/*.ts`, each mapped to a route via `vercel.json`
- **No separate auth layer**: API routes are same-origin — no SigV4 or IAM signing required

### Notion API

- Acts as the sole database layer — no separate SQL/NoSQL database
- All 8 tables were created manually in the Notion UI
- The backend only queries and updates pages; it never creates or drops schema
- SDK: `@notionhq/client` (Notion Data Sources API for queries, Pages API for mutations)

---

## Request Lifecycle

1. Browser sends a request to `https://finance.gootube.online`
2. Cloudflare receives the request, applies WAF and bot rules, injects `x-cf-secret` header, and proxies to Vercel
3. Vercel middleware runs on all `/api/*` requests:
   - `/api/auth` and `/api/cron/*` are bypassed (no auth required)
   - All other requests: validates `x-cloudflare-secret` header — returns HTTP 403 if missing or invalid
   - Then validates `Authorization: Bearer <JWT>` — returns HTTP 401 if missing or invalid
4. Vercel evaluates the path:
   - `/api/*` → routes to the matching Node.js serverless function in `api/*.ts`
   - otherwise → serves the React frontend (Vite build)
5. The serverless function receives `(req: VercelRequest, res: VercelResponse)`
6. The handler calls `Connector` methods (Notion SDK wrapper)
7. On success the handler writes the response via `res.json(data)`
8. On error the handler calls `handleError(e, res)` which maps the error to an HTTP status

---

## Backend Code Layout

```
api/
├── accounts.ts          GET /api/accounts, POST /api/accounts?action=...
├── auth.ts              POST /api/auth
├── cards.ts             GET /api/cards, GET /api/cards?id=
├── categories.ts        GET /api/categories
├── promotions.ts        GET/POST/PATCH/DELETE /api/promotions
├── reports.ts           GET /api/reports
├── statements.ts        GET/POST/DELETE /api/statements
├── transactions.ts      GET/POST/PATCH/DELETE /api/transactions
├── cron/
│   ├── snapshot.ts      GET /api/cron/snapshot
│   └── archive.ts       GET /api/cron/archive
├── _handlers/           Business logic per domain
│   ├── account.handler.ts
│   ├── card.handler.ts
│   ├── category.handler.ts
│   ├── promotion.handler.ts
│   ├── reports.handler.ts
│   ├── snapshot.handler.ts
│   ├── archive.handler.ts
│   ├── statement.handler.ts
│   └── transaction.handler.ts
├── _lib/                Shared utilities
│   ├── connector.ts     Notion SDK wrapper — all DB read/write operations
│   ├── error-handler.ts handleError(e, res: VercelResponse)
│   ├── helper.ts        ok(), err(), getQueryString(), getQueryInt(), etc.
│   ├── router.ts        RouteHandler type definition
│   └── types/           Type definitions (account, card, category, transaction, promotion, statement, request, response, error, common)
└── __tests__/           Vitest tests (141 tests)
```

---

## Error Handling Flow

```
Handler calls handleError(e, res)
  QueryError            →  HTTP 400
  SchemaError           →  HTTP 500
  DatabaseError         →  HTTP 500
  APIResponseError (Notion SDK):
    object_not_found    →  HTTP 404
    unauthorized        →  HTTP 403
    rate_limited        →  HTTP 429
    service_unavailable →  HTTP 503
    conflict_error      →  HTTP 409
    validation_error    →  HTTP 400
  Unknown Error         →  HTTP 500 (logged with stack trace)
```
