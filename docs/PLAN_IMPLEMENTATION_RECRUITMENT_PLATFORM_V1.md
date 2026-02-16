# Implementation Plan: AI-Assisted Recruitment Operations Platform (V1)

## Enhancement Summary

**Deepened on:** February 16, 2026
**Sections enhanced:** 14 major sections + cross-cutting governance
**Research agents used (synthesized):** architecture-strategist, performance-oracle, security-sentinel, data-integrity-guardian, data-migration-expert, agent-native-reviewer, pattern-recognition-specialist, kieran-typescript-reviewer, code-simplicity-reviewer, best-practices-researcher, framework-docs-researcher, repo-research-analyst, spec-flow-analyzer, plus matched skills (`agent-native-architecture`, `tanstack-integration`, `provider-pattern`, `config-priority`, `frontend-design`).

### Key Improvements
1. Added hard technical guardrails for ingestion idempotency, ranking determinism, and explicit agent completion semantics.
2. Added security and compliance hardening mapped to OWASP Top 10 (2021) and OWASP API Security Top 10 (2023), including row-level data boundaries and object-level authorization checks.
3. Added performance and reliability targets with concrete storage/indexing patterns (PostgreSQL partial indexes, pgvector ANN strategy, TanStack Query cache policy, SLO/error-budget operations).

### New Considerations Discovered
- Encore Cron does not run in local development; local execution needs explicit endpoint triggers and test coverage for scheduler-triggered code paths.
- Pub/Sub delivery should be treated as at-least-once with idempotent consumers, replay-safe handlers, and per-source dedup keys.
- Next.js Route Handlers have segment constraints (no `route.ts` alongside `page.tsx` at same segment) and explicit caching behavior that must be designed intentionally for recruitment data freshness.
- AI tool orchestration should set explicit `stopWhen`/approval behavior to prevent unbounded loops and unsafe mutating tool execution.

## 1. Document Control
- Plan owner: Product + Engineering
- Repository: `/Users/cortex-air/Developer/hire-dash`
- Plan status: Draft v1 (implementation-ready baseline)
- Delivery methodology: Vertical slicing + mandatory TDD + BDD acceptance criteria.
- Architecture style: Agent-native first (human and agent parity by design).
- Inputs used:
  - `/Users/cortex-air/Developer/hire-dash/docs/PRD.md`
  - `/Users/cortex-air/Developer/hire-dash/docs/plan-694942db-c0b8-41d0-abf7-92f741749bea_text_markdown.md`

## 2. Goals, Outcomes, and Non-Goals
### 2.1 Goals
- Centralize recruiting ops for assignment-based hiring into one workspace.
- Cut time-to-shortlist through automated sourcing, grading, and matching.
- Preserve explainability and auditability for AI-assisted decisions.
- Keep ingestion data fresh and operationally visible.

### 2.2 Measurable outcomes (V1 targets)
- Median job ingestion run completes in < 5 minutes for active sources.
- Duplicate scraped jobs reduced by >= 95% via source ID/URL dedup.
- Candidate grading success rate >= 98% for valid resume inputs.
- Recruiter can move an application across stages in <= 3 clicks.
- P95 catalog search response <= 500ms for operational data volume.

### 2.3 Non-goals for V1
- Candidate self-service portal.
- Full enterprise RBAC matrix.
- Full calendar scheduling integration.
- Advanced BI warehouse and executive analytics suite.

## 3. Product Scope Breakdown (V1)
- Job ingestion and catalog normalization.
- Job discovery with search/filter/hybrid ranking.
- Candidate management + lifecycle.
- AI resume grading.
- Candidate-to-job matching (knock-out + weighted scoring).
- Application pipeline tracking.
- Scraper operations dashboard and manual controls.
- Recruiter-facing AI assistant with tool traces.

## 4. Architecture and Technology Decisions
### 4.1 Chosen stack
- Backend: Encore.dev (TypeScript), service-oriented layout.
- Database: PostgreSQL + pgvector.
- ORM/query layer: Drizzle ORM.
- Frontend: Next.js App Router.
- UI stack: shadcn/ui + Tailwind + Tremor for metrics.
- Server state: TanStack Query.
- Client state: Zustand.
- URL state: nuqs.
- AI UX: Vercel AI SDK (streaming chat + tool trace surface).
- File uploads: presigned URL workflow (S3-compatible object store).

### 4.2 Why this architecture
- PRD requires hard relational integrity (FKs, unique constraints, delete guards).
- Ingestion and grading are workflow-heavy; Encore cron + pub/sub map directly.
- Assistant and grading need streaming and async job orchestration.
- Ops UI needs both relational queryability and near-real-time status updates.

### 4.3 High-level bounded contexts
- `sources`: source configs, run orchestration, scrape ingest.
- `jobs`: normalized job catalog, search, ranking.
- `candidates`: profiles, resume assets, lifecycle.
- `grading`: LLM evaluation and structured grade persistence.
- `matching`: job-candidate match engine and explanation payloads.
- `applications`: candidate-job pipeline, stage transitions, notes.
- `assistant`: chat orchestration, tool invocation, response streaming.
- `ops`: operational metrics, audits, and platform health surfaces.

### 4.4 Agent-native architecture contract
- Parity rule: every UI action must have an equivalent agent tool path.
- Visibility rule: every recruiter-visible state must be queryable by agent tools.
- Tool granularity rule: prefer atomic primitives and composable CRUD operations.
- Completion rule: agent workflows must use explicit completion signaling (no heuristics).
- Shared workspace rule: human and agent operate on the same underlying entities and audit trail.

