import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuricError } from "../src/errors.js";
import { loadManifests } from "../src/manifest.js";
import { resolveSelection } from "../src/resolve.js";
import { parseArgs } from "../src/cli/args.js";
import { PlainRenderer, type Prompter } from "../src/cli/render.js";
import { installWithPackageManager, run } from "../src/cli/run.js";
import { errorLines, errorParts, foundationModules, moduleOptions, selectableModules, shortDescription, successLines, suggestModule } from "../src/cli/ui.js";
import { projectNameProblem } from "../src/cli/validate.js";
import { repoRoot, stripAnsi } from "./support.js";

/**
 * The CLI as a developer experiences it, asserted on meaning — text, exit codes and what
 * lands on disk — never on terminal escape sequences. `run()` is driven directly with a
 * captured stream and scripted prompts.
 */
// Several tests generate more than one project (each runs Prisma offline).
vi.setConfig({ testTimeout: 120_000 });

const manifests = loadManifests(join(repoRoot, "core"));

let cwd: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "auric-cli-"));
});
afterEach(() => rmSync(cwd, { recursive: true, force: true }));

interface Answers {
  text?: Array<string | null>;
  multiselect?: Array<string[] | null>;
  confirm?: Array<boolean | null>;
}

function scripted(answers: Answers) {
  const asked = { text: [] as unknown[], multiselect: [] as unknown[], confirm: [] as unknown[] };
  const next = <T>(queue: T[] | undefined, kind: string): T => {
    if (!queue || queue.length === 0) throw new Error(`unexpected ${kind} prompt`);
    return queue.shift()!;
  };
  const prompter: Prompter = {
    async text(o) {
      asked.text.push(o);
      return next(answers.text, "text");
    },
    async multiselect(o) {
      asked.multiselect.push(o);
      return next(answers.multiselect, "multiselect");
    },
    async confirm(o) {
      asked.confirm.push(o);
      return next(answers.confirm, "confirm");
    },
  };
  return { prompter, asked };
}

async function cli(
  argv: string[],
  o: {
    prompter?: Prompter;
    install?: (dir: string, pm: string, verbose: boolean) => Promise<void>;
    env?: NodeJS.ProcessEnv;
    types?: boolean;
    overrides?: Record<string, unknown>;
    cwd?: string;
  } = {},
) {
  const out: string[] = [];
  const code = await run({
    argv,
    cwd: o.cwd ?? cwd,
    env: o.env ?? {},
    write: (t) => void out.push(t),
    assetsDir: repoRoot,
    version: "9.9.9",
    prompter: o.prompter,
    install: o.install as never,
    // Type generation is slow and covered by the engine/e2e suites; the CLI's own behaviour does not depend on it.
    generateOverrides: { kyselyTypes: o.types ?? false, ...o.overrides },
  });
  return { code, text: stripAnsi(out.join("")) };
}

describe("arguments", () => {
  it("parses a name, modules and flags", () => {
    expect(parseArgs(["my-app", "--modules", "files, Messaging", "--yes", "--verbose"])).toMatchObject({
      name: "my-app",
      modules: ["files", "messaging"],
      yes: true,
      verbose: true,
    });
    expect(parseArgs(["-m", "files", "-y", "-h", "-v"])).toMatchObject({ modules: ["files"], yes: true, help: true, version: true });
    expect(parseArgs(["--modules=files,assistant"]).modules).toEqual(["files", "assistant"]);
    expect(parseArgs(["--install"]).install).toBe(true);
    expect(parseArgs(["--no-install"]).install).toBe(false);
    expect(parseArgs([]).install).toBeUndefined();
  });

  it("rejects what it cannot understand, with a next step", () => {
    for (const argv of [["--modules"], ["--bogus"], ["a", "b"], ["--modules", "--yes"]]) {
      try {
        parseArgs(argv);
        expect.unreachable(`${argv.join(" ")} should throw`);
      } catch (err) {
        expect(err).toBeInstanceOf(AuricError);
        expect((err as AuricError).code).toBe("USAGE");
        expect((err as AuricError).hint).not.toBe("");
      }
    }
  });
});

