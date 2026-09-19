import { describe, expect, it, vi } from "vitest";
import { ApiError, createHttpClient, createTokenStore, type KeyValueStorage } from "../src/index.js";

function memoryStorage(): KeyValueStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

function setup(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const tokens = createTokenStore({ refreshKey: "t.refresh", storage: memoryStorage() });
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return handler(String(url), init ?? {});
  });
  const onLogout = vi.fn();
  const onRefreshed = vi.fn();
  const client = createHttpClient({
    baseUrl: "/api",
    tokens,
    refreshPath: "/auth/refresh",
    onLogout,
    onRefreshed,
    fetch: fetchMock as unknown as typeof fetch,
  });
  return { client, tokens, calls, onLogout, onRefreshed };
}

const auth = (init: RequestInit) => (init.headers as Record<string, string>).Authorization;

describe("createHttpClient", () => {
  it("attaches the bearer token and serialises query + json body", async () => {
    const { client, tokens, calls } = setup(() => json(200, { ok: true }));
    tokens.set("acc", "ref");
    await client("/things", { method: "POST", query: { a: 1, b: undefined, c: ["x", "y"] }, body: { n: 1 } });
    expect(calls[0]!.url).toBe("/api/things?a=1&c=x&c=y");
    expect(auth(calls[0]!.init)).toBe("Bearer acc");
    expect(calls[0]!.init.body).toBe('{"n":1}');
  });

  it("skips the Authorization header for anonymous calls", async () => {
    const { client, tokens, calls } = setup(() => json(200, {}));
    tokens.set("acc", "ref");
    await client("/auth/login", { method: "POST", anonymous: true, body: {} });
    expect(auth(calls[0]!.init)).toBeUndefined();
  });

  it("returns undefined for 204 and empty bodies", async () => {
    const { client } = setup(() => json(204));
    await expect(client("/x")).resolves.toBeUndefined();
  });

  it("refreshes once on 401 and replays the request with the new token", async () => {
    const { client, tokens, calls, onRefreshed } = setup((url, init) => {
      if (url === "/api/auth/refresh") return json(200, { tokens: { accessToken: "acc2", refreshToken: "ref2" } });
      return auth(init) === "Bearer acc2" ? json(200, { ok: 1 }) : json(401, { error: { code: "auth.expired", message: "x" } });
    });
    tokens.set("acc", "ref");
    await expect(client("/things")).resolves.toEqual({ ok: 1 });
    expect(calls.map((c) => c.url)).toEqual(["/api/things", "/api/auth/refresh", "/api/things"]);
    expect(JSON.parse(calls[1]!.init.body as string)).toEqual({ refreshToken: "ref" });
    expect(tokens.getRefresh()).toBe("ref2");
    expect(onRefreshed).toHaveBeenCalledOnce();
  });

  it("shares ONE refresh between concurrent 401s (refresh tokens are single-use)", async () => {
    let refreshCalls = 0;
    const { client, tokens } = setup(async (url, init) => {
      if (url === "/api/auth/refresh") {
        refreshCalls++;
        await new Promise((r) => setTimeout(r, 10));
        return json(200, { tokens: { accessToken: "acc2", refreshToken: "ref2" } });
      }
      return auth(init) === "Bearer acc2" ? json(200, { ok: 1 }) : json(401, null);
    });
    tokens.set("acc", "ref");
    const results = await Promise.all([client("/a"), client("/b"), client("/c")]);
    expect(results).toEqual([{ ok: 1 }, { ok: 1 }, { ok: 1 }]);
    expect(refreshCalls).toBe(1);
  });

  it("clears the session and signals logout when refresh is rejected", async () => {
    const { client, tokens, onLogout } = setup((url) =>
      url === "/api/auth/refresh" ? json(401, {}) : json(401, { error: { code: "auth.expired", message: "Expired." } }),
    );
    tokens.set("acc", "ref");
    const err = await client("/things").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("auth.expired");
    expect(tokens.getAccess()).toBeNull();
    expect(tokens.getRefresh()).toBeNull();
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("treats a refresh network failure as a failed refresh", async () => {
    const { client, tokens, onLogout } = setup((url) => {
      if (url === "/api/auth/refresh") throw new TypeError("network down");
      return json(401, {});
    });
    tokens.set("acc", "ref");
    await expect(client("/things")).rejects.toBeInstanceOf(ApiError);
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("does not attempt a refresh when there is no refresh token", async () => {
    const { client, calls, onLogout } = setup(() => json(401, {}));
    await expect(client("/things")).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(1);
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("does not refresh anonymous 401s (e.g. bad login credentials)", async () => {
    const { client, tokens, calls, onLogout } = setup(() =>
      json(401, { error: { code: "identity.invalid_credentials", message: "nope" } }),
    );
    tokens.set("acc", "ref");
    await expect(client("/auth/login", { anonymous: true })).rejects.toMatchObject({ code: "identity.invalid_credentials" });
    expect(calls).toHaveLength(1);
    expect(onLogout).not.toHaveBeenCalled();
  });

  it("maps non-2xx to ApiError with the backend envelope's code, message and fields", async () => {
    const { client } = setup(() =>
      json(400, {
        error: {
          code: "request.invalid_body",
          message: "Invalid.",
          details: { fields: [{ path: "name", message: "Required" }] },
          correlationId: "c-1",
        },
      }),
    );
    const err = (await client("/x").catch((e: unknown) => e)) as ApiError;
    expect(err).toMatchObject({ status: 400, code: "request.invalid_body", message: "Invalid.", correlationId: "c-1" });
    expect(err.fields).toEqual([{ path: "name", message: "Required" }]);
    expect(err.isValidation).toBe(true);
  });

  it("falls back to a generic ApiError for a non-JSON error body", async () => {
    const { client } = setup(() => new Response("<html>bad gateway</html>", { status: 502 }));
    await expect(client("/x")).rejects.toMatchObject({ status: 502, code: "unknown", message: "Request failed (502)" });
  });

  it("withApiBase prefixes relative paths and leaves absolute URLs alone", () => {
    const { client } = setup(() => json(200));
    expect(client.withApiBase("/files/1")).toBe("/api/files/1");
    expect(client.withApiBase("https://cdn.example/x")).toBe("https://cdn.example/x");
  });

  it("keeps an absolute base absolute", async () => {
    const tokens = createTokenStore({ refreshKey: "k", storage: memoryStorage() });
    const fetchMock = vi.fn(async (_url: string | URL | Request) => json(200, {}));
    const client = createHttpClient({
      baseUrl: "https://api.example.com/api",
      tokens,
      refreshPath: "/auth/refresh",
      fetch: fetchMock as unknown as typeof fetch,
    });
    await client("/x");
    expect(String(fetchMock.mock.calls[0]![0])).toBe("https://api.example.com/api/x");
  });
});

describe("createTokenStore", () => {
  it("keeps the access token in memory and persists only the refresh token", () => {
    const storage = memoryStorage();
    const tokens = createTokenStore({ refreshKey: "k", storage });
    tokens.set("a", "r");
    expect(tokens.getAccess()).toBe("a");
    expect(storage.getItem("k")).toBe("r");
    expect(createTokenStore({ refreshKey: "k", storage }).getAccess()).toBeNull();
    tokens.clear();
    expect(storage.getItem("k")).toBeNull();
    expect(tokens.getAccess()).toBeNull();
  });

  it("survives unavailable storage", () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    const tokens = createTokenStore({ refreshKey: "k", storage: broken });
    tokens.set("a", "r");
    expect(tokens.getAccess()).toBe("a");
    expect(tokens.getRefresh()).toBe("r"); // still usable for this tab
    expect(() => tokens.clear()).not.toThrow();
    expect(tokens.getRefresh()).toBeNull();
  });

  it("decodes JWT claims and tolerates garbage", () => {
    const tokens = createTokenStore({ refreshKey: "k", storage: memoryStorage() });
    const payload = Buffer.from(JSON.stringify({ sub: "u1" })).toString("base64url");
    tokens.setAccess(`h.${payload}.s`);
    expect(tokens.getClaims<{ sub: string }>()).toEqual({ sub: "u1" });
    tokens.setAccess("not-a-jwt");
    expect(tokens.getClaims()).toBeNull();
  });
});

describe("ApiError", () => {
  it("accepts both the enveloped and the flat body shapes", () => {
    expect(new ApiError(404, { error: { code: "a.b", message: "m" } })).toMatchObject({ code: "a.b", message: "m", isNotFound: true });
    expect(new ApiError(403, { code: "c", message: "n" })).toMatchObject({ code: "c", message: "n", isForbidden: true });
    expect(new ApiError(500, null)).toMatchObject({ code: "unknown", message: "Request failed (500)" });
  });
});