### 4.5 Vertical slice execution model
- Every slice ships end-to-end behavior across DB, backend, frontend, agent tools, and tests.
- No "backend-only phase" or "frontend-only phase" without a user-observable outcome.
- Every slice must include:
  - BDD scenarios (acceptance language for recruiter/admin outcomes).
  - TDD evidence (failing tests before implementation).
  - Agent parity checks (agent can complete the same outcome as human UI flow).

### 4.6 Harness engineering adaptation
- Treat engineering as environment design:
  - Improve prompts, tools, tests, and feedback loops together rather than code-only changes.
- Make the app legible to agents:
  - Provide structured logs, capability discovery tools, and deterministic APIs.
  - Ensure agent-readable run status for ingestion, grading, matching, and pipeline changes.
- Keep repository knowledge structured:
  - `AGENTS.md` remains a map; implementation details live in focused docs referenced from it.
  - Maintain decision records for architecture and prompt/tool contract changes.
- Shift quality from only human review to harness-driven evaluation:
  - Run task-level evals for recruiter/admin workflows on each substantial change.
  - Track harness pass rate and regressions as first-class release signals.

## 5. Data Model and Constraints
### 5.1 Core tables
- `jobs`
- `candidates`
- `applications`
- `interviews`
- `scraper_configs`
- `scrape_runs`
- `candidate_grades`
- `candidate_job_matches`
- `assistant_threads`
- `assistant_messages`
- `audit_events`

### 5.2 Critical constraints (must enforce in DB)
- `candidates.normalized_email` unique where non-null.
- `applications(candidate_id, job_id)` unique.
- `jobs(source_platform, external_job_id)` unique where `external_job_id` present.
- `jobs(source_platform, canonical_url_hash)` unique fallback when external ID missing.
- FK delete guards:
  - candidate delete restricted if applications exist.
  - job delete restricted if applications exist.
  - application delete restricted if interviews exist.
- Numeric bounds:
  - all score fields constrained to 0-100.
  - weighted criteria sums constrained to <= 100.

### 5.3 Search and ranking storage
- `jobs.search_tsv` generated tsvector for lexical search.
- `jobs.embedding` vector for semantic similarity.
- `jobs.posted_at` + `jobs.scraped_at` for freshness scoring.
- SQL function `rank_jobs(query_text, query_vector, filters)` combining:
  - lexical rank
  - semantic rank
  - freshness decay

## 6. End-to-End Workflows
### 6.1 Source ingestion workflow
1. Scheduler or operator triggers source run.
2. Connector fetches external listings.
3. Normalizer maps raw payload to canonical schema.
4. Deduper checks stable external ID or canonical URL hash.
5. New/changed jobs persisted; run metrics recorded.
6. Optional enrichment and embedding queued async.

### 6.2 Candidate grading workflow
1. Candidate created or resume uploaded.
2. Resume text extracted and normalized.
3. Grading job enqueued with candidate snapshot.
4. LLM returns structured JSON (score + rationale + extracted fields).
5. Validation layer checks shape/range.
6. Candidate grade and profile enrichment persisted.

### 6.3 Matching workflow
1. Recruiter initiates match, or auto-trigger on candidate/job update.
2. Knock-out criteria evaluated first.
3. If pass, weighted criteria computed with criterion-level reasons.
4. Result persisted as upserted match payload.
5. Application view renders total, level, risk profile, recommendations.

### 6.4 Assistant workflow
1. Recruiter asks question in assistant panel.
2. Assistant classifies intent and selects tool(s).
3. Tool calls executed with trace logging.
4. Streaming response returned with tool output references.
5. Conversation persisted for audit and replay.

### 6.5 Agent-human parity workflow rules
1. Define user outcome in BDD format.
2. Map UI actions needed for that outcome.
3. Map equivalent agent tools for the same outcome.
4. Add parity tests for both UI path and agent path.
5. Block slice completion until both paths pass and produce equivalent state changes.

## 7. Workstream Plan With Dependencies
Workstreams below represent capability backlogs. Delivery happens as vertical slices that pull from multiple workstreams simultaneously.

Mandatory rule for every workstream item:
- Write BDD scenario(s) first.
- Implement failing acceptance/integration/unit tests first (TDD RED).
- Implement minimum code to pass (TDD GREEN), then refactor.
- Add/update parity tests confirming the same outcome is achievable via UI and agent tooling.

## WS-0: Foundation and Project Setup
- Deliverables:
  - Monorepo structure finalized.
  - Encore services scaffolded.
  - Shared type package + lint/test baseline.
  - Environment config conventions.
- Depends on: none.
- Done when:
  - CI runs lint + unit tests.
  - Local dev starts web + backend with one command.

## WS-1: Database Schema and Migrations
- Deliverables:
  - Initial schema migration with all core tables.
  - Constraints, indexes, and vector/search structures.
  - Seed fixtures for local/dev test data.
- Depends on: WS-0.
- Done when:
  - Migration is repeatable from empty DB.
  - Referential/delete constraints are enforced by integration tests.

## WS-2: Source Connectors and Ingestion Pipeline
- Deliverables:
  - Source config CRUD service.
  - Connector interface + 2 initial adapters.
  - Run execution endpoint + cron hooks.
  - Dedup + persistence pipeline + run logs.
- Depends on: WS-1.
- Done when:
  - Manual trigger works per source and all active sources.
  - Run history includes counts, durations, and error summaries.

## WS-3: Job Catalog and Discovery
- Deliverables:
  - Job list/detail APIs.
  - Filter set (platform, location, rate, recency).
  - Hybrid ranking query path.
  - App Router job catalog UI.
- Depends on: WS-2.
- Done when:
  - Search/filter result correctness verified by test fixtures.
  - P95 search latency meets target in staging dataset.

