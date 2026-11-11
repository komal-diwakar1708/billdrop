# BillDrop — Tell Claude. Get paid.

Invoicing for freelancers and small studios that runs on **your own Claude**. You describe the work in
Claude (or paste an email thread / timesheet photo); Claude calls BillDrop over MCP; a draft invoice
appears in your BillDrop dashboard; you tweak it, publish it, and send your client one live link.
BillDrop then keeps working after the chat ends: hosting the invoice page, tracking when the client
opens it, flagging it overdue, and recording payment.

**There is no AI inside BillDrop.** No OpenAI/Anthropic SDKs or keys anywhere — the customer's Claude
plan pays for the thinking; BillDrop only pays for hosting.

## Try it

| | |
|---|---|
| Live app | https://billdrop-eta.vercel.app |
| Demo login | `demo@billdrop.app` / `billdrop-demo` (or click **Try the live demo**) |
| Demo MCP URL | Shared privately in the submission email, and shown on the **Connect Claude** page after logging in |

### Connect it to Claude (2 minutes)

1. Open **claude.ai → Settings → Connectors** (`https://claude.ai/settings/connectors`).
2. Click **Add custom connector**, name it `BillDrop`, paste the MCP URL above, click **Add**.
   No OAuth or API key is needed — the URL itself is the secret.
3. Start a new chat, make sure **BillDrop** is enabled in the tools menu, and ask for example:
   > Invoice Lumen Labs (finance@lumenlabs.io) for 3 days of UX research at $750/day and $90 for
   > user-testing incentives. Due in 14 days, add 18% GST.
4. Open the dashboard — the draft is already there (it auto-refreshes). Edit a line, click
   **Publish & get link**, open the client page.

Every account has its own MCP URL on the **Connect Claude** page.

## MCP tools

| Tool | What it does |
|---|---|
| `create_invoice` | Create a draft invoice (client, line items, currency, dates, tax, discount, notes) |
| `update_invoice` | Edit any field; `items` replaces the full list |
| `get_invoice` | Full details + edit/client links |
| `list_invoices` | Filter by status (`unpaid`, `overdue`, …) or client |
| `send_invoice` | Publish and return the client link |
| `mark_invoice_paid` | Record payment |
| `get_business_summary` | “Who owes me money?” — outstanding, overdue, paid this month |
| `list_clients` | Saved clients |

Claude sends amounts in major units (e.g. `800`); BillDrop stores integer cents and computes all
subtotals, tax and discounts itself.

## Architecture

- **Next.js 16 (App Router)** — web app, server actions and the MCP endpoint in one deploy.
- **MCP**: official `@modelcontextprotocol/sdk`, stateless Streamable HTTP at `/api/mcp/[token]`
  (serverless-friendly: a fresh server per request, JSON responses).
- **Postgres** via Drizzle ORM — Neon in production (`DATABASE_URL`), embedded PGlite locally when
  `DATABASE_URL` is unset. Tables are created automatically on first request and a demo account is seeded.
- **Auth**: email + password (bcrypt) with an http-only session cookie; MCP auth by per-user secret URL.

```
src/
  app/api/mcp/[token]/route.ts   MCP endpoint
  mcp/server.ts                  tool definitions
  lib/invoices.ts                invoice domain logic (shared by MCP + web)
  lib/money.ts                   totals, currency, dates
  app/(app)/…                    dashboard, invoice editor, connect, settings
  app/i/[token]/page.tsx         public client invoice page
  db/                            schema, DDL, demo seed
```

## Run locally

```bash
npm install
echo "DEMO_MCP_TOKEN=bd_demo_local_token" > .env.local
npm run dev
# MCP URL: http://localhost:3000/api/mcp/bd_demo_local_token
```

Test the MCP server without Claude: `npx @modelcontextprotocol/inspector` → Streamable HTTP → the URL above.

## Deploy (Vercel + Neon)

1. Push this repo to GitHub and import it in Vercel.
2. Add a Neon Postgres database (Vercel → Storage → Neon) so `DATABASE_URL` is set.
3. Set `DEMO_MCP_TOKEN` to a long random string (e.g. `bd_` + 32 random characters).
4. Optionally set `APP_URL` to your production URL so links in MCP responses always use it.
5. Deploy. The first request creates the tables and the demo account.
