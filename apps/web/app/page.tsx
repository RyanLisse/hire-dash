"use client";

import { useEffect, useState } from "react";
import type { Application, Candidate, SourceConfig, SourceStatus, Capability } from "@hire-dash/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

type Job = {
  id: string;
  title: string;
  description: string;
  rate: number;
};

export default function HomePage() {
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [status, setStatus] = useState<SourceStatus | null>(null);
  const [caps, setCaps] = useState<Capability[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);

  const [sourceForm, setSourceForm] = useState({ name: "", platform: "", baseUrl: "" });
  const [candidateForm, setCandidateForm] = useState({ name: "", email: "", resumeText: "React Node TypeScript" });
  const [searchQ, setSearchQ] = useState("Frontend");

  async function loadAll() {
    const [sRes, stRes, cRes, jRes, candRes, appRes, runRes, auditRes] = await Promise.all([
      fetch(`${API_BASE}/api/sources`),
      fetch(`${API_BASE}/api/assistant/source-status`),
      fetch(`${API_BASE}/api/tools/list-capabilities`),
      fetch(`${API_BASE}/api/jobs?q=${encodeURIComponent(searchQ)}`),
      fetch(`${API_BASE}/api/candidates`),
      fetch(`${API_BASE}/api/applications`),
      fetch(`${API_BASE}/api/ops/runs`),
      fetch(`${API_BASE}/api/audit`)
    ]);

    setSources((await sRes.json()).items);
    setStatus((await stRes.json()).item);
    setCaps((await cRes.json()).capabilities);
    setJobs((await jRes.json()).items);
    setCandidates((await candRes.json()).items);
    setApplications((await appRes.json()).items);
    setRuns((await runRes.json()).items);
    setAudit((await auditRes.json()).items);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function createSource() {
    await fetch(`${API_BASE}/api/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...sourceForm, active: true })
    });
    setSourceForm({ name: "", platform: "", baseUrl: "" });
    await loadAll();
  }

  async function runFirstSource() {
    if (!sources[0]) return;
    await fetch(`${API_BASE}/api/sources/${sources[0].id}/run`, { method: "POST" });
    await loadAll();
  }

  async function createCandidate() {
    await fetch(`${API_BASE}/api/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candidateForm)
    });
    await loadAll();
  }

  async function gradeFirstCandidate() {
    if (!candidates[0]) return;
    await fetch(`${API_BASE}/api/candidates/${candidates[0].id}/grade`, { method: "POST" });
    await loadAll();
  }

  async function createAndMatch() {
    if (!candidates[0] || !jobs[0]) return;
    await fetch(`${API_BASE}/api/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId: candidates[0].id, jobId: jobs[0].id })
    });
    await fetch(`${API_BASE}/api/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId: candidates[0].id, jobId: jobs[0].id })
    });
    await loadAll();
  }

  async function moveFirstApplicationStage() {
    if (!applications[0]) return;
    await fetch(`${API_BASE}/api/applications/${applications[0].id}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "screening" })
    });
    await loadAll();
  }

  return (
    <main>
      <section>
        <h1>Hire Dash Bootstrap (VS-0 .. VS-5)</h1>
        <p>Vertical-slice scaffold with UI and agent-parity APIs.</p>
      </section>

      <section>
        <h2>VS-0 Source Create/Read</h2>
        <label>Name<input value={sourceForm.name} onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })} /></label>
        <label>Platform<input value={sourceForm.platform} onChange={(e) => setSourceForm({ ...sourceForm, platform: e.target.value })} /></label>
        <label>Base URL<input value={sourceForm.baseUrl} onChange={(e) => setSourceForm({ ...sourceForm, baseUrl: e.target.value })} /></label>
        <button onClick={createSource}>Create Source</button>
        <pre>{JSON.stringify(status, null, 2)}</pre>
      </section>

      <section>
        <h2>VS-1 Ingestion and Search</h2>
        <button onClick={runFirstSource}>Run First Source</button>
        <label>Search<input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} /></label>
        <button onClick={loadAll}>Refresh Search</button>
        <ul>{jobs.map((j) => <li key={j.id}>{j.title} (${j.rate})</li>)}</ul>
      </section>

      <section>
        <h2>VS-2 Candidate and Grading</h2>
        <label>Name<input value={candidateForm.name} onChange={(e) => setCandidateForm({ ...candidateForm, name: e.target.value })} /></label>
        <label>Email<input value={candidateForm.email} onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })} /></label>
        <label>Resume Text<input value={candidateForm.resumeText} onChange={(e) => setCandidateForm({ ...candidateForm, resumeText: e.target.value })} /></label>
        <button onClick={createCandidate}>Create Candidate</button>
        <button onClick={gradeFirstCandidate}>Grade First Candidate</button>
        <ul>{candidates.map((c) => <li key={c.id}>{c.name} - grade: {c.grade?.overall ?? "n/a"}</li>)}</ul>
      </section>

      <section>
        <h2>VS-3 Applications and Matching</h2>
        <button onClick={createAndMatch}>Create Application + Match</button>
        <button onClick={moveFirstApplicationStage}>Move First App to Screening</button>
        <ul>{applications.map((a) => <li key={a.id}>{a.id} - {a.stage} - {a.match?.weightedScore ?? "n/a"}</li>)}</ul>
      </section>

      <section>
        <h2>VS-4 Ops and Audit</h2>
        <p>Runs: {runs.length}</p>
        <p>Audit events: {audit.length}</p>
      </section>

      <section>
        <h2>Agent Capabilities (Parity Map)</h2>
        <ul>{caps.map((c) => <li key={c.id}><strong>{c.id}</strong> [{c.kind}] - {c.description}</li>)}</ul>
      </section>

      <section>
        <h2>Sources</h2>
        <ul>{sources.map((s) => <li key={s.id}>{s.id} - {s.name} ({s.platform})</li>)}</ul>
      </section>
    </main>
  );
}
