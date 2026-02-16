import { beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../src/server.js";
import { resetStore } from "../src/store.js";

describe("Vertical slice API flow", () => {
  beforeEach(() => resetStore());

  it("VS-0 create/read source and status", async () => {
    const app = await buildServer();
    const createRes = await app.inject({
      method: "POST",
      url: "/api/sources",
      payload: { name: "Board A", platform: "public-sector", baseUrl: "https://example.com/jobs" }
    });
    expect(createRes.statusCode).toBe(201);

    const statusRes = await app.inject({ method: "GET", url: "/api/assistant/source-status" });
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json().item.totalSources).toBe(1);
  });

  it("VS-1 run source and query jobs", async () => {
    const app = await buildServer();
    const src = await app.inject({
      method: "POST",
      url: "/api/sources",
      payload: { name: "Board B", platform: "remote", baseUrl: "https://example.com/x" }
    });
    const sourceId = src.json().item.id;

    const runRes = await app.inject({ method: "POST", url: `/api/sources/${sourceId}/run` });
    expect(runRes.statusCode).toBe(200);

    const jobsRes = await app.inject({ method: "GET", url: "/api/jobs?q=Frontend" });
    expect(jobsRes.statusCode).toBe(200);
    expect(jobsRes.json().items.length).toBeGreaterThan(0);
  });

  it("VS-2 create and grade candidate", async () => {
    const app = await buildServer();
    const cRes = await app.inject({
      method: "POST",
      url: "/api/candidates",
      payload: { name: "Ada", email: "ada@example.com", resumeText: "React TypeScript Node" }
    });
    expect(cRes.statusCode).toBe(201);

    const id = cRes.json().item.id;
    const gRes = await app.inject({ method: "POST", url: `/api/candidates/${id}/grade` });
    expect(gRes.statusCode).toBe(200);
    expect(gRes.json().item.grade.overall).toBeGreaterThan(0);
  });

  it("VS-3 create app, match and stage transition", async () => {
    const app = await buildServer();
    const src = await app.inject({ method: "POST", url: "/api/sources", payload: { name: "Board", platform: "x", baseUrl: "https://example.com" } });
    const sourceId = src.json().item.id;
    await app.inject({ method: "POST", url: `/api/sources/${sourceId}/run` });
    const jobs = await app.inject({ method: "GET", url: "/api/jobs" });
    const jobId = jobs.json().items[0].id;

    const cand = await app.inject({ method: "POST", url: "/api/candidates", payload: { name: "Lin", email: "lin@example.com", resumeText: "Node TypeScript" } });
    const candidateId = cand.json().item.id;
    await app.inject({ method: "POST", url: `/api/candidates/${candidateId}/grade` });

    const appRes = await app.inject({ method: "POST", url: "/api/applications", payload: { candidateId, jobId } });
    expect(appRes.statusCode).toBe(201);

    const matchRes = await app.inject({ method: "POST", url: "/api/match", payload: { candidateId, jobId } });
    expect(matchRes.statusCode).toBe(200);
    expect(matchRes.json().item.match).toBeTruthy();

    const stageRes = await app.inject({ method: "PATCH", url: `/api/applications/${appRes.json().item.id}/stage`, payload: { stage: "screening" } });
    expect(stageRes.statusCode).toBe(200);
    expect(stageRes.json().item.stage).toBe("screening");
  });

  it("VS-4 run ops/audit endpoints", async () => {
    const app = await buildServer();
    const src = await app.inject({ method: "POST", url: "/api/sources", payload: { name: "Ops", platform: "ops", baseUrl: "https://example.com" } });
    await app.inject({ method: "POST", url: `/api/sources/${src.json().item.id}/run` });

    const runsRes = await app.inject({ method: "GET", url: "/api/ops/runs" });
    const auditRes = await app.inject({ method: "GET", url: "/api/audit" });

    expect(runsRes.statusCode).toBe(200);
    expect(runsRes.json().items.length).toBe(1);
    expect(auditRes.statusCode).toBe(200);
    expect(auditRes.json().items.length).toBeGreaterThan(0);
  });
});
