import { buildServer } from "../apps/api/src/server.js";
import { resetStore } from "../apps/api/src/store.js";
import fs from "node:fs";
import path from "node:path";

type Scenario = {
  id: string;
  description: string;
  steps: { method: string; path: string; body?: unknown; expectStatus: number }[];
};

async function run() {
  const app = await buildServer();
  resetStore();

  const scenarioPath = path.join(process.cwd(), "harness", "scenarios.json");
  const scenarios = JSON.parse(fs.readFileSync(scenarioPath, "utf8")) as Scenario[];

  const results = [] as { id: string; passed: boolean; errors: string[] }[];

  for (const scenario of scenarios) {
    const errors: string[] = [];
    for (const step of scenario.steps) {
      const res = await app.inject({
        method: step.method as "GET" | "POST" | "PATCH",
        url: step.path,
        payload: step.body
      });
      if (res.statusCode !== step.expectStatus) {
        errors.push(`${step.method} ${step.path} expected ${step.expectStatus} got ${res.statusCode}`);
      }
    }
    results.push({ id: scenario.id, passed: errors.length === 0, errors });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    passRate: results.filter((r) => r.passed).length / results.length,
    results
  };

  fs.mkdirSync(path.join(process.cwd(), "harness", "reports"), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), "harness", "reports", "latest.json"), JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));

  if (results.some((r) => !r.passed)) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
