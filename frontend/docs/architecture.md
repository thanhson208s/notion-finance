# System Architecture

## Overview

```
Browser
  │
  ▼
Vercel (finance.gootube.online)
  ├── /api/*  ──► Node.js Serverless Functions (api/*.ts)
  │                        │
  │                        ▼
  │                   Notion API
  │
  └── /* ──────► React Frontend (Vite build)
```

---

## Infrastructure Components

### Vercel Deployment

- **Domain**: `finance.gootube.online`
- **Platform**: Vercel — single deployment serves both the React frontend and the API
- **Frontend**: static Vite build served for all non-API paths
- **API**: Node.js serverless functions in `api/*.ts`, each mapped to a route via `vercel.json`
- **No separate auth layer**: API routes are same-origin — no SigV4 or IAM signing required

### Notion API

- Acts as the sole database layer — no separate SQL/NoSQL database
- All 4 tables were created manually in the Notion UI
- The backend only queries and updates pages; it never creates or drops schema
- SDK: `@notionhq/client` (Notion Data Sources API for queries, Pages API for mutations)

---

## Request Lifecycle

1. Browser sends a request to `https://finance.gootube.online`
2. Vercel evaluates the path:
   - `/api/*` → routes to the matching Node.js serverless function in `api/*.ts`
   - otherwise → serves the React frontend (Vite build)
3. The serverless function receives `(req: VercelRequest, res: VercelResponse)`
4. The handler calls `Connector` methods (Notion SDK wrapper)
5. On success the handler writes the response via `res.json(data)`
6. On error the handler calls `handleError(e, res)` which maps the error to an HTTP status

---

## Backend Code Layout

```
api/
├── accounts.ts          GET /api/accounts
├── adjustment.ts        POST /api/adjustment
├── categories.ts        GET /api/categories
├── expense.ts           GET /api/expense, POST /api/expense
├── income.ts            GET /api/income, POST /api/income
├── transfer.ts          POST /api/transfer
├── reports.ts           GET /api/reports
├── _handlers/           Business logic (account, category, transaction, reports)
├── _lib/                Shared utilities
│   ├── connector.ts     Notion SDK wrapper — all DB read/write operations
│   ├── error-handler.ts handleError(e, res: VercelResponse)
│   ├── helper.ts        ok(), err(), getQueryString(), getQueryInt(), etc.
│   ├── router.ts        RouteHandler type definition
│   └── types/           Type definitions (account, category, transaction, request, response, error, common)
└── __tests__/           Vitest tests (88 tests)
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

---

## Asset vs Liability Classification

Defined in `api/_lib/types/account.type.ts → isAssetType()`:

| Classification | Account Types |
|---|---|
| **Asset** | Cash, Prepaid, eWallet, Bank, Loan, Savings, Gold, Fund, Bond, Stock |
| **Liability** | Credit, Debt, Crypto, PayLater |

Note: `Loan` is an asset (money you have lent out — you are owed it).
Note: `Crypto` is classified as a liability in the current implementation.

---

## Timezone

All timestamps are stored in `Asia/Bangkok` (UTC+7) timezone using the native `Intl.DateTimeFormat` API.
The `toISOStringWithTimezone(ms, tz)` helper in `api/_lib/connector.ts` handles the conversion.