## WS-4: Candidate Management and Resume Assets
- Deliverables:
  - Candidate CRUD + uniqueness handling.
  - Resume upload + extraction pipeline.
  - Candidate lifecycle transitions (single + bulk).
- Depends on: WS-1.
- Done when:
  - Duplicate identity handling works deterministically.
  - Invalid stage transitions are rejected with typed errors.

## WS-5: AI Grading Engine
- Deliverables:
  - Grading prompt contract and structured output schema.
  - Grade API + persist path + batch grading endpoint.
  - Retry + fallback behavior for transient AI errors.
- Depends on: WS-4.
- Done when:
  - Grading output passes strict schema validation.
  - Batch grading supports resumable progress.

## WS-6: Matching Engine and Explainability
- Deliverables:
  - Knock-out evaluator.
  - Weighted scoring evaluator.
  - Match persistence and application upsert.
  - Explanation payload rendering in UI.
- Depends on: WS-3, WS-5.
- Done when:
  - Criterion-level traces shown in application detail.
  - Same inputs yield deterministic score output.

## WS-7: Applications and Pipeline Operations
- Deliverables:
  - Application CRUD with uniqueness guard.
  - Stage/status transitions and notes.
  - Interview linkage and delete restrictions.
  - Recruiter pipeline views.
- Depends on: WS-3, WS-4.
- Done when:
  - Duplicate application creation blocked at DB + API layers.
  - Pipeline state updates reflected in UI without reload.

## WS-8: Scraper Operations Dashboard
- Deliverables:
  - Source status cards (active/paused/last run/yield).
  - Run history table.
  - Trigger controls for single/all sources.
  - Error inspection panel.
- Depends on: WS-2.
- Done when:
  - Operator can diagnose failed run from dashboard alone.
  - Triggers are idempotent and audit logged.

## WS-9: Assistant Experience
- Deliverables:
  - Assistant conversation APIs (standard + streaming).
  - Tooling hooks: scrape trigger, summary, shortlist helper.
  - Tool call trace UI.
- Depends on: WS-2, WS-3, WS-7.
- Done when:
  - Streaming and non-streaming modes both work.
  - Tool traces include action, duration, and outcome.

## WS-10: Security, Auditability, and Hardening
- Deliverables:
  - Auth integration and role baseline.
  - Audit events for state-changing operations.
  - PII handling controls and redaction rules.
  - Rate limits and abuse protections.
- Depends on: WS-1 through WS-9.
- Done when:
  - Sensitive fields are never exposed in unauthorized contexts.
  - Audit log coverage exists for all destructive/mutating endpoints.

## WS-11: Quality, Performance, and Release Readiness
- Deliverables:
  - Test pyramid completion (unit/integration/e2e).
  - Synthetic load profile for search and ingestion.
  - Runbook + SLO + alert definitions.
  - Production readiness checklist.
- Depends on: WS-0 through WS-10.
- Done when:
  - Release criteria and rollback procedure are documented and tested.

## 8. Vertical Slice Delivery Sequence
### VS-0: Thin foundation slice (walking skeleton)
- Scope:
  - Minimal recruiter auth/session path.
  - One source config create/read flow.
  - One assistant command that reads source status (no mutation).
- Pulls from: WS-0, WS-1, WS-2, WS-9.
- Exit criteria:
  - BDD scenario "admin creates source and sees it in UI and agent response" passes.
  - TDD evidence captured (test failed before implementation).
  - Agent parity test proves source can be created/viewed from tool layer.

### VS-1: Ingest and discover jobs slice
- Scope:
  - Trigger one source run and persist deduped jobs.
  - Render searchable `/jobs` list with core filters.
  - Agent can run source and list latest jobs.
- Pulls from: WS-2, WS-3, WS-8, WS-9.
- Exit criteria:
  - BDD scenarios for manual run and job discovery pass.
  - Search performance baseline met on seed dataset.
  - UI and agent paths produce equivalent run/job visibility.

### VS-2: Candidate intake and grading slice
- Scope:
  - Create candidate, upload resume, extract text.
  - Run grading and show structured result in candidate detail.
  - Agent can trigger grading and summarize rationale.
- Pulls from: WS-4, WS-5, WS-9.
- Exit criteria:
  - BDD scenarios for candidate intake and grading pass.
  - TDD-covered schema and score bounds enforced.
  - Agent and UI observe the same grade payload.

### VS-3: Matching and pipeline slice
- Scope:
  - Create application from candidate + job.
  - Run matching (knock-out + weighted score).
  - Move application stage and track notes.
  - Agent can execute and explain same transitions.
- Pulls from: WS-6, WS-7, WS-9.
- Exit criteria:
  - BDD scenarios for match + stage transition pass.
  - Deterministic match scoring tests pass.
  - Parity tests confirm stage updates from UI and agent are equivalent.

### VS-4: Operations and guardrails slice
- Scope:
  - Full scraper dashboard metrics and error drill-down.
  - Audit logs for mutating actions.
  - Agent tool traces and approval prompts for high-impact actions.
- Pulls from: WS-8, WS-9, WS-10.
- Exit criteria:
  - BDD scenarios for operator diagnostics and approvals pass.
  - Security and audit assertions pass in integration tests.
  - Agent-side mutating tools require explicit confirmation.

### VS-5: Hardening and production readiness slice
- Scope:
  - Performance tuning, reliability tests, runbooks, alerts.
  - Final UX quality pass and accessibility pass.
  - Release and rollback rehearsal.
- Pulls from: WS-11 plus unresolved WS-10 items.
- Exit criteria:
  - SLO tests pass in staging.
  - No open P0/P1 defects.
  - Rollback drill executed successfully.

