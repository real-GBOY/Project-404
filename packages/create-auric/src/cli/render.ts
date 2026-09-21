import * as p from "@clack/prompts";
import pc from "picocolors";
import { CREDIT, dim, gold, type ErrorParts, type SuccessParts } from "./ui.js";

/** A running unit of work in the generation progress list. */
export interface Task {
  done(): void;
  fail(): void;
}

/** Where the CLI's words go. One implementation draws with a live TTY; the other writes plain lines. */
export interface Renderer {
  intro(version: string, tagline: string): void;
  /** A completed step: a title on the rail, with its content beneath. */
  step(title: string, lines?: string[]): void;
  warn(lines: string[]): void;
  /** Whether prompts already echo their answer, so the flow need not print it again. */
  readonly echoesPrompts: boolean;
  task(label: string): Task;
  /** Called when a run of tasks is over: lets a live renderer collapse its spinner into a checklist. */
  endTasks(): void;
  error(parts: ErrorParts): void;
  /** The closing block (success screen). */
  outro(parts: SuccessParts): void;
  cancelled(message: string): void;
  debug(line: string): void;
}

/** Answers from the developer; `null` means they cancelled (Ctrl+C / Esc). */
export interface Prompter {
  text(o: { message: string; placeholder?: string; validate: (value: string) => string | undefined }): Promise<string | null>;
  multiselect(o: {
    message: string;
    options: Array<{ value: string; label: string; hint?: string }>;
  }): Promise<string[] | null>;
  confirm(o: { message: string; initial: boolean }): Promise<boolean | null>;
}

const RAIL = pc.dim("│");

/** Plain-stream renderer: the same rail and glyphs, no cursor control — for pipes, CI and tests. */
export class PlainRenderer implements Renderer {
  readonly echoesPrompts = false;

  constructor(
    private readonly write: (text: string) => void,
    private readonly verbose = false,
  ) {}

  private lines(lines: string[]): string {
    return lines.map((l) => (l === "" ? RAIL : `${RAIL}  ${l}`)).join("\n");
  }

  intro(version: string, tagline: string): void {
    this.write(`${gold("◆ AURIC")}  ${dim(`${version} · ${CREDIT}`)}\n${RAIL}  ${tagline}\n${RAIL}\n`);
  }

  step(title: string, lines: string[] = []): void {
    this.write(`${pc.cyan("◇")} ${title}\n${lines.length ? `${this.lines(lines)}\n` : ""}${RAIL}\n`);
  }

  warn(lines: string[]): void {
    this.write(`${this.lines(lines.map((l) => `${pc.yellow("▲")} ${l}`))}\n`);
  }

  task(label: string): Task {
    return {
      done: () => this.write(`${RAIL}  ${pc.green("✓")} ${label}\n`),
      fail: () => this.write(`${RAIL}  ${pc.red("✖")} ${label}\n`),
    };
  }

  endTasks(): void {
    /* each task line is written the moment it finishes */
  }

  error({ headline, body }: ErrorParts): void {
    this.write(`\n${pc.red("✖")} ${pc.bold(headline)}\n${body.join("\n")}\n`);
  }

  outro({ headline, body, closing }: SuccessParts): void {
    const indented = [...body, "", closing].map((l) => (l ? `   ${l}` : "")).join("\n");
    this.write(`${RAIL}\n${pc.green("└")}─ ${pc.green("✓")} ${pc.bold(headline)}\n${indented}\n`);
  }

  cancelled(message: string): void {
    this.write(`${RAIL}\n${pc.dim("└")}─ ${message}\n`);
  }

  debug(line: string): void {
    if (this.verbose) this.write(`${RAIL}  ${dim(line)}\n`);
  }
}

/** Live-terminal renderer built on @clack/prompts, so its blocks join the prompts' own rail seamlessly. */
export class ClackRenderer implements Renderer {
  readonly echoesPrompts = true;
  private spinner: ReturnType<typeof p.spinner> | undefined;
  private finished: string[] = [];
  private failed: string | undefined;

  constructor(private readonly verbose = false) {}

  intro(version: string, tagline: string): void {
    p.intro(`${gold("AURIC")}  ${dim(`${version} · ${CREDIT}`)}`);
    p.log.message(tagline, { symbol: pc.dim("│") });
  }

  step(title: string, lines: string[] = []): void {
    p.log.step(title);
    if (lines.length) p.log.message(lines.join("\n"), { symbol: pc.dim("│") });
  }

  warn(lines: string[]): void {
    for (const l of lines) p.log.warn(l);
  }

  /**
   * One spinner for the whole run, its message advancing with each stage; on `endTasks` it collapses
   * into a single checklist. Far calmer than a spinner (and a blank rail line) per stage.
   */
  task(label: string): Task {
    if (this.spinner) this.spinner.message(label);
    else {
      this.spinner = p.spinner({ cancelMessage: "Cancelled. The partial project was removed." });
      this.spinner.start(label);
    }
    return {
      done: () => void this.finished.push(label),
      fail: () => void (this.failed = label),
    };
  }

  endTasks(): void {
    const s = this.spinner;
    if (!s) return;
    this.spinner = undefined;
    s.clear();
    const lines = [...this.finished.map((l) => `${pc.green("✓")} ${l}`), ...(this.failed ? [`${pc.red("✖")} ${this.failed}`] : [])];
    this.finished = [];
    this.failed = undefined;
    if (lines.length) p.log.message(lines.join("\n"), { symbol: pc.cyan("◇") });
  }

  error({ headline, body }: ErrorParts): void {
    p.log.error(pc.bold(headline));
    p.log.message(body.join("\n"), { symbol: pc.dim("│") });
  }

  outro({ headline, body, closing }: SuccessParts): void {
    p.log.success(pc.bold(headline));
    p.log.message(body.join("\n"), { symbol: pc.dim("│") });
    p.outro(closing);
  }

  cancelled(message: string): void {
    p.cancel(message);
  }

  debug(line: string): void {
    if (this.verbose) p.log.message(dim(line), { symbol: pc.dim("·") });
  }
}

/** Real prompts. Each returns `null` when the developer cancels. */
export const clackPrompter: Prompter = {
  async text({ message, placeholder, validate }) {
    const v = await p.text({ message, placeholder, validate: (x) => validate(x ?? "") });
    return p.isCancel(v) ? null : v;
  },
  async multiselect({ message, options }) {
    const v = await p.multiselect({ message, options, required: false });
    return p.isCancel(v) ? null : v;
  },
  async confirm({ message, initial }) {
    const v = await p.confirm({ message, initialValue: initial });
    return p.isCancel(v) ? null : v;
  },
};
