# Developer Guide

---

## Prerequisites

- Node.js 20.x
- npm (or pnpm)
- AWS CLI configured with credentials for region `ap-southeast-1`
- Serverless Framework CLI (`npm install -g serverless`)
- A Notion integration token with access to the four databases

---

## Environment Variables

All variables are passed to Lambda via `serverless.yml` → `provider.environment`.
For local tooling, copy them into a `.env` file (not committed to source control).

| Variable | Type | Description |
|---|---|---|
| `NOTION_API_KEY` | Secret | Internal integration token from Notion settings |
| `NOTION_ACCOUNT_DATABASE_ID` | DB ID | ID of the Account Notion database |
| `NOTION_TRANSACTION_DATABASE_ID` | DB ID | ID of the Transaction Notion database |
| `NOTION_CATEGORY_DATABASE_ID` | DB ID | ID of the Category Notion database |
| `NOTION_TRANSFER_TRANSACTION_ID` | Page ID | Page ID of the "Transfer" category in the Category DB |
| `NOTION_ADJUSTMENT_TRANSACTION_ID` | Page ID | Page ID of the "Adjustment" category in the Category DB |

> **How to get database IDs**: Open the Notion database, click Share → Copy link. The ID is the 32-character hex string in the URL.
>
> **How to get `NOTION_TRANSFER_TRANSACTION_ID` and `NOTION_ADJUSTMENT_TRANSACTION_ID`**: Open the Category database, find (or create) entries named "Transfer" and "Adjustment" with `Type = Financial`. Open each page and copy the ID from the URL. These are **page IDs**, not database IDs.

---

## Build & Deploy

```bash
# Install dependencies
npm install

# Package only (no deploy — produces .serverless/ directory)
npm run build

# Deploy to AWS
npm run deploy

# Remove all deployed resources from AWS
npm run remove
```

**Bundler**: esbuild via the `serverless-esbuild` plugin (configured in `serverless.yml`).
**Output**: `.serverless/` directory.

---

## Adding a New Endpoint

1. Create or update a handler function in `src/handlers/[domain].handler.ts`
2. Define request/response types in `src/types/request.ts` and `src/types/response.ts`
3. Register the route in `src/handlers/main.ts`:
   ```typescript
   router.register('POST', '/your-path', yourHandler);
   ```
4. Add Notion DB operations to `src/utils/connector.ts` (if new DB access is needed)
5. Follow the `mapPage*` private method pattern for consistent property extraction
6. Document the endpoint in `docs/api-reference.md`
7. Create or update the relevant `docs/feature-*.md`
8. Update the status table in `docs/README.md`

---

## Connector Pattern

All Notion API calls **must** go through `src/utils/connector.ts`.
Never call the Notion SDK directly from handler files.

**Property extractor methods** (private, throw `SchemaError` if type mismatch):

| Method | Notion type | Returns |
|---|---|---|
| `getTitleProperty(page, key)` | Title | `string` |
| `getNumberProperty(page, key, required?)` | Number | `number \| null` |
| `getSelectProperty(page, key, required?)` | Select | `string \| null` |
| `getTextProperty(page, key, required?)` | Rich Text | `string \| null` |
| `getRelationProperty(page, key, required?)` | Relation | `string \| null` |
| `getDateProperty(page, key, required?)` | Date | `number \| null` (epoch ms) |

---

## Error Handling Conventions

| Error class | When to throw | HTTP result |
|---|---|---|
| `QueryError` | Invalid or missing request parameters | 400 |
| `DatabaseError` | Data not found or unexpected DB state | 500 |
| `SchemaError` | Notion property type does not match expectation | 500 |
| _(Notion `APIResponseError`)_ | Thrown by Notion SDK | Mapped by `main.ts` |

Do **not** call `err()` from handlers. Handlers return `ok(data)` on success or throw a typed error. All error mapping is done in `main.ts`.

---

## Code Conventions

- **Handler signature**: `async (req: ReqType): Promise<ResType>` — matches `RouteHandler<Req, Res>` generic
- **Response**: always `return ok(data satisfies ResponseType)` — use `satisfies` to enforce shape
- **Timezone**: always use `Asia/Bangkok` for all timestamp formatting via `moment-timezone`
- **Transaction ID format**: `${categoryId}-${Date.now()}-${amount}` (generated in `addTransaction()`)
- **No direct balance mutation**: every balance change must be accompanied by a transaction record

---

## Running Checks (Pre-commit)

Per `CLAUDE.md` Standard AI Workflow:

```bash
npm run lint    # ESLint
npm run test    # Vitest
npm run build   # serverless package
```

---

## Frontend Reference

| Item | Value |
|---|---|
| Repo | `/Users/thanhson208s/Repos/notion-finance/frontend/` |
| Framework | React 19 + Vite + TypeScript |
| Deploy | Vercel (`notion-finance-sigma.vercel.app`) |
| API base | `https://finance.gootube.online/api` |
| State management | Local `useState` + `useEffect` only (no Redux/Zustand) |
| UI library | Lucide React (icons) + custom CSS (dark theme) |
| Router | React Router DOM v7 |
