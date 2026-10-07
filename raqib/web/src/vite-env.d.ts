/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  /** "true" shows the demo switcher (sign in as any seeded role). Never enable in production. */
  readonly VITE_DEMO?: string;
  readonly VITE_DEMO_SCOPE?: string;
  readonly VITE_DEMO_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
