/**
 * Proxy /api/* from Cloudflare Pages (pgwalo.com) to the Workers API.
 * Prefer the api.pgwalo.com custom domain; fall back to workers.dev if unset.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const workersOrigin = (env.WORKER_URL || 'https://api.pgwalo.com').replace(/\/$/, '');
  const targetUrl = new URL(url.pathname + url.search, workersOrigin);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  const headers = new Headers(request.headers);
  headers.set('X-Forwarded-Host', url.host);
  headers.set('X-Forwarded-Proto', 'https');

  const response = await fetch(new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'follow',
  }));

  const proxyResponse = new Response(response.body, response);
  const cors = corsHeaders();
  for (const [key, value] of Object.entries(cors)) {
    proxyResponse.headers.set(key, value);
  }
  return proxyResponse;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-role, x-organization-id, x-user-id',
  };
}
