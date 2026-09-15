import { describe, expect, it } from "vitest";
import { matchCannedTopic } from "@atlas/realestate/assistant/assistant.domain.js";

describe("realestate/assistant assistant.domain", () => {
  it("matches each keyword group to its topic", () => {
    expect(matchCannedTopic("Which projects have the highest sales velocity?")).toBe("velocity");
    expect(matchCannedTopic("How much revenue is outstanding?")).toBe("outstanding");
    expect(matchCannedTopic("How much is currently outstanding?")).toBe("outstanding");
    expect(matchCannedTopic("Which agents are underperforming?")).toBe("underperforming");
    expect(matchCannedTopic("Show me the units most likely to sell")).toBe("likely");
    expect(matchCannedTopic("Summarise this customer's history")).toBe("summar");
  });

  it("falls back to velocity when nothing matches", () => {
    expect(matchCannedTopic("what's the weather today")).toBe("velocity");
  });
});
