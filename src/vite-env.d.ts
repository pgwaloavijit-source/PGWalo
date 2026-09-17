/// <reference types="vite/client" />

// Only non-secret, build-time configuration belongs here. `VITE_`-prefixed
// values are inlined into the public bundle, so never declare credentials.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
