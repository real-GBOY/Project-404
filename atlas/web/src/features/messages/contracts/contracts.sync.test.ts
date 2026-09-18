import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The realtime + REST wire contract is authored on the server and COPIED here
 * (the web app is a separate package and cannot import backend source). Same
 * guard as `colors.sync.test.ts`: if either side is edited without the other,
 * this fails — so the client can never silently drift from what the server sends.
 *
 * To update after a server change:  copy the file over, then re-run the tests.
 */
const repo = path.resolve(__dirname, "../../../../../..");
const PAIRS: Array<[string, string]> = [
  ["messaging-types.ts", "core/messaging/contracts/messaging-types.ts"],
  ["realtime-events.ts", "core/messaging/contracts/realtime-events.ts"],
  ["insights-types.ts", "atlas/backend/app/realestate/conversation-intelligence/contracts/insights-types.ts"],
];

describe("messaging contracts stay in sync with the backend", () => {
  for (const [local, remote] of PAIRS) {
    it(`${local} is identical to ${remote}`, () => {
      const here = readFileSync(path.join(__dirname, local), "utf8");
      const there = readFileSync(path.join(repo, remote), "utf8");
      expect(here.replace(/\r\n/g, "\n")).toBe(there.replace(/\r\n/g, "\n"));
    });
  }
});
