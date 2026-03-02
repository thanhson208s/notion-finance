# Guide — Backend Patterns

## Adding a New Route

1. Create a handler in `backend/src/handlers/*.handler.ts` typed as `RouteHandler<Req, Res>`
2. Register it in `main.ts` via `router.register(method, path, handler)`
3. Add the request and response types to `request.ts` and `response.ts`

Use `satisfies MyResponse` on the return value for compile-time shape checking.

## Connector Patterns

All Notion API calls go through `connector.ts`. Use the appropriate method per operation:

| Operation | Notion API | When |
|---|---|---|
| List records | `dataSources.query` | Fetching multiple items |
| Fetch one | `pages.retrieve` | Fetching a single record by ID |
| Create | `pages.create` | Inserting a new record |
| Update | `pages.update` | Updating an existing record |

> **Important**: Use `dataSources.query` for list queries — NOT `databases.query`.

### Property Mappers

Private methods on `Connector` extract typed values from Notion page objects. All accept a `required: boolean` generic that changes the return type between `T` and `T | null`. Available mappers: `getTitleProperty`, `getNumberProperty`, `getSelectProperty`, `getRelationProperty`, `getDateProperty`, `getTextProperty`.

When adding a new entity type, add a corresponding `mapPageTo*` method in `connector.ts`.

## Error Handling

Handlers do **not** need try/catch — throw and let `main.ts` handle it:

| Error class | Use when | HTTP |
|---|---|---|
| `SchemaError` | Notion property has wrong type or is missing | 500 |
| `QueryError` | Bad or missing request query parameter | 400 |
| `DatabaseError` | Notion page not found or update failed | 500 |

Query parameter helpers in `helper.ts`: `getQueryInt(query, key, required)` and `getQueryString(query, key, required)`. Required params throw `QueryError` if absent; optional ones return `null`.

## Response Helpers

`ok(data)` returns `{ statusCode: 200, body: data }`.

`err(status, code, message)` returns `{ statusCode: status, body: { code, message } }`.

## Environment Variables

See full mapping in [architecture/notion-schema.md](../architecture/notion-schema.md#environment-variables).
