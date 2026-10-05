/**
 * View-model contract between presenters (src/presenters) and the design-faithful screens
 * (src/ui/generated). Presenters derive it from server state + UI state; screens only render it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VM = Record<string, any>;
