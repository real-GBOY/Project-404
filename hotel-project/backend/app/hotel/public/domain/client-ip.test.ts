import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip.js";

describe("clientIp", () => {
  it("uses the socket address when no proxy is trusted", () => {
    expect(clientIp("10.0.0.1", "1.2.3.4", 0)).toBe("10.0.0.1");
  });

  it("takes the entry our own proxy appended, not whatever the client claimed", () => {
    // The client sent "X-Forwarded-For: 6.6.6.6"; nginx appended the real address.
    expect(clientIp("127.0.0.1", "6.6.6.6, 203.0.113.9", 1)).toBe("203.0.113.9");
    expect(clientIp("127.0.0.1", ["6.6.6.6", "203.0.113.9, 10.0.0.2"], 2)).toBe("203.0.113.9");
  });

  it("falls back to the socket when the header is missing or too short", () => {
    expect(clientIp("127.0.0.1", undefined, 1)).toBe("127.0.0.1");
    expect(clientIp("127.0.0.1", "203.0.113.9", 2)).toBe("127.0.0.1");
  });
});