describe("project names", () => {
  it.each(["acme", "acme-platform", "my.app", "a1", "under_score"])("accepts %s", (n) => expect(projectNameProblem(n)).toBeUndefined());
  it.each([
    ["", /enter a project name/i],
    ["   ", /enter a project name/i],
    [" x", /space/i],
    ["Acme", /lowercase/i],
    ["my app", /only lowercase/i],
    ["@scope/pkg", /plain name/i],
    ["a/b", /plain name/i],
    [".hidden", /dot or underscore/i],
    ["_x", /dot or underscore/i],
    ["node_modules", /reserved/i],
    ["x".repeat(215), /214/],
  ])("rejects %j", (n, why) => expect(projectNameProblem(n)).toMatch(why));
});

describe("help and version", () => {
  it("prints the version and nothing else", async () => {
    expect(await cli(["--version"])).toEqual({ code: 0, text: "9.9.9\n" });
  });

  it("lists exactly the selectable modules, from the manifests", async () => {
    const { code, text } = await cli(["--help"]);
    expect(code).toBe(0);
    for (const m of selectableModules(manifests)) expect(text).toContain(m.name);
    // The always-included foundation is described, not offered.
    expect(text).toMatch(/always included/);
    for (const flag of ["--modules", "--yes", "--install", "--no-install", "--verbose", "--help", "--version"]) expect(text).toContain(flag);
    expect(text).toContain("npx create-auric");
  });
});

describe("branding", () => {
  it("credits JINX beside the version in the help header and in the intro", async () => {
    expect((await cli(["--help"])).text.split("\n")[0]).toBe("AURIC create-auric 9.9.9 · by JINX");
    const { text } = await cli(["nothing-here", "--modules", "bogus", "--yes"]);
    expect(text).toContain("◆ AURIC  9.9.9 · by JINX");
  });

  it("keeps --version bare, because scripts read it", async () => {
    expect((await cli(["--version"])).text).toBe("9.9.9\n");
  });
});

describe("dependency installation process", () => {
  // Spawning a package-manager .cmd shim on Windows needs a shell; passing an args ARRAY with `shell: true`
  // makes Node print `DeprecationWarning: DEP0190` in the middle of the CLI's own output.
  it("does not raise Node's DEP0190 deprecation warning", async () => {
    const dir = mkdtempSync(join(tmpdir(), "auric-install-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "no-deps", version: "1.0.0" }));
    const warnings: string[] = [];
    const onWarning = (w: Error & { code?: string }) => void warnings.push(w.code ?? w.name);
    process.on("warning", onWarning);
    try {
      await installWithPackageManager(dir, "npm", false);
      await new Promise((r) => setTimeout(r, 50)); // warnings are delivered on a later tick
    } finally {
      process.off("warning", onWarning);
      rmSync(dir, { recursive: true, force: true });
    }
    expect(warnings).not.toContain("DEP0190");
  });
});

describe("what the picker offers (derived from the manifests)", () => {
  it("offers only modules the foundation does not already include", () => {
    const offered = moduleOptions(manifests).map((o) => o.value);
    expect(offered).toEqual(["assistant", "files", "messaging", "notifications"]);
    const foundation = foundationModules(manifests).map((m) => m.name);
    expect(foundation).toEqual(["base", "identity", "organizations", "rbac"]);
    for (const f of foundation) expect(offered).not.toContain(f);
    for (const o of moduleOptions(manifests)) expect(o.hint.length).toBeGreaterThan(0);
    expect(moduleOptions(manifests).every((o) => !o.hint.endsWith("."))).toBe(true);
  });
});

describe("picker text stays on one line", () => {
  it("shortens every module hint at a word boundary, from the manifest", () => {
    for (const o of moduleOptions(manifests)) {
      expect(o.hint.length, o.hint).toBeLessThanOrEqual(53);
      expect(o.hint, "no dangling separator before the ellipsis").not.toMatch(/[\s,;:—-]…$/);
    }
    const assistant = moduleOptions(manifests).find((o) => o.value === "assistant")!;
    expect(assistant.hint.endsWith("…")).toBe(true);
    expect(shortDescription("Short one. Second sentence.")).toBe("Short one");
  });
});

describe("with a live renderer that already echoes prompt answers", () => {
  it("does not print the project name a second time", async () => {
    const steps: string[] = [];
    const out: string[] = [];
    const base = new PlainRenderer((t) => void out.push(t));
    const renderer = Object.assign(Object.create(base), {
      echoesPrompts: true,
      step: (title: string) => void steps.push(title),
    }) as PlainRenderer;
    const { prompter } = scripted({ text: ["echoed"], multiselect: [[]], confirm: [false, true] });
    const code = await run({
      argv: [],
      cwd,
      env: {},
      write: () => undefined,
      assetsDir: repoRoot,
      version: "9.9.9",
      prompter,
      renderer,
      generateOverrides: { kyselyTypes: false },
    });
    expect(code).toBe(0);
    expect(steps).not.toContain("Project name");
    expect(steps).toEqual(expect.arrayContaining(["Foundation", "Dependency resolution", "Summary", "Generate"]));
    // ...whereas a name given as an argument is shown, because nothing else echoed it.
    steps.length = 0;
    await run({ argv: ["fromarg", "--yes"], cwd, env: {}, write: () => undefined, assetsDir: repoRoot, version: "9.9.9", renderer, generateOverrides: { kyselyTypes: false } });
    expect(steps).toContain("Project name");
  });
});

describe("non-interactive generation", () => {
  it("generates a project and tells the developer what happened, in order", async () => {
    const { code, text } = await cli(["acme-platform", "--modules", "messaging", "--yes"]);
    expect(code).toBe(0);
    expect(existsSync(join(cwd, "acme-platform", "src", "core", "messaging"))).toBe(true);
    expect(existsSync(join(cwd, "acme-platform", "src", "core", "files"))).toBe(true); // pulled in by messaging

    // The story, in order.
    const order = ["◆ AURIC", "Project name", "Dependency resolution", "Summary", "Generate", "AURIC foundation created", "Your Core is yours"];
    const at = order.map((s) => text.indexOf(s));
    expect(at.every((i) => i >= 0), `all sections present: ${at}`).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);

    for (const stage of ["Resolving modules", "Assembling schemas", "Generating Prisma baseline", "Applying security SQL", "Preparing source", "Preparing configuration", "Validating output"]) {
      expect(text).toContain(`✓ ${stage}`);
    }
  });

  it("shows why each dependency was added, and what is merely foundation", async () => {
    const { text } = await cli(["p", "--modules", "messaging", "--yes"]);
    expect(text).toContain("Messaging requires");
    expect(text).toMatch(/Files\s+message attachments\s+added/);
    expect(text).toMatch(/Identity\s+participants\s+foundation/);
    expect(text).toMatch(/Organizations\s+tenant ownership\s+foundation/);
    expect(text).toMatch(/RBAC\s+authorization\s+foundation/);
    expect(text).toContain("Files will also be installed.");
  });

  it("reports numbers computed from the real selection — never hardcoded", async () => {
    for (const modules of [[], ["files"], ["files", "notifications", "messaging", "assistant"]]) {
      const name = `p${modules.length}`;
      const { code, text } = await cli([name, ...(modules.length ? ["--modules", modules.join(",")] : []), "--yes"]);
      expect(code).toBe(0);
      const selected = resolveSelection(manifests, modules).selected.map((n) => manifests.find((m) => m.name === n)!);
      const tables = selected.reduce((n, m) => n + m.tables.length, 0);
      expect(text).toContain(`${selected.length} modules · ${tables} tables ·`);
    }
  });

  it("warns, from the manifests, about what a skipped module means", async () => {
    const without = await cli(["a", "--yes"]);
    expect(without.text).toMatch(/Email verification is switched off/);
    expect(without.text).toContain('"Good to know" in README.md');
    expect(readFileSync(join(cwd, "a", "README.md"), "utf8")).toMatch(/## Good to know[^]*Email verification is switched off/);
    expect(JSON.parse(readFileSync(join(cwd, "a", "auric.json"), "utf8")).features).toEqual({ emailVerification: false });

    const withIt = await cli(["b", "--modules", "notifications", "--yes"]);
    expect(withIt.text).not.toMatch(/Email verification is switched off/);
    expect(JSON.parse(readFileSync(join(cwd, "b", "auric.json"), "utf8")).features).toEqual({ emailVerification: true });
  });

  it("tells the developer a foundation module is always included, and does not fail", async () => {
    const { code, text } = await cli(["a", "--modules", "identity,files", "--yes"]);
    expect(code).toBe(0);
    expect(text).toMatch(/identity is part of the foundation and always included/);
  });

  it("prints next steps that use the package manager they ran it with", async () => {
    const npm = await cli(["a", "--yes"], { env: { npm_config_user_agent: "npm/11.0.0 node/v24" } });
    expect(npm.text).toContain("npm install");
    expect(npm.text).toContain("npm run migrate");
    const pnpm = await cli(["b", "--yes"], { env: { npm_config_user_agent: "pnpm/9.0.0 npm/? node/v24" } });
    expect(pnpm.text).toContain("pnpm install");
    expect(pnpm.text).toContain("pnpm migrate");
    expect(pnpm.text).not.toContain("npm run");
  });

  it("is deterministic: the same selection gives byte-identical projects", async () => {
    // Same project name, two different parent directories — no normalising, so any drift is real.
    const first = join(cwd, "first");
    const second = join(cwd, "second");
    mkdirSync(first);
    mkdirSync(second);
    await cli(["proj", "--modules", "files,messaging", "--yes"], { cwd: first });
    await cli(["proj", "--modules", "messaging,files", "--yes"], { cwd: second });
    const read = (root: string): Record<string, string> => {
      const out: Record<string, string> = {};
      const walk = (dir: string) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, e.name);
          if (e.isDirectory()) walk(full);
          else out[full.slice(root.length + 1).split("\\").join("/")] = readFileSync(full, "utf8");
        }
      };
      walk(root);
      return out;
    };
    const a = read(join(first, "proj"));
    expect(Object.keys(a).length).toBeGreaterThan(100);
    expect(read(join(second, "proj"))).toEqual(a);
    expect(readdirSync(join(first, "proj", "prisma", "migrations")).sort()).toEqual([
      "20260101000000_auric_baseline",
      "20260101000001_auric_security",
      "migration_lock.toml",
    ]);
  });
});

describe("failing well", () => {
  it.each(["demo-app", "atlas-crm", "my-real-estate-saas", "mizan-clone", "law-firm"])(
    "accepts %s as a project name — the developer's words are never mistaken for a leak",
    async (name) => {
      const { code, text } = await cli([name, "--yes"]);
      expect(text).not.toContain("failed its own validation");
      expect(code).toBe(0);
      expect(JSON.parse(readFileSync(join(cwd, name, "package.json"), "utf8")).name).toBe(name);
      expect(readFileSync(join(cwd, name, "README.md"), "utf8")).toContain(`# ${name}`);
    },
  );

  it("refuses an existing non-empty directory and leaves it untouched", async () => {
    mkdirSync(join(cwd, "my-app"));
    writeFileSync(join(cwd, "my-app", "precious.txt"), "keep me");
    const { code, text } = await cli(["my-app", "--yes"]);
    expect(code).toBe(1);
    expect(text).toContain(`✖ Directory "my-app" already exists and isn't empty.`);
    expect(text).toMatch(/never overwrites/);
    expect(text).toMatch(/Next\s+Choose a different name/);
    expect(readFileSync(join(cwd, "my-app", "precious.txt"), "utf8")).toBe("keep me");
    expect(readdirSync(join(cwd, "my-app"))).toEqual(["precious.txt"]);
  });

  // In a real terminal the live spinner puts stdin in raw mode, so Ctrl+C is a keypress that @clack turns into
  // `process.exit(0)` — no SIGINT. Found in a pty run: it left a half-written project and exited 0.
  it("discards a half-written project when the process exits mid-generation, and does not exit 0", async () => {
    const armed: Array<() => void> = [];
    const spy = vi.spyOn(process, "once").mockImplementation(((event: string, fn: () => void) => {
      if (event === "exit") armed.push(fn);
      return process;
    }) as never);
    const before = process.exitCode;
    try {
      let interrupted = false;
      await cli(["doomed", "--yes"], {
        overrides: {
          onStage: () => {
            if (interrupted || !existsSync(join(cwd, "doomed"))) return;
            interrupted = true;
            expect(armed).toHaveLength(1);
            armed[0]!(); // what the `exit` event does when clack calls process.exit(0)
            throw new Error("stop");
          },
        },
      });
      expect(interrupted).toBe(true);
      expect(existsSync(join(cwd, "doomed"))).toBe(false);
      expect(process.exitCode).toBe(130);
    } finally {
      spy.mockRestore();
      process.exitCode = before;
    }
  });

  it("does not leave the exit guard armed after a successful generation", async () => {
    const before = process.listenerCount("exit");
    expect((await cli(["fine", "--yes"])).code).toBe(0);
    expect(process.listenerCount("exit")).toBe(before);
  });

  // A fixed `auric` default collided with any existing AURIC database: the baseline migration then failed with
  // `relation "audit_logs" already exists`. The project must point at (and tell the developer to create) its own.
  it("points a project at its own database, and documents creating it", async () => {
    expect((await cli(["my-app", "--yes"])).code).toBe(0);
    const env = readFileSync(join(cwd, "my-app", ".env.example"), "utf8");
    expect(env).toContain("AURIC_DATABASE_URL=postgres://postgres:postgres@localhost:5432/my_app");
    expect(env).not.toMatch(/5432\/auric\b/);
    const readme = readFileSync(join(cwd, "my-app", "README.md"), "utf8");
    expect(readme).toContain("createdb my_app");
    expect(readme).toMatch(/empty/i);
    expect(readme).toContain('relation "audit_logs" already exists');
    expect(readme).toContain("/api/health");
    // With no .env at all, Core falls back to a built-in URL. That must be THIS project's database too — a
    // forgotten .env used to run the migrations against a shared `auric` and leave a failed-migration record there.
    const config = readFileSync(join(cwd, "my-app", "src", "core", "kernel", "config.ts"), "utf8");
    expect(config).toContain('localhost:5432/my_app"');
    expect(config).not.toContain('localhost:5432/auric"');
  });

  // `cp .env.example .env` is the README's first step, and Core loads `.env` into the environment. An ACTIVE
  // `AURIC_SMTP_URL=CHANGE_ME` is not "unset": nodemailer parses it as a URL, so every email dead-letters; the R2 keys
  // made a live-service test call Cloudflare. Optional secrets ship commented out; only what the project needs is active.
  it("ships optional secrets commented out, and only required ones as active placeholders", async () => {
    expect((await cli(["all-in", "--modules", "files,messaging,notifications,assistant", "--yes"])).code).toBe(0);
    const env = readFileSync(join(cwd, "all-in", ".env.example"), "utf8").split("\n");
    const active = env.filter((l) => l.trim() && !l.startsWith("#"));
    const placeholders = active.filter((l) => l.endsWith("=CHANGE_ME")).map((l) => l.split("=")[0]);
    expect(placeholders.sort()).toEqual(["AURIC_APP_DB_PASSWORD", "AURIC_SYSTEM_DB_PASSWORD"]);
    for (const optional of ["AURIC_SMTP_URL", "AURIC_R2_ACCESS_KEY_ID", "AURIC_R2_SECRET_ACCESS_KEY", "AI_API_KEY"]) {
      expect(env, `${optional} stays documented`).toContain(`# ${optional}=`);
      expect(active.some((l) => l.startsWith(`${optional}=`)), `${optional} must not be active`).toBe(false);
    }
  });

  it("accepts an existing EMPTY directory", async () => {
    mkdirSync(join(cwd, "empty"));
    expect((await cli(["empty", "--yes"])).code).toBe(0);
    expect(existsSync(join(cwd, "empty", "package.json"))).toBe(true);
  });

  it("explains an invalid name (exit 2) and writes nothing", async () => {
    const { code, text } = await cli(["My App", "--yes"]);
    expect(code).toBe(2);
    expect(text).toContain(`✖ "My App" is not a valid project name.`);
    expect(text).toMatch(/lowercase/);
    expect(readdirSync(cwd)).toEqual([]);
  });

  it("names the unknown module and lists the real ones", async () => {
    const { code, text } = await cli(["p", "--modules", "files,billing", "--yes"]);
    expect(code).toBe(1);
    expect(text).toContain("✖ Unknown module: billing.");
    expect(text).toMatch(/Available modules: assistant, files, messaging, notifications/);
    expect(readdirSync(cwd)).toEqual([]);
  });

  it("suggests the module you probably meant, and only when it is a plausible typo", async () => {
    const typo = await cli(["p", "--modules", "mesaging", "--yes"]);
    expect(typo.text).toContain("Did you mean messaging?");
    expect(typo.text).not.toContain("--verbose"); // a typo is fully explained; no need to ask for debug output
    const far = await cli(["p", "--modules", "billing", "--yes"]);
    expect(far.text).not.toContain("Did you mean");
    expect(far.text).toContain("Check the spelling");
    expect(suggestModule("filez", ["files", "messaging"])).toBe("files");
    expect(suggestModule("zzzzzzzz", ["files", "messaging"])).toBeUndefined();
  });

  it("needs a name when nothing can ask for one (exit 2)", async () => {
    const { code, text } = await cli(["--yes"]);
    expect(code).toBe(2);
    expect(text).toContain("✖ A project name is required.");
    expect(text).toContain("npx create-auric my-app --yes");
  });

  it("reports an unknown flag as a usage error", async () => {
    const { code, text } = await cli(["--frobnicate"]);
    expect(code).toBe(2);
    expect(text).toContain(`✖ Unknown option "--frobnicate".`);
    expect(text).toContain("--help");
  });

  it("cleans up completely when generation fails, and explains why without a stack trace", async () => {
    const { code, text } = await cli(["doomed", "--yes"], { overrides: { repoRoot: join(cwd, "no-such-assets") } });
    expect(code).toBe(1);
    expect(existsSync(join(cwd, "doomed"))).toBe(false); // nothing half-written
    expect(text).toContain("✖ Could not write the project to disk.");
    expect(text).toMatch(/Next\s+/);
    expect(text).toContain("Run with --verbose for the full error.");
    expect(text).not.toMatch(/\n\s+at .*\(.*:\d+:\d+\)/); // no raw stack by default
  });

  it("shows the full error with --verbose", async () => {
    const { text } = await cli(["doomed", "--yes", "--verbose"], { overrides: { repoRoot: join(cwd, "no-such-assets") } });
    expect(text).toMatch(/\n\s+at .*:\d+:\d+/); // the stack, on request
    expect(text).not.toContain("Run with --verbose");
  });

  it("formats every error with what, why and what to do next", () => {
    const codes = ["INVALID_NAME", "DIR_EXISTS", "UNKNOWN_MODULE", "MANIFEST_INVALID", "SCHEMA_CLOSURE", "PRISMA_FAILED", "FS_FAILED", "INSTALL_FAILED", "USAGE", "UNEXPECTED"] as const;
    for (const code of codes) {
      const text = stripAnsi(errorLines(new AuricError(code, "It broke.", "Because reasons.", "Try this."), false).join("\n"));
      expect(text, code).toContain("✖ It broke.");
      expect(text, code).toContain("Because reasons.");
      expect(text, code).toContain("Next  Try this.");
      expect(text, code).not.toMatch(/undefined|\[object/);
    }
  });
});

describe("the success and error screens", () => {
  const stats = { modules: 6, tables: 18, rlsTables: 12, envVars: 30, migrations: 2 };

  it("reads headline → project → next steps → closing, from the numbers it is given", () => {
    const text = stripAnsi(successLines({ name: "acme", stats, installed: false, pm: "npm", notes: [] }).join("\n"));
    expect(text.split("\n")[0]).toBe("✓ AURIC foundation created");
    expect(text).toContain("6 modules · 18 tables · 12 with row-level security · 2 migrations");
    expect(text.trim().split("\n").at(-1)).toMatch(/^Your Core is yours\./);
    for (const step of ["cd acme", "createdb acme", "cp .env.example .env", "npm install", "npm run migrate", "npm run dev"]) {
      expect(text).toContain(step);
    }
    // The one step people trip on is spelled out, and the deeper guide is pointed to.
    expect(text).toContain("a NEW, EMPTY database");
    expect(text).toContain("provision-db");
    expect(text).toContain("README.md");
    expect(text).not.toMatch(/undefined|NaN|\[object/);
  });

  it("omits the install step when dependencies were already installed", () => {
    const text = stripAnsi(successLines({ name: "acme", stats, installed: true, pm: "pnpm", notes: [] }).join("\n"));
    expect(text).not.toMatch(/pnpm install/);
    expect(text).toContain("pnpm migrate");
  });

  it("explains what to do about skipped-module notes without repeating them", () => {
    const text = stripAnsi(successLines({ name: "a", stats, installed: false, pm: "npm", notes: ["One.", "Two."] }).join("\n"));
    expect(text).toContain('2 notes about skipped modules: see "Good to know" in README.md');
    expect(text).not.toContain("One.");
  });

  it("splits an error into a headline and a body, so each renderer can draw its own glyph", () => {
    const parts = errorParts(new AuricError("FS_FAILED", "Could not write.", "EACCES", "Check permissions."), false);
    expect(parts.headline).toBe("Could not write.");
    expect(stripAnsi(parts.body.join("\n"))).toContain("Next  Check permissions.");
  });
});

describe("--verbose", () => {
  it("adds generation detail without changing the outcome", async () => {
    const quiet = await cli(["a", "--yes"]);
    const loud = await cli(["b", "--yes", "--verbose"]);
    expect(loud.code).toBe(0);
    expect(loud.text).toMatch(/resolved: base, identity, organizations, rbac/);
    expect(loud.text).toMatch(/baseline done \+\d+ms/);
    expect(quiet.text).not.toMatch(/resolved:|baseline done/);
  });
});

describe("dependency installation", () => {
  it("runs the installer only when asked, and reflects it in the next steps", async () => {
    const calls: Array<[string, string]> = [];
    const install = async (dir: string, pm: string) => void calls.push([dir.split(/[\\/]/).pop()!, pm]);

    const skipped = await cli(["a", "--yes"], { install });
    expect(calls).toEqual([]);
    expect(skipped.text).toContain("npm install");

    const done = await cli(["b", "--yes", "--install"], { install, env: { npm_config_user_agent: "pnpm/9" } });
    expect(calls).toEqual([["b", "pnpm"]]);
    expect(done.text).toContain("✓ Installing dependencies (pnpm)");
    expect(done.text).not.toMatch(/pnpm install\s*\n/); // already done, so not listed as a next step
  });

  it("keeps a generated project when the install fails, and says how to retry", async () => {
    const { code, text } = await cli(["a", "--yes", "--install"], {
      install: async () => {
        throw new Error("network unreachable");
      },
    });
    expect(code).toBe(0);
    expect(existsSync(join(cwd, "a", "package.json"))).toBe(true);
    expect(text).toContain("✖ Installing dependencies (npm)");
    expect(text).toMatch(/Dependency install failed — your project is generated and intact\./);
    expect(text).toContain("Run `npm install` yourself to retry.");
    expect(text).toContain("network unreachable");
    expect(text).toContain("npm install"); // still listed as a next step
  });
});

describe("interactive flow", () => {
  it("asks for the name, modules, install and confirmation — and builds what was chosen", async () => {
    const { prompter, asked } = scripted({
      text: ["acme-platform"],
      multiselect: [["messaging"]],
      confirm: [false, true], // install? no · generate? yes
    });
    const { code, text } = await cli([], { prompter });
    expect(code).toBe(0);
    expect(existsSync(join(cwd, "acme-platform", "src", "core", "messaging"))).toBe(true);

    // The picker offered the manifest-derived choices — not the foundation.
    const picker = asked.multiselect[0] as { options: Array<{ value: string; label: string }> };
    expect(picker.options.map((o) => o.value)).toEqual(["assistant", "files", "messaging", "notifications"]);
    expect(picker.options.find((o) => o.value === "files")!.label).toBe("Files");
    expect(text).toContain("Foundation");
    expect(text).toContain("Base");

    // The prompts validate as the developer types.
    const nameAsk = asked.text[0] as { validate: (v: string) => string | undefined };
    expect(nameAsk.validate("Bad Name")).toBeDefined();
    expect(nameAsk.validate("good-name")).toBeUndefined();
    expect((asked.confirm[0] as { message: string }).message).toBe("Install dependencies?");
    expect((asked.confirm[1] as { message: string }).message).toBe("Generate acme-platform?");
  });

  it("validates the name against directories that already exist, live", async () => {
    mkdirSync(join(cwd, "taken"));
    writeFileSync(join(cwd, "taken", "x"), "");
    const { prompter, asked } = scripted({ text: ["fresh"], multiselect: [[]], confirm: [false, true] });
    await cli([], { prompter });
    const validate = (asked.text[0] as { validate: (v: string) => string | undefined }).validate;
    expect(validate("taken")).toMatch(/already exists/);
    expect(validate("not-created-yet")).toBeUndefined();
  });

  it("stops without writing anything when the developer cancels at any prompt", async () => {
    for (const answers of [
      { text: [null] },
      { text: ["a"], multiselect: [null] },
      { text: ["a"], multiselect: [["files"]], confirm: [null] },
      { text: ["a"], multiselect: [["files"]], confirm: [false, false] }, // declines the final confirm
    ] as Answers[]) {
      const { prompter } = scripted(answers);
      const { code, text } = await cli([], { prompter });
      expect(code).toBe(130);
      expect(text).toContain("Cancelled. Nothing was written.");
      expect(readdirSync(cwd)).toEqual([]);
    }
  });

  it("skips prompts whose answers were given as arguments", async () => {
    const { prompter, asked } = scripted({ confirm: [false, true] });
    const { code } = await cli(["given", "--modules", "files"], { prompter });
    expect(code).toBe(0);
    expect(asked.text).toHaveLength(0);
    expect(asked.multiselect).toHaveLength(0);
    expect(asked.confirm).toHaveLength(2);
  });

  it("--yes asks nothing even when a terminal is available", async () => {
    const { prompter, asked } = scripted({});
    const { code } = await cli(["quiet", "--yes"], { prompter });
    expect(code).toBe(0);
    expect(asked.text.length + asked.multiselect.length + asked.confirm.length).toBe(0);
  });
});