## 9. API Contract Plan (Conceptual)
### 9.1 Job APIs
- `GET /jobs`
- `GET /jobs/:id`
- `POST /jobs/search`
- `POST /jobs/:id/reindex`

### 9.2 Candidate APIs
- `GET /candidates`
- `POST /candidates`
- `PATCH /candidates/:id`
- `POST /candidates/:id/upload-resume`
- `POST /candidates/stage/bulk`

### 9.3 Application APIs
- `GET /applications`
- `POST /applications`
- `PATCH /applications/:id/stage`
- `PATCH /applications/:id/notes`

### 9.4 Source/Ops APIs
- `GET /sources`
- `POST /sources`
- `PATCH /sources/:id`
- `POST /sources/:id/run`
- `POST /sources/run-all`
- `GET /sources/runs`

### 9.5 AI APIs
- `POST /ai/grade-candidate`
- `POST /ai/grade-candidates/batch`
- `POST /ai/match`
- `POST /assistant/chat`
- `POST /assistant/chat/stream`

### 9.6 Agent-native tool contract map
- Capability discovery:
  - `list_capabilities`
  - `refresh_context`
- Source tools:
  - `list_sources`, `create_source`, `update_source`, `delete_source`, `run_source`, `run_all_sources`
- Job tools:
  - `search_jobs`, `get_job`, `reindex_job`
- Candidate tools:
  - `list_candidates`, `create_candidate`, `update_candidate`, `delete_candidate`, `upload_resume`, `grade_candidate`
- Application tools:
  - `list_applications`, `create_application`, `update_application_stage`, `update_application_notes`, `delete_application`
- Assistant safety and completion:
  - `request_confirmation` for high-impact mutations
  - `complete_task` for explicit completion signal

### 9.7 UI-to-agent parity matrix (must remain complete)
- Create source config: UI form -> `create_source`.
- Trigger scraping: UI button -> `run_source` / `run_all_sources`.
- Search jobs: UI filters -> `search_jobs`.
- Create and update candidate: UI forms -> `create_candidate` / `update_candidate`.
- Grade candidate: UI action -> `grade_candidate`.
- Create application and move stage: UI pipeline actions -> `create_application` / `update_application_stage`.
- Add notes: UI editor -> `update_application_notes`.

## 10. Frontend Plan (App Router)
### 10.1 Route map
- `/jobs`
- `/jobs/[id]`
- `/candidates`
- `/candidates/[id]`
- `/applications`
- `/sources`
- `/assistant`

### 10.2 Shared UX patterns
- Filter state URL-synced with nuqs.
- Data-fetching standardized on TanStack Query hooks.
- Error + empty + loading states standardized across modules.
- Action toasts include operation ID for support traceability.

### 10.3 Accessibility baseline
- Keyboard-accessible table actions and dialogs.
- Contrast-compliant status tokens.
- Screen-reader labels for stage-change controls and assistant actions.

## 11. Testing and Verification Strategy
### 11.1 BDD acceptance-first workflow
- Each vertical slice starts with Gherkin-style scenarios owned by product + engineering.
- Scenario format: `Given` context, `When` action, `Then` observable business outcome.
- No slice implementation begins until acceptance scenarios are approved.

### 11.2 TDD implementation workflow (mandatory)
- RED: write failing acceptance/integration/unit test(s) first.
- Verify RED: confirm failure is for missing behavior, not bad setup.
- GREEN: implement minimum production code to pass tests.
- REFACTOR: clean implementation while keeping tests green.
- Rule: no production code without a failing test first.

### 11.3 Test layers
- Unit tests:
  - scoring functions, knock-out evaluator, dedup rules, stage transition guards.
- Integration tests:
  - migration + constraints.
  - ingestion pipeline from mock source to persisted jobs.
  - grading and matching persistence workflows.
- End-to-end tests:
  - recruiter path: ingest -> find job -> create candidate -> match -> stage transition.
  - ops path: configure source -> run -> inspect metrics/errors.
  - assistant path: ask action -> tool call trace -> streamed response.

### 11.4 Agent-native parity tests
- Every BDD scenario with a UI action has a mirrored agent-tool scenario.
- Assertions verify equivalent state transitions, audit events, and user-visible outcomes.
- Capability regression suite ensures no UI action becomes agent-inaccessible.

### 11.5 Performance tests
- Search endpoint latency under realistic dataset.
- Concurrent ingestion runs with one failing source and graceful partial success.

### 11.6 Harness evaluation suite
- Maintain a curated scenario set that mirrors real recruiter/admin tasks:
  - source configuration and run diagnostics
  - candidate grading and mismatch escalation
  - application stage changes with notes and audit requirements
  - assistant request with tool invocation and completion confirmation
- For each scenario, assert:
  - outcome correctness
  - side-effect correctness (DB state + audit events)
  - tool trace quality (action, justification, duration, result)
- Run harness evals in CI for pull requests touching agent prompts, tools, workflow orchestration, or domain rules.
- Define release gate thresholds:
  - no P0 scenario failures
  - no net regression in overall harness pass rate
  - no regression in critical parity scenarios

## 12. Observability and Operations
- Structured logs with request and run correlation IDs.
- Metrics:
  - ingestion run duration and yield
  - search latency and error rate
  - grading success/failure counts
  - assistant tool call success/failure
- Traces:
  - source run pipeline spans
  - grading/matching spans
  - assistant request + tool spans
- Alerts:
  - ingestion failure spike
  - grading backlog growth
  - search latency SLA breach
  - harness critical-scenario regression

## 13. Security and Compliance Baseline
- Encrypt data in transit and at rest.
- Minimize PII in logs, with explicit redaction middleware.
- AuthN required for all non-public endpoints.
- Role baseline for recruiter vs admin mutations.
- Audit log for:
  - source config changes
  - stage transitions
  - destructive operations
  - assistant-triggered side effects

