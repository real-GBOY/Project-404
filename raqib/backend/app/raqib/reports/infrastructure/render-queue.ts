import { AppError } from "@core/kernel/errors.js";

export interface QueueOptions {
  /** Jobs running at once. */
  concurrency: number;
  /** Jobs allowed to wait; one more is refused immediately. */
  maxQueue: number;
  /** Longest a single job may run before it is abandoned. */
  timeoutMs: number;
}

export interface QueueStats {
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  rejected: number;
  timedOut: number;
}

const busy = (retryAfterSec: number) =>
  new AppError({
    code: "raqib.pdf_busy",
    message: "The server is busy producing other reports. Try again in a few seconds.",
    kind: "rate_limited",
    details: { retryAfterSec },
  });

/**
 * A bounded work queue: at most `concurrency` jobs run, at most `maxQueue` wait, everything beyond that is turned away
 * with a "busy, retry shortly" answer instead of piling up memory on a small server. A job that overruns its time limit
 * is abandoned (the caller gets an error; `onTimeout` lets the owner clean up the stuck resource).
 */
export class RenderQueue {
  private active = 0;
  private readonly waiting: Array<() => void> = [];
  private stat = { completed: 0, failed: 0, rejected: 0, timedOut: 0 };

  constructor(private readonly opts: QueueOptions) {}

  stats(): QueueStats {
    return { active: this.active, waiting: this.waiting.length, ...this.stat };
  }

  async run<T>(job: () => Promise<T>, onTimeout?: () => void): Promise<T> {
    if (this.active >= this.opts.concurrency) {
      if (this.waiting.length >= this.opts.maxQueue) {
        this.stat.rejected += 1;
        throw busy(Math.max(2, Math.ceil(((this.waiting.length + 1) * 3) / this.opts.concurrency)));
      }
      await new Promise<void>((resolve) => this.waiting.push(resolve)); // the slot is handed over by release()
    } else {
      this.active += 1;
    }
    try {
      return await this.withTimeout(job(), onTimeout);
    } finally {
      this.release();
    }
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next)
      next(); // the finished job's slot passes straight to the next waiter
    else this.active -= 1;
  }

  private withTimeout<T>(work: Promise<T>, onTimeout?: () => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.stat.timedOut += 1;
        onTimeout?.();
        reject(new AppError({ code: "raqib.pdf_timeout", message: "Producing the report took too long. Try again.", kind: "internal" }));
      }, this.opts.timeoutMs);
      work.then(
        (v) => {
          clearTimeout(timer);
          this.stat.completed += 1;
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          this.stat.failed += 1;
          reject(e);
        },
      );
    });
  }
}
