/**
 * Shared API base URL resolver.
 *
 * VITE_API_BASE_URL should be the worker origin WITHOUT a path, e.g.
 *   ""                      → same-origin (deployed, worker serves the SPA)
 *   "http://localhost:8787" → local worker
 *
 * Historically configs have also used a value with a trailing "/api";
 * strip it here so `${base}/api/...` never becomes `/api/api/...`.
 */
export const API_BASE: string = (() => {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
  return configured.endsWith('/api') ? configured.slice(0, -4) : configured;
})();

export const apiUrl = (path: string): string => `${API_BASE}${path.startsWith('/api') ? path : `/api${path}`}`;
