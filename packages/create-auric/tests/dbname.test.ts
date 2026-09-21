import { describe, expect, it } from "vitest";
import { defaultDatabaseName } from "../src/dbname.js";

describe("defaultDatabaseName", () => {
  it.each([
    ["testy", "testy"],
    ["my-app", "my_app"],
    ["acme.platform", "acme_platform"],
    ["under_score", "under_score"],
    ["9lives", "db_9lives"],
    ["--", "app"],
  ])("%s → %s", (name, db) => expect(defaultDatabaseName(name)).toBe(db));

  it("is never the shared `auric` default that collides with another AURIC database", () => {
    expect(defaultDatabaseName("auric")).toBe("auric"); // only if the developer literally names the project that
    expect(defaultDatabaseName("my-app")).not.toBe("auric");
  });
});
