import { Env, User } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { generateJWT } from '../utils/jwt';

export async function authHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Login endpoint
  if (path === '/api/auth/login' && request.method === 'POST') {
    try {
      const body = await request.json() as {
        email: string;
        password: string;
        role?: string;
      };

      // Simple authentication - in production, validate against D1 users table
      // For now, we'll generate a JWT token based on the provided role
      const role = body.role || 'public';
      const userId = `user-${Date.now()}`;
      
      // Generate JWT token
      const token = await generateJWT({
        userId,
        role,
        organizationId: env.DEFAULT_ORGANIZATION_ID,
        name: body.email.split('@')[0],
      }, env.JWT_SECRET || 'default-secret');

      const response = new Response(JSON.stringify({
        success: true,
        token,
        user: {
          id: userId,
          role,
          name: body.email.split('@')[0],
          organizationId: env.DEFAULT_ORGANIZATION_ID,
        },
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('Login error:', error);
      const response = new Response(JSON.stringify({ 
        success: false,
        error: 'Login failed' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
  }

  // Register endpoint
  if (path === '/api/auth/register' && request.method === 'POST') {
    try {
      const body = await request.json() as {
        name: string;
        email: string;
        phone: string;
        role: string;
        password?: string;
      };

      // In production, create user in D1 database
      // For now, generate a JWT token
      const userId = `user-${Date.now()}`;
      
      const token = await generateJWT({
        userId,
        role: body.role,
        organizationId: env.DEFAULT_ORGANIZATION_ID,
        name: body.name,
      }, env.JWT_SECRET || 'default-secret');

      const response = new Response(JSON.stringify({
        success: true,
        token,
        user: {
          id: userId,
          role: body.role,
          name: body.name,
          organizationId: env.DEFAULT_ORGANIZATION_ID,
        },
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('Registration error:', error);
      const response = new Response(JSON.stringify({ 
        success: false,
        error: 'Registration failed' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
  }

  // Logout endpoint
  if (path === '/api/auth/logout' && request.method === 'POST') {
    const response = new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    return addCorsHeaders(response);
  }

  const response = new Response(JSON.stringify({ error: 'Invalid auth endpoint' }), { 
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  });
  return addCorsHeaders(response);
}