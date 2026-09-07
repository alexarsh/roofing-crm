# Roofing CRM & Lead Identification UI

## Context

Roofing companies need a practical CRM for finding and qualifying residential and commercial roofing leads in their service area. The immediate requirement is a map-based CRM that helps sales teams explore local properties, surface roofs that are aging or have stalled open permits, and turn those signals into actionable outreach opportunities.

Data gathering and ingestion pipelines are covered by a separate user story and are **out of scope** for this work. This story assumes property, permit, and related enrichment data are already available for the UI and agent to consume.

## Description

Create a map-based roofing lead CRM that enables users to locate properties from their current GPS position or a pin drop on the map, set a search radius, and review candidate roofs that meet lead criteria—primarily roof age (for example, older than 15 years) and open roofing permits (especially permits that have remained open for many years).

The UI should present property and permit details, including contractor information and BBB rating scores where available. Users should also be able to query the platform in natural language through a RAG-backed agent to discover roofing opportunities (for example, “show me open roofing permits older than five years within five miles of [city xyz]”).

## Acceptance Criteria

- Default the map and search experience to a particular county, with support for exploring properties in the user’s selected area.
- Allow users to center property search on current GPS location and/or a pin dropped on the map.
- Allow users to set a configurable search radius around the selected location.
- Display properties within the radius that have roofs older than a configurable age threshold (default suggestion: 15 years).
- Display properties within the radius that have open roofing permits, with emphasis on permits that have remained open for an extended period.
- Show permit details in the UI, including permit status, age/open duration, contractor name, and BBB rating score when available.
- Present a browsable list of matching roofing lead candidates derived from the map/radius filters.
- Support creating and managing CRM lead records from identified properties and permits.
- Provide a RAG-backed agent that answers natural-language queries about roofing opportunities using available property and permit data.
- Keep data gathering, ingestion, and source-system integration out of scope; consume pre-existing/available datasets.
- Show (disabled) sections on the CRM that would expand the product beyond the initial lead-identification workflow.

## Demo Transcript

- Open the CRM centered on a particular county.
- Drop a pin (or use GPS) and set a search radius.
- Show roofs older than the age threshold (e.g., 15 years) within the radius.
- Highlight properties with open roofing permits, prioritizing long-open permits.
- Open a selected property/permit and review contractor details and BBB rating where available.
- Convert one or more matches into CRM lead records.
- Ask the RAG agent a natural-language query for roofing opportunities in the area and show relevant results.
- Demonstrate filtering leads by roof age, permit status/open duration, and location radius.
- Show disabled/placeholder sections for future CRM expansions beyond lead identification.

## Out of Scope

- Property, permit, ownership, or enrichment data collection and ingestion pipelines (separate story).
- Live BBB API integration beyond displaying scores already present in available data.
- Actual outbound messaging to property owners (can be mocked or deferred).

## Reference

