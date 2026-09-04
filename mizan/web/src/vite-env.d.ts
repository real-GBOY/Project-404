/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API base path. Default `/api` (the dev server proxies it to the backend). */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
