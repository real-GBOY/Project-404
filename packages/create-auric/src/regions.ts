/**
 * Module regions — how one Core source file serves both the monorepo (every
 * module present) and a scaffolded project (only the selected ones).
 *
 *   // @auric-begin notifications
 *   import { NotificationsModule } from "@core/notifications/notifications.module.js";
 *   // @auric-end notifications
 *
 * The lines between the markers are kept when `notifications` is selected and
 * dropped when it is not. An optional `else` branch carries the alternative,
 * written as commented-out code (so the monorepo build never sees it):
 *
 *   // @auric-begin notifications
 *   { provide: REQUIRE_EMAIL_VERIFICATION, useValue: true },
 *   // @auric-else notifications
 *   // { provide: REQUIRE_EMAIL_VERIFICATION, useValue: false },
 *   // @auric-end notifications
 *
 * When `notifications` is NOT selected the first branch is dropped and the
 * else branch is emitted with its leading `// ` removed. The marker lines never
 * reach the generated project.
 *
 * Deliberately a line-based transform, not a TypeScript AST rewrite: the source
 * stays the single source of truth, the monorepo compiles it untouched (markers
 * are plain comments), and a reader of the monorepo can see exactly what each
 * module contributes to a wiring file.
 */

const DIRECTIVE = /^\s*\/\/ @auric-(begin|else|end) ([a-z][a-z0-9-]*)\s*$/;

interface Frame {
  name: string;
  inElse: boolean;
  line: number;
}

export function applyRegions(
  source: string,
  selected: { has(name: string): boolean },
  file = "<source>",
): string {
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const out: string[] = [];
  const stack: Frame[] = [];

  source.split(/\r?\n/).forEach((line, index) => {
    const lineNo = index + 1;
    const directive = DIRECTIVE.exec(line);

    if (directive) {
      const kind = directive[1]!;
      const name = directive[2]!;
      if (kind === "begin") {
        if (stack.some((f) => f.name === name)) {
          throw new Error(`${file}:${lineNo}: region "${name}" is already open`);
        }
        stack.push({ name, inElse: false, line: lineNo });
        return;
      }
      const top = stack[stack.length - 1];
      if (!top || top.name !== name) {
        throw new Error(
          `${file}:${lineNo}: @auric-${kind} ${name} does not match the open region ` +
            `${top ? `"${top.name}"` : "(none)"}`,
        );
      }
      if (kind === "else") {
        if (top.inElse) throw new Error(`${file}:${lineNo}: region "${name}" has two else branches`);
        top.inElse = true;
        return;
      }
      stack.pop();
      return;
    }

    let emit = true;
    let uncomment = false;
    for (const frame of stack) {
      const on = selected.has(frame.name);
      if (frame.inElse ? on : !on) {
        emit = false;
        break;
      }
      if (frame.inElse) uncomment = true;
    }
    if (!emit) return;
    out.push(uncomment ? line.replace(/^(\s*)\/\/ ?/, "$1") : line);
  });

  if (stack.length > 0) {
    const open = stack[stack.length - 1]!;
    throw new Error(`${file}:${open.line}: region "${open.name}" is never closed`);
  }
  return out.join(eol);
}

/** Every module name mentioned by a region marker in `source`. */
export function regionNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const line of source.split(/\r?\n/)) {
    const m = DIRECTIVE.exec(line);
    if (m) names.add(m[2]!);
  }
  return names;
}

/**
 * Removes every region whose name matches `drop` (markers and content), leaving
 * all other regions — and their markers — untouched. The package build uses this
 * to take product-only regions (`product-*`) out of the shipped Core snapshot
 * while the module regions stay intact for generation time.
 */
export function removeRegions(source: string, drop: (name: string) => boolean, file = "<source>"): string {
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const out: string[] = [];
  let open: string | undefined;

  source.split(/\r?\n/).forEach((line, index) => {
    const m = DIRECTIVE.exec(line);
    const name = m?.[2];
    if (m && name && drop(name)) {
      if (m[1] === "begin") {
        if (open) throw new Error(`${file}:${index + 1}: region "${name}" opens inside "${open}"`);
        open = name;
      } else if (m[1] === "end") {
        if (open !== name) throw new Error(`${file}:${index + 1}: @auric-end ${name} does not match the open region`);
        open = undefined;
      }
      return;
    }
    if (!open) out.push(line);
  });

  if (open) throw new Error(`${file}: region "${open}" is never closed`);
  return out.join(eol);
}

/** Region names that never belong to a module: product-only code every scaffold strips. */
export const isProductRegion = (name: string): boolean => name.startsWith("product-");