## 14. Risks and Mitigations
- Risk: connector fragility due to external site changes.
  - Mitigation: adapter contract tests + per-source health dashboards + fast disable switch.
- Risk: model output drift causing inconsistent grading.
  - Mitigation: strict schema validator + prompt versioning + confidence thresholds.
- Risk: relevance quality regressions in hybrid ranking.
  - Mitigation: offline ranking eval set + weighted tuning workflow + canary rollout.
- Risk: operator trust degradation if assistant tools are opaque.
  - Mitigation: mandatory tool traces, action confirmations for mutating operations.
- Risk: schema churn and migration mistakes.
  - Mitigation: migration review checklist + staging snapshot tests + rollback scripts.

## 15. Delivery Governance
- Weekly architecture review for open decisions and scope control.
- Bi-weekly acceptance review against vertical-slice exit criteria.
- BDD scenario review before every slice kickoff and parity review before slice signoff.
- Weekly harness review:
  - top failing scenarios
  - prompt/tool changes since prior review
  - regressions, mitigations, and risk acceptance decisions
- Change policy:
  - Scope additions must map to a vertical slice and explicit tradeoff.
  - Breaking schema/API changes require migration and compatibility notes.

## 16. Definition of Done (Release Gate)
- All VS-0 through VS-5 exit criteria met.
- No open P0/P1 defects.
- Search + ingestion + grading SLOs met in staging load profile.
- Audit events present for all mutating operations.
- Runbooks and rollback procedure validated.
- BDD scenarios and mirrored agent parity scenarios pass for all in-scope workflows.
- TDD evidence exists for all production behavior introduced in V1 slices.

## 17. Immediate Next Actions (Execution Kickoff)
1. Write BDD scenarios for VS-0 (source create/read via UI and agent).
2. Implement RED tests for VS-0 acceptance + integration + parity before feature code.
3. Scaffold minimal services/routes/UI to pass VS-0 tests (GREEN), then refactor.
4. Add capability map tests to lock UI-to-agent parity before VS-1.
5. Create initial harness scenario pack with pass/fail reporting for core recruiter/admin flows.
6. Instrument tool traces and structured outcomes to support automated harness scoring.
7. Repeat the same BDD -> TDD -> parity -> harness cycle for VS-1 through VS-5.

## 18. Plan Iteration Prompts (for next refinement round)
### 18.1 Prompt for architecture and scope upgrades
```
Carefully review this entire implementation plan and propose revisions that improve reliability, performance, security, and delivery speed. For every proposed change, include rationale and a git-diff style update to this plan.
```

### 18.2 Prompt for dependency and slice hardening
```
Analyze this plan for hidden dependency risks, sequencing mistakes, and rollout hazards. Propose improved vertical-slice boundaries, test gates, and rollback strategy with concrete edits.
```

## 19. Harness Engineering Lessons Applied
### 19.1 Key lessons we are adopting
- Shift from "agent as autocomplete" to "agent as teammate" by investing in environment quality.
- Optimize for legibility so agents can reliably understand system state and constraints.
- Encode engineering taste with repeatable checks and scenario harnesses.
- Expect entropy: include explicit cleanup and consolidation passes in regular cadence.
- Keep human judgment at high-impact decisions while automating repeatable validation.

### 19.2 Concrete implementation commitments
- Add a `harness/` directory containing:
  - scenario definitions for recruiter/admin tasks
  - expected outcomes and invariants
  - CI runner script and summary report format
- Add agent-facing context endpoints/tools:
  - capability listing
  - current platform state snapshot
  - task completion signaling and mutation confirmation
- Add guardrail checks in CI:
  - architecture boundary checks
  - parity regression checks (UI action still achievable by agent)
  - harness score regression checks
- Add recurring "entropy control" activities:
  - stale docs pruning
  - prompt/tool contract review
  - dead-code/dead-workflow cleanup

### 19.3 Adoption phases
- Phase A (immediate): VS-0 and VS-1 include harness baseline and parity gates.
- Phase B (mid): VS-2 and VS-3 expand harness coverage to grading and matching.
- Phase C (hardening): VS-4 and VS-5 enforce harness thresholds as release blockers.

## 19. Deepened Research Insights (2026)

### 19.1 Section Manifest (What Was Deepened)
- Section 4: Architecture and technology decisions (service boundaries, provider interfaces, agent-native tooling contract).
- Section 5: Data model and constraints (DB integrity, uniqueness edge cases, RLS boundaries).
- Section 5.3 and WS-3: Search/ranking design (lexical + vector + freshness, deterministic ranking function).
- Section 6 and WS-2: Ingestion orchestration (cron, connector contracts, dedup, idempotency).
- WS-5: AI grading engine (schema-safe model IO, retries, resumability).
- WS-6: Matching engine (determinism and explainability trace guarantees).
- WS-9: Assistant experience (tool loop safety, explicit completion, trace surface).
- Section 9 and WS-10: API and security posture (authorization, abuse controls, auditability).
- Section 10: Frontend App Router, state synchronization, and UX consistency.
- Section 11: Test strategy hardening (BDD/TDD/parity plus infra-aware testing).
- Section 12: Observability + SLO operations.
- Section 13: Security and compliance baseline upgrades.
- Section 15/16: Delivery governance and release gate hardening.
- Section 17: Immediate next actions with tighter execution sequencing.

### 19.2 Architecture and Technology Decisions (Section 4)

#### Research Insights

