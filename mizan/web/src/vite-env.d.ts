/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API base path. Default `/api` (the dev server proxies it to the backend). */
  readonly VITE_API_BASE?: string;
  /** Demo builds only: pre-fill the sign-in form so visitors can log straight in. */
  readonly VITE_DEMO_EMAIL?: string;
  readonly VITE_DEMO_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
