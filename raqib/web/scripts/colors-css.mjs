// Regenerates src/styles/tokens.css from src/styles/colors.ts (the source of truth). `npm run colors:sync`
// The sync test fails when the two disagree, so run this after editing colors.ts.
import { writeFileSync } from "node:fs";
import { flattenColors } from "../src/styles/colors.ts";

const lines = flattenColors().map(([name, value]) => `  --color-${name}: ${value};`);
const css = `/**
 * GENERATED from colors.ts by \`npm run colors:sync\`. Do not edit by hand: change colors.ts and regenerate.
 * Used by index.css (and any future stylesheet) so CSS and TypeScript can never disagree about a color.
 */
:root {
${lines.join("\n")}
}
`;
writeFileSync(new URL("../src/styles/tokens.css", import.meta.url), css);
console.log(`wrote ${lines.length} tokens`);
