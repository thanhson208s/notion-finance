# Notion Database Schema

## Accounts DB (`NOTION_ACCOUNT_DATABASE_ID`)

| Property | Notion Type | Notes |
|---|---|---|
| Name | title | Account name |
| Type | select | AccountType enum |
| Balance | number | Current balance in VND |

## Transactions DB (`NOTION_TRANSACTION_DATABASE_ID`)

| Property | Notion Type | Notes |
|---|---|---|
| ID | title | `{categoryId}-{timestamp}-{amount}` |
| Timestamp | date | Asia/Bangkok timezone |
| Amount | number | Always positive |
| FromAccount | relation | Empty for income transactions |
| ToAccount | relation | Empty for expense transactions |
| Category | relation | Required |
| Note | rich_text | Optional |
| Linked card | relation | Optional — used for credit card transaction tracking |

## Categories DB (`NOTION_CATEGORY_DATABASE_ID`)

| Property | Notion Type | Notes |
|---|---|---|
| Name | title | Category name |
| Type | select | `Income` \| `Expense` \| `Financial` |
| Parent item | relation | Empty for top-level categories |

Categories are hierarchical: top-level items have `parentId: null`, sub-categories reference their parent.

## Transaction Semantics

| Type | FromAccount | ToAccount | Category |
|---|---|---|---|
| Expense | accountId | — | User-selected expense category |
| Income | — | accountId | User-selected income category |
| Transfer | fromAccountId | toAccountId | `NOTION_TRANSFER_TRANSACTION_ID` |
| Adjustment (decrease) | accountId | — | `NOTION_ADJUSTMENT_TRANSACTION_ID` |
| Adjustment (increase) | — | accountId | `NOTION_ADJUSTMENT_TRANSACTION_ID` |

## Environment Variables

| `.env` key | Lambda env key | Used in |
|---|---|---|
| `NOTION_API_KEY` | `NOTION_API_KEY` | `connector.ts` |
| `NOTION_ACCOUNT_DATABASE_ID` | `NOTION_ACCOUNT_DATABASE_ID` | `connector.ts` |
| `NOTION_TRANSACTION_DATABASE_ID` | `NOTION_TRANSACTION_DATABASE_ID` | `connector.ts` |
| `NOTION_CATEGORY_DATABASE_ID` | `NOTION_CATEGORY_DATABASE_ID` | `connector.ts` |
| `NOTION_TRANSFER_TRANSACTION_ID` | `NOTION_TRANSFER_TRANSACTION_ID` | `connector.ts` |
| `NOTION_ADJUSTMENT_TRANSACTION_ID` | `NOTION_ADJUSTMENT_TRANSACTION_ID` | `account.handler.ts` |

> **Note**: `.env` keys use plural suffixes (`ACCOUNTS`, `TRANSACTIONS`, `CATEGORIES`) while the Lambda environment uses singular forms. The mapping is handled in `serverless.yml`.