**Best Practices:**
- Keep connector integrations behind a provider contract so ingestion orchestration logic stays stable while adapters evolve.
- Treat the agent contract as a first-class API surface: parity tests must fail if a UI action loses tool equivalence.
- Explicitly separate mutating and read-only tools to enforce approval gates and reduce blast radius.
- Standardize configuration precedence: runtime flag > environment variable > default.

**Performance Considerations:**
- Service boundaries should align to independent scaling units (`sources`, `jobs`, `grading`, `assistant`) to isolate hot paths.
- Prevent synchronous fan-out from assistant orchestration into ingestion/matching paths; use queued async hops with correlation IDs.

**Implementation Details:**
```ts
// Provider boundary for source connectors
export interface SourceConnector {
  platform: 'linkedin' | 'upwork' | 'indeed' | string;
  fetchJobs(input: { cursor?: string; since?: string }): Promise<RawJobPayload[]>;
  normalize(raw: RawJobPayload): CanonicalJobInput;
  dedupKey(raw: RawJobPayload): { externalId?: string; canonicalUrlHash: string };
}
```

**Edge Cases:**
- Connector returns partial page with transient upstream failures.
- Assistant requests a mutation that spans multiple bounded contexts; enforce step-wise confirmation.

**References:**
- https://encore.dev/docs/ts/primitives/pubsub
- https://encore.dev/docs/ts/primitives/cron-jobs
- https://ai-sdk.dev/docs/agents/building-agents

### 19.3 Data Model and Constraints (Section 5)

#### Research Insights

**Best Practices:**
- Enforce duplicate prevention with partial unique indexes for nullable external IDs and fallback canonical URL hashes.
- Keep score-domain invariants in DB `CHECK` constraints, not only application validators.
- Add explicit row visibility policy (RLS) for recruiter/admin workspace separation as auth matures.

**Performance Considerations:**
- Composite indexes should follow highest-selectivity + most-common filters from `/jobs` and `/applications` query plans.
- Partial indexes reduce bloat for sparse uniqueness constraints and improve write throughput.

**Implementation Details:**
```sql
CREATE UNIQUE INDEX uq_jobs_platform_external
ON jobs (source_platform, external_job_id)
WHERE external_job_id IS NOT NULL;

CREATE UNIQUE INDEX uq_jobs_platform_canonical
ON jobs (source_platform, canonical_url_hash)
WHERE external_job_id IS NULL;

ALTER TABLE candidate_grades
  ADD CONSTRAINT chk_grade_total CHECK (total_score BETWEEN 0 AND 100);
```

**Edge Cases:**
- Same canonical posting appears across platforms with different IDs; dedup should be platform-scoped by policy.
- Backfill migrations that violate new constraints must be staged with pre-validation and repair scripts.

**References:**
- https://www.postgresql.org/docs/current/ddl-constraints.html
- https://www.postgresql.org/docs/current/indexes-partial.html
- https://orm.drizzle.team/docs/indexes-constraints
- https://www.postgresql.org/docs/current/ddl-rowsecurity.html

### 19.4 Search, Ranking, and Storage (Section 5.3 + WS-3)

#### Research Insights

**Best Practices:**
- Keep lexical (`tsvector`) and semantic (`pgvector`) scores separate, then fuse in SQL with explicit weights.
- Version embeddings (`embedding_model`, `embedding_version`) to support safe re-indexing and rollback.
- Persist ranking explainability payload (component scores + final score) for audit and recruiter trust.

**Performance Considerations:**
- Use `GIN` for `search_tsv`; choose `HNSW` or `IVFFlat` in pgvector based on recall/latency tradeoff and dataset shape.
- Add offline quality evaluation set before changing ranking weights in production.

**Implementation Details:**
```sql
CREATE OR REPLACE FUNCTION rank_jobs(
  query_text text,
  query_vector vector,
  now_ts timestamptz
) RETURNS TABLE(job_id bigint, total_score numeric) AS $$
  SELECT j.id,
         (0.45 * ts_rank_cd(j.search_tsv, plainto_tsquery(query_text))) +
         (0.40 * (1 - (j.embedding <=> query_vector))) +
         (0.15 * exp(-0.0008 * EXTRACT(EPOCH FROM (now_ts - j.posted_at))))
  FROM jobs j
  ORDER BY total_score DESC;
$$ LANGUAGE sql STABLE;
```

**Edge Cases:**
- ANN index recall drop after large ingest spikes; schedule periodic recall checks against exact search sample.
- Freshness term can swamp relevance for brand-new low-quality listings if decay is too aggressive.

**References:**
- https://www.postgresql.org/docs/current/textsearch-controls.html
- https://github.com/pgvector/pgvector

### 19.5 Source Ingestion Workflow (Section 6.1 + WS-2)

#### Research Insights

**Best Practices:**
- Assume scheduler and pub/sub pathways can replay; ingestion handlers must be idempotent by `(source_id, run_id, dedup_key)`.
- Keep connector timeouts and retry policy per-source configurable.
- Separate ingestion run lifecycle states (`queued`, `running`, `partial_success`, `failed`, `completed`).

**Performance Considerations:**
- Limit concurrent source runs globally and per source to avoid upstream bans and DB lock pressure.
- Queue embeddings/enrichment as separate jobs to keep run completion latency stable.

**Implementation Details:**
```ts
// Pseudocode: replay-safe ingestion finalization
await db.tx(async (tx) => {
  const run = await tx.getRunForUpdate(runId);
  if (run.status === 'completed') return; // idempotent replay guard
  await tx.upsertJobs(normalizedJobs);
  await tx.updateRunMetrics(runId, metrics);
  await tx.markRunCompleted(runId);
});
```

**Edge Cases:**
- Cron-triggered run overlaps with manual run for same source.
- Connector payload shape drift silently degrades normalization quality.

