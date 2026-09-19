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
      replyTo?: string;
    }) => Promise<unknown>;
  };
  /** cloudflare | resend | none. Defaults to whichever credential is present. */
  EMAIL_PROVIDER?: string;
  /** Sender used when the primary fails on quota/auth/availability. */
  EMAIL_FALLBACK_PROVIDER?: string;
  EMAIL_FROM?: string;
  EMAIL_FROM_NAME?: string;
  EMAIL_REPLY_TO?: string;
  RESEND_API_KEY?: string;
  /** Override for the Resend API base (self-hosted proxy / tests). */
  RESEND_BASE_URL?: string;
  // ---- payments ----------------------------------------------------------
  /** Cashfree app id + secret key. Both halves are required to enable the gateway.
   *  A TEST-prefixed app id automatically targets the sandbox environment. */
  CASHFREE_APP_ID?: string;
  CASHFREE_SECRET_KEY?: string;
  /** Required for verified gateway webhooks (recommended in production). */
  CASHFREE_WEBHOOK_SECRET?: string;
  SUPERADMIN_EMAIL?: string;
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