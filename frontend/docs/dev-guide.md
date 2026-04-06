# Developer Guide

---

## Prerequisites

- Node.js 20.x
- npm
- Vercel CLI (`npm install -g vercel`)
- A Notion integration token with access to all databases

---

## Environment Variables

For local development, copy variables into a `.env.local` file (not committed to source control).
In production, all variables are set in the Vercel project settings dashboard.

| Variable | Type | Description |
|---|---|---|
| `NOTION_API_KEY` | Secret | Internal integration token from Notion settings |
| `NOTION_ACCOUNT_DATABASE_ID` | DB ID | ID of the Account Notion database |
| `NOTION_TRANSACTION_DATABASE_ID` | DB ID | ID of the Transaction Notion database |
| `NOTION_CATEGORY_DATABASE_ID` | DB ID | ID of the Category Notion database |
| `NOTION_CARD_DATABASE_ID` | DB ID | ID of the Card Notion database |
| `NOTION_SNAPSHOT_DATABASE_ID` | DB ID | ID of the Snapshot Notion database |
| `NOTION_ARCHIVE_DATABASE_ID` | DB ID | ID of the Archive Notion database (one page per calendar month) |
| `NOTION_PROMOTION_DATABASE_ID` | DB ID | ID of the Promotion Notion database |
| `NOTION_STATEMENT_DATABASE_ID` | DB ID | ID of the Statement Notion database |
| `NOTION_TRANSFER_TRANSACTION_ID` | Page ID | Page ID of the "Transfer" category in the Category DB |
| `NOTION_ADJUSTMENT_TRANSACTION_ID` | Page ID | Page ID of the "Adjustment" category in the Category DB |
| `APP_SECRET` | Secret | Password for `POST /api/auth` — generate with `openssl rand -hex 32` |
| `JWT_SECRET` | Secret | Secret used to sign/verify JWT tokens — generate with `openssl rand -hex 32` |
| `CF_SECRET` | Secret | Secret injected by Cloudflare on every proxied request; validated in middleware |
| `CRON_SECRET` | Secret | Secret used to authenticate Vercel cron requests — generate with `openssl rand -hex 32` |
| `VITE_API_BASE` | URL | API base URL — `/api` in production, `http://localhost:3000/api` for local dev |
| `TELEGRAM_BOT_TOKEN` | Secret | Telegram bot token for sending cron run reports |
| `TELEGRAM_CHAT_ID` | String | Telegram chat/group ID to send reports to |
| `TELEGRAM_TOPIC_ID` | Number | Telegram forum topic ID (thread); set to `0` if not using topics |

> **How to get database IDs**: Open the Notion database, click Share → Copy link. The ID is the 32-character hex string in the URL.
>
> **How to get `NOTION_TRANSFER_TRANSACTION_ID` and `NOTION_ADJUSTMENT_TRANSACTION_ID`**: Open the Category database, find (or create) entries named "Transfer" and "Adjustment" with `Type = System`. Open each page and copy the ID from the URL. These are **page IDs**, not database IDs.

---

## Build & Deploy

```bash
# Install dependencies
npm install

# Run frontend + API locally (Vercel dev server on port 3000)
npm run dev:api

# Run frontend only (Vite, no API)
npm run dev

# Build (TypeScript check + Vite production build)
npm run build

# Deploy to production
npm run deploy
```

**Build output**: `dist/` directory (Vite static build).
**Deploy**: `vercel --prod` — pushes both the frontend and `api/` serverless functions.

---

## Triggering the monthly snapshot cron manually

```bash
curl -X GET https://finance.gootube.online/api/cron/snapshot \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Vercel automatically adds the `Authorization: Bearer <CRON_SECRET>` header when invoking scheduled cron functions. For local testing, provide the header manually.

---

## Triggering the archive cron manually

```bash
curl -X GET https://finance.gootube.online/api/cron/archive \
  -H "Authorization: Bearer <CRON_SECRET>"
```

The archive cron runs daily at 00:00 UTC and archives any transactions older than 3 calendar months. Safe to re-run — existing archive pages are reused.

---

## Adding a New Endpoint

1. Create or update a handler function in `api/_handlers/[domain].handler.ts`
2. Define request/response types in `api/_lib/types/request.ts` and `api/_lib/types/response.ts`
3. Create a new route file `api/[route].ts` that imports the handler and calls it:
   ```typescript
   import type { VercelRequest, VercelResponse } from '@vercel/node';
   import { yourHandler } from './_handlers/[domain].handler';
   import { Connector } from './_lib/connector';
   import { handleError } from './_lib/error-handler';

   export default async function handler(req: VercelRequest, res: VercelResponse) {
     const connector = new Connector();
     const query = req.query as Record<string, string>;
     try {
       const result = await yourHandler({ method: req.method ?? 'GET', path: req.url ?? '', query, body: req.body }, connector);
       return res.status(result.statusCode).json(result.body);
     } catch (e) {
       handleError(e, res);
     }
   }
   ```
4. Add Notion DB operations to `api/_lib/connector.ts` (if new DB access is needed)
5. Follow the `mapPage*` private method pattern for consistent property extraction
6. Document the endpoint in `docs/api-reference.md`
7. Create or update the relevant `docs/feature-*.md`
8. Update the status table in `docs/README.md`

---

## Connector Pattern

All Notion API calls **must** go through `api/_lib/connector.ts`.
Never call the Notion SDK directly from handler files.

**Property extractor methods** (private, throw `SchemaError` if type mismatch):

| Method | Notion type | Returns |
|---|---|---|
| `getTitleProperty(page, key)` | Title | `string` |
| `getNumberProperty(page, key, required)` | Number | `number \| null` |
| `getSelectProperty(page, key, required)` | Select | `string \| null` |
| `getTextProperty(page, key, required)` | Rich Text | `string \| null` |
| `getRelationProperty(page, key, required)` | Relation (single) | `string \| null` |
| `getRelationsProperty(page, key)` | Relation (multi) | `string[]` |
| `getDateProperty(page, key, required)` | Date | `number \| null` (epoch ms) |
| `getCheckboxProperty(page, key)` | Checkbox | `boolean` |
| `getMultiSelectProperty(page, key)` | Multi-select | `string[]` |
| `getFileProperty(page, key, required)` | Files & media | `string \| null` (first file URL) |

---

## Error Handling Conventions

| Error class | When to throw | HTTP result |
|---|---|---|
| `QueryError` | Invalid or missing request parameters | 400 |
| `DatabaseError` | Data not found or unexpected DB state | 500 |
| `SchemaError` | Notion property type does not match expectation | 500 |
| _(Notion `APIResponseError`)_ | Thrown by Notion SDK | Mapped by `handleError` |

Handlers return `ok(data)` on success or throw a typed error. All error mapping is done in `handleError(e, res)` from `api/_lib/error-handler.ts`.

---

## Code Conventions

- **Handler signature**: `RouteHandler<Req, Res>` — `async (event: { method, path, query, body: Req }, connector: Connector): Promise<{ statusCode, body: Res }>`
- **Response**: always `return ok(data satisfies ResponseType)` — use `satisfies` to enforce shape
- **Timezone**: always use `Asia/Bangkok` for all timestamp formatting via `toISOStringWithTimezone(ms, tz)` in `api/_lib/connector.ts`
- **Transaction ID format**: `${categoryId}-${Date.now()}-${amount}` (generated in `addTransaction()`)
- **No direct balance mutation**: every balance change must be accompanied by a transaction record

---

## Running Checks (Pre-commit)

Per `CLAUDE.md` Standard AI Workflow:

```bash
npm run lint    # ESLint
npm run test    # Vitest (141 tests)
npm run build   # tsc -b && vite build
```

---

## Frontend Reference

| Item | Value |
|---|---|
| Repo | `/Users/thanhson208s/Repos/notion-finance/frontend/` |
| Framework | React 19 + Vite + TypeScript |
| Deploy | Vercel (`finance.gootube.online`) |
| API base | `/api` (relative, same deployment) |
| State management | Local `useState` + `useEffect` only (no Redux/Zustand) |
| UI library | Lucide React (icons) + custom CSS (dark theme) |
| Router | React Router DOM v7 |
