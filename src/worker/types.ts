export interface Env {
  DB: D1Database;
  MEDIA?: R2Bucket;
  CACHE?: KVNamespace;
  ASSETS?: Fetcher;
  AI?: {
    run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
  };
  GOOGLE_MAPS_SERVER_KEY?: string;
  EMAIL?: {
    send: (msg: {
      to: string;
      from: { email: string; name?: string };
      subject: string;
      html?: string;
      text?: string;
    }) => Promise<unknown>;
  };
  ENVIRONMENT: string;
  DEFAULT_ORGANIZATION_ID: string;
  JWT_SECRET?: string;
  SUPERADMIN_USERNAME?: string;
  SUPERADMIN_PASSWORD?: string;
  SUPERADMIN_PHONE?: string;
  SUPERADMIN_PIN?: string;
}

export interface User {
  id: string;
  role: string;
  organizationId?: string;
  name?: string;
  email?: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}