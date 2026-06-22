# Attest·COI

A vendor insurance compliance ledger. Property managers track Certificate of Insurance (COI) documents for vendors — uploading PDFs to auto-extract coverage data using Claude, and automatically checking each vendor against coverage minimums by type.

## Run & Operate

- `pnpm --filter @workspace/coi-tracker run dev` — run the frontend (port auto-assigned)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required secret: `ANTHROPIC_API_KEY` — used server-side only for COI PDF extraction

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Wouter routing, TanStack Query, inline brand styles
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: Anthropic Claude (claude-sonnet-4-6) — server-side PDF extraction only
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/vendors.ts` — vendors table (id, name, type, coverages jsonb, etc.)
- `artifacts/api-server/src/routes/vendors.ts` — all vendor + COI + stats routes, Claude extraction
- `artifacts/coi-tracker/src/pages/Dashboard.tsx` — main COI ledger page
- `artifacts/coi-tracker/src/App.tsx` — router + providers

## Architecture decisions

- COI PDF extraction happens **server-side** — the Anthropic API key is never exposed to the browser. The frontend sends base64 PDF to `/api/coi/extract`, the server calls Claude.
- Coverages stored as `jsonb` in Postgres — flexible for varying coverage types without rigid schema.
- Compliance logic runs **client-side** (in the detail panel) for instant feedback; the `/api/stats` endpoint replicates it server-side for the KPI summary row.
- All vendor types and coverage requirements are defined as constants in `artifacts/api-server/src/routes/vendors.ts` (server) and mirrored in `artifacts/coi-tracker/src/pages/Dashboard.tsx` (client).

## Product

- **Compliance ledger**: Table of all vendors with GL limit, earliest expiry date, and status chip (Compliant / Expiring / Non-compliant)
- **KPI cards**: Live counts of total vendors, compliant, expiring ≤30 days, non-compliant
- **Filter tabs**: Filter table by status
- **Detail panel**: Click any vendor row to see per-coverage compliance checks with pass/fail, all coverages on the certificate, and a delete button
- **COI upload**: Upload a PDF → server calls Claude to extract structured data → vendor is added and checked automatically

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- `coverages` is a jsonb column — Drizzle returns it as `unknown`, cast to `any[]` in route handlers
- The `ON CONFLICT DO NOTHING` in seed SQL means re-running the seed is safe
- Coverage type normalization must be kept in sync between client (Dashboard.tsx) and server (vendors.ts)
