import { AuricError } from "../errors.js";

export interface CliArgs {
  name?: string;
  /** Modules named with --modules (undefined = not given, so ask). */
  modules?: string[];
  yes: boolean;
  /** true / false when --install / --no-install was given; undefined = ask (or skip when non-interactive). */
  install?: boolean;
  verbose: boolean;
  help: boolean;
  version: boolean;
}

const USAGE_HINT = "Run `create-auric --help` to see the available options.";

/** Minimal, dependency-free argv parser: the surface is small and stays predictable. */
export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { yes: false, verbose: false, help: false, version: false };
  const list = [...argv];

  const value = (flag: string, inline: string | undefined): string => {
    if (inline !== undefined) return inline;
    const next = list.shift();
    if (next === undefined || next.startsWith("-")) {
      throw new AuricError("USAGE", `${flag} needs a value.`, `Nothing followed ${flag}.`, `Example: ${flag} identity,files. ${USAGE_HINT}`);
    }
    return next;
  };

  while (list.length > 0) {
    const raw = list.shift()!;
    const eq = raw.startsWith("--") ? raw.indexOf("=") : -1;
    const flag = eq === -1 ? raw : raw.slice(0, eq);
    const inline = eq === -1 ? undefined : raw.slice(eq + 1);

    switch (flag) {
      case "--modules":
      case "-m":
        args.modules = value(flag, inline)
          .split(",")
          .map((m) => m.trim().toLowerCase())
          .filter(Boolean);
        break;
      case "--yes":
      case "-y":
        args.yes = true;
        break;
      case "--install":
        args.install = true;
        break;
      case "--no-install":
        args.install = false;
        break;
      case "--verbose":
        args.verbose = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--version":
      case "-v":
        args.version = true;
        break;
      default:
        if (flag.startsWith("-")) {
          throw new AuricError("USAGE", `Unknown option "${flag}".`, "create-auric does not have that flag.", USAGE_HINT);
        }
        if (args.name !== undefined) {
          throw new AuricError(
            "USAGE",
            `Unexpected argument "${flag}".`,
            `The project name is already "${args.name}"; only one is accepted.`,
            "Quote the name if it contains spaces, or remove the extra argument.",
          );
        }
        args.name = flag;
    }
  }
  return args;
}
