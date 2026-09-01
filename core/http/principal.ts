import type { FastifyRequest } from "fastify";

/**
 * The authenticated caller, attached to the request by `JwtAuthGuard` and read
 * by controllers via the `@CurrentUser()` param decorator.
 */
export interface Principal {
  userId: string;
  email: string;
  /** The active tenant (§ docs/tenancy.md), or null for an orgless token. */
  organizationId: string | null;
  /** Permission keys ("action:resource") baked into the token, scoped to `organizationId`. */
  permissions: string[];
}

declare module "fastify" {
  interface FastifyRequest {
    principal?: Principal;
    locale?: string;
  }
}

export type RequestWithPrincipal = FastifyRequest & { principal?: Principal };
