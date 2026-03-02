# Notion Finance

Personal finance app — single user, VND currency, Notion as database. No new feature scope — focus on completing what is already planned.

## Stack
| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router 7 — hosted on Vercel |
| Backend | AWS Lambda (Node 20), Serverless Framework — `ap-southeast-1` |
| Database | Notion API (`@notionhq/client`) |
| CDN | CloudFront — `finance.gootube.online` |

## URLs
- App: `https://finance.gootube.online`
- API: `https://finance.gootube.online/api`

## Current Status
- ✅ AccountsPage with all 4 transaction forms fully working
- ❌ ReportsPage, CardsPage — not yet implemented

## Key Files
| File | Role |
|---|---|
| `backend/src/utils/connector.ts` | All Notion API calls |
| `backend/src/handlers/main.ts` | Lambda entry, router, error handling |
| `frontend/src/main.tsx` | SigV4 fetch interceptor |
| `frontend/src/App.ts` | Shared frontend types |

## Docs
→ **[docs/README.md](docs/README.md)** — full table of contents

---

## Working Rules

1. **English only.** All documentation, comments, and guides must be written in professional English.

2. **Keep docs in sync.** Every code change must be reflected in the relevant docs files. Docs must accurately represent the current state of the project at all times to enable seamless handoff across sessions and machines.

3. **Docs describe, don't duplicate.** Docs must not reproduce source code. They list what exists (types, endpoints, patterns) and explain *why* or *how* at a conceptual level. For implementation specifics, read the source. A doc is correct when a reader can understand the full picture from it, not when it mirrors the code.

4. **Requirements first.** Implementations must stay as close to requirements as possible. When new requirements arise, update the relevant `docs/requirements/` files *before* planning or implementing any changes.

5. **Minimal footprint.** Do not modify files unrelated to the current feature. If a change to an unrelated file seems necessary, ask before proceeding.
