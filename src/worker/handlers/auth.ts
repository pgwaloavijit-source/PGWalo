import { Env } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { generateJWT } from '../utils/jwt';
import { hashPassword, verifyPassword } from '../utils/password';
import { logAuthEvent, getAuthAnalytics, AuthEventPayload } from '../utils/authAnalytics';
import { authMiddleware } from '../middleware/auth';

interface DbUser {
  id: string;
  organization_id: string | null;
  name: string;
  email: string;
  phone: string;
  role: string;
  password_hash: string | null;
}

const STAFF_INVITE_CODES = new Set(['PGWALO-STAFF', 'STAFF-2026']);

async function findUserByEmail(env: Env, email: string): Promise<DbUser | null> {
  const row = await env.DB.prepare(
    'SELECT id, organization_id, name, email, phone, role, password_hash FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1'
  ).bind(email.trim()).first<DbUser>();
  return row ?? null;
}

async function findUserByPhone(env: Env, phone: string): Promise<DbUser | null> {
  const normalized = phone.replace(/\D/g, '').slice(-10);
  const row = await env.DB.prepare(
    `SELECT id, organization_id, name, email, phone, role, password_hash FROM users
     WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+91', '') LIKE ? LIMIT 1`
  ).bind(`%${normalized}`).first<DbUser>();
  return row ?? null;
}

function track(ctx: AuthEventPayload, env: Env) {
  return logAuthEvent(env, ctx).catch(() => undefined);
}

export async function authHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/auth/track' && request.method === 'POST') {
    try {
      const body = await request.json() as AuthEventPayload & { sessionId: string };
      await logAuthEvent(env, {
        sessionId: body.sessionId || `anon-${Date.now()}`,
        eventType: body.eventType,
        authPath: body.authPath,
        intent: body.intent,
        sourcePage: body.sourcePage,
        propertyId: body.propertyId,
        role: body.role,
        userId: body.userId,
        organizationId: body.organizationId,
        deviceType: body.deviceType,
        metadata: body.metadata,
      });
      return addCorsHeaders(new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      }));
    } catch {
      return addCorsHeaders(new Response(JSON.stringify({ ok: false }), { status: 400 }));
    }
  }

  if (path === '/api/auth/analytics' && request.method === 'GET') {
    const authResult = await authMiddleware(request, env);
    if (!authResult.success || !['admin', 'owner'].includes(authResult.user!.role)) {
      return addCorsHeaders(new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }));
    }
    const data = await getAuthAnalytics(
      env,
      authResult.user!.organizationId || env.DEFAULT_ORGANIZATION_ID,
      authResult.user!.role
    );
    return addCorsHeaders(new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    }));
  }

  if (path === '/api/auth/login' && request.method === 'POST') {
    try {
      const body = await request.json() as {
        email?: string;
        phone?: string;
        password: string;
        role?: string;
        sessionId?: string;
        authPath?: string;
        intent?: string;
        sourcePage?: string;
        propertyId?: string;
        deviceType?: string;
      };

      const user = body.email
        ? await findUserByEmail(env, body.email)
        : body.phone
          ? await findUserByPhone(env, body.phone)
          : null;

      const trackBase = {
        sessionId: body.sessionId || `sess-${Date.now()}`,
        authPath: body.authPath,
        intent: body.intent,
        sourcePage: body.sourcePage,
        propertyId: body.propertyId,
        deviceType: body.deviceType,
      };

      if (!body.password || !user?.password_hash || !(await verifyPassword(body.password, user.password_hash))) {
        await track({ ...trackBase, eventType: 'login_failed', role: body.role }, env);
        return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      const role = user.role || body.role || 'public';
      const token = await generateJWT({
        userId: user.id,
        role,
        organizationId: user.organization_id || env.DEFAULT_ORGANIZATION_ID,
        name: user.name,
      }, env.JWT_SECRET || 'default-secret');

      await track({
        ...trackBase,
        eventType: 'login_success',
        userId: user.id,
        organizationId: user.organization_id || env.DEFAULT_ORGANIZATION_ID,
        role,
      }, env);

      return addCorsHeaders(new Response(JSON.stringify({
        success: true,
        token,
        user: {
          id: user.id,
          role,
          name: user.name,
          email: user.email,
          phone: user.phone,
          organizationId: user.organization_id || env.DEFAULT_ORGANIZATION_ID,
        },
      }), { headers: { 'Content-Type': 'application/json' } }));
    } catch (error) {
      console.error('Login error:', error);
      return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Login failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }));
    }
  }

  if (path === '/api/auth/register' && request.method === 'POST') {
    try {
      const body = await request.json() as {
        name: string;
        email?: string;
        phone: string;
        role: string;
        password?: string;
        inviteCode?: string;
        sessionId?: string;
        authPath?: string;
        intent?: string;
        sourcePage?: string;
        propertyId?: string;
        deviceType?: string;
      };

      const trackBase = {
        sessionId: body.sessionId || `sess-${Date.now()}`,
        authPath: body.authPath,
        intent: body.intent,
        sourcePage: body.sourcePage,
        propertyId: body.propertyId,
        deviceType: body.deviceType,
      };

      if (!body.name || !body.phone || !body.password) {
        return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Name, phone and PIN required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      const role = ['owner', 'resident', 'staff', 'public'].includes(body.role) ? body.role : 'resident';

      if (role === 'staff' && (!body.inviteCode || !STAFF_INVITE_CODES.has(body.inviteCode.toUpperCase()))) {
        await track({ ...trackBase, eventType: 'register_failed', role, metadata: { reason: 'invalid_invite' } }, env);
        return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Invalid staff invite code' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      const email = body.email?.trim().toLowerCase() || `${body.phone.replace(/\D/g, '')}@pgwalo.app`;
      const existing = await findUserByEmail(env, email) || await findUserByPhone(env, body.phone);
      if (existing) {
        return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Account already exists. Try signing in.' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      const userId = `user-${Date.now()}`;
      const passwordHash = await hashPassword(body.password);

      await env.DB.prepare(`
        INSERT INTO users (id, organization_id, name, email, phone, role, is_profile_completed, status, password_hash)
        VALUES (?, ?, ?, ?, ?, ?, 0, 'Active', ?)
      `).bind(userId, env.DEFAULT_ORGANIZATION_ID, body.name, email, body.phone, role, passwordHash).run();

      const token = await generateJWT({
        userId,
        role,
        organizationId: env.DEFAULT_ORGANIZATION_ID,
        name: body.name,
      }, env.JWT_SECRET || 'default-secret');

      await track({
        ...trackBase,
        eventType: 'register_success',
        userId,
        organizationId: env.DEFAULT_ORGANIZATION_ID,
        role,
      }, env);

      return addCorsHeaders(new Response(JSON.stringify({
        success: true,
        token,
        user: { id: userId, role, name: body.name, email, phone: body.phone, organizationId: env.DEFAULT_ORGANIZATION_ID },
      }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    } catch (error) {
      console.error('Registration error:', error);
      return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Registration failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }));
    }
  }

  if (path === '/api/auth/logout' && request.method === 'POST') {
    return addCorsHeaders(new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    }));
  }

  return addCorsHeaders(new Response(JSON.stringify({ error: 'Invalid auth endpoint' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  }));
}
