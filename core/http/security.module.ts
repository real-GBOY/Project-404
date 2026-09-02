import { Global, Module } from "@nestjs/common";
import { IdentityModule } from "@core/identity/identity.module.js";
import { RbacModule } from "@core/rbac/rbac.module.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { PermissionGuard } from "./permission.guard.js";

/**
 * Makes the auth + permission guards — and the identity/RBAC contracts they
 * need — resolvable in every module's controllers without each importing
 * Identity/Rbac. `@UseGuards(JwtAuthGuard, PermissionGuard)` then works
 * anywhere, and `USER_PROVIDER` / `PERMISSION_PROVIDER` / `JWT_SERVICE` are
 * globally injectable (they are cross-cutting infrastructure, like the kernel).
 */
@Global()
@Module({
  imports: [IdentityModule, RbacModule],
  providers: [JwtAuthGuard, PermissionGuard],
  exports: [JwtAuthGuard, PermissionGuard, IdentityModule, RbacModule],
})
export class SecurityModule {}
