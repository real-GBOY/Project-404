import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { AuricError, toAuricError } from "../errors.js";
import { loadManifests, type Manifest } from "../manifest.js";
import { generateProject, type GenerateOptions, type StageId } from "../project.js";
import { absentNotes, resolveSelection } from "../resolve.js";
import { parseArgs, type CliArgs } from "./args.js";
import { PlainRenderer, type Prompter, type Renderer, type Task } from "./render.js";
import {
  STAGE_LABELS,
  TAGLINE,
  dependencyLines,
  detectPackageManager,
  errorParts,
  foundationLines,
  foundationModules,
  helpText,
  moduleOptions,
  selectableModules,
  successParts,
  suggestModule,
  summaryLines,
  type PackageManager,
} from "./ui.js";
import { assertProjectName, assertTargetFree, projectNameProblem, targetProblem } from "./validate.js";

export interface CliDeps {
  argv: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  write: (text: string) => void;
  /** The Core snapshot: a directory holding `core/`, `prisma/schema/`, `scripts/`, `package.json`. */
  assetsDir: string;
  version: string;
  /** Present only when a human is at a terminal; absent means fully non-interactive. */
  prompter?: Prompter;
  /** Defaults to a plain-stream renderer. */
  renderer?: Renderer;
  /** Installs dependencies. Defaults to running the package manager. */
  install?: (dir: string, pm: PackageManager, verbose: boolean) => Promise<void>;
  /** Overrides passed to the generator (tests use this to skip slow steps). */
  generateOverrides?: Partial<GenerateOptions>;
}

export const EXIT = { ok: 0, failure: 1, usage: 2, cancelled: 130 } as const;

/** Thrown to unwind the flow when the developer cancels a prompt. */
class Cancelled extends Error {}

const orCancel = <T>(value: T | null): T => {
  if (value === null) throw new Cancelled();
  return value;
};

/** Runs the package manager's install in `dir`, streaming nothing unless `verbose`. */
export function installWithPackageManager(dir: string, pm: PackageManager, verbose: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = pm === "npm" ? ["install", "--no-audit", "--no-fund", "--loglevel=error"] : ["install"];
    const child = spawn(pm, args, {
      cwd: dir,
      stdio: verbose ? "inherit" : ["ignore", "ignore", "pipe"],
      // npm/pnpm/yarn are .cmd shims on Windows, which cannot be spawned without a shell.
      shell: process.platform === "win32",
    });
    let stderr = "";
    child.stderr?.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim().split("\n").slice(-6).join("\n") || `${pm} install exited with code ${code}`));
    });
  });
}

export async function run(deps: CliDeps): Promise<number> {
  let render: Renderer = deps.renderer ?? new PlainRenderer(deps.write);
  let args: CliArgs = { yes: false, verbose: false, help: false, version: false };

  try {
    args = parseArgs(deps.argv);
    if (!deps.renderer && args.verbose) render = new PlainRenderer(deps.write, true);
    if (args.version) {
      deps.write(`${deps.version}\n`);
      return EXIT.ok;
    }
    const manifests = loadManifests(join(deps.assetsDir, "core"));
    if (args.help) {
      deps.write(helpText(deps.version, manifests));
      return EXIT.ok;
    }
    return await flow(deps, args, render, manifests);
  } catch (err) {
    if (err instanceof Cancelled) {
      render.cancelled("Cancelled. Nothing was written.");
      return EXIT.cancelled;
    }
    const e = toAuricError(err);
    render.error(errorParts(e, args.verbose));
    return e.code === "USAGE" || e.code === "INVALID_NAME" ? EXIT.usage : EXIT.failure;
  }
}

