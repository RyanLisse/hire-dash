# Tech stack for an AI recruitment operations platform

**Supabase (or Neon) for the database, Encore.dev for backend orchestration, and Next.js App Router with shadcn/ui form the strongest foundation for this platform.** The deciding factor across all three layers is the platform's demand for strong relational integrity — foreign keys, delete guards, compound unique constraints — which eliminates Convex and points firmly toward PostgreSQL. Encore.dev then emerges as the ideal backend framework because it provides built-in PostgreSQL, cron scheduling, Pub/Sub, and streaming APIs — precisely the primitives needed for scraper pipelines, AI orchestration, and real-time dashboards. On the frontend, the App Router's nested layouts and Server Components pair naturally with TanStack Query and the Vercel AI SDK to handle the data-heavy, streaming-intensive UI this platform requires.

---

## The database layer demands PostgreSQL, not Convex

The platform's explicit requirements for **referential integrity** — delete guards blocking candidate removal when linked applications exist, compound unique constraints on candidate+job pairs, email uniqueness, and external source ID deduplication — make this decision clear. PostgreSQL enforces all of these at the engine level, race-condition-proof and without application-layer workarounds.

Convex, despite its excellent real-time reactivity and TypeScript developer experience, cannot natively enforce foreign keys, unique constraints, or delete guards. These must be implemented in application code via index-then-check patterns in mutations. The Convex Ents library that added declarative support for these patterns is now in **maintenance mode**. Worse, Convex's strict transaction time limits make complex delete guard operations on large datasets problematic — if a candidate has hundreds of linked applications, verifying all references in a single mutation risks timeout. Convex's full-text search also lost fuzzy matching in January 2025, and vector search caps at 256 results per query. For a platform where data integrity is non-negotiable, Convex creates unnecessary risk.

Between the two PostgreSQL options, the choice depends on how much integrated infrastructure you want:

**Supabase** provides a complete backend platform — Auth (GoTrue), Storage for resume uploads, real-time subscriptions via WAL monitoring, Edge Functions, and built-in pgvector for semantic search. The `tsvector`/`tsquery` engine handles lexical search, pgvector handles semantic similarity, and SQL functions combine them via Reciprocal Rank Fusion for the hybrid search requirement. Freshness scoring slots in naturally as a SQL date-decay function in the `ORDER BY` clause. Row Level Security adds role-based access control at the database level. The Pro tier at **$25/month** comfortably handles the projected scale of 10K jobs, 50K candidates, and 100K applications.

**Neon** offers pure serverless PostgreSQL with instant copy-on-write branching — a killer feature for testing schema migrations against production data, creating PR preview environments, and CI/CD pipeline databases. Post-Databricks acquisition (May 2025), storage costs dropped to $0.35/GB-month, making the Launch plan at **$19/month** extremely competitive. However, Neon provides no built-in auth, real-time subscriptions, storage, or edge functions — you assemble those yourself.

| Criteria | Convex | Supabase | Neon |
|---|---|---|---|
| FK constraints | App-layer only | ✅ Native | ✅ Native |
| Delete guards | App-layer (transaction limits) | ✅ `ON DELETE RESTRICT` | ✅ `ON DELETE RESTRICT` |
| Compound unique | App-layer (index + check) | ✅ Native | ✅ Native |
| Hybrid search | @convex-dev/rag component | ✅ tsvector + pgvector | ✅ tsvector + pgvector |
| Real-time | ✅ Best-in-class | ✅ WAL-based | ❌ External needed |
| TypeScript DX | ✅ Excellent | Good (type generation) | ✅ Excellent via Drizzle |
| Vendor lock-in | High (custom model) | Low (standard Postgres) | Very low |
| Estimated cost | $25–75/mo | $25–50/mo | $19–69/mo |

**Recommendation:** If using Encore.dev as the backend (which provisions its own PostgreSQL), the database question shifts. Encore.dev's built-in Postgres supports pgvector and all standard constraints. For production, you can point Encore at **Neon** to get branching and serverless scaling, or use Encore Cloud's managed provisioning (AWS RDS / GCP Cloud SQL). If you skip Encore.dev and want a more integrated BaaS approach, **Supabase** is the strongest single-platform choice.

