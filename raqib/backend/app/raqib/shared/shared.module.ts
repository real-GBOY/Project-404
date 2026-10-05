import { Module } from "@nestjs/common";
import { Counters } from "./counters.js";

/** Cross-feature infrastructure every Raqib module may use (reference counters). */
@Module({ providers: [Counters], exports: [Counters] })
export class SharedModule {}
