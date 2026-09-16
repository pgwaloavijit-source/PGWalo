import { Env } from '../types';
import { applySecurityHeaders, resolveCorsOrigin } from './security';

const CORS_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const CORS_HEADERS = 'Content-Type, Authorization, x-user-role, x-organization-id, x-user-id';

let activeRequest: Request | null = null;
let activeEnv: Env | null = null;

export function setCorsContext(request: Request, env: Env): void {
  activeRequest = request;
  activeEnv = env;
}

export function handleCors(): Response {
  const origin = resolveCorsOrigin(activeRequest!, activeEnv?.ENVIRONMENT || 'production');
  const headers = new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': CORS_METHODS,
    'Access-Control-Allow-Headers': CORS_HEADERS,
    'Access-Control-Max-Age': '86400',
  });
  applySecurityHeaders(headers);
  return new Response(null, { status: 204, headers });
}

export function addCorsHeaders(response: Response): Response {
  const origin = resolveCorsOrigin(activeRequest!, activeEnv?.ENVIRONMENT || 'production');
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', CORS_METHODS);
  headers.set('Access-Control-Allow-Headers', CORS_HEADERS);
  applySecurityHeaders(headers);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