---

## Encore.dev provides the exact backend primitives this platform needs

Encore.dev is not just a web framework — it is an **infrastructure-aware application platform** that declaratively provisions databases, Pub/Sub topics, cron jobs, and object storage from TypeScript code. For a recruitment platform with scraper pipelines, AI orchestration, and real-time streaming, this is a remarkably precise fit.

**API definition and type safety** go deeper than any alternative. Encore's Rust runtime performs static analysis of TypeScript types at compile time and enforces them at runtime on the HTTP boundary — malformed requests are rejected before reaching application code. Services call each other via auto-generated typed clients (`import { gradeCV } from "~encore/clients/grading"`), and the framework generates frontend API clients with `encore gen client`. There is zero boilerplate: no Express app setup, no route registration, no middleware chains. Benchmarks show **9x faster throughput than Express and 3x faster than Hono**, thanks to the Rust I/O layer.

**Scraper pipelines map directly to Encore's primitives.** Cron jobs are declarative TypeScript:

```typescript
const scraperJob = new CronJob("run-linkedin-scraper", {
  title: "LinkedIn Job Scraper",
  every: "6h",
  endpoint: runLinkedInScraper,
});
```

Since cron jobs target regular API endpoints, the same function serves both scheduled and manual triggers — solving the manual scraper trigger requirement. Scraped data flows through Pub/Sub topics with at-least-once delivery, automatic retry with backoff, and dead-letter queues. The architecture becomes: `CronJob/ManualAPI → runScraper → publishes to scraperEvents → Subscription processes and stores → publishes to gradingEvents`.

**AI orchestration has first-class streaming support.** Encore.ts offers typed WebSocket-based streaming in three modes: `api.streamIn`, `api.streamOut`, and `api.streamInOut`. The bidirectional mode is ideal for the conversational AI assistant, providing type-safe message contracts for both directions. Long-running CV grading tasks (10–30 seconds) work naturally with async/await — the Rust runtime handles I/O efficiently while Node.js processes application logic. Any npm package works, including the OpenAI SDK, Anthropic SDK, and Vercel AI SDK.

**Built-in observability is automatic.** Every API call, database query, and Pub/Sub message generates distributed traces visible in the local development dashboard at `localhost:9400`. The dashboard also shows auto-generated architecture diagrams, live API documentation, and a database explorer. Production monitoring integrates directly with **Datadog and Grafana Cloud**. For the scraper operations dashboard, you store run history in PostgreSQL and expose query endpoints — Encore's tracing captures the full execution pipeline.

**The DDD/hexagonal architecture question deserves honest assessment.** Encore's service-per-directory model maps well to bounded contexts, and Pub/Sub naturally handles domain events between them. Within each service, you freely organize domain, application, and infrastructure layers. The tension point is that Encore's declarative infrastructure (`new SQLDatabase(...)`, `new Topic(...)`) must be defined as top-level module variables, which conflicts with pure DDD patterns where infrastructure is injected. The pragmatic solution: treat Encore's infrastructure declarations as the outermost adapter layer, with domain logic in pure functions. Effect-TS should work within service implementations, though API handlers must return plain objects — resolve `Effect<A, E, R>` at the boundary.

**Compared to alternatives:** tRPC provides excellent type safety but zero infrastructure — you'd need to separately assemble database provisioning, job queues (BullMQ), cron scheduling (node-cron), observability (OpenTelemetry), and deployment pipelines. Hono excels at edge deployment but lacks stateful backend primitives. Fastify has a mature plugin ecosystem but requires 10x more DevOps setup. For a solo developer or small team, **Encore.dev eliminates approximately 60–70% of the infrastructure work** these alternatives require.

**Pricing and lock-in:** The framework and CLI are open source (MPL-2.0). You can export Docker images with `encore build docker` and self-host anywhere. The proprietary element is Encore Cloud's automated CI/CD, preview environments, and managed infrastructure — the Pro plan costs **$49/member/month**. Leaving Encore Cloud means building your own deployment pipeline, but application code remains portable.