**References:**
- https://encore.dev/docs/ts/primitives/cron-jobs
- https://encore.dev/docs/ts/primitives/pubsub
- https://encore.dev/docs/ts/develop/testing

### 19.6 Candidate Grading Workflow (Section 6.2 + WS-5)

#### Research Insights

**Best Practices:**
- Enforce strict schema validation at model boundary; persist only validated and range-checked payloads.
- Store prompt/template version and model ID with each grade for reproducibility.
- Implement retry strategy with bounded attempts and explicit terminal states for batch resumability.

**Performance Considerations:**
- Batch grading should chunk by candidate volume and token budget, not by fixed count only.
- Cache deterministic extraction artifacts (resume text normalization) to avoid repeated expensive preprocessing.

**Implementation Details:**
```ts
const GradeSchema = z.object({
  totalScore: z.number().min(0).max(100),
  rationale: z.string().min(1),
  skills: z.array(z.object({ name: z.string(), score: z.number().min(0).max(100) })),
});

const result = await streamText({ model, prompt });
const parsed = GradeSchema.parse(JSON.parse(result.text));
```

**Edge Cases:**
- LLM returns valid JSON with semantically inconsistent rationale/score pair.
- Resume extraction fails for image-only PDFs; queue OCR fallback with explicit status.

**References:**
- https://ai-sdk.dev/docs/ai-sdk-core/generating-text
- https://ai-sdk.dev/docs/agents/building-agents

### 19.7 Matching and Explainability (Section 6.3 + WS-6)

#### Research Insights

**Best Practices:**
- Keep matching as pure deterministic function over versioned inputs.
- Persist criterion-level breakdown and knockout reason codes for recruiter and agent parity surfaces.
- Add regression suite with locked fixtures to detect scoring drift.

**Performance Considerations:**
- Precompute reusable criterion features (e.g., normalized skill vectors) to reduce per-match latency.
- Use incremental recomputation on candidate/job delta instead of full rematch.

**Implementation Details:**
```ts
export function scoreMatch(input: MatchInput): MatchResult {
  const knockout = evaluateKnockouts(input);
  if (!knockout.passed) return { level: 'no-match', total: 0, reasons: knockout.reasons };

  const weighted = input.criteria.map(c => ({
    key: c.key,
    weight: c.weight,
    value: c.evaluate(input),
  }));

  const total = weighted.reduce((s, c) => s + c.weight * c.value, 0);
  return { level: classify(total), total, weighted };
}
```

**Edge Cases:**
- Ties around threshold boundaries causing unstable shortlist ordering.
- Missing candidate fields interpreted differently across criteria.

**References:**
- https://www.postgresql.org/docs/current/ddl-constraints.html
- https://www.postgresql.org/docs/current/textsearch-controls.html

### 19.8 Assistant Workflow and Agent-Native Safety (Sections 6.4, 6.5, 9.6)

#### Research Insights

**Best Practices:**
- Configure explicit stop conditions for tool loops and require confirmations for high-impact mutating tools.
- Keep read-only and mutating tool namespaces distinct for policy clarity.
- Log tool traces with request ID, tool name, args hash, duration, and outcome.

**Performance Considerations:**
- Cap tool loop depth and enforce per-turn time budgets.
- Prefer narrow capability exposure by user role and context to reduce unnecessary tool planning latency.

**Implementation Details:**
```ts
const agent = new ToolLoopAgent({
  model,
  tools,
  stopWhen: stepCountIs(10),
});

// Mutations require explicit approval
if (tool.meta.requiresApproval) {
  await requestConfirmation({ action: tool.name, payload: safePreview(args) });
}
```

**Edge Cases:**
- Assistant loops between listing and summarizing tools without converging.
- User asks for bulk destructive action; confirmation wording must include scope and undo path.

**References:**
- https://ai-sdk.dev/docs/agents/building-agents

### 19.9 API Contract and Security Hardening (Sections 9 + 13 + WS-10)

#### Research Insights

**Best Practices:**
- Enforce object-level authorization on every resource endpoint (`/candidates/:id`, `/applications/:id`) regardless of route-level auth.
- Define idempotency behavior for mutation endpoints (`POST /sources/:id/run`, bulk stage updates).
- Standardize audit envelope across all mutating APIs.

**Performance Considerations:**
- Apply rate limits and abuse protection by endpoint risk profile (assistant/mutations stricter than reads).
- Keep API payload fields minimal and cursor-based where lists may grow quickly.

**Implementation Details:**
```ts
// Example policy check pattern
authorize(user, 'application:update', application.workspaceId);
validateInput(schema, req.body);
const result = await svc.updateApplicationStage(...);
audit.log({ actor: user.id, action: 'application.stage.update', entityId: application.id });
```

**Edge Cases:**
- Broken object-level auth from predictable IDs across workspaces.
- Missing audit events on internal tool-triggered side effects.

**References:**
- https://owasp.org/Top10/2021/
- https://owasp.org/API-Security/editions/2023/en/0x11-t10/

### 19.10 Frontend Plan Hardening (Section 10)

#### Research Insights

**Best Practices:**
- Respect App Router segment rules: `route.ts` and `page.tsx` cannot coexist in the same segment level.
- Keep URL state canonical with `nuqs` for shareable recruiter workflows.
- Adopt TanStack Query key factories and mutation rollback patterns for consistency.

**Performance Considerations:**
- Tune query `staleTime` by domain volatility (`sources/runs` lower, reference lists higher).
- Use selective hydration boundaries and defer non-critical dashboard panels.

