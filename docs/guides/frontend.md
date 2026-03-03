# Guide — Frontend Patterns

## API Call Pattern

Use `useEffect` with an `AbortController` for data fetching. The effect creates the controller, fires an async IIFE, handles errors by falling back to a default value, and returns a cleanup that calls `abort()` on unmount. See existing pages for the exact pattern.

## Form State Machine

Each form uses a discriminated union `Status` type with four states: `idle`, `loading`, `success` (with response data), `error` (with error data).

Flow: `idle → loading → success | error → idle` (reset via "Log again" / "Try again" button).

Submit sequence:
1. **Validate** — set field errors and return early if invalid
2. Set status to `loading`
3. POST the payload; on non-OK response set status to `error`; on success set status to `success`
4. On network exception, reset to `idle`

## Amount Input

Do not use `<input type="number">`. Use a controlled text input with `inputMode="numeric"` and an `onKeyDown` handler: Backspace trims the last digit (`Math.floor(amount / 10)`), digit keys append (`amount * 10 + digit`). Display value is formatted with `toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })`.

## Category Dropdown

Categories are hierarchical. Render top-level items as `<optgroup>` if they have children (and also add the parent itself as a selectable option inside its own group), or as a plain `<option>` if they are leaf nodes.

## CSS Class Naming

| Context | Classes |
|---|---|
| Page | `.page` |
| Account card | `.account-card`, `.account-info`, `.account-title`, `.account-balance` |
| Account type badge | `.account-cash`, `.account-bank`, `.account-credit`, `.account-ewallet`, `.account-savings`, `.account-paylater`, `.account-prepaid`, `.account-gold` |
| Action buttons | `.action-btn`, `.expense`, `.income`, `.transfer`, `.adjustment` |
| Form | `.form-main`, `.form-row`, `.form-col`, `.form-buttons`, `.form-btn`, `.submit-btn`, `.retry-btn` |
| Form states | `.submit-state`, `.circle-loading`, `.circle-state`, `.circle-success`, `.circle-error` |
| Validation error | `.input-error` |
| Transaction page header | `.transaction-header`, `.back-btn`, `.transaction-title` |
| Transaction page body | `.transaction-body` |

See [guides/styling.md](styling.md) for visual specs (colors, sizes, spacing).

## Icons (`lucide-react`)

| Icon | Used for |
|---|---|
| `ArrowDownRight` | Expense |
| `ArrowUpRight` | Income |
| `ArrowLeftRight` | Transfer |
| `Pencil` | Adjustment |
| `Hash` | Amount field |
| `Radar` | Category field |
| `BanknoteArrowDown` | Transfer — from account |
| `BanknoteArrowUp` | Transfer — to account |
| `ArrowUpDown` | Switch from/to in TransferForm |
| `ChevronLeft` | Back button on transaction pages |

## SigV4 Note

`main.tsx` patches the global `fetch` to add the `x-amz-content-sha256` header to all POST requests before the app mounts. No additional work is needed inside individual components.

## API Base URL

Currently hardcoded: `https://finance.gootube.online/api`

## Routing (`App.tsx`)

| Path | Page |
|---|---|
| `/` | AccountsPage |
| `/expense/:accountId` | ExpensePage |
| `/income/:accountId` | IncomePage |
| `/transfer/:accountId` | TransferPage |
| `/adjustment/:accountId` | AdjustmentPage |
| `/reports` | ReportsPage |
| `/cards` | CardsPage |
| `/promos` | PromotionsPage |

NavBar is rendered at the bottom of the screen and uses React Router `<Link>`. The accounts tab stays highlighted on all `/expense`, `/income`, `/transfer`, `/adjustment` routes via `useLocation` in `NavBar.tsx`.

## Transaction Pages (`ExpensePage`, `IncomePage`, `TransferPage`, `AdjustmentPage`)

Each transaction form has its own full-screen page under `frontend/src/pages/`. They share `TransactionPage.css` for the sticky header (back button + title). Clicking an action button on an account card navigates to the corresponding page via `useNavigate`. The back button calls `navigate(-1)` to return to AccountsPage.

`TransferPage` fetches the accounts list independently (same pattern as AccountsPage) and passes it to `TransferForm`.
