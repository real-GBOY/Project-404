/** @format */

import {
	Body,
	Controller,
	Get,
	Headers,
	HttpCode,
	Post,
	UseGuards,
} from "@nestjs/common";
import type { z } from "zod";
import { CurrentUser } from "../../http/decorators.js";
import { JwtAuthGuard } from "../../http/jwt-auth.guard.js";
import { ZodBody } from "../../http/zod.pipe.js";
import type { Principal } from "../../http/principal.js";
import { USER_PROVIDER } from "../../kernel/tokens.js";
import { Inject } from "@nestjs/common";
import type { IUserProvider } from "../../contracts/index.js";
import { IdentityService } from "../application/identity-service.js";
import {
	loginSchema,
	refreshSchema,
	registerSchema,
	requestEmailVerificationSchema,
	requestPasswordResetSchema,
	resetPasswordSchema,
	verifyEmailSchema,
} from "../validation/schemas.js";

@Controller("auth")
export class AuthController {
	constructor(private readonly service: IdentityService) {}

	@Post("register")
	@HttpCode(201)
	async register(
		@Body(ZodBody(registerSchema)) input: z.infer<typeof registerSchema>,
	) {
		return { user: await this.service.register(input) };
	}

	@Post("login")
	async login(
		@Body(ZodBody(loginSchema)) input: z.infer<typeof loginSchema>,
		@Headers("user-agent") userAgent?: string,
	) {
		return this.service.login({
			...input,
			...(userAgent ? { userAgent } : {}),
		});
	}

	@Post("refresh")
	async refresh(
		@Body(ZodBody(refreshSchema)) body: z.infer<typeof refreshSchema>,
	) {
		return {
			tokens: await this.service.refresh(
				body.refreshToken,
				body.organizationId,
			),
		};
	}

	@Post("logout")
	@HttpCode(204)
	async logout(
		@Body(ZodBody(refreshSchema)) body: z.infer<typeof refreshSchema>,
	) {
		await this.service.logout(body.refreshToken);
	}

	@Post("logout-all")
	@HttpCode(204)
	@UseGuards(JwtAuthGuard)
	async logoutAll(@CurrentUser() user: Principal) {
		await this.service.logoutAll(user.userId);
	}

	@Post("password/forgot")
	@HttpCode(202)
	async forgotPassword(
		@Body(ZodBody(requestPasswordResetSchema))
		body: z.infer<typeof requestPasswordResetSchema>,
	) {
		await this.service.requestPasswordReset(body.email);
		return {
			message: "If that email is registered, a reset link is on its way.",
		};
	}

	@Post("password/reset")
	@HttpCode(204)
	async resetPassword(
		@Body(ZodBody(resetPasswordSchema))
		body: z.infer<typeof resetPasswordSchema>,
	) {
		await this.service.resetPassword(body.token, body.password);
	}

	@Post("email/verify")
	@HttpCode(204)
	async verifyEmail(
		@Body(ZodBody(verifyEmailSchema)) body: z.infer<typeof verifyEmailSchema>,
	) {
		await this.service.verifyEmail(body.token);
	}

	@Post("email/resend")
	@HttpCode(202)
	async resendVerification(
		@Body(ZodBody(requestEmailVerificationSchema))
		body: z.infer<typeof requestEmailVerificationSchema>,
	) {
		await this.service.requestEmailVerification(body.email);
		return {
			message: "If that account needs verification, a new link is on its way.",
		};
	}
}

@Controller("me")
@UseGuards(JwtAuthGuard)
export class MeController {
	constructor(@Inject(USER_PROVIDER) private readonly users: IUserProvider) {}

	@Get()
	async me(@CurrentUser() principal: Principal) {
		return {
			user: await this.users.getUser(principal.userId),
			organizationId: principal.organizationId,
			permissions: principal.permissions,
		};
	}
}
