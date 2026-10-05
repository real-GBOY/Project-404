import { useSyncExternalStore } from "react";
import type { FormSection } from "@/api/types";

/**
 * UI state only — never server data. Filters, tabs, open dialogs, form drafts, the language. (Server
 * state lives in TanStack Query; session in AuthProvider; the route in the URL.) A tiny external
 * store with the design's `setState(partial | fn)` shape, so presenters stay close to the approved
 * interaction logic.
 */
/** A file the person picked that has not finished becoming stored evidence. */
export interface UploadEntry {
  id: string;
  name: string;
  kind: "photo" | "video" | "doc";
  size: number;
  progress: number;
  status: "uploading" | "failed" | "rejected";
  /** Local preview of a photo (an object URL; never leaves the browser). */
  url: string | null;
  limitMb?: number;
  file?: File;
}

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
  /** Inspection workspace: current step, expanded detail panels, observation toggles, in-flight uploads, declaration. */
  step: number;
  expanded: Record<string, boolean>;
  obsOn: Record<string, boolean>;
  decl: boolean;
  uploads: Record<string, UploadEntry[]>;
  itab: string;
  rtab: string;
  fb: { ver?: string; sec?: number };
  /** Unsaved edits to a form draft (shown immediately, sent after a pause). */
  fbDraft: { versionId: string; sections: FormSection[] } | null;
  /** Wall-clock time of the last successful autosave. */
  savedAt: string | null;
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
  step: 0,
  expanded: {},
  obsOn: {},
  decl: false,
  uploads: {},
  itab: "active",
  rtab: "pending_review",
  fb: {},
  fbDraft: null,
  savedAt: null,
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
