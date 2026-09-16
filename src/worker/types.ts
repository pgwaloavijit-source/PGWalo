export interface Env {
  DB: D1Database;
  MEDIA?: R2Bucket; // Optional R2 storage
  CACHE?: KVNamespace; // Optional KV cache
  ASSETS?: Fetcher;
  ENVIRONMENT: string;
  DEFAULT_ORGANIZATION_ID: string;
  JWT_SECRET?: string;
}

export interface User {
  id: string;
  role: string;
  organizationId?: string;
  name?: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}