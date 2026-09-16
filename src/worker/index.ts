import { Env } from './types';
import { handleCors, addCorsHeaders } from './utils/cors';
import { authMiddleware } from './middleware/auth';
import { bootstrapHandler } from './handlers/bootstrap';
import { collectionHandler } from './handlers/collection';
import { healthHandler } from './handlers/health';
import { mediaHandler } from './handlers/media';
import { authHandler } from './handlers/auth';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors();
    }

    try {
      // Health check
      if (path === '/api/health') {
        return healthHandler(env);
      }

      // Authentication endpoints (no auth middleware required)
      if (path.startsWith('/api/auth')) {
        return authHandler(request, env);
      }

      // Media upload/download endpoints (no auth middleware required for public access)
      if (path.startsWith('/api/media')) {
        return mediaHandler(request, env, ctx);
      }

      // Bootstrap endpoints (auth middleware applied)
      if (path === '/api/bootstrap') {
        const authResult = await authMiddleware(request, env);
        if (!authResult.success) {
          return addCorsHeaders(new Response(JSON.stringify({ error: authResult.error }), { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }));
        }

        if (request.method === 'GET') {
          return bootstrapHandler(request, env, authResult.user!);
        } else if (request.method === 'POST') {
          return bootstrapHandler(request, env, authResult.user!);
        }
      }

      // Collection endpoints (auth middleware applied)
      const collectionMatch = path.match(/^\/api\/([^/]+)(?:\/([^/]+))?$/);
      if (collectionMatch) {
        const authResult = await authMiddleware(request, env);
        if (!authResult.success) {
          return addCorsHeaders(new Response(JSON.stringify({ error: authResult.error }), { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }));
        }

        const [, collection, id] = collectionMatch;
        return collectionHandler(request, env, collection, id, authResult.user!);
      }

      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return addCorsHeaders(new Response(JSON.stringify({ error: 'Not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      }));
    } catch (error) {
      console.error('Worker error:', error);
      return addCorsHeaders(new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }));
    }
  }
};