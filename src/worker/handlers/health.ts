import { Env } from '../types';
import { addCorsHeaders } from '../utils/cors';

export async function healthHandler(env: Env): Promise<Response> {
  const response = new Response(JSON.stringify({ 
    ok: true, 
    environment: env.ENVIRONMENT,
    storage: env.MEDIA ? 'D1 + R2' : 'D1 (R2 optional)',
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
  return addCorsHeaders(response);
}