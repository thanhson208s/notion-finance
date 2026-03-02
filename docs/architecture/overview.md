# Architecture Overview

## System Diagram

```
User Browser
    │
    ▼
CloudFront (finance.gootube.online)
    ├── /*      → Vercel (React SPA)
    └── /api/*  → Lambda Function URL (ap-southeast-1, IAM auth)
                      │
                      ▼
               Lambda (notion-finance-api)
                      │
                      ▼
               Notion API (3 databases)
```

## CloudFront Setup
- **Default behavior**: Vercel origin (`notion-finance-sigma.vercel.app`)
- **`/api/*` behavior**: Lambda origin — CachingDisabled, CORS-With-Preflight response headers
- **Auth**: Lambda Function URL uses IAM authorizer + Origin Access Control (CloudFront signs requests to Lambda with SigV4)
- Frontend POST requests must include `x-amz-content-sha256` — see [guides/frontend.md](../guides/frontend.md#sigv4-note)

## Backend Request Flow

```
CloudFront → Lambda Function URL (IAM)
  → main.handler
  → Router.resolve(method, path)   // key format: "GET /api/accounts"
  → RouteHandler(event, connector)
  → Connector → Notion API
```

The router automatically prefixes `/api` when routes are registered, so handlers use short paths (e.g. `/accounts`) that resolve as `GET /api/accounts`.

## Error Handling (`main.ts`)

Three error layers are caught at `main.ts` — handlers **do not need try/catch**:

| Error type | HTTP status | When |
|---|---|---|
| `Notion APIResponseError` | 400 / 403 / 404 / 409 / 429 / 500 / 503 | Notion API error |
| `SchemaError` | 500 | Notion property wrong type or missing |
| `QueryError` | 400 | Bad request query parameter |
| Route not found | 404 | Path does not match any registered route |

## Deployment
- **Backend**: `cd backend && serverless deploy`
- **Frontend**: `cd frontend && npm run deploy`
