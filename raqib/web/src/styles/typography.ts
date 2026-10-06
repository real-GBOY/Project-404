/**
 * Raqib's type stacks. Like colors, they are named once here and imported everywhere; the fonts themselves are loaded by
 * index.html. `sans` is the interface face (Arabic first, so Arabic text never falls back to a Latin-only font), `latin` is
 * for Latin-only surfaces such as the presenter bar, `mono` is for references, codes and numbers.
 */
export const FONT = {
  sans: "'IBM Plex Sans Arabic','IBM Plex Sans',system-ui,sans-serif",
  latin: "'IBM Plex Sans',system-ui,sans-serif",
  mono: "'IBM Plex Mono',monospace",
} as const;