---

## Frontend architecture centers on App Router, shadcn/ui, and the AI SDK

**Next.js App Router** is the definitive choice for this internal operations platform. Its nested layout system preserves sidebar and navigation state across route transitions — critical for a multi-panel workspace where recruiters switch between job catalogs, candidate pipelines, and scraper dashboards without losing context. Server Components handle layout shells, initial data fetching, and static UI chrome to reduce client-side JavaScript. Client Components (`"use client"`) handle interactive leaves: kanban boards, data tables with client-side sorting, chat panels, and real-time subscriptions.

**State management follows a three-layer pattern.** TanStack Query v5 handles all server state — API data fetching, caching, background refetch, and optimistic updates for stage transitions. Zustand v5 manages client-side UI state: sidebar collapse, active filters, kanban column ordering, and selected candidates. **nuqs** synchronizes filter and search state with URL parameters, making views shareable and bookmarkable. This separation is clean, lightweight, and avoids the complexity of Redux-like global stores. React Hook Form plus Zod handles form validation with runtime type checking.

**The component library strategy pairs shadcn/ui with Tremor.** shadcn/ui provides copy-paste, Radix UI-based components you fully own — buttons, dialogs, popovers, command palettes, and a DataTable wrapper around TanStack Table. The copy-paste model means complete control for custom recruitment UI patterns. Tremor supplements with **dashboard-specific visualization**: sparkline charts for scraper success rates, KPI cards with delta badges for platform metrics, and tracker components for status-over-time displays. Both libraries use Tailwind CSS and Radix UI, making them fully compatible. Ant Design and Mantine were considered but rejected — Ant Design's ~1MB bundle and opinionated design system clash with Tailwind, while Mantine's CSS-in-JS approach creates friction.

For specific UI patterns, the recommendations are precise:

- **Job catalog**: shadcn/ui `CommandDialog` for command-palette search, faceted filter popovers, toggle between card grid and table view, with nuqs persisting filter state in URLs
- **Candidate pipeline**: **@dnd-kit** (`@dnd-kit/core` + `@dnd-kit/sortable`) for the kanban board — it's the only actively maintained, accessible React drag-and-drop library after react-beautiful-dnd's deprecation. A ready-made integration exists at `Georgegriff/react-dnd-kit-tailwind-shadcn-ui`
- **Scraper dashboard**: Tremor `Tracker` for status-over-time, `SparkAreaChart` for trends, shadcn/ui `Badge` for current status, TanStack Table for run history
- **AI assistant**: **Vercel AI SDK v6** is strongly recommended — its `useChat` hook handles message state, streaming display, loading states, and tool execution traces automatically, saving weeks of custom SSE code. It supports custom transports, meaning it works with Encore.dev's streaming APIs
- **Match reports**: Recharts `RadarChart` for multi-dimensional candidate scoring, Tremor `BarList` for category breakdowns, shadcn/ui `Table` with pass/fail badges for knock-out criteria

**Real-time updates use SSE for AI streaming and either Encore's streaming APIs or database subscriptions for other updates.** The Vercel AI SDK uses SSE natively. Scraper status changes push through Encore's `api.streamOut` endpoints. For non-critical updates (dashboard stats refresh), TanStack Query's `refetchInterval` provides simple polling. If using Supabase directly, its Realtime channels subscribe to PostgreSQL changes via WAL monitoring.

**Resume upload follows a presigned-URL pattern.** `react-dropzone` provides the drag-and-drop UI with client-side file validation (PDF/DOCX, size limits). The flow: client requests a presigned URL from Encore.dev → direct upload to S3/R2 → backend records metadata. For PDF preview, `react-pdf` v10 renders pages as React components with text selection and zoom.

---

## Monorepo structure and shared types

The project structure uses **Turborepo with pnpm workspaces**, separating the Next.js frontend and Encore.dev backend while sharing TypeScript types:

