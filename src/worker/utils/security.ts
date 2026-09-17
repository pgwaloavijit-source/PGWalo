const ALLOWED_ORIGINS = new Set([
  'https://pgwalo.com',
  'https://www.pgwalo.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8787',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
]);

export function resolveCorsOrigin(request: Request, environment: string): string {
  const origin = request.headers.get('Origin');
  if (environment !== 'production') {
    return origin || '*';
  }
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return origin;
  }
  return 'https://pgwalo.com';
}

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
};

export function applySecurityHeaders(headers: Headers): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
}
