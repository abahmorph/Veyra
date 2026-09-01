/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Veyra backend base URL (e.g. http://localhost:8787). */
  readonly VITE_VEYRA_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}