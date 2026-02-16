# Product Requirements Document (PRD)
## Product: AI-Assisted Recruitment Operations Platform

## 1. Purpose
This product centralizes the recruitment workflow for assignment-based hiring (with strong support for freelance/public-sector procurement flows). It combines:
- Multi-source job ingestion
- Unified job discovery
- Candidate evaluation and matching
- Application lifecycle tracking
- Operator-facing AI assistance

This PRD is intentionally language- and framework-agnostic so the system can be refactored without functional regression.

## 2. Product Goals
- Reduce time-to-shortlist by automating sourcing and first-pass screening.
- Provide one operational workspace for recruiters instead of fragmented tools.
- Improve match quality via structured criteria and explainable scoring.
- Keep ingested market data fresh with repeatable scraper pipelines.
- Preserve auditability of candidate/job decisions.

## 3. Personas
- Recruiter: Sources roles, reviews opportunities, evaluates candidates, advances pipeline.
- Recruitment Lead/Admin: Configures ingestion sources, monitors platform health, controls lifecycle states.
- Hiring Stakeholder (internal): Consumes match insights and shortlist recommendations.
- System Agent (AI): Executes scraping/search/grading/matching workflows through tool contracts.

## 4. Functional Scope

### 4.1 Job Ingestion and Catalog
- Ingest opportunities from multiple external platforms via pluggable adapters.
- Normalize heterogeneous listing payloads into a unified listing/job model.
- Persist listings into central storage with deduplication (primary key behavior based on stable external URL/ID).
- Track ingestion run results (found/new/duplicates/errors/duration/timestamp).
- Support per-platform configuration (source URL, schedule, active/inactive state, optional selectors/parameters).

### 4.2 Job Discovery
- Provide searchable job catalog with:
  - Text search
  - Platform filter
  - Location/province filter
  - Rate range filter
  - Recency-aware ranking
- Support hybrid ranking behavior (lexical + semantic hints + freshness weighting).
- Expose list/detail views for jobs with metadata (source, timing, contract type, compensation hints, requirements).

### 4.3 Candidate Management
- Store candidate profile and resume-derived attributes.
- Enforce candidate uniqueness on key contact identity (email or equivalent).
- Support lifecycle stages (new, screening, interview, offer, hired, rejected).
- Support stage updates (single and bulk).
- Protect referential integrity (cannot hard-delete candidate with active linked applications).

### 4.4 Candidate AI Evaluation
- Grade resume/CV text using an LLM-based grading engine.
- Produce structured outputs including:
  - Overall score
  - Skill match
  - Relevance
  - Resume quality
  - AI-authorship likelihood
  - Extracted skills, experience, education, summary
- Persist grading outputs back to candidate profile.
- Support batch grading of unscored candidates.

### 4.5 Candidate-to-Job Matching
- Match candidate against job using two-phase logic:
  - Knock-out criteria (hard fail/pass)
  - Weighted scoring criteria (soft scoring)
- Produce explainable match output:
  - Knock-out evaluation details
  - Criterion-level weighted scores
  - Total weighted score
  - Match level and risk profile
  - Recommendations
- Upsert match outputs into application records.

### 4.6 Application and Pipeline Tracking
- Represent candidate-job relationship as an application entity.
- Prevent duplicate applications for same candidate+job pair.
- Track stage, status, notes, and AI match outputs.
- Support stage transitions with validation.
- Prevent hard-delete when dependent interviews exist.

### 4.7 Scraper Operations UI
- Show per-platform operational status:
  - Active/paused
  - Last run
  - Total listings by platform
  - Last run yield
- Allow manual trigger for single platform or all platforms.
- Show recent run history table (result metrics + status).
- Surface scrape errors to operator.

### 4.8 AI Assistant Experience
- Conversational assistant for recruiter workflows.
- Supports quick actions (scrape, summarize, shortlist-oriented prompts).
- Displays assistant responses and tool call traces.
- Supports standard request-response and streaming response modes.

## 5. Out of Scope (Current Version)
- Candidate self-service portal and direct application UX.
- Fully implemented RBAC with fine-grained authorization policy.
- Full interview scheduling/calendar integration.
- Guaranteed autonomous scheduling of scrape jobs (manual/on-demand is primary proven flow).
- Production-grade analytics/BI layer beyond operational counters.

## 6. User Stories

### Recruiter
- As a recruiter, I want all opportunities from multiple sources in one searchable catalog so I can avoid context switching.
- As a recruiter, I want to filter jobs by platform, location, and rate so I can focus on relevant assignments.
- As a recruiter, I want candidate resumes automatically graded so I can triage faster.
- As a recruiter, I want transparent match reports (hard failures + weighted scores) so I can defend shortlist decisions.
- As a recruiter, I want to move candidates/applications through stages so pipeline state stays accurate.
- As a recruiter, I want an AI assistant that can run operational actions and summarize outcomes so I can work faster.

### Recruitment Lead/Admin
- As an admin, I want to configure and activate/deactivate source connectors so ingestion remains controllable.
- As an admin, I want scrape run history and error visibility so I can monitor ingestion quality.
- As an admin, I want deduplication safeguards so repeated runs don’t pollute the catalog.
- As an admin, I want data integrity protections on deletes so historical linkage is preserved.

