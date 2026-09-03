import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

/**
 * Mounts interactive API docs at `/api/docs` (JSON at `/api/docs-json`).
 *
 * Route + method coverage is automatic from the Nest metadata. Request/response
 * *schemas* are not generated here: validation is Zod pipes, not
 * class-validator DTOs, so there are no decorated classes to reflect. Adding
 * `@ApiOperation` / `@ApiResponse` per handler (or generating from the Zod
 * schemas) is a follow-up — the endpoint catalogue + bearer auth are the
 * immediate value.
 */
export function setupOpenApi(
  app: INestApplication,
  opts: { title: string; version: string; description: string },
): void {
  const config = new DocumentBuilder()
    .setTitle(opts.title)
    .setVersion(opts.version)
    .setDescription(opts.description)
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "access-token")
    .addTag("identity", "register · login · refresh · verify email · reset password")
    .addTag("rbac", "roles, permissions, assignments")
    .addTag("organizations", "orgs, members, settings — the tenant")
    .addTag("files", "upload / download / metadata")
    .addTag("notifications", "in-app inbox")
    .addTag("audit", "the append-only trail")
    .addTag("health", "liveness + readiness (outbox backlog)")
    .addTag("lawfirm", "Mizan domain — matters, hearings, tasks, documents, billing, …")
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: false,
  });

  SwaggerModule.setup("api/docs", app, document, {
    customSiteTitle: `${opts.title} API`,
    swaggerOptions: { persistAuthorization: true, tagsSorter: "alpha", operationsSorter: "alpha" },
  });
}
