/**
 * Observability: metrics are protected and real, readiness reports Raqib's own checks, the scheduled jobs run on one
 * process only, and alerts reach a webhook without flooding it.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL } from "@core/tests/helpers.js";
import { AlertService } from "@raqib/raqib/observability/alerts.js";
import { JobsRunner } from "@raqib/raqib/jobs/jobs-runner.js";
import { createDemoHttpApp, get, hasTestDb } from "./helpers.js";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!hasTestDb)("Raqib observability", () => {
  let app: NestFastifyApplication;
  let runner: JobsRunner;
  let alerts: AlertService;
  const received: Json[] = [];
  let hook: http.Server;
  let hookUrl = "";

  beforeAll(async () => {
    hook = http.createServer((req, res) => {
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        received.push(JSON.parse(body));
        res.end("ok");
      });
    });
    await new Promise<void>((r) => hook.listen(0, "127.0.0.1", r));
    hookUrl = `http://127.0.0.1:${(hook.address() as AddressInfo).port}/hook`;
    const booted = await createDemoHttpApp();
    app = booted.http;
    runner = get<JobsRunner>(booted.moduleRef, JobsRunner);
    alerts = get<AlertService>(booted.moduleRef, AlertService);
  }, 180_000);

  afterAll(async () => {
    delete process.env.RAQIB_METRICS_TOKEN;
    delete process.env.RAQIB_ALERT_WEBHOOK_URL;
    await app?.close();
    await new Promise((r) => hook.close(r));
  });

  const metrics = (auth?: string) => app.inject({ method: "GET", url: "/api/metrics", headers: auth ? { authorization: auth } : {} });

  describe("metrics", () => {
    it("is hidden until a token is configured, then needs it", async () => {
      delete process.env.RAQIB_METRICS_TOKEN;
      expect((await metrics()).statusCode).toBe(404);
      process.env.RAQIB_METRICS_TOKEN = "s3cret-metrics-token";
      expect((await metrics()).statusCode).toBe(401);
      expect((await metrics("Bearer wrong")).statusCode).toBe(401);
      expect((await metrics("Bearer s3cret-metrics-token")).statusCode).toBe(200);
    });

    it("exposes request counts, latency and the operational gauges in the Prometheus format", async () => {
      process.env.RAQIB_METRICS_TOKEN = "s3cret-metrics-token";
      await app.inject({ method: "GET", url: "/api/health" });
      await app.inject({ method: "GET", url: "/api/raqib/visits" }); // 401
      const res = await metrics("Bearer s3cret-metrics-token");
      expect(res.headers["content-type"]).toContain("text/plain");
      const text = res.body;
      expect(text).toMatch(/raqib_http_requests_total\{method="GET",status="2xx"\} \d+/);
      expect(text).toMatch(/raqib_http_requests_total\{method="GET",status="4xx"\} \d+/);
      expect(text).toContain('raqib_http_request_duration_seconds_bucket{le="+Inf"}');
      for (const name of ["raqib_process_uptime_seconds", "raqib_jobs_last_run_timestamp_seconds", "raqib_outbox_pending", "raqib_outbox_dead_lettered"]) {
        expect(text).toContain(name);
      }
      expect(text).not.toContain("/api/"); // never a path or an identity in a label
    });
  });

  describe("readiness", () => {
    it("reports jobs, storage and PDF, and stays ready while the timer is not armed (tests)", async () => {
      const res = await app.inject({ method: "GET", url: "/api/health/raqib" });
      const body = res.json() as Json;
      expect(res.statusCode).toBe(200);
      expect(body.status).toBe("ready");
      expect(Object.keys(body.checks).sort()).toEqual(["jobs", "outbox", "storage"]);
    });

    it("turns degraded when the armed jobs have gone stale", async () => {
      runner.running = true;
      runner.lastRun = {
        at: new Date(Date.now() - 3 * 3600_000),
        report: {
          organizations: 0,
          visitsMarkedOverdue: 0,
          actionsMarkedOverdue: 0,
          actionsEscalated: 0,
          requestsErased: 0,
          evidencePurged: 0,
          uploadsPurged: 0,
        },
      };
      try {
        const res = await app.inject({ method: "GET", url: "/api/health/raqib" });
        expect(res.statusCode).toBe(503);
        expect((res.json() as Json).checks.jobs.ok).toBe(false);
      } finally {
        runner.running = false;
      }
    });
  });

  describe("scheduled jobs", () => {
    it("runs when it holds the leader lock and records the run", async () => {
      const before = runner.runs;
      expect(await runner.tick()).toBeDefined();
      expect(runner.runs).toBe(before + 1);
      expect(runner.lastRun?.at).toBeInstanceOf(Date);
    });

    it("stands down when another process holds the lock, so nothing runs twice", async () => {
      const other = new pg.Client({ connectionString: TEST_DATABASE_URL });
      await other.connect();
      try {
        await other.query("SELECT pg_advisory_lock($1)", [7_265_100_001]);
        const runs = runner.runs;
        const skipped = runner.skipped;
        expect(await runner.tick()).toBeUndefined();
        expect(runner.runs).toBe(runs);
        expect(runner.skipped).toBe(skipped + 1);
        await other.query("SELECT pg_advisory_unlock($1)", [7_265_100_001]);
        expect(await runner.tick()).toBeDefined();
      } finally {
        await other.end();
      }
    });
  });

  describe("alerts", () => {
    it("posts to the webhook, de-duplicates the same alert and never throws when the webhook is down", async () => {
      process.env.RAQIB_ALERT_WEBHOOK_URL = hookUrl;
      const t = 1_000_000;
      expect(await alerts.notify("Disk almost full", { free: "2%" }, t)).toBe(true);
      expect(await alerts.notify("Disk almost full", { free: "1%" }, t + 1_000)).toBe(false); // same alert, within five minutes
      expect(await alerts.notify("Disk almost full", {}, t + 6 * 60_000)).toBe(true);
      expect(received).toHaveLength(2);
      expect(received[0]).toMatchObject({ text: "[Raqib] Disk almost full", service: "raqib-backend", free: "2%" });

      process.env.RAQIB_ALERT_WEBHOOK_URL = "http://127.0.0.1:1/down";
      await expect(alerts.notify("Another problem", {}, t + 7 * 60_000)).resolves.toBe(false);
      delete process.env.RAQIB_ALERT_WEBHOOK_URL;
      expect(await alerts.notify("Nobody listening", {}, t + 8 * 60_000)).toBe(false);
    });
  });
});
