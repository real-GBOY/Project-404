import { defineEvent } from "@core/contracts/domain-event.js";

/** A high-severity finding was recorded: the people configured in settings.escalation.highSeverity hear at once. */
export const observationHigh = (p: { observationId: string }) => defineEvent("raqib.observation_high", 1, p);
