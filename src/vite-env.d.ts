/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPERADMIN_PHONE?: string;
  readonly VITE_SUPERADMIN_PIN?: string;
  readonly VITE_SUPERADMIN_USERNAME?: string;
  readonly VITE_SUPERADMIN_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
