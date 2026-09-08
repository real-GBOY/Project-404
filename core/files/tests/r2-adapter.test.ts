import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { R2Adapter } from "@core/files/infrastructure/r2-adapter.js";

/**
 * R2Adapter talks to Cloudflare over `fetch`; here `fetch` is stubbed so no
 * request ever leaves the process. We assert the adapter builds SigV4-shaped
 * requests against the right endpoint — not Cloudflare's behaviour.
 */
const CONFIG = {
  accountId: "acc123",
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  bucket: "mizan-files",
};
const KEY = "org_1/2026/09/file_abc";
const HOST = "acc123.r2.cloudflarestorage.com";

let calls: Array<{ url: string; method: string; headers: Headers; body: unknown }>;

function stubFetch(response: () => Response) {
  return vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const req = new Request(input, init);
    calls.push({
      url: req.url,
      method: req.method,
      headers: req.headers,
      body: init?.body ?? null,
    });
    return Promise.resolve(response());
  });
}

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("R2Adapter.presignPut", () => {
  it("returns a SigV4 query-signed PUT URL for the right object", async () => {
    const adapter = new R2Adapter(CONFIG);
    const { url, method, headers, expiresAt } = await adapter.presignPut(KEY, {
      contentType: "application/pdf",
      expiresIn: 900,
    });

    expect(method).toBe("PUT");
    expect(headers).toEqual({});
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const parsed = new URL(url);
    expect(parsed.host).toBe(HOST);
    expect(parsed.pathname).toBe(`/${CONFIG.bucket}/${KEY}`);
    for (const p of [
      "X-Amz-Algorithm",
      "X-Amz-Credential",
      "X-Amz-Date",
      "X-Amz-Expires",
      "X-Amz-SignedHeaders",
      "X-Amz-Signature",
    ]) {
      expect(parsed.searchParams.get(p), p).toBeTruthy();
    }
    expect(parsed.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(parsed.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(parsed.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(parsed.searchParams.get("X-Amz-Credential")).toContain("/auto/s3/aws4_request");
    // no Authorization header ever leaves for a presigned URL
    expect(url).not.toMatch(/authorization/i);
  });
});

describe("R2Adapter signed server-side requests", () => {
  it("HEAD is SigV4-header-signed and parses size + unquoted etag", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch(
        () =>
          new Response(null, {
            status: 200,
            headers: { "content-length": "2048", etag: '"d41d8cd98f00b204e9800998ecf8427e"' },
          }),
      ),
    );
    const adapter = new R2Adapter(CONFIG);
    const head = await adapter.head(KEY);

    expect(head).toEqual({ size: 2048, etag: "d41d8cd98f00b204e9800998ecf8427e" });
    const call = calls[0];
    expect(call.method).toBe("HEAD");
    expect(new URL(call.url).host).toBe(HOST);
    const auth = call.headers.get("authorization") ?? "";
    expect(auth).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
    expect(call.headers.get("x-amz-date")).toMatch(/^\d{8}T\d{6}Z$/);
    expect(call.headers.get("x-amz-content-sha256")).toBeTruthy();
  });

  it("HEAD returns null on 404", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch(() => new Response(null, { status: 404 })),
    );
    const adapter = new R2Adapter(CONFIG);
    expect(await adapter.head(KEY)).toBeNull();
  });

  it("GET signs the request and returns the body bytes", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch(() => new Response(Buffer.from("hello r2"), { status: 200 })),
    );
    const adapter = new R2Adapter(CONFIG);
    const buf = await adapter.get(KEY);

    expect(buf.toString()).toBe("hello r2");
    expect(calls[0].method).toBe("GET");
    expect(calls[0].headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=/);
  });

  it("DELETE signs the request and tolerates a 404", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch(() => new Response(null, { status: 404 })),
    );
    const adapter = new R2Adapter(CONFIG);
    await expect(adapter.remove(KEY)).resolves.toBeUndefined();
    expect(calls[0].method).toBe("DELETE");
    expect(calls[0].headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 /);
  });

  it("PUT signs over the payload hash of the body", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch(() => new Response(null, { status: 200 })),
    );
    const adapter = new R2Adapter(CONFIG);
    await adapter.put(KEY, Buffer.from("some bytes"));

    expect(calls[0].method).toBe("PUT");
    // real SHA-256 of "some bytes", not the empty-string hash
    expect(calls[0].headers.get("x-amz-content-sha256")).toBe(
      "0d22cdcc10e6d049dbe1af5123d50873fdfc1a4f58306e58cb6241be9472014d",
    );
  });

  it("uses publicBaseUrl for public downloads when configured", async () => {
    const adapter = new R2Adapter({ ...CONFIG, publicBaseUrl: "https://files.example.com" });
    expect(await adapter.url(KEY)).toBe(`https://files.example.com/${KEY}`);
  });

  it("falls back to a presigned GET URL when there is no public base", async () => {
    const adapter = new R2Adapter(CONFIG);
    const url = await adapter.url(KEY);
    const parsed = new URL(url);
    expect(parsed.host).toBe(HOST);
    expect(parsed.searchParams.get("X-Amz-Signature")).toBeTruthy();
  });
});
