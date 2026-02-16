import type {
  Application,
  Candidate,
  CreateSourceInput,
  Job,
  SourceConfig
} from "@hire-dash/shared";

const sourceStore: SourceConfig[] = [];
const jobsStore: Job[] = [];
const candidatesStore: Candidate[] = [];
const applicationsStore: Application[] = [];
const runsStore: { id: string; sourceId: string; found: number; deduped: number; createdAt: string }[] = [];
const auditStore: { id: string; action: string; createdAt: string; metadata?: Record<string, unknown> }[] = [];

function now() {
  return new Date().toISOString();
}

function audit(action: string, metadata?: Record<string, unknown>) {
  auditStore.push({ id: `audit_${auditStore.length + 1}`, action, createdAt: now(), metadata });
}

export function listSources(): SourceConfig[] {
  return [...sourceStore];
}

export function createSource(input: CreateSourceInput): SourceConfig {
  const item: SourceConfig = {
    id: `src_${sourceStore.length + 1}`,
    name: input.name,
    platform: input.platform,
    baseUrl: input.baseUrl,
    active: input.active ?? true,
    createdAt: now()
  };
  sourceStore.push(item);
  audit("source.created", { sourceId: item.id });
  return item;
}

export function sourceStatus() {
  const totalSources = sourceStore.length;
  const activeSources = sourceStore.filter((s) => s.active).length;
  const lastUpdatedAt = sourceStore.length ? sourceStore[sourceStore.length - 1].createdAt : null;
  return { totalSources, activeSources, lastUpdatedAt };
}

export function runSource(sourceId: string) {
  const source = sourceStore.find((s) => s.id === sourceId);
  if (!source) return null;

  const generated: Job[] = [
    {
      id: `job_${sourceId}_1`,
      sourceId,
      externalId: `${sourceId}_external_1`,
      title: `${source.platform} Frontend Contract`,
      location: "Remote",
      rate: 95,
      description: "React + TypeScript",
      createdAt: now()
    },
    {
      id: `job_${sourceId}_2`,
      sourceId,
      externalId: `${sourceId}_external_2`,
      title: `${source.platform} Backend Contract`,
      location: "Remote",
      rate: 110,
      description: "Node + Postgres",
      createdAt: now()
    }
  ];

  let deduped = 0;
  for (const job of generated) {
    const exists = jobsStore.some((j) => j.externalId === job.externalId);
    if (!exists) jobsStore.push(job);
    else deduped += 1;
  }

  const run = {
    id: `run_${runsStore.length + 1}`,
    sourceId,
    found: generated.length,
    deduped,
    createdAt: now()
  };
  runsStore.push(run);
  audit("source.run", { sourceId, runId: run.id });
  return run;
}

export function listJobs(query?: string) {
  if (!query) return [...jobsStore];
  const q = query.toLowerCase();
  return jobsStore.filter((j) => j.title.toLowerCase().includes(q) || j.description.toLowerCase().includes(q));
}

export function createCandidate(input: { name: string; email: string; resumeText: string }) {
  if (candidatesStore.some((c) => c.email.toLowerCase() === input.email.toLowerCase())) {
    return { error: "candidate_exists" as const };
  }
  const candidate: Candidate = {
    id: `cand_${candidatesStore.length + 1}`,
    name: input.name,
    email: input.email,
    resumeText: input.resumeText,
    stage: "new",
    createdAt: now(),
    grade: null
  };
  candidatesStore.push(candidate);
  audit("candidate.created", { candidateId: candidate.id });
  return { candidate };
}

function scoreFromText(text: string) {
  const normalized = text.toLowerCase();
  const hasReact = normalized.includes("react") ? 1 : 0;
  const hasNode = normalized.includes("node") ? 1 : 0;
  const hasTs = normalized.includes("typescript") ? 1 : 0;
  const base = (hasReact + hasNode + hasTs) * 30;
  const overall = Math.min(100, base + 10);
  return {
    overall,
    skillMatch: Math.min(100, base),
    relevance: Math.min(100, base + 5),
    summary: "Automated deterministic grade from resume text"
  };
}

export function gradeCandidate(candidateId: string) {
  const candidate = candidatesStore.find((c) => c.id === candidateId);
  if (!candidate) return null;
  candidate.grade = scoreFromText(candidate.resumeText);
  audit("candidate.graded", { candidateId });
  return candidate;
}

export function listCandidates() {
  return [...candidatesStore];
}

export function createApplication(input: { candidateId: string; jobId: string }) {
  const existing = applicationsStore.find((a) => a.candidateId === input.candidateId && a.jobId === input.jobId);
  if (existing) return { error: "application_exists" as const };
  const candidate = candidatesStore.find((c) => c.id === input.candidateId);
  const job = jobsStore.find((j) => j.id === input.jobId);
  if (!candidate || !job) return { error: "missing_entity" as const };

  const app: Application = {
    id: `app_${applicationsStore.length + 1}`,
    candidateId: input.candidateId,
    jobId: input.jobId,
    stage: "new",
    notes: "",
    match: null,
    createdAt: now()
  };
  applicationsStore.push(app);
  audit("application.created", { applicationId: app.id });
  return { application: app };
}

export function matchApplication(input: { candidateId: string; jobId: string }) {
  const app = applicationsStore.find((a) => a.candidateId === input.candidateId && a.jobId === input.jobId);
  const candidate = candidatesStore.find((c) => c.id === input.candidateId);
  const job = jobsStore.find((j) => j.id === input.jobId);
  if (!app || !candidate || !job) return null;

  const knockoutPassed = !!candidate.grade && candidate.grade.overall >= 40;
  const weightedScore = knockoutPassed ? Math.min(100, (candidate.grade?.overall ?? 0) * 0.6 + 40) : 0;
  app.match = {
    knockoutPassed,
    weightedScore,
    explanation: knockoutPassed ? "Meets baseline score" : "Failed baseline score"
  };
  audit("application.matched", { applicationId: app.id });
  return app;
}

export function updateApplicationStage(appId: string, stage: Application["stage"]) {
  const app = applicationsStore.find((a) => a.id === appId);
  if (!app) return null;
  app.stage = stage;
  audit("application.stage_updated", { applicationId: app.id, stage });
  return app;
}

export function listApplications() {
  return [...applicationsStore];
}

export function listRuns() {
  return [...runsStore];
}

export function listAudit() {
  return [...auditStore];
}

export function resetStore() {
  sourceStore.length = 0;
  jobsStore.length = 0;
  candidatesStore.length = 0;
  applicationsStore.length = 0;
  runsStore.length = 0;
  auditStore.length = 0;
}
