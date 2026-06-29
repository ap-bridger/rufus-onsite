# Bridger Agent — AI Transaction Categorization

An accountant's cockpit for reviewing bank transactions. Claude proposes a
**category** and **vendor** (with a confidence level) for every transaction; the
accountant reviews, corrects, and approves; unclear transactions get an info
request sent to the client. Every AI suggestion is kept **separate** from the
accountant-approved value, so there's always a clean review trail — and a
feedback signal to improve the model over time.

> The AI is an assistant, not the source of truth. The product is built around
> *earning the accountant's trust*: the human always sees what the AI guessed,
> how confident it was, and stays the one who approves.

---

## The workflow

```
Import txns ──▶ Categorize (AI) ──▶ Review ──▶ Accept / Override ──▶ Approve
                     │                  │              │
                 Claude fills      HIGH = green    overrides are
                 ai* fields +      LOW  = red      captured as Feedback
                 confidence                        (eval set)
                                        └──▶ Unclear? ──▶ Request info (email)
```

1. **Categorize** — Claude classifies a batch of transactions in one call,
   constrained to the client's real categories/vendors (no hallucinated values).
2. **Review** — rows are colored by confidence (HIGH = green, LOW = red) so the
   accountant's eye goes straight to what needs attention.
3. **Accept / Override** — approve the AI's pick, choose a different category or
   vendor, or type a brand-new vendor (created as a real record + "pushed to
   QBO", mocked here).
4. **Request info** — for ambiguous transactions, send the client an info
   request and mark the row `SENT`.
5. **Feedback** — every override is recorded against the transaction, building
   an eval set to measure and improve categorization quality.

---

## Architecture

```
React (App Router, "use client")
  └─ Apollo Client
       └─ /api/graphql  ── GraphQL Yoga  (Next.js route handler)
            └─ resolvers (src/server/modules/*)
                 ├─ Prisma ─▶ SQLite (prisma/dev.db)
                 └─ @anthropic-ai/sdk ─▶ Claude (claude-haiku-4-5)
```

**Stack:** Next.js 15 · TypeScript · React · Tailwind · Apollo Client ·
GraphQL Yoga · Prisma · SQLite · @anthropic-ai/sdk (Claude).

Claude calls are **server-side only** (inside resolvers) — the API key never
reaches the browser.

---

## Getting started

```bash
npm install                 # install deps
npx prisma db push          # create the SQLite schema
npm run prisma:seed         # seed clients, categories, vendors, transactions
npm run dev                 # http://localhost:3000
```

Requires `ANTHROPIC_API_KEY` in `.env.local` (used by the categorization
resolver). The GraphQL playground is at `http://localhost:3000/api/graphql`.

---

## Data model

| Model | Purpose |
|-------|---------|
| `Client` | An accounting client (the company whose books are kept). |
| `BankAccount` | A client's bank account; transactions belong to one. |
| `Category` | Chart-of-accounts category (mirrors a QBO account). |
| `Vendor` | A vendor/payee (mirrors a QBO vendor). |
| `Transaction` | A bank transaction. Holds **both** the AI suggestion (`aiCategoryId`, `aiVendorId`, `aiNewVendorName`, `confidence`) **and** the approved value (`final*`), plus `status`. |
| `Feedback` | A record of an accountant override — the eval/training signal. |

`status` and `confidence` are stored as strings (SQLite has no Prisma enums);
`status` is validated at the API boundary by the GraphQL `TransactionStatus`
enum. Money is stored as `amountCents` (Int), never a float. Dates are returned
as ISO strings over GraphQL.

---

## GraphQL API

### Queries
```graphql
greetings: String                                  # legacy scaffold example
bankAccounts(clientId: ID!): [BankAccount!]!
transactions(bankAccountId: ID!): [Transaction!]!
vendors(clientId: ID!): [Vendor!]!
categories(clientId: ID!): [Category!]!
```

### Mutations
```graphql
# AI: classify a batch of transactions (writes the ai* fields + confidence)
categorizeTransactions(ids: [ID!]!): [Transaction!]!

# Human: accept / override / undo. category|vendor|newVendorName only with ACCEPTED;
# a typed-in newVendorName creates a real Vendor and links it.
updateTransaction(
  id: ID!
  status: TransactionStatus!        # DRAFT | ACCEPTED | SENT
  category: ID
  vendor: ID
  newVendorName: String
): Transaction!

acceptAll(ids: [ID!]!): [Transaction!]!            # bulk-approve AI suggestions
sendEmail(ids: [ID!]!): [Transaction!]!            # request info → status SENT
submitFeedback(transactionId: ID!, feedback: String!): Feedback!
```

### Status state machine
- **DRAFT** → not yet reviewed (or override undone; clears `final*`).
- **ACCEPTED** → approved; the accountant's choices are persisted to `final*`.
- **SENT** → an info request was sent to the client; final fields untouched.

---

## How a feature is added (the loop)

1. `prisma/schema.prisma` — add/modify models → `npx prisma db push`
2. `src/app/api/graphql/route.ts` — add to **both** `typeDefs` and `resolvers`
3. `src/server/modules/<thing>/` — resolver logic (Prisma + Claude)
4. `src/components/<Thing>/` — component + `<Thing>.api.ts` (gql ops)

See `CLAUDE.md` for the full conventions and the hard rules that keep the
GraphQL/Prisma/SQLite/Claude layers consistent.

---

## Design decisions & scope

- **AI suggestion ≠ approved value.** The `ai*` and `final*` fields are kept
  apart deliberately — it's the review trail, the trust mechanism, and the eval
  set, all at once.
- **Batched categorization.** All selected transactions go to Claude in a single
  structured-output call, constrained to the client's allowed lists.
- **QBO is mocked.** "Create vendor in QuickBooks" / `qboId`s are stubs scoped
  for this build; the data model is shaped so a real Intuit integration drops in
  later (and could generalize to Xero / NetSuite).

## Useful commands

```bash
npm run dev              # run the app
npm run prisma:studio    # browse the SQLite DB
npm run prisma:seed      # reseed sample data
npm run build            # production build
```
