/**
 * A tiny in-process metrics registry that renders the Prometheus text format — enough for request volume and latency
 * plus the gauges the operator actually alerts on (jobs, outbox, PDF queue), without a client library. Labels are kept
 * to a handful of fixed values on purpose (method, status class): no paths, no user ids, so cardinality cannot grow.
 */
const BUCKETS_SECONDS = [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export interface Gauge {
  name: string;
  help: string;
  value: number;
  labels?: Record<string, string>;
}

const esc = (v: string): string => v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
const fmtLabels = (l?: Record<string, string>): string => {
  const e = l ? Object.entries(l) : [];
  return e.length ? `{${e.map(([k, v]) => `${k}="${esc(v)}"`).join(",")}}` : "";
};

export class Metrics {
  private readonly requests = new Map<string, number>();
  private readonly buckets = new Array<number>(BUCKETS_SECONDS.length + 1).fill(0);
  private durationSum = 0;
  private durationCount = 0;
  readonly startedAt = Date.now();

  observeRequest(method: string, status: number, seconds: number): void {
    const key = `${method}|${Math.floor(status / 100)}xx`;
    this.requests.set(key, (this.requests.get(key) ?? 0) + 1);
    const i = BUCKETS_SECONDS.findIndex((b) => seconds <= b);
    this.buckets[i === -1 ? BUCKETS_SECONDS.length : i]! += 1;
    this.durationSum += seconds;
    this.durationCount += 1;
  }

  render(gauges: Gauge[]): string {
    const out: string[] = [];
    out.push("# HELP raqib_http_requests_total HTTP requests handled, by method and status class.", "# TYPE raqib_http_requests_total counter");
    for (const [k, n] of [...this.requests].sort()) {
      const [method, cls] = k.split("|");
      out.push(`raqib_http_requests_total${fmtLabels({ method: method!, status: cls! })} ${n}`);
    }
    out.push("# HELP raqib_http_request_duration_seconds HTTP request latency.", "# TYPE raqib_http_request_duration_seconds histogram");
    let cumulative = 0;
    BUCKETS_SECONDS.forEach((b, i) => {
      cumulative += this.buckets[i]!;
      out.push(`raqib_http_request_duration_seconds_bucket{le="${b}"} ${cumulative}`);
    });
    out.push(`raqib_http_request_duration_seconds_bucket{le="+Inf"} ${this.durationCount}`);
    out.push(`raqib_http_request_duration_seconds_sum ${this.durationSum.toFixed(6)}`);
    out.push(`raqib_http_request_duration_seconds_count ${this.durationCount}`);

    const seen = new Set<string>();
    for (const g of gauges) {
      if (!seen.has(g.name)) {
        seen.add(g.name);
        out.push(`# HELP ${g.name} ${g.help}`, `# TYPE ${g.name} gauge`);
      }
      out.push(`${g.name}${fmtLabels(g.labels)} ${Number.isFinite(g.value) ? g.value : 0}`);
    }
    return out.join("\n") + "\n";
  }
}

/** One registry per process. */
export const metrics = new Metrics();