**Implementation Details:**
```ts
export const queryKeys = {
  jobs: (filters: JobFilters) => ['jobs', filters] as const,
  candidate: (id: string) => ['candidate', id] as const,
};

const { data } = useQuery({
  queryKey: queryKeys.jobs(filters),
  queryFn: () => api.jobs.search(filters),
  staleTime: 60_000,
});
```

**Edge Cases:**
- Route handler accidentally added to a segment with existing `page.tsx`.
- URL filter state and server defaults diverge after navigation restoration.

**References:**
- https://nextjs.org/docs/app
- https://nextjs.org/docs/app/getting-started/route-handlers
- https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
- https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
- https://nuqs.dev/docs/basic-usage

### 19.11 Accessibility Baseline Upgrades (Section 10.3)

#### Research Insights

**Best Practices:**
- Add WCAG 2.2 criteria checks to CI UX gate, especially focus-visibility and target operation criteria.
- Ensure keyboard and screen-reader equivalents for all stage movement and assistant actions.
- Ensure status toasts are announced appropriately (polite/assertive by impact).

**Performance Considerations:**
- Accessibility checks should run in parallel with e2e smoke tests to avoid release drag.

**Implementation Details:**
```text
Accessibility gate additions:
- 2.4.11 Focus Not Obscured (Minimum)
- 2.5.7 Dragging Movements
- 3.3.7 Redundant Entry
- Existing color contrast and semantic structure checks
```

**Edge Cases:**
- Dense pipeline board obscures keyboard focus ring.
- Drag-only stage transitions unavailable to keyboard-only users.

**References:**
- https://www.w3.org/TR/WCAG22/

### 19.12 Testing and Verification Strategy Deepening (Section 11)

#### Research Insights

**Best Practices:**
- Keep acceptance criteria executable: every VS exit criterion maps to BDD scenario IDs.
- Require RED evidence artifact per slice (failing test run link/log) before GREEN implementation merge.
- Add parity test matrix requiring equivalent state transitions and audit trails for UI and tool paths.

**Performance Considerations:**
- Partition e2e by user journey (`recruiter`, `ops`, `assistant`) and parallelize in CI.
- Run load checks for search and ingestion continuously on representative staging snapshots.

**Implementation Details:**
```text
Parity test matrix columns:
- Scenario ID
- UI path assertions
- Agent tool path assertions
- State equivalence check
- Audit event equivalence check
```

**Edge Cases:**
- Passing UI tests but missing tool capability regression.
- Flaky async grading tests caused by nondeterministic retry windows.

**References:**
- https://nextjs.org/docs/app/guides/testing/playwright
- https://encore.dev/docs/ts/develop/testing

### 19.13 Observability and Operations (Section 12)

#### Research Insights

**Best Practices:**
- Instrument all critical workflows with trace + span IDs, then emit correlation IDs into logs/metrics.
- Use semantic conventions for span naming and attributes to keep dashboards consistent.
- Define SLOs with error budgets before launch and wire alerts to budget burn rate, not only threshold spikes.

**Performance Considerations:**
- Keep high-cardinality labels controlled; avoid unbounded user-provided values in metric dimensions.
- Build per-workflow latency histograms (ingestion, search, grading, assistant tools).

**Implementation Details:**
```text
SLO starter set:
- Search API: 99% < 500ms over 28 days
- Ingestion run success: 99.5% over 28 days
- Grading completion (valid inputs): 99% over 28 days
- Assistant tool success: 99% over 28 days
```

**Edge Cases:**
- Alerts that fire on volume spikes without user-impact context.
- Trace gaps between assistant request and downstream tool side effects.

**References:**
- https://opentelemetry.io/docs/specs/otel/trace/api/
- https://opentelemetry.io/docs/specs/semconv/general/trace/
- https://sre.google/workbook/implementing-slos/
- https://sre.google/sre-book/service-level-objectives/

### 19.14 Security and Compliance Baseline Deepening (Section 13)

#### Research Insights

**Best Practices:**
- Add explicit data classification (PII, sensitive operational data, public metadata) and policy per class.
- Use deny-by-default authorization checks at the service layer plus endpoint guard.
- Ensure assistant-triggered mutations are always auditable with actor, intent, and confirmation state.

**Performance Considerations:**
- Security controls must be load-tested (rate-limiter, auth middleware, audit writes) to avoid hot-path bottlenecks.

**Implementation Details:**
```text
Mandatory security checks per endpoint:
1) Authenticate identity
2) Authorize object/workspace access
3) Validate input schema and bounds
4) Enforce idempotency/rate limits where required
5) Emit audit event for mutation
```

**Edge Cases:**
- Internal service-to-service calls bypassing user-context authorization.
- Logs leaking PII through structured debug payloads.

**References:**
- https://owasp.org/Top10/2021/
- https://owasp.org/API-Security/editions/2023/en/0x11-t10/

### 19.15 Governance, Release Gate, and Next Actions (Sections 15-17)

#### Research Insights

**Best Practices:**
- Tie release-go/no-go to SLO error budget posture and unresolved severity policy.
- Add formal rollback rehearsal cadence before V1 launch window.
- Keep change approval template requiring parity impact statement for every scope addition.

**Performance Considerations:**
- Release gate should include representative-load canary checks for search, ingestion, grading, and assistant tools.

**Implementation Details:**
```text
Kickoff sequence refinement:
1) VS-0 BDD + parity matrix finalized
2) RED evidence captured for VS-0 acceptance/integration/parity suites
3) GREEN implementation + refactor with trace/audit coverage
4) Canary + rollback script rehearsal before VS-1 promotion
```

**Edge Cases:**
- Scope creep introducing cross-context dependencies late in a slice.
- Rollback scripts untested against realistic partially-completed runs.

**References:**
- https://sre.google/workbook/implementing-slos/
- https://encore.dev/docs/ts/develop/testing
