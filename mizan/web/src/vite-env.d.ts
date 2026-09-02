/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `off` disables MSW and talks to the real backend (proxied `/api`). Default: mocks on. */
  readonly VITE_API_MOCKS?: "on" | "off";
  /** API base path. Default `/api`. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
