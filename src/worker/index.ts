import { Env } from './types';
import { handleCors, addCorsHeaders, setCorsContext } from './utils/cors';
import { authMiddleware } from './middleware/auth';
import { bootstrapHandler } from './handlers/bootstrap';
import { collectionHandler } from './handlers/collection';
import { healthHandler } from './handlers/health';
import { mediaHandler } from './handlers/media';
import { authHandler } from './handlers/auth';
import { notifyHandler } from './handlers/notify';
import { aiListingCopyHandler } from './handlers/aiCopy';
import { agreementsHandler } from './handlers/agreements';
import { staffOpsHandler } from './handlers/staffOps';
import { geoHandler } from './handlers/geo';
import { listingsHandler } from './handlers/listings';
import { inquiriesHandler } from './handlers/inquiries';
import { adminHandler } from './handlers/admin';
import { supportTicketsHandler, reactivationHandler } from './handlers/supportTickets';
import { paymentsHandler } from './handlers/payments';
import { statsHandler } from './handlers/stats';
import { maintenanceTicketsHandler } from './handlers/maintenanceTickets';
import { eventsHandler } from './handlers/events';
import { notificationsHandler } from './handlers/notifications';
import { runEscalationSweep } from './handlers/maintenanceTickets';
import { emailHandler } from './handlers/email';
import { marketHandler, marketWebhookHandler } from './handlers/market';
import { drainOutbox } from './email';

export default {
  // Escalation sweep every 15 minutes, then drain the email outbox — retrying
  // anything the inline attempt missed (or that failed transiently).
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await runEscalationSweep(env);
    try {
      await drainOutbox(env, 50);
    } catch (error) {
      console.error('email outbox drain failed', error);
    }
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    setCorsContext(request, env);
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return handleCors();
    }

    try {
      // Health check
      if (path === '/api/health') {
        return healthHandler(env);
      }

      // Public platform numbers for the home page (live D1 counts).
      if (path === '/api/stats') {
        return statsHandler(env);
      }

      // Authentication endpoints (no auth middleware required)
      if (path.startsWith('/api/auth')) {
        return authHandler(request, env);
      }

      // Email engine — declared before the generic /api/notify and /api/admin
      // matchers so these exact paths land here.
      if (
        path === '/api/notify/event' ||
        path === '/api/email/unsubscribe' ||
        path === '/api/notifications/preferences' ||
        path === '/api/admin/email/stats' ||
        path === '/api/admin/email/drain' ||
        path === '/api/admin/email/probe' ||
        path === '/api/admin/email/test'
      ) {
        return emailHandler(request, env, ctx);
      }

      if (path.startsWith('/api/geo')) {
        return geoHandler(request, env);
      }

      // AI listing copy for the owner onboarding flow (JWT-required).
      if (path === '/api/ai/listing-copy') {
        return aiListingCopyHandler(request, env);
      }

      // Tenant agreement signatures — durable, requester-scoped, before the
      // generic /api/:collection matcher.
      if (path.startsWith('/api/agreements')) {
        return agreementsHandler(request, env);
      }

      // Staff operational checklists — role-seeded runs, owner monitoring.
      if (path.startsWith('/api/staff-ops')) {
        return staffOpsHandler(request, env);
      }

      if (path.startsWith('/api/media')) {
        return mediaHandler(request, env);
      }

      if (path.startsWith('/api/listings')) {
        return listingsHandler(request, env);
      }

      if (path === '/api/inquiries') {
        return inquiriesHandler(request, env, ctx);
      }

      if (path.startsWith('/api/notify')) {
        return notifyHandler(request, env);
      }

      if (path === '/api/support-tickets') {
        return supportTicketsHandler(request, env);
      }

      // Public lifeline for disabled/suspended accounts (no JWT — their every
      // authenticated call is rejected). Only creates a ticket; cannot un-disable.
      if (path === '/api/reactivation' && request.method === 'POST') {
        return reactivationHandler(request, env);
      }

      if (path === '/api/maintenance-tickets') {
        return maintenanceTicketsHandler(request, env);
      }

      // Server-Sent Events push channel (JWT via ?token= — EventSource cannot
      // set headers). Kept above the generic /api/<collection> matcher.
      if (path === '/api/events') {
        return eventsHandler(request, env);
      }

      if (path === '/api/notifications') {
        return notificationsHandler(request, env);
      }

      if (path.startsWith('/api/admin')) {
        return adminHandler(request, env, ctx);
      }

      // Owner publishing plans: order, verify, resume and the gateway webhook.
      if (path.startsWith('/api/payments')) {
        return paymentsHandler(request, env);
      }

      // Market-ready domain endpoints: visits, reservations, payment intents,
      // expenses, inspections, compliance, KYC, verified reviews, imports,
      // analytics and the payment webhook.
      if (path === '/api/market/webhooks/razorpay') {
        return marketWebhookHandler(request, env);
      }
      if (path.startsWith('/api/market/')) {
        return marketHandler(request, env);
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