import { describe, expect, it } from "vitest";
import {
  AppError,
  Conflict,
  Forbidden,
  Internal,
  NotFound,
  Unauthenticated,
  ValidationError,
  httpStatusForError,
} from "../errors.js";

describe("error factories", () => {
  it("ValidationError carries code, kind and details", () => {
    const err = ValidationError("identity.bad_input", "nope", { fields: [{ path: "email" }] });
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.kind).toBe("validation");
    expect(err.code).toBe("identity.bad_input");
    expect(err.details).toEqual({ fields: [{ path: "email" }] });
  });

  it("Unauthenticated and Forbidden have sensible defaults", () => {
    expect(Unauthenticated().code).toBe("auth.unauthenticated");
    expect(Unauthenticated().kind).toBe("unauthenticated");
    expect(Forbidden().kind).toBe("forbidden");
  });

  it("Conflict and NotFound require an explicit code + message", () => {
    expect(Conflict("rbac.role_exists", "taken").kind).toBe("conflict");
    expect(NotFound("files.not_found", "gone").kind).toBe("not_found");
  });

  it("Internal keeps the cause for logs but not on a public field", () => {
    const cause = new Error("boom");
    const err = Internal("Something went wrong.", cause);
    expect(err.kind).toBe("internal");
    expect(err.cause).toBe(cause);
    expect(err.details).toBeUndefined();
  });
});

describe("httpStatusForError", () => {
  it("maps every error kind to its status code", () => {
    expect(httpStatusForError(ValidationError("c", "m"))).toBe(400);
    expect(httpStatusForError(Unauthenticated())).toBe(401);
    expect(httpStatusForError(Forbidden())).toBe(403);
    expect(httpStatusForError(NotFound("c", "m"))).toBe(404);
    expect(httpStatusForError(Conflict("c", "m"))).toBe(409);
    expect(httpStatusForError(Internal())).toBe(500);
  });

  it("treats any non-AppError as 500", () => {
    expect(httpStatusForError(new Error("plain"))).toBe(500);
    expect(httpStatusForError("a string")).toBe(500);
    expect(httpStatusForError(undefined)).toBe(500);
  });
});
