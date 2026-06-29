# Bridger Agent — Engineering Guide

AI-assisted bookkeeping for accountants. An accountant reviews a client's bank
transactions, where an AI proposes a **category** (chart-of-accounts account) and
a **vendor** for each, then **approves**, **corrects**, or **requests more info**
from the client. Corrections are captured as feedback to improve the model.

## Stack
Next.js 15 (App Router) · TypeScript · React · Tailwind · Apollo Client (frontend) ·
GraphQL Yoga (single endpoint at `/api/graphql`) · Prisma · SQLite · `@anthropic-ai/sdk`.

External systems (QuickBooks Online) are **mocked from CSV fixtures** — no live QBO
calls. Treat any `qbo*` field/integration as CSV-backed.

## Architecture & request flow
```
React (components/*) → Apollo → POST /api/graphql (Yoga)
   → resolver (server/modules/<entity>/api.ts) → Prisma → SQLite
   → (AI categorization) @anthropic-ai/sdk → Claude
```

## Where things live
| Path | Role |
|---|---|
| `prisma/schema.prisma` | data model (source of truth) |
| `prisma/seed.ts` | deterministic seed (`npm run prisma:seed`) |
| `src/app/api/graphql/route.ts` | GraphQL `typeDefs` + resolver wiring |
| `src/server/modules/<entity>/api.ts` | **one resolver per file** (the repo pattern) |
| `src/components/<Name>/<Name>.tsx` + `.api.ts` | component + its gql operations |
| `src/lib/db.ts` | Prisma client singleton |

**Adding a feature:** model → `db push`/migrate → resolver in a `server/modules/<entity>/api.ts` file → register in `route.ts` (`typeDefs` AND `resolvers`) → component + `.api.ts`.

## Data model (current)
`Client` → `BankAccount[]`, `Category[]`, `Vendor[]`. `Category`/`Vendor` are
**client-scoped** (carry `clientId`). `Transaction` belongs to a `BankAccount` and
references category/vendor by **FK id**, split into AI suggestion vs accountant-final:
`aiCategoryId`/`finalCategoryId`, `aiVendorId`/`finalVendorId`, plus
`aiNewVendorName`/`finalNewVendorName` for vendors not yet in QBO. `status` ∈
`DRAFT | ACCEPTED | SENT`; `confidence` ∈ `HIGH | LOW`. `Feedback` stores why an
accountant overrode the AI (model-improvement signal).

## GraphQL contract
Queries: `bankAccounts(clientId)`, `transactions(bankAccountId)`, `categories(clientId)`, `vendors(clientId)`.
Mutations (some pending): `categorizeTransactions(ids)`, `updateTransaction(id, finalCategoryId, finalVendorId, finalNewVendorName, status)`, `acceptAll(ids)→ACCEPTED`, `sendEmail(ids)→SENT`, `submitFeedback(transactionId, feedback)`.
Transaction queries return **FK ids, not nested objects** — the frontend maps ids→names via the `categories`/`vendors` lists.

## Hard rules (these break things)
- **SQLite has no Prisma enums** → `status`/`confidence` are `String`, never `enum`.
- **GraphQL has no DateTime scalar** → resolvers return `date.toISOString()`.
- **Money is `amountCents: Int`** — never Float; negative = debit.
- **Migrations adding a required FK column** must reseed or backfill (NOT NULL + no default fails on a populated table).
- **Frontend writes use `useMutation`** + `refetchQueries` (or optimistic) or the table shows stale data.
- **Nullable Prisma fields stay nullable in GraphQL** (no trailing `!`).
- **Claude / `@anthropic-ai/sdk` calls are server-side only** (resolvers) — never in a `"use client"` component; the API key must not reach the browser.
- **Keep one resolver per `server/modules/<entity>/api.ts` file** — don't inline resolvers in `route.ts`.

## Claude (categorization)
`new Anthropic()` reads `ANTHROPIC_API_KEY` from `.env.local`. Model: `claude-haiku-4-5`.
Use structured output (Zod + `messages.parse`), constrain category output to the
client's `Category` list, and batch many transactions into one call.

## Dev commands
```
npm run dev                 # app → localhost:3000
npm run prisma:studio       # DB browser → localhost:5555
npx prisma migrate reset --force   # rebuild DB from migrations + seed
npm run prisma:seed         # reseed only
```

## Product behaviors (UI)
- Transactions sort **needs-review (DRAFT) → SENT → ACCEPTED**; low-confidence first within a group.
- Row color: green = high confidence, red = low/needs review, amber = info requested.
- Accountant can **hide accepted**, multi-select for bulk **Approve** / **Request Info**.
- Overriding an AI category/vendor opens a **feedback modal** → saved via `submitFeedback`.
