/**
 * `configureAuricHttp` / `createAuricApp` — the HTTP conventions every AURIC app shares.
 * No database: a throwaway module with two routes stands in for a product.
 */
import "reflect-metadata";
import { Body, Controller, Get, Module, Post } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterEach, describe, expect, it } from "vitest";
import { createAuricApp } from "@core/http/bootstrap.js";

@Controller("ping")
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
  @Post("raw")
  raw(@Body() body: Buffer) {
    return { bytes: Buffer.isBuffer(body) ? body.length : -1 };
  }
}

@Module({ controllers: [PingController] })
class TinyModule {}

type Cfg = Parameters<typeof createAuricApp>[1];
const cfg = (over: Partial<Cfg> = {}): Cfg => ({
  corsOrigins: [],
  nodeEnv: "production",
  fileMaxUploadBytes: 1024,
  ...over,
});

let app: NestFastifyApplication | undefined;
const boot = async (over: Partial<Cfg> = {}) => {
  app = await createAuricApp(TinyModule, cfg(over));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
};
afterEach(async () => {
  await app?.close();
  app = undefined;
});

const get = (a: NestFastifyApplication, origin?: string) =>
  a.inject({ method: "GET", url: "/api/ping", headers: origin ? { origin } : {} });

describe("configureAuricHttp — routing", () => {
  it("mounts every route under the /api prefix", async () => {
    const a = await boot();
    expect((await get(a)).statusCode).toBe(200);
    expect((await a.inject({ method: "GET", url: "/ping" })).statusCode).toBe(404);
  });
});

describe("configureAuricHttp — raw octet-stream uploads", () => {
  const put = (a: NestFastifyApplication, size: number) =>
    a.inject({
      method: "POST",
      url: "/api/ping/raw",
      headers: { "content-type": "application/octet-stream" },
      payload: Buffer.alloc(size, 1),
    });

  it("parses the body as a Buffer", async () => {
    const a = await boot();
    const res = await put(a, 500);
    expect(res.json()).toEqual({ bytes: 500 });
  });

  it("caps octet-stream at fileMaxUploadBytes (not the 1 MiB global default)", async () => {
    const a = await boot({ fileMaxUploadBytes: 2 * 1_048_576 });
    expect((await put(a, 1_500_000)).statusCode).toBe(201); // > 1 MiB global, < configured cap
    expect((await put(a, 2 * 1_048_576 + 1)).statusCode).toBe(413);
  });
});

describe("configureAuricHttp — CORS", () => {
  it("production with no configured origins: CORS is off entirely", async () => {
    const a = await boot();
    const res = await get(a, "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows exactly the configured origins", async () => {
    const a = await boot({ corsOrigins: ["https://app.example.com"] });
    expect((await get(a, "https://app.example.com")).headers["access-control-allow-origin"]).toBe("https://app.example.com");
    expect((await get(a, "https://other.example.com")).headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("a '*.host' entry matches subdomains (preview deployments), not unrelated hosts", async () => {
    const a = await boot({ corsOrigins: ["*.vercel.app"] });
    expect((await get(a, "https://x-abc.vercel.app")).headers["access-control-allow-origin"]).toBe("https://x-abc.vercel.app");
    expect((await get(a, "https://vercel.app.evil.com")).headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("loopback / LAN origins are allowed whenever CORS is on (dev, or production with configured origins)", async () => {
    // Pinned as-is: this is the pre-extraction behaviour of both entrypoints, not a new rule.
    const dev = await boot({ nodeEnv: "development" });
    expect((await get(dev, "http://localhost:5173")).headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect((await get(dev, "http://192.168.1.20:8081")).headers["access-control-allow-origin"]).toBe("http://192.168.1.20:8081");
    expect((await get(dev, "http://8.8.8.8:80")).headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("requests without an Origin (curl, native apps) are never blocked", async () => {
    const a = await boot({ corsOrigins: ["https://app.example.com"] });
    expect((await get(a)).statusCode).toBe(200);
  });
});
