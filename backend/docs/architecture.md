# System Architecture

## Overview

```
Browser
  │
  ▼
CloudFront (finance.gootube.online)
  ├── /api/*  ──────────────────────► Lambda Function URL (AWS IAM)
  │                                        │
  │                                        ▼
  │                                   Notion API
  │
  └── /* (default) ─────────────────► Vercel (React frontend)
```

---

## Infrastructure Components

### CloudFront Distribution

- **Domain**: `finance.gootube.online` (ACM certificate in us-east-1)
- **Origin region**: `ap-southeast-1`
- **Cache behaviors**:
  - `/api/*` → LambdaOrigin (caching disabled — `CachePolicyId: 4135ea2d`)
  - `/*` (default) → VercelOrigin
- **Origin Access Control (OAC)**: sigv4, always signs all requests to Lambda
- **CORS headers**: `ResponseHeadersPolicyId: 5cc3b908`
- **Config file**: `serverless.yml` → `resources.Resources.CloudFrontDistribution`

### Lambda Function

- **Name**: `notion-finance-api`
- **Runtime**: `nodejs20.x`, region `ap-southeast-1`
- **Timeout**: 60 seconds
- **Auth**: `AWS_IAM` (Function URL)
- **Resource policy**: only callable from the CloudFront distribution (`SourceArn`)
- **Entry point**: `src/handlers/main.ts` → `handler` export
- **Build**: esbuild via `serverless-esbuild`

### Notion API

- Acts as the sole database layer — no separate SQL/NoSQL database
- All 4 tables were created manually in the Notion UI
- The backend only queries and updates pages; it never creates or drops schema
- SDK: `@notionhq/client` (Notion Data Sources API for queries, Pages API for mutations)

### Frontend (Vercel)

- **Framework**: React 19 + Vite + TypeScript
- **Deploy**: `notion-finance-sigma.vercel.app` (Vercel)
- **API calls**: all directed to `https://finance.gootube.online/api/*`
- No backend-for-frontend layer; the frontend calls Lambda directly through CloudFront

---

## Request Lifecycle

1. Browser sends a request to `https://finance.gootube.online`
2. CloudFront evaluates the path:
   - `/api/*` → routes to LambdaOrigin, signs with OAC sigv4
   - otherwise → routes to VercelOrigin (React app)
3. Lambda receives a `LambdaFunctionURLEvent` with IAM authorizer context
4. `src/handlers/main.ts` extracts `{ method, path, query, body }`
5. The router resolves the route to a handler function
6. The handler calls `Connector` methods (Notion SDK wrapper)
7. The handler returns `ok(data)` or throws a typed error
8. `main.ts` catches any error, maps it to an HTTP status, and returns the response

---

## POST Request Authentication Note

CloudFront OAC adds the AWS Signature V4 headers automatically.
The frontend **must not** manually add `x-amz-*` headers — CloudFront handles signing.
The frontend only needs to set `Content-Type: application/json` on POST requests.

---

## Backend Code Layout

```
src/
├── handlers/
│   ├── main.ts                 Lambda entry point, error handling, router wiring
│   ├── account.handler.ts      GET /accounts, POST /adjustment
│   ├── transaction.handler.ts  POST /expense, GET /expense, POST /income, GET /income, POST /transfer
│   └── category.handler.ts     GET /categories
├── types/
│   ├── account.type.ts         Account, AccountType enum, isAssetType()
│   ├── category.type.ts        Category, CategoryType enum
│   ├── transaction.type.ts     Transaction
│   ├── request.ts              All request DTOs
│   ├── response.ts             All response DTOs
│   ├── error.ts                CustomError, SchemaError, QueryError, DatabaseError
│   └── common.ts               Currency type (VND | USD)
└── utils/
    ├── connector.ts            Notion SDK wrapper — all DB read/write operations
    ├── router.ts               HTTP router: register(), resolve(), path normalization
    └── helper.ts               ok(), err(), getQueryString(), getQueryInt(), etc.
```

---

## Error Handling Flow

```
Handler throws          →  main.ts catch block
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

Defined in `src/types/account.type.ts → isAssetType()`:

| Classification | Account Types |
|---|---|
| **Asset** | Cash, Prepaid, eWallet, Bank, Loan, Savings, Gold, Fund, Bond, Stock |
| **Liability** | Credit, Debt, Crypto, PayLater |

Note: `Loan` is an asset (money you have lent out — you are owed it).
Note: `Crypto` is classified as a liability in the current implementation.

---

## Timezone

All timestamps are stored in `Asia/Bangkok` (UTC+7) timezone using `moment-timezone`.
The backend always converts to this timezone before writing to Notion.
