// PUBLIC: the only unauthenticated controller in Raqib. It can read the form's options and create a PENDING request;
// it is rate limited (rate-limit.ts, "account-request"), validated, and reachable only under /raqib/public/.
import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ZodBody } from "@core/http/zod.pipe.js";
import { OnboardingService } from "../application/onboarding-service.js";

const schema = z
  .object({
    name: z.string().trim().min(3).max(120),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().min(7).max(20),
    nationalId: z
      .string()
      .trim()
      .regex(/^[0-9]{10}$/),
    employeeNo: z.string().trim().max(40).default(""),
    department: z.string().trim().max(120).default(""),
    role: z.enum(["qe", "pm", "ins", "gs", "guard"]),
    projects: z.string().trim().max(500).default(""),
    justification: z.string().trim().min(10).max(2000),
    signature: z.string().trim().min(3).max(120),
    agree: z.boolean(),
  })
  .strict();

@ApiTags("raqib · public onboarding")
@Controller("raqib/public/onboarding")
export class PublicOnboardingController {
  constructor(private readonly service: OnboardingService) {}

  @Get(":org")
  info(@Param("org") org: string) {
    return this.service.publicInfo(org.slice(0, 80));
  }

  @Post(":org/requests")
  @HttpCode(201)
  submit(@Param("org") org: string, @Body(ZodBody(schema)) b: z.infer<typeof schema>) {
    return this.service.submitPublic(org.slice(0, 80), b);
  }
}