- [Soofi XYZ Team Kit](https://github.com/soofi-xyz/soofi-xyz-team-kit)
- [Elephant Oracle Skills](https://github.com/elephant-xyz/skills)

---

# Solution

This repository now contains the working Roofing CRM described above: a single Next.js 15
(App Router, TypeScript strict, Tailwind v4) application that consumes the published Osceola
dataset **only through the Elephant MCP server** and keeps its own CRM records in Postgres via
Drizzle ORM.

## Routes

| Route                                                         | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                                           | **Map CRM.** MapLibre GL over OSM raster tiles, centred on Osceola County (county selector lists other counties disabled). "Use my location" (browser geolocation, clamped to the county), click-to-drop / drag pin, radius slider 0.5–15 mi, roof-age threshold (default 15 y), toggles for open roofing permits, long-open permits (>= N years, default 5), owner out of state, no sale in 10+ years, property type. Results panel with totals, sortable candidate list, multi-select and **Create leads**. Markers are coloured by lead signal. Clicking a row/marker opens the property drawer: roof age + basis, owner/tenure, values, every permit with status, dates, days open, contractor name/qualifier/phone/license, BBB rating/accredited/profile (or "not available"), and source links. |
| `/leads`                                                      | **Leads list** with filters (status, roof age, permit status / open duration, radius from a named place), inline status changes, per-status counts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/leads/[id]`                                                 | **Lead detail**: snapshot of the property, the roofing-permit snapshot taken at creation (contractor + BBB columns), activity timeline, add note, delete, deep link back to the map.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/assistant`                                                  | **RAG agent** (Vercel AI SDK `useChat` + `streamText`, `@ai-sdk/anthropic`). Shows every tool call and SQL statement inline. Renders a clear notice when `ANTHROPIC_API_KEY` is absent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `/coming-soon/{outreach,quotes,crews,reporting}`              | Placeholder pages for the **disabled future sections** shown greyed-out in the sidebar (tooltips say "coming soon"); each explains what it would do and what it depends on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/api/search`, `/api/properties/[parcelId]`                   | Read-only JSON over MCP (radius candidates + totals; property detail + permits).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/api/leads`, `/api/leads/[id]`, `/api/leads/[id]/activities` | CRM CRUD (create from one or many parcels, list with filters, status update, note, delete).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/api/chat`                                                   | AI SDK UI-message stream for the assistant (503 without a key).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/api/health`                                                 | MCP / database / assistant status.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

## Architecture

```
app/                    Next.js routes (pages + route handlers, all Node runtime)
components/             map/ (MapLibre, controls, results, drawer), leads/, assistant/, nav/, ui/
lib/config/             county constants (copied from the pipeline, no cross-repo dependency), env (Zod), sections
lib/mcp/                MCP client (streamable HTTP) + McpDataSource interface  <-- the ONLY data boundary
lib/queries/            SQL builders (numbers/enums/validated ids only; ILIKE escaping), haversine, row mappers
lib/db/                 Drizzle schema, driver switch (pg | neon-http), lead repository, FTS knowledge retrieval
lib/leads/              pure mappers property -> lead / permit snapshot / priority
lib/agent/              tools (DI for tests), system prompt, model factory, knowledge docs, production wiring
lib/services/           search + lead-creation orchestration over MCP
drizzle/                generated SQL migrations (`npm run db:generate`), applied by `npm run db:migrate`
scripts/                migrate, seed-knowledge, agent-smoke (tool layer without an LLM)
tests/                  Vitest: SQL builders, haversine, mappers, geocoder, agent tools (MockLanguageModelV2)
```

**Data boundary.** Property, permit and contractor facts are read exclusively via the MCP tools
`getPropertyQuerySchema`, `queryProperties`, `getPermitQuerySchema`, `queryPermits` and
`findPropertiesInArea` (`lib/mcp/client.ts`). No parquet, IPFS, DuckDB or Neon query-db access
exists in this app. SQL sent to MCP is generated by tested builders that interpolate only
validated numbers, whitelisted enums and pattern-checked identifiers; free text is escaped for
`ILIKE`. Agent-authored SQL additionally passes `assertReadOnlySelect` before it leaves the app,
and the MCP server enforces single read-only SELECT with a 1000-row cap.

**Lead signals.** A candidate matches when it is inside the radius and (`roof_age_years >=
threshold` OR it has an open roofing permit). Signal = `long_open_permit` (oldest open roofing
permit >= N years) > `open_permit` > `aged_roof`; priority (high/medium/low) is derived from it.
Roof age comes from the dataset's `roof_age_basis` (`roof_permit` | `built_year` proxy |
`unknown`) and the UI always shows the basis.

**CRM schema** (`lib/db/schema.ts`): `leads` (id, parcel_id unique, address, lat, lng, status
enum new/contacted/qualified/quoted/won/lost, priority, signal, roof_age_years, roof_age_basis,
open_roof_permit_count, oldest_open_roof_permit_days, owner_name, owner_mail_state,
owner_out_of_state, market_value, last_sale_date, notes, source_urls[], timestamps),
`lead_permits` (snapshot at creation: permit_number, status, is_open, days_open, dates,
contractor name/qualifier/phone/license, bbb_rating/accredited/profile_url, source_url),
`lead_activities` (created / note / status_change), `knowledge_chunks` (documentation chunks with
a generated weighted `tsvector` + GIN index).

**Retrieval design (assistant).**

1. Structured retrieval tools over MCP: `getSchema`, `queryProperties`, `queryPermits`,
   `findPropertiesInArea`, plus `searchRoofingLeads` / `searchOpenRoofPermits` that reuse the
   tested query builders, and `geocodePlace` for Osceola places (Kissimmee, St. Cloud,
   Celebration, Poinciana, Harmony).
2. A small local knowledge index of the dataset documentation (column meanings, coverage
   caveats, how roof age is derived, BBB matching method, query rules) stored as chunks in
   Postgres and retrieved lexically with `websearch_to_tsquery` / `ts_rank_cd` (`searchKnowledge`).
3. `createLead` converts result parcels into CRM leads on explicit request.
   The system prompt requires: restate the question + inferred filters, schema first, one read-only
   SELECT, capped rows, cite `source_url(s)`, list assumptions and missing data. Model:
   `claude-sonnet-4-5` unless `AGENT_MODEL` is set; up to 10 tool steps per turn.

## Environment variables

| Variable                | Purpose                                                                 | Default                                   |
| ----------------------- | ----------------------------------------------------------------------- | ----------------------------------------- |
| `ORACLE_MCP_URL`        | Elephant MCP streamable-HTTP endpoint                                   | `http://localhost:8877/mcp`               |
| `ORACLE_MCP_AUTH_TOKEN` | Optional bearer token for the MCP server                                | –                                         |
| `ORACLE_MCP_COUNTY`     | County key served by the MCP query tables                               | `osceola`                                 |
| `DATABASE_URL`          | Postgres for leads / activities / knowledge index                       | – (required for CRM features)             |
| `DB_DRIVER`             | `pg` (node-postgres) or `neon` (`@neondatabase/serverless` HTTP driver) | `pg` (auto-`neon` for `*.neon.tech` URLs) |
| `ANTHROPIC_API_KEY`     | Enables the assistant                                                   | – (UI shows a notice when absent)         |
| `AGENT_MODEL`           | Anthropic model id for the assistant                                    | `claude-sonnet-4-5`                       |

## Local development

```bash
# 1. Elephant MCP server (from the sibling pipeline's published query tables)
cd ../elephant-mcp && R=../osceola/artifacts/runs/<run>/query-tables && \
  MCP_HTTP_STANDALONE=1 PORT=8877 \
  PROPERTY_QUERY_TABLE_MAP="{\"osceola\":\"$R/properties.parquet\"}" \
  PERMIT_QUERY_TABLE_MAP="{\"osceola\":\"$R/permits.parquet\"}" \
  PROPERTY_QUERY_TABLE_DEFAULT_COUNTY=osceola PERMIT_QUERY_TABLE_DEFAULT_COUNTY=osceola \
  node dist/server-http.js

# 2. Postgres
docker run -d --name crm-pg -e POSTGRES_PASSWORD=crm -p 5433:5432 postgres:16

# 3. App
cp .env.example .env.local        # set DATABASE_URL=postgres://postgres:crm@localhost:5433/postgres
npm install
npm run db:migrate                # applies drizzle/*.sql
npm run db:seed                   # knowledge index (also self-seeds on first assistant use)
npm run dev                       # http://localhost:3000

# Quality gates
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
npm run agent:smoke               # exercises the assistant tool layer without an LLM key
```

## Deploy (Vercel Hobby + Neon)

1. Create a Neon project (or add the Neon integration to the Vercel project); copy the pooled
   connection string.
2. `vercel link`, then set env vars: `DATABASE_URL` (Neon), `DB_DRIVER=neon`, `ORACLE_MCP_URL`
   (a reachable MCP deployment, e.g. the pipeline's HTTP MCP behind a token),
   `ORACLE_MCP_AUTH_TOKEN`, `ORACLE_MCP_COUNTY=osceola`, `ANTHROPIC_API_KEY`, optional
   `AGENT_MODEL`.
3. Run migrations once from a shell with the Neon unpooled URL: `DATABASE_URL=... npm run db:migrate`.
4. `vercel --prod`. All routes run on the Node runtime; `next build` needs no secrets.

Zero standing cost: Vercel Hobby and Neon free tier scale to zero; the MCP server reads static
parquet artifacts.

## Kit conformance and deviations

- **Data via MCP only** (`use-elephant-mcp`): honoured; `county` is passed on every call, schema
  is fetched before SQL, counts are computed with aggregates rather than paged rows.
- **All LLM calls through the Vercel AI SDK** (`stack-ai-sdk-for-llm`): `ai` + `@ai-sdk/anthropic`,
  Zod `inputSchema` on every tool, no `any`, strict TypeScript. `ToolLoopAgent` is not in AI SDK 5;
  the equivalent `streamText` + `stopWhen: stepCountIs(10)` loop is used.
- **Own tables via Drizzle** (`use-elephant-query-db` conventions): server-only access, `DATABASE_URL`
  from the platform, checked-in migrations, `pg` locally / Neon driver in production.
- **Testing** (`testing-strategy`): Vitest unit tests for builders, geo, mappers and agent tools
  (`MockLanguageModelV2` from `ai/test`); ESLint + Prettier + `tsc` in `.github/workflows/ci.yml`.
- **Retrieval design** (`build-local-rag-pocs` principles): explicit data boundary, deterministic
  chunk ids, metadata (source/title/section), lexical retrieval; no embeddings are used because the
  corpus is ten documentation chunks and the kit prefers not to send content to an embedding
  provider without an approved boundary. A vector index can be added later without changing the
  tool contract.
- **Hosting deviation:** the kit's Amplify + CDK/Lambda path is replaced by Vercel + Neon because
  the assignment requires zero standing cost and there is no AWS account; the app is a single Next.js
  project rather than a tRPC monorepo for the same reason.

## Observed numbers (local run against the 2026-09-07 query tables)

- Dataset: 210,853 properties (210,141 geocoded; roof age known for 170,813; 201 parcels with an
  open roofing permit; 34,846 out-of-state owners). Permits: 317,197 (14,735 roofing, 329 open
  roofing, 15 open >= 5 years); **no permit row carries a BBB match in this run**, so every BBB
  field renders "not available".
- Radius search 5 mi around Kissimmee, roof age >= 15: **39,375 candidates** (39,267 aged roofs,
  117 with open roofing permits, 6 long-open >= 5 y, 5,520 out-of-state owners); the UI shows the
  top 500 by priority and the totals.
- Long-open only (>= 5 y): 6 parcels; top is 333 W Columbia Ave, Kissimmee (3 open roofing
  permits, oldest 10,177 days / 27.9 y, permit 98-3642).
- Assistant tool query "open roofing permits older than five years within five miles of
  Kissimmee": 8 permits.

## Notes

- **MapLibre worker.** MapLibre v6 resolves its web-worker URL from `import.meta.url`, which
  webpack rewrites to a `file://` path, so GeoJSON layers never render. `postinstall` copies
  `maplibre-gl-worker.mjs` + `maplibre-gl-shared.mjs` into `public/` (gitignored) and the map
  calls `setWorkerUrl("/maplibre-gl-worker.mjs")`. Vercel runs `postinstall`, so no extra step.
- `next build` prints one benign webpack warning ("Critical dependency") from
  `@ai-sdk/provider-utils`; it has no runtime effect.
- Set `ORACLE_MCP_URL` to wherever the MCP server listens (local default port 8877).

## Limitations

- BBB ratings, contractor phone/license are displayed when present but are NULL for all rows in
  the current run; the UI says "not available" rather than inferring.
- The MCP server caps a query at 1000 rows; the map shows the top 500 by priority plus exact totals.
- Geocoding is limited to the county's named places; the assistant asks for coordinates otherwise.
- The county selector is fixed to Osceola; other counties are visible but disabled.
- Owner contact (phone/email) is not in the dataset; Outreach is a disabled future section.
- Lead permit data is a snapshot taken at creation time and is not refreshed automatically.
