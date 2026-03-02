# Docs — Table of Contents

Technical documentation for **notion-finance**. Start with [CLAUDE.md](../CLAUDE.md) for a high-level overview, then navigate to the relevant section below.

---

## Architecture
System design and database structure.

- [architecture/overview.md](architecture/overview.md) — System diagram, CloudFront setup, request flow, error handling
- [architecture/notion-schema.md](architecture/notion-schema.md) — Notion DB schemas, transaction semantics, environment variables

## API
All endpoints with request/response schemas.

- [api/accounts.md](api/accounts.md) — `GET /accounts`, `POST /adjustment`
- [api/categories.md](api/categories.md) — `GET /categories`
- [api/transactions.md](api/transactions.md) — `POST /expense`, `POST /income`, `POST /transfer`, GET stubs, error codes

## Types
TypeScript types and data models.

- [types/backend.md](types/backend.md) — Account, Category, Transaction, all DTOs, error classes
- [types/frontend.md](types/frontend.md) — Frontend types (simplified subset), account metadata maps

## Requirements
Product requirements and implementation state.

- [requirements/pages.md](requirements/pages.md) — Detailed spec for all 4 pages (Accounts, Reports, Cards, Promotions)
- [requirements/status.md](requirements/status.md) — Done / Stub / TODO by priority + known issues

## Guides
Code patterns and conventions.

- [guides/backend.md](guides/backend.md) — Adding routes, connector patterns, error handling
- [guides/frontend.md](guides/frontend.md) — Fetch pattern, form state machine, amount input, CSS naming, icons
- [guides/styling.md](guides/styling.md) — Design principles, CSS variables, color palette, typography, spacing, component styles
