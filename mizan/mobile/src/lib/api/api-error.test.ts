import { ApiError, isApiError } from "./api-error";

describe("ApiError", () => {
  it("maps a structured AppError body", () => {
    const err = new ApiError(400, {
      code: "validation_failed",
      message: "Bad input",
      details: { fields: [{ path: "email", message: "required" }] },
    });
    expect(err.status).toBe(400);
    expect(err.code).toBe("validation_failed");
    expect(err.message).toBe("Bad input");
    expect(err.fields).toEqual([{ path: "email", message: "required" }]);
    expect(err.name).toBe("ApiError");
    expect(err).toBeInstanceOf(Error);
  });

  it("falls back sanely on an empty / non-JSON body", () => {
    const err = new ApiError(500, null);
    expect(err.code).toBe("unknown");
    expect(err.message).toBe("Request failed (500)");
    expect(err.fields).toEqual([]);
  });

  it("classifies status codes", () => {
    expect(new ApiError(401, null).isUnauthorized).toBe(true);
    expect(new ApiError(403, null).isForbidden).toBe(true);
    expect(new ApiError(404, null).isNotFound).toBe(true);
    expect(new ApiError(400, null).isValidation).toBe(true);
    expect(new ApiError(409, null).isValidation).toBe(true);
    expect(new ApiError(500, null).isValidation).toBe(false);
  });

  it("isApiError is a working type guard", () => {
    expect(isApiError(new ApiError(400, null))).toBe(true);
    expect(isApiError(new Error("nope"))).toBe(false);
    expect(isApiError("nope")).toBe(false);
  });
});
