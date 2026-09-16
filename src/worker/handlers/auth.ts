import { Env } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { generateJWT } from '../utils/jwt';
import { hashPassword, verifyPassword } from '../utils/password';

interface DbUser {
  id: string;
  organization_id: string | null;
  name: string;
  email: string;
  phone: string;
  role: string;
  password_hash: string | null;
}

async function findUserByEmail(env: Env, email: string): Promise<DbUser | null> {
  const row = await env.DB.prepare(
    'SELECT id, organization_id, name, email, phone, role, password_hash FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1'
  ).bind(email.trim()).first<DbUser>();
  return row ?? null;
}

export async function authHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/auth/login' && request.method === 'POST') {
    try {
      const body = await request.json() as { email: string; password: string; role?: string };
      if (!body.email || !body.password) {
        return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Email and password required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      const user = await findUserByEmail(env, body.email);
      if (!user?.password_hash || !(await verifyPassword(body.password, user.password_hash))) {
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
        email: string;
        phone: string;
        role: string;
        password?: string;
      };

      if (!body.email || !body.password || !body.name || !body.phone) {
        return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'All fields required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      const existing = await findUserByEmail(env, body.email);
      if (existing) {
        return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Email already registered' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      const userId = `user-${Date.now()}`;
      const passwordHash = await hashPassword(body.password);
      const role = ['owner', 'resident', 'staff'].includes(body.role) ? body.role : 'resident';

      await env.DB.prepare(`
        INSERT INTO users (id, organization_id, name, email, phone, role, is_profile_completed, status, password_hash)
        VALUES (?, ?, ?, ?, ?, ?, 0, 'Active', ?)
      `).bind(
        userId,
        env.DEFAULT_ORGANIZATION_ID,
        body.name,
        body.email.trim().toLowerCase(),
        body.phone,
        role,
        passwordHash
      ).run();

      const token = await generateJWT({
        userId,
        role,
        organizationId: env.DEFAULT_ORGANIZATION_ID,
        name: body.name,
      }, env.JWT_SECRET || 'default-secret');

      return addCorsHeaders(new Response(JSON.stringify({
        success: true,
        token,
        user: {
          id: userId,
          role,
          name: body.name,
          email: body.email,
          phone: body.phone,
          organizationId: env.DEFAULT_ORGANIZATION_ID,
        },
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
