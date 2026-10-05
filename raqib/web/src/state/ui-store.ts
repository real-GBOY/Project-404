import { useSyncExternalStore } from "react";

/**
 * UI state only — never server data. Filters, tabs, open dialogs, form drafts, the language. (Server
 * state lives in TanStack Query; session in AuthProvider; the route in the URL.) A tiny external
 * store with the design's `setState(partial | fn)` shape, so presenters stay close to the approved
 * interaction logic.
 */
export interface UiState {
  lang: "ar" | "en";
  w: number;
  search: boolean;
  q: string;
  sel: number;
  recent: string[];
  notif: boolean;
  more: boolean;
  modal: ({ kind: string } & Record<string, unknown>) | null;
  mf: Record<string, unknown>;
  mErr: string[] | null;
  /** A modal command is in flight (the dialog stays open until the backend answers). */
  busy: boolean;
  toast: { msg: string; action?: { label: string; fn: () => void } } | null;
  loadingNav: boolean;
  explain: boolean;
  period: "week" | "month" | "quarter";
  // lists & filters
  pq: string;
  pstatus: string;
  ptab: string;
  vview: string;
  vfilter: string;
  utab: string;
  ufilter: { q: string; role: string };
  ptab2: string;
  prole: string;
  permEdit: boolean;
  permDraft: Record<string, Record<string, string>> | null;
  scopeEdit: boolean;
  scopeDraft: Record<string, string[]> | null;
  stab: string;
  setd: Record<string, Record<string, unknown>> | null;
  sheet: boolean;
}

const initial = (): UiState => ({
  lang: "ar",
  w: typeof window === "undefined" ? 1280 : window.innerWidth,
  search: false,
  q: "",
  sel: 0,
  recent: [],
  notif: false,
  more: false,
  modal: null,
  mf: {},
  mErr: null,
  busy: false,
  toast: null,
  loadingNav: false,
  explain: false,
  period: "month",
  pq: "",
  pstatus: "all",
  ptab: "overview",
  vview: "list",
  vfilter: "all",
  utab: "users",
  ufilter: { q: "", role: "all" },
  ptab2: "roles",
  prole: "qm",
  permEdit: false,
  permDraft: null,
  scopeEdit: false,
  scopeDraft: null,
  stab: "org",
  setd: null,
  sheet: false,
});

let state: UiState = initial();
const listeners = new Set<() => void>();

export function getUi(): UiState {
  return state;
}

export function setUi(patch: Partial<UiState> | ((s: UiState) => Partial<UiState>)): void {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}

export function resetUi(keep: Partial<UiState> = {}): void {
  state = { ...initial(), ...keep };
  listeners.forEach((l) => l());
}

export function useUi(): UiState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