async function flow(deps: CliDeps, args: CliArgs, r: Renderer, manifests: Manifest[]): Promise<number> {
  const prompts = args.yes ? undefined : deps.prompter;
  const debug = (line: string) => r.debug(line);

  r.intro(deps.version, TAGLINE);
  debug(`assets: ${deps.assetsDir}`);

  // ── project name ─────────────────────────────────────────────────────────
  let name = args.name;
  const prompted = name === undefined;
  if (name === undefined) {
    if (!prompts) {
      throw new AuricError(
        "USAGE",
        "A project name is required.",
        "There is no terminal to ask you for one.",
        "Pass it as an argument: `npx create-auric my-app --yes`.",
      );
    }
    name = orCancel(
      await prompts.text({
        message: "Project name",
        placeholder: "acme-platform",
        validate: (v) => projectNameProblem(v) ?? targetProblem(deps.cwd, v),
      }),
    );
  }
  assertProjectName(name);
  const dir = assertTargetFree(deps.cwd, name);
  // A live prompt already echoes "◇ Project name / value"; only a name that came from the arguments needs a line.
  if (!(prompted && r.echoesPrompts && prompts)) r.step("Project name", [name]);

  // ── modules ──────────────────────────────────────────────────────────────
  const known = new Set(manifests.map((m) => m.name));
  let chosen = args.modules;
  if (chosen === undefined) {
    r.step("Foundation", foundationLines(manifests).slice(1));
    chosen = prompts
      ? orCancel(
          await prompts.multiselect({
            message: "Add modules",
            options: moduleOptions(manifests),
          }),
        )
      : [];
  }
  const unknown = chosen.filter((m) => !known.has(m));
  if (unknown.length > 0) {
    const options = selectableModules(manifests).map((m) => m.name);
    const guesses = unknown.map((u) => suggestModule(u, options)).filter((g): g is string => Boolean(g));
    throw new AuricError(
      "UNKNOWN_MODULE",
      `Unknown module${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}.`,
      `Available modules: ${options.join(", ")}.`,
      guesses.length ? `Did you mean ${guesses.join(", ")}?` : "Check the spelling, or run `create-auric --help`.",
    );
  }

  const resolution = resolveSelection(manifests, chosen);
  const foundationNames = new Set(foundationModules(manifests).map((m) => m.name));
  const alreadyIncluded = resolution.requested.filter((n) => foundationNames.has(n));
  const dep = dependencyLines(resolution, manifests);
  r.step(
    "Dependency resolution",
    dep.length > 0
      ? dep
      : [resolution.requested.length ? "No additional modules needed." : "Foundation only — add modules any time with a re-run."],
  );
  if (alreadyIncluded.length > 0) {
    r.warn([`${alreadyIncluded.join(", ")} ${alreadyIncluded.length > 1 ? "are" : "is"} part of the foundation and always included.`]);
  }
  debug(`resolved: ${resolution.selected.join(", ")}`);

  // ── options + summary ────────────────────────────────────────────────────
  const notes = absentNotes(manifests, resolution.selected);
  const install = args.install ?? (prompts ? orCancel(await prompts.confirm({ message: "Install dependencies?", initial: true })) : false);
  r.step("Summary", summaryLines({ resolution, manifests, notes, install }));

  if (prompts) {
    const go = orCancel(await prompts.confirm({ message: `Generate ${name}?`, initial: true }));
    if (!go) throw new Cancelled();
  }

  // ── generate ─────────────────────────────────────────────────────────────
  const pm = detectPackageManager(deps.env.npm_config_user_agent);
  let current: Task | undefined;
  const started = Date.now();
  r.step("Generate");

  // Ctrl+C while generating must not leave a half-written project behind. The directory was verified
  // absent-or-empty above, so removing it removes only our own output. Only armed while WE are writing:
  // once generation finishes the project is complete and an interrupted install must not delete it.
  //
  // Two routes lead here. Piped or non-raw stdin delivers a real SIGINT. But while the live spinner is on
  // screen a TTY is in raw mode, so Ctrl+C is a *keypress* that @clack calls `process.exit(0)` on — no
  // signal at all, and an exit code that reads as success. Listening for `exit` covers that route: while
  // this listener is armed, any exit means generation did not finish.
  const discardOnInterrupt = () => {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    process.exitCode = EXIT.cancelled;
  };
  const onSigint = () => {
    discardOnInterrupt();
    process.exit(EXIT.cancelled);
  };
  const disarmInterrupt = () => {
    process.off("SIGINT", onSigint);
    process.off("exit", discardOnInterrupt);
  };
  process.once("SIGINT", onSigint);
  process.once("exit", discardOnInterrupt);

  try {
    const result = await generateProject({
      repoRoot: deps.assetsDir,
      outDir: dir,
      projectName: name,
      modules: chosen,
      onStage: ({ id, state }: { id: StageId; state: "start" | "done" }) => {
        if (state === "start") {
          current = r.task(STAGE_LABELS[id]);
        } else {
          current?.done();
          current = undefined;
        }
        debug(`${id} ${state} +${Date.now() - started}ms`);
      },
      ...deps.generateOverrides,
    });
    disarmInterrupt();
    r.endTasks();

    let installed = false;
    if (install) {
      const task = r.task(`Installing dependencies (${pm})`);
      try {
        await (deps.install ?? installWithPackageManager)(dir, pm, args.verbose);
        task.done();
        installed = true;
        r.endTasks();
      } catch (err) {
        task.fail();
        r.endTasks();
        r.warn([
          `Dependency install failed — your project is generated and intact.`,
          `Run \`${pm} install\` yourself to retry.`,
          ...(err instanceof Error && err.message ? [err.message.split("\n")[0]!] : []),
        ]);
      }
    }

    r.outro(successParts({ name, stats: result.stats, installed, pm, notes: result.notes }));
    return EXIT.ok;
  } catch (err) {
    disarmInterrupt();
    current?.fail();
    r.endTasks();
    // The directory was verified free (absent or empty) above, so removing it can only remove our own output.
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    throw err;
  }
}
