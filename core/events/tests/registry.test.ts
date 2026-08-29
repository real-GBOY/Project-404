import { describe, expect, it, vi } from "vitest";
import { EventRegistry } from "../registry.js";

const noop = async () => {};

describe("EventRegistry — in-process handlers", () => {
  it("accumulates multiple handlers for one event, in order", () => {
    const reg = new EventRegistry();
    const a = vi.fn(noop);
    const b = vi.fn(noop);
    reg.onInProcess("user.registered", a);
    reg.onInProcess("user.registered", b);
    expect(reg.inProcessHandlers("user.registered")).toEqual([a, b]);
  });

  it("returns an empty list for an unknown event", () => {
    expect(new EventRegistry().inProcessHandlers("nope")).toEqual([]);
  });
});

describe("EventRegistry — external handlers", () => {
  it("registers named external handlers", () => {
    const reg = new EventRegistry();
    reg.onExternal("user.email_verification_requested", "notifications.send_email", noop);
    expect(reg.hasExternal("user.email_verification_requested")).toBe(true);
    expect(reg.externalHandlers("user.email_verification_requested")).toHaveLength(1);
    expect(reg.externalHandlers("user.email_verification_requested")[0]!.handlerName).toBe(
      "notifications.send_email",
    );
  });

  it("rejects a duplicate handler name for the same event", () => {
    const reg = new EventRegistry();
    reg.onExternal("evt", "handler.one", noop);
    expect(() => reg.onExternal("evt", "handler.one", noop)).toThrow(/already registered/);
  });

  it("allows the same handler name on a different event", () => {
    const reg = new EventRegistry();
    reg.onExternal("evt.a", "shared.name", noop);
    expect(() => reg.onExternal("evt.b", "shared.name", noop)).not.toThrow();
  });

  it("hasExternal is false when nothing is registered", () => {
    expect(new EventRegistry().hasExternal("evt")).toBe(false);
  });
});

describe("EventRegistry.clear", () => {
  it("drops every subscription", () => {
    const reg = new EventRegistry();
    reg.onInProcess("a", noop);
    reg.onExternal("b", "h", noop);
    reg.clear();
    expect(reg.inProcessHandlers("a")).toEqual([]);
    expect(reg.hasExternal("b")).toBe(false);
  });
});
