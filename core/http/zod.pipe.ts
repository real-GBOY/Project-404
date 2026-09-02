import { type PipeTransform } from "@nestjs/common";
import type { ZodTypeAny, infer as ZodInfer } from "zod";
import { ValidationError } from "@core/kernel/errors.js";

/**
 * Validates a request part against a Zod schema (§3.4: controllers validate,
 * then call a use case). Kept Zod — the schemas already exist and are the
 * source of truth; no class-validator DTOs. A failure throws the Core's
 * `ValidationError`, which `AppExceptionFilter` maps to 400.
 *
 *   @Body(new ZodBody(loginSchema)) input: LoginInput
 */
class ZodPipe<S extends ZodTypeAny> implements PipeTransform {
  constructor(
    private readonly schema: S,
    private readonly code: string,
    private readonly label: string,
  ) {}

  transform(value: unknown): ZodInfer<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw ValidationError(this.code, `The request ${this.label} is invalid.`, {
        fields: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    return result.data;
  }
}

export const ZodBody = <S extends ZodTypeAny>(schema: S) =>
  new ZodPipe(schema, "request.invalid_body", "body");
export const ZodQuery = <S extends ZodTypeAny>(schema: S) =>
  new ZodPipe(schema, "request.invalid_query", "query parameters");
export const ZodParams = <S extends ZodTypeAny>(schema: S) =>
  new ZodPipe(schema, "request.invalid_params", "path parameters");
