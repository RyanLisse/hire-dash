import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  CapabilitySchema,
  CandidateSchema,
  CreateApplicationSchema,
  CreateCandidateSchema,
  CreateSourceInputSchema,
  JobSchema,
  SourceStatusSchema
} from "@hire-dash/shared";
import {
  createApplication,
  createCandidate,
  createSource,
  gradeCandidate,
  listApplications,
  listAudit,
  listCandidates,
  listJobs,
  listRuns,
  listSources,
  matchApplication,
  runSource,
  sourceStatus,
  updateApplicationStage
} from "./store.js";

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  const capabilities = [
    { id: "list_capabilities", description: "List agent capabilities", kind: "read" as const },
    { id: "list_sources", description: "List configured sources", kind: "read" as const },
    { id: "create_source", description: "Create source configuration", kind: "mutate" as const },
    { id: "run_source", description: "Run a source ingestion", kind: "mutate" as const },
    { id: "search_jobs", description: "Search jobs", kind: "read" as const },
    { id: "create_candidate", description: "Create candidate", kind: "mutate" as const },
    { id: "grade_candidate", description: "Grade candidate resume", kind: "mutate" as const },
    { id: "create_application", description: "Create application", kind: "mutate" as const },
    { id: "match_application", description: "Match candidate to job", kind: "mutate" as const },
    { id: "update_application_stage", description: "Update application stage", kind: "mutate" as const },
    { id: "assistant_source_status", description: "Read source status summary", kind: "read" as const },
    { id: "complete_task", description: "Explicit completion signal", kind: "mutate" as const }
  ];

  app.get("/health", async () => ({ ok: true }));

  app.get("/api/tools/list-capabilities", async () => ({
    capabilities: capabilities.map((c) => CapabilitySchema.parse(c))
  }));

  app.post("/api/tools/complete-task", async (request, reply) => {
    const body = request.body as { summary?: string };
    if (!body?.summary) return reply.status(400).send({ error: "summary_required" });
    return { ok: true, summary: body.summary };
  });

  app.get("/api/sources", async () => ({ items: listSources() }));

  app.post("/api/sources", async (request, reply) => {
    const parsed = CreateSourceInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_input", issues: parsed.error.flatten() });
    return reply.status(201).send({ item: createSource(parsed.data) });
  });

  app.post("/api/sources/:id/run", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const run = runSource(id);
    if (!run) return reply.status(404).send({ error: "source_not_found" });
    return { item: run };
  });

  app.get("/api/jobs", async (request) => {
    const query = (request.query as { q?: string }).q;
    return { items: listJobs(query).map((j) => JobSchema.parse(j)) };
  });

  app.post("/api/candidates", async (request, reply) => {
    const parsed = CreateCandidateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_input", issues: parsed.error.flatten() });
    const result = createCandidate(parsed.data);
    if ("error" in result) return reply.status(409).send(result);
    return reply.status(201).send({ item: CandidateSchema.parse(result.candidate) });
  });

  app.get("/api/candidates", async () => ({ items: listCandidates().map((c) => CandidateSchema.parse(c)) }));

  app.post("/api/candidates/:id/grade", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const graded = gradeCandidate(id);
    if (!graded) return reply.status(404).send({ error: "candidate_not_found" });
    return { item: CandidateSchema.parse(graded) };
  });

  app.post("/api/applications", async (request, reply) => {
    const parsed = CreateApplicationSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_input", issues: parsed.error.flatten() });
    const result = createApplication(parsed.data);
    if ("error" in result) return reply.status(409).send(result);
    return reply.status(201).send({ item: result.application });
  });

  app.get("/api/applications", async () => ({ items: listApplications() }));

  app.post("/api/match", async (request, reply) => {
    const body = request.body as { candidateId?: string; jobId?: string };
    if (!body?.candidateId || !body?.jobId) return reply.status(400).send({ error: "candidateId_and_jobId_required" });
    const result = matchApplication({ candidateId: body.candidateId, jobId: body.jobId });
    if (!result) return reply.status(404).send({ error: "application_not_found" });
    return { item: result };
  });

  app.patch("/api/applications/:id/stage", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const stage = (request.body as { stage?: "new" | "screening" | "interview" | "offer" | "hired" | "rejected" }).stage;
    if (!stage) return reply.status(400).send({ error: "stage_required" });
    const updated = updateApplicationStage(id, stage);
    if (!updated) return reply.status(404).send({ error: "application_not_found" });
    return { item: updated };
  });

  app.get("/api/assistant/source-status", async () => ({ item: SourceStatusSchema.parse(sourceStatus()) }));
  app.get("/api/ops/runs", async () => ({ items: listRuns() }));
  app.get("/api/audit", async () => ({ items: listAudit() }));

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 4000);
  buildServer()
    .then((app) => app.listen({ port, host: "0.0.0.0" }))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exit(1);
    });
}
