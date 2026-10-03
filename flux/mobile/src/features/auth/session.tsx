import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { loadJson, saveJson } from "@/lib/storage";
import { DEFAULT_PROFILE } from "@/features/onboarding/data";
import type { TrainingProfile } from "@/features/onboarding/types";

export type WeightUnit = "KG" | "LBS";
export type Language = "EN" | "AR";
export type Settings = {
  units: WeightUnit;
  language: Language;
  notifications: boolean;
  darkMode: boolean;
};
export type Account = {
  name: string;
  email: string;
  joinedAt: string;
  onboarded: boolean;
  profile: TrainingProfile | null;
};

/**
 * loading          → hydrating from storage (splash)
 * signedOut        → (auth) group: intro / sign-up / sign-in
 * needsOnboarding  → signed in but the 7-step profile isn't finished
 * ready            → the app proper
 */
export type SessionStatus = "loading" | "signedOut" | "needsOnboarding" | "ready";

type Persisted = {
  seenIntro: boolean;
  currentEmail: string | null;
  accounts: Record<string, Account>;
  settings: Settings;
};

const KEY = "flux.session.v1";
const DEFAULT_SETTINGS: Settings = {
  units: "KG",
  language: "EN",
  notifications: true,
  darkMode: false,
};
const EMPTY: Persisted = {
  seenIntro: false,
  currentEmail: null,
  accounts: {},
  settings: DEFAULT_SETTINGS,
};

type AuthResult = { ok: true } | { ok: false; error: string };

type SessionValue = {
  status: SessionStatus;
  user: Account | null;
  settings: Settings;
  seenIntro: boolean;
  markIntroSeen: () => void;
  signUp: (input: {
    name: string;
    email: string;
    password: string;
    units: WeightUnit;
    language: Language;
  }) => AuthResult;
  signIn: (email: string, password: string) => AuthResult;
  signOut: () => void;
  completeOnboarding: (profile: TrainingProfile) => void;
  updateSettings: (patch: Partial<Settings>) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalize = (email: string) => email.trim().toLowerCase();

/**
 * Frontend-only session. There is no backend yet: accounts live in
 * AsyncStorage on this device and passwords are validated but never stored.
 * Swap `signUp` / `signIn` for real API calls when the backend exists — the
 * route guards only depend on `status`.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    void loadJson<Persisted>(KEY, EMPTY).then((saved) => {
      const accounts = Object.fromEntries(
        Object.entries(saved.accounts ?? {}).map(([k, a]) => [
          k,
          a.onboarded && !a.profile ? { ...a, profile: DEFAULT_PROFILE } : a,
        ]),
      );
      setState({
        ...EMPTY,
        ...saved,
        accounts,
        settings: { ...DEFAULT_SETTINGS, ...saved.settings },
      });
      setHydrated(true);
    });
  }, []);

  const commit = useCallback((next: Persisted) => {
    setState(next);
    void saveJson(KEY, next);
  }, []);

  const user = state.currentEmail ? (state.accounts[state.currentEmail] ?? null) : null;
  const status: SessionStatus = !hydrated
    ? "loading"
    : !user
      ? "signedOut"
      : user.onboarded
        ? "ready"
        : "needsOnboarding";

  const markIntroSeen = useCallback(() => {
    if (stateRef.current.seenIntro) return;
    commit({ ...stateRef.current, seenIntro: true });
  }, [commit]);

  const signUp: SessionValue["signUp"] = useCallback(
    ({ name, email, password, units, language }) => {
      const cur = stateRef.current;
      const key = normalize(email);
      if (!name.trim()) return { ok: false, error: "Enter your name." };
      if (!EMAIL_RE.test(key)) return { ok: false, error: "Enter a valid email address." };
      if (password.length < 6)
        return { ok: false, error: "Password must be at least 6 characters." };
      if (cur.accounts[key])
        return { ok: false, error: "An account with this email already exists." };
      const account: Account = {
        name: name.trim(),
        email: key,
        joinedAt: new Date().toISOString(),
        onboarded: false,
        profile: null,
      };
      commit({
        ...cur,
        seenIntro: true,
        currentEmail: key,
        accounts: { ...cur.accounts, [key]: account },
        settings: { ...cur.settings, units, language },
      });
      return { ok: true };
    },
    [commit],
  );

  const signIn: SessionValue["signIn"] = useCallback(
    (email, password) => {
      const cur = stateRef.current;
      // Validation intentionally disabled: any input (even empty) signs in and
      // goes straight to home, creating an onboarded guest account if needed.
      const key = normalize(email) || "guest@flux.app";
      const account: Account = cur.accounts[key] ?? {
        name: key.split("@")[0] || "Guest",
        email: key,
        joinedAt: new Date().toISOString(),
        onboarded: true,
        profile: DEFAULT_PROFILE,
      };
      commit({
        ...cur,
        seenIntro: true,
        currentEmail: key,
        accounts: {
          ...cur.accounts,
          [key]: account.onboarded
            ? { ...account, profile: account.profile ?? DEFAULT_PROFILE }
            : { ...account, onboarded: true, profile: account.profile ?? DEFAULT_PROFILE },
        },
      });
      return { ok: true };
    },
    [commit],
  );

  const signOut = useCallback(() => {
    commit({ ...stateRef.current, currentEmail: null });
  }, [commit]);

  const completeOnboarding = useCallback(
    (profile: TrainingProfile) => {
      const cur = stateRef.current;
      const key = cur.currentEmail;
      const account = key ? cur.accounts[key] : undefined;
      if (!key || !account) return;
      commit({
        ...cur,
        accounts: { ...cur.accounts, [key]: { ...account, onboarded: true, profile } },
        // body-info units chosen during onboarding become the app-wide default
        settings: {
          ...cur.settings,
          units: profile.units.w === "lbs" ? "LBS" : cur.settings.units,
        },
      });
    },
    [commit],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      commit({ ...stateRef.current, settings: { ...stateRef.current.settings, ...patch } });
    },
    [commit],
  );

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      settings: state.settings,
      seenIntro: state.seenIntro,
      markIntroSeen,
      signUp,
      signIn,
      signOut,
      completeOnboarding,
      updateSettings,
    }),
    [
      status,
      user,
      state.settings,
      state.seenIntro,
      markIntroSeen,
      signUp,
      signIn,
      signOut,
      completeOnboarding,
      updateSettings,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
