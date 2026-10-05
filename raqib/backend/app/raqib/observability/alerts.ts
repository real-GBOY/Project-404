import { Injectable } from "@nestjs/common";
import { AppError } from "@core/kernel/errors.js";
import { getContext } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { loggingErrorTracker, type ErrorTracker } from "@core/observability/errors/error-tracker.js";
import { readRaqibConfig } from "@raqib/config.js";

const log = moduleLogger("raqib-alerts");
const DEDUPE_MS = 5 * 60_000;
const MAX_PER_HOUR = 30;

/**
 * Sends operational alerts (unexpected server errors, a stuck or failing job) as a JSON POST to
 * `RAQIB_ALERT_WEBHOOK_URL` — a Slack/Teams/PagerDuty-style incoming webhook (`{ text, ... }`). The same alert is sent at
 * most once per five minutes and at most 30 an hour in total, so a failing dependency cannot flood the channel. It never
 * throws: alerting must not make an outage worse. With no URL configured it only logs.
 */
@Injectable()
export class AlertService {
  private readonly recent = new Map<string, number>();
  private hour = { start: 0, sent: 0 };

  async notify(title: string, detail: Record<string, unknown> = {}, now = Date.now()): Promise<boolean> {
    const url = readRaqibConfig().alertWebhookUrl;
    log.warn({ title, ...detail }, "alert");
    if (!url) return false;
    const last = this.recent.get(title);
    if (last !== undefined && now - last < DEDUPE_MS) return false;
    if (now - this.hour.start > 3_600_000) this.hour = { start: now, sent: 0 };
    if (this.hour.sent >= MAX_PER_HOUR) return false;
    this.recent.set(title, now);
    this.hour.sent += 1;
    if (this.recent.size > 200) for (const [k, t] of this.recent) if (now - t > DEDUPE_MS) this.recent.delete(k);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `[Raqib] ${title}`, title, service: "raqib-backend", at: new Date(now).toISOString(), ...detail }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) log.error({ status: res.status }, "alert webhook answered with an error");
      return res.ok;
    } catch (err) {
      log.error({ err }, "alert webhook unreachable");
      return false;
    }
  }
}

/** Core's logging tracker plus an alert for the failures worth waking someone for (anything that is not a typed, expected AppError). */
@Injectable()
export class AlertingErrorTracker implements ErrorTracker {
  constructor(private readonly alerts: AlertService) {}

  capture(error: unknown, context?: Record<string, unknown>): void {
    loggingErrorTracker.capture(error, context);
    if (error instanceof AppError && error.kind !== "internal") return;
    const message = error instanceof Error ? error.message : String(error);
    void this.alerts.notify(`Server error: ${message.slice(0, 120)}`, { correlationId: getContext()?.correlationId, ...context });
  }
}
