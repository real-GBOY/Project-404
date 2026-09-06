import { ApiError } from "./api-error";

// The module under test imports these; mock them so we can drive auth state.
jest.mock("@/lib/auth/token-store", () => ({
  tokenStore: {
    getAccess: jest.fn<string | null, []>(() => null),
    getRefresh: jest.fn<Promise<string | null>, []>(async () => null),
    set: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  },
}));
jest.mock("@/lib/auth/auth-events", () => ({
  authEvents: { emit: jest.fn(), on: jest.fn() },
}));

import { httpClient } from "./http-client";
import { tokenStore } from "@/lib/auth/token-store";
import { authEvents } from "@/lib/auth/auth-events";

const mockTokens = tokenStore as jest.Mocked<typeof tokenStore>;
const mockEvents = authEvents as jest.Mocked<typeof authEvents>;

type Body = Record<string, unknown> | undefined;
function resp(status: number, body: Body = { ok: true }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockTokens.getAccess.mockReturnValue(null);
  mockTokens.getRefresh.mockResolvedValue(null);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe("httpClient — request shaping", () => {
  it("attaches a Bearer token and returns parsed JSON", async () => {
    mockTokens.getAccess.mockReturnValue("access-1");
    fetchMock.mockResolvedValueOnce(resp(200, { hello: "world" }));

    const out = await httpClient<{ hello: string }>("/things", { query: { page: 2 } });

    expect(out).toEqual({ hello: "world" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/api/things?page=2");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer access-1");
  });

  it("omits the Authorization header for anonymous calls", async () => {
    mockTokens.getAccess.mockReturnValue("access-1");
    fetchMock.mockResolvedValueOnce(resp(201, { id: "u1" }));

    await httpClient("/auth/login", { method: "POST", body: { email: "a@b.c" }, anonymous: true });

    const init = fetchMock.mock.calls[0][1];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("serialises a JSON body and sets content-type", async () => {
    fetchMock.mockResolvedValueOnce(resp(200));
    await httpClient("/things", { method: "POST", body: { a: 1 } });

    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("sends no content-type on a bodyless POST (Fastify 400s otherwise)", async () => {
    fetchMock.mockResolvedValueOnce(resp(200));
    await httpClient("/things/ping", { method: "POST" });

    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>)["content-type"]).toBeUndefined();
  });
});

describe("httpClient — responses", () => {
  it("throws a typed ApiError on a non-2xx response", async () => {
    fetchMock.mockResolvedValue(resp(404, { code: "not_found", message: "nope" }));

    const err = await httpClient("/missing").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, code: "not_found" });
  });

  it("resolves 204 to undefined without parsing a body", async () => {
    fetchMock.mockResolvedValueOnce(resp(204, undefined));
    await expect(httpClient("/things/1", { method: "DELETE" })).resolves.toBeUndefined();
  });
});

describe("httpClient — 401 refresh flow", () => {
  it("refreshes once on 401, then retries the original request and succeeds", async () => {
    mockTokens.getAccess.mockReturnValue("stale");
    mockTokens.getRefresh.mockResolvedValue("refresh-1");
    fetchMock
      .mockResolvedValueOnce(resp(401, { code: "token_expired" })) // original
      .mockResolvedValueOnce(resp(200, { tokens: { accessToken: "new-a", refreshToken: "new-r" } })) // /auth/refresh
      .mockResolvedValueOnce(resp(200, { data: 42 })); // retry

    const out = await httpClient<{ data: number }>("/protected");

    expect(out).toEqual({ data: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.test/api/auth/refresh");
    expect(mockTokens.set).toHaveBeenCalledWith("new-a", "new-r");
    expect(mockEvents.emit).toHaveBeenCalledWith("tokens-refreshed");
  });

  it("clears tokens, emits logout, and throws when the refresh fails", async () => {
    mockTokens.getRefresh.mockResolvedValue("refresh-1");
    fetchMock
      .mockResolvedValueOnce(resp(401, { code: "token_expired" })) // original
      .mockResolvedValueOnce(resp(401, { code: "token_expired" })); // /auth/refresh rejects

    await expect(httpClient("/protected")).rejects.toMatchObject({ status: 401 });
    expect(mockTokens.clear).toHaveBeenCalled();
    expect(mockEvents.emit).toHaveBeenCalledWith("logout");
  });

  it("single-flights the refresh: concurrent 401s trigger exactly one /auth/refresh", async () => {
    mockTokens.getRefresh.mockResolvedValue("refresh-1");
    let refreshCalls = 0;
    let firstHits = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/auth/refresh")) {
        refreshCalls += 1;
        return resp(200, { tokens: { accessToken: "new-a", refreshToken: "new-r" } });
      }
      firstHits += 1;
      return firstHits <= 2 ? resp(401, { code: "token_expired" }) : resp(200, { ok: firstHits });
    });

    const [a, b] = await Promise.all([httpClient("/a"), httpClient("/b")]);

    expect(refreshCalls).toBe(1);
    expect(a).toEqual({ ok: 3 });
    expect(b).toEqual({ ok: 4 });
    expect(mockTokens.set).toHaveBeenCalledTimes(1);
  });
});