### Hiring Stakeholder
- As a hiring stakeholder, I want standardized match outputs and risk indicators so I can make consistent selection decisions.

## 7. Data Model (Domain-Level, Agnostic)

### 7.1 Core Entities
- Candidate
  - Identity/contact: name, email, phone, location
  - Resume assets/text
  - Derived attributes: skills, experience years, education
  - AI scores: overall grade, AI-content score
  - Lifecycle status

- Job
  - Core metadata: title, department/client, location, type, description
  - Requirements (list)
  - Optional knock-out criteria (criterion, description, required)
  - Optional scoring criteria (criterion, weight, description)
  - Source metadata: platform, external URL/ID, scraped timestamp
  - Lifecycle status

- Application
  - Foreign keys: candidate, job
  - Stage/status
  - AI match score
  - Knock-out/scoring result payloads
  - Operator notes

- Interview
  - Foreign key: application
  - Type, date/time, interviewer, status
  - Optional feedback/rating

- ScraperConfig
  - Platform connector identity
  - Base/source URL
  - Query parameters/selectors
  - Schedule policy
  - Active state
  - Last run metadata

- ScrapeResult
  - Foreign key: scraper config
  - Run timestamp
  - Jobs found/new
  - Error summary

- Message / CommunicationLog
  - Optional foreign key: application
  - Template metadata, subject/body
  - Delivery/engagement status metrics

- AgentContext (optional but useful)
  - Key/value context memory for multi-step agent workflows
  - Updated timestamp

### 7.2 Integrity Rules
- Candidate unique by normalized email (or configured identity key).
- Application unique by (candidate_id, job_id).
- Scraped job dedup keyed by stable external source identifier.
- Delete guards:
  - Candidate blocked if linked applications exist.
  - Job blocked if linked applications exist.
  - Application blocked if linked interviews exist.
- Validation constraints:
  - Score ranges constrained (0-100 where applicable).
  - Enumerated lifecycle values enforced.
  - Weighted criteria totals bounded.

## 8. Non-Functional Requirements
- Responsiveness: usable desktop-first with mobile-capable interaction patterns.
- Reliability: partial failures in one source/step should not fail entire ingestion workflow.
- Observability: capture run statistics, error summaries, and timestamps for scraping and AI operations.
- Explainability: AI scoring/matching outputs must include rationale fields.
- Extensibility: platform adapter architecture must allow adding/removing connectors with minimal core changes.
- Performance:
  - Job search should return interactive results under expected operational loads.
  - Ingestion should support high-volume source catalogs with bounded processing windows.
- Security/Privacy:
  - Resume and contact data treated as sensitive.
  - Access controls and audit logging required before enterprise scaling.

## 9. API and Service Contracts (Conceptual)
- Job service: list/get/create/update/delete + hybrid search + find by external URL.
- Candidate service: list/get/create/update/delete + stage updates + unscored retrieval.
- Application service: list/get/create/update/delete + stage updates + upserted AI match results.
- Scraper service: config CRUD + run result logging + save-scraped-jobs.
- AI service: grade resume, grade+persist candidate, batch grade, match candidate-to-job.
- Assistant service: conversational endpoint with optional streaming and tool execution traces.

## 10. Refactor Safety Requirements
Any refactor must preserve the following behaviors:
- Multi-platform ingestion with normalized listing storage and deduplication.
- Search/filter/rank job discovery capabilities.
- Candidate grading and candidate-job matching with explainable outputs.
- Application lifecycle stage management with validation.
- Referential integrity guards on destructive operations.
- Operational scraper dashboard metrics and manual trigger flow.
- Assistant endpoint contract for user message in, assistant/tool response out.

## 11. Acceptance Criteria (Product-Level)
- Platform can ingest and persist listings from all configured sources in one run.
- Duplicate listings from repeated ingestion runs do not create duplicate job records.
- Recruiter can find jobs using text + at least two structured filters.
- Candidate grading returns structured scores and stores results.
- Candidate-to-job matching returns knock-out and weighted scoring details and persists them.
- Recruiter can move pipeline stages and see updated state.
- Scraper dashboard reflects latest run outcomes and errors.
- Assistant can execute at least one end-to-end tool-backed workflow (e.g., scrape + summarize).

## 12. Key Learnings Extracted From Existing System
- Adapter pattern is the right abstraction boundary for source expansion and should be retained.
- Deduplication at persistence boundary (not only at scrape boundary) is essential.
- Explainable AI outputs (criterion-level evidence) materially improve recruiter trust.
- Hard/soft criteria split for matching maps well to public procurement-style hiring.
- Search quality improves when recency is blended with lexical/semantic relevance.
- Operational dashboards should read from persisted run logs, not transient in-memory state.
- Data integrity rules currently enforce important safety; these are critical during refactor.
- Existing tests/documentation contain some drift from current implementation; align tests to current contracts before major refactor to avoid false confidence.

## 13. Migration Notes for Framework/Language Changes
- Preserve domain model and service contracts first; swap transport/runtime second.
- Keep AI orchestration tool contracts stable to avoid breaking assistant flows.
- Isolate provider integrations (LLM, storage, scraper fetch engines) behind explicit interfaces.
- Add contract tests around API payload shapes and entity lifecycle invariants before rewriting internals.