```
recruitment-platform/
├── apps/
│   └── web/                        # Next.js App Router
│       ├── app/                    # Routes: (dashboard)/jobs, candidates, scraper, assistant
│       ├── modules/                # Feature modules: jobs/, candidates/, scraper/, assistant/
│       │   └── [feature]/
│       │       ├── components/     # Feature-specific React components
│       │       ├── hooks/          # useJobs(), useCandidates(), useScraperStatus()
│       │       └── api.ts          # API client functions
│       ├── components/ui/          # shadcn/ui components
│       ├── stores/                 # Zustand stores
│       └── lib/                    # Utilities, query client, API client
├── packages/
│   ├── shared-types/               # TypeScript types shared between frontend and backend
│   └── config/                     # Shared ESLint, TypeScript, Tailwind configs
├── backend/                        # Encore.dev project (services, migrations, pub/sub)
└── turbo.json
```

The feature-module pattern within `modules/` keeps domain boundaries clear — each feature owns its components, hooks, types, and API functions. Parallel routes (`@chat/`) let the AI assistant panel persist alongside main content during navigation.

---

## Recommended final tech stack

| Layer | Technology | Rationale |
|---|---|---|
| **Database** | Encore.dev built-in PostgreSQL + pgvector (Neon for production) | Native FK, unique constraints, delete guards; pgvector for semantic search; Neon branching for dev workflow |
| **Backend framework** | **Encore.dev (TypeScript)** | Built-in cron, Pub/Sub, streaming, PostgreSQL, tracing — eliminates 60-70% of infrastructure work |
| **ORM** | **Drizzle ORM** | Schema-first TypeScript, lightweight, functional style, excellent Neon/Postgres support |
| **Frontend framework** | **Next.js 16 (App Router)** | Server Components, nested layouts, streaming, parallel routes |
| **UI components** | **shadcn/ui + Tremor** | Full ownership, Tailwind-native, dashboard-specific charts |
| **Data tables** | **TanStack Table v8** | Headless, type-safe, sorting/filtering/pagination |
| **Server state** | **TanStack Query v5** | Caching, background refetch, optimistic updates |
| **Client state** | **Zustand v5** | Lightweight, TypeScript-first, slice pattern |
| **URL state** | **nuqs v2** | Type-safe URL search params |
| **Forms** | **React Hook Form + Zod** | Validation, type inference, minimal re-renders |
| **Drag and drop** | **@dnd-kit** | Modern, accessible, kanban-ready |
| **AI chat/streaming** | **Vercel AI SDK v6** | `useChat`, streaming, tool execution traces |
| **File upload** | **react-dropzone** | Hook-based, flexible, presigned URL flow |
| **Auth** | **Clerk or Better Auth** | Since Encore.dev has no built-in auth; Clerk has excellent Next.js middleware |
| **Testing** | **Vitest + React Testing Library + Playwright** | Encore.dev uses Vitest natively; Playwright for e2e |
| **Monorepo** | **Turborepo + pnpm** | Lightweight, Vercel-native, shared types |

**One alternative path worth noting:** If Encore.dev's opinionated patterns feel too constraining for hexagonal architecture, the fallback stack would be **Supabase (database + auth + storage + real-time) + Hono or Fastify (custom API layer) + BullMQ (job queues) + tRPC (type-safe API contracts)**. This provides more architectural freedom but requires significantly more integration work and DevOps overhead. For a solo developer or small team prioritizing speed to production, Encore.dev is the higher-leverage choice.

## Conclusion

Three insights emerged from this research that weren't obvious at the outset. First, the database decision is entirely driven by the referential integrity requirements — not by developer experience or real-time features — which makes Convex unsuitable despite its otherwise excellent TypeScript DX. Second, Encore.dev's value is not as a web framework but as an **infrastructure abstraction layer** that eliminates the need to separately provision and wire together databases, job queues, cron schedulers, Pub/Sub systems, and observability — each of which would be a project unto itself with alternatives like Fastify or Hono. Third, the Vercel AI SDK has matured to the point where building custom SSE streaming and tool execution trace UIs is genuinely unnecessary — its `useChat` hook and agent abstractions handle the exact patterns this platform's conversational AI assistant requires, and it works with any backend transport including Encore.dev's streaming APIs. The net effect of these three choices is a stack that maximizes type safety from database schema to UI component while minimizing operational surface area.