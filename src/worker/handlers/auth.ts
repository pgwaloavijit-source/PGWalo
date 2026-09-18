import { Env } from '../types';
import { notifyEvent } from '../email';
import { addCorsHeaders } from '../utils/cors';
import { generateJWT } from '../utils/jwt';
import { hashPassword, verifyPassword } from '../utils/password';
import { logAuthEvent, getAuthAnalytics, AuthEventPayload } from '../utils/authAnalytics';
import { authMiddleware } from '../middleware/auth';
import { credentialsMatch, isPlatformAdmin, lastTenDigits, normalizeLoginId } from '../utils/platformAdmin';
import {
  deliverOtp,
  hashOtp,
  isValidAadhaar,
  isValidEmail,
  isValidPhone,
  matchOtp,
  normalizePhone,
  randomOtp,
} from '../utils/otp';

interface DbUser {
  id: string;
  organization_id: string | null;
  name: string;
  email: string;
  phone: string;
  role: string;
  password_hash: string | null;
  is_profile_completed?: number;
  staff_role?: string | null;
  property_id?: string | null;
  email_verified?: number;
  phone_verified?: number;
  age?: number | null;
  gender?: string | null;
  occupation?: string | null;
  organization?: string | null;
  city?: string | null;
  avatar?: string | null;
  aadhaar_last4?: string | null;
  permanent_address?: string | null;
  alternate_phone?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
  profile_extras?: string | null;
}

const USER_COLS = `id, organization_id, name, email, phone, role, password_hash, is_profile_completed, staff_role, email_verified, phone_verified,
  age, gender, occupation, organization, city, avatar, aadhaar_last4, permanent_address, alternate_phone,
  emergency_contact_name, emergency_contact_phone, emergency_contact_relation, profile_extras`;

async function findUserByEmail(env: Env, email: string): Promise<DbUser | null> {
  return env.DB.prepare(`SELECT ${USER_COLS} FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`)
    .bind(email.trim()).first<DbUser>();
}

async function findUserByPhone(env: Env, phone: string): Promise<DbUser | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return env.DB.prepare(
    `SELECT ${USER_COLS} FROM users
     WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+91', '') LIKE ? LIMIT 1`
  ).bind(`%${normalized}`).first<DbUser>();
}

function publicUser(user: DbUser, organizationFallback: string) {
  let extras: Record<string, string> = {};
  try {
    extras = user.profile_extras ? JSON.parse(user.profile_extras) : {};
  } catch {
    extras = {};
  }
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone,
    organizationId: user.organization_id || organizationFallback,
    isProfileCompleted: Boolean(user.is_profile_completed),
    propertyId: user.property_id || undefined,
    staffRole: user.staff_role || undefined,
    emailVerified: Boolean(user.email_verified),
    phoneVerified: Boolean(user.phone_verified),
    age: user.age ?? undefined,
    gender: user.gender || undefined,
    occupation: user.occupation || undefined,
    organization: user.organization || undefined,
    city: user.city || undefined,
    avatar: user.avatar || undefined,
    aadhaarLast4: user.aadhaar_last4 || undefined,
    permanentAddress: user.permanent_address || undefined,
    alternatePhone: user.alternate_phone || undefined,
    emergencyContactName: user.emergency_contact_name || undefined,
    emergencyContactPhone: user.emergency_contact_phone || undefined,
    emergencyContactRelation: user.emergency_contact_relation || undefined,
    foodPreference: extras.foodPreference || undefined,
    bloodGroup: extras.bloodGroup || undefined,
    vehicleType: extras.vehicleType || undefined,
    maritalStatus: extras.maritalStatus || undefined,
    preferredLanguage: extras.preferredLanguage || undefined,
  };
}

function track(ctx: AuthEventPayload, env: Env) {
  return logAuthEvent(env, ctx).catch(() => undefined);
}

function json(data: unknown, status = 200) {
  return addCorsHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
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
      return json({ ok: true });
    } catch {
      return json({ ok: false }, 400);
    }
  }

  if (path === '/api/auth/analytics' && request.method === 'GET') {
    const authResult = await authMiddleware(request, env);
    if (!authResult.success || (!isPlatformAdmin(authResult.user!.role) && authResult.user!.role !== 'owner')) {
      return json({ error: 'Forbidden' }, 403);
    }
    const data = await getAuthAnalytics(
      env,
      authResult.user!.organizationId || env.DEFAULT_ORGANIZATION_ID,
      authResult.user!.role
    );
    return json(data);
  }

  if (path === '/api/auth/me' && request.method === 'GET') {
    const authResult = await authMiddleware(request, env);
    if (!authResult.success) return json({ error: authResult.error }, 401);
    const current = await env.DB.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`)
      .bind(authResult.user!.id).first<DbUser>();
    if (!current) return json({ error: 'User not found' }, 404);
    return json({ success: true, user: publicUser(current, env.DEFAULT_ORGANIZATION_ID) });
  }

  if (path === '/api/auth/otp/send' && request.method === 'POST') {
    try {
      const body = await request.json() as { email: string; phone: string; purpose?: string };
      if (!isValidEmail(body.email || '') || !isValidPhone(body.phone || '')) {
        return json({ success: false, error: 'Enter a valid Indian mobile and email so we can send a code.' }, 400);
      }
      const email = body.email.trim().toLowerCase();
      const phone = normalizePhone(body.phone);
      const purpose = body.purpose === 'login' ? 'login' : 'signup';
      const code = randomOtp();
      const codeHash = await hashOtp(code);
      const id = `otp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await env.DB.prepare(
        `INSERT INTO auth_otps (id, target, channel, code_hash, purpose, expires_at, consumed)
         VALUES (?, ?, 'email', ?, ?, ?, 0)`
      ).bind(id, `${phone}|${email}`, codeHash, purpose, Date.now() + 10 * 60 * 1000).run();

      const delivered = await deliverOtp(env, email, code, purpose);
      await track({
        sessionId: id,
        eventType: 'otp_sent',
        role: purpose,
        metadata: { delivered, channel: 'email' },
      }, env);

      return json({
        success: true,
        otpId: id,
        delivered,
        message: delivered
          ? `Code sent to ${email}`
          : `We could not reach email yet. Enter this one-time code: ${code}`,
        // Code is included only when Cloudflare Email Sending is not bound.
        fallbackCode: delivered ? undefined : code,
      });
    } catch (error) {
      console.error('OTP send', error);
      return json({ success: false, error: 'Could not send verification code' }, 500);
    }
  }

  if (path === '/api/auth/otp/verify' && request.method === 'POST') {
    try {
      const body = await request.json() as { otpId: string; code: string };
      const row = await env.DB.prepare(
        'SELECT id, target, code_hash, expires_at, consumed FROM auth_otps WHERE id = ?'
      ).bind(body.otpId).first<{ id: string; target: string; code_hash: string; expires_at: number; consumed: number }>();
      if (!row || row.consumed || row.expires_at < Date.now()) {
        return json({ success: false, error: 'Code expired. Request a new one.' }, 400);
      }
      if (!(await matchOtp(body.code, row.code_hash))) {
        return json({ success: false, error: 'Incorrect code.' }, 400);
      }
      await env.DB.prepare('UPDATE auth_otps SET consumed = 1 WHERE id = ?').bind(row.id).run();
      return json({ success: true, verificationId: row.id });
    } catch {
      return json({ success: false, error: 'Verification failed' }, 400);
    }
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

      const ident = normalizeLoginId(body.email || body.phone);
      const secret = body.password || '';
      const phoneIdent = lastTenDigits(ident);
      const envPhone = lastTenDigits(env.SUPERADMIN_PHONE);
      const username = normalizeLoginId(env.SUPERADMIN_USERNAME);
      const phoneOk = Boolean(envPhone && phoneIdent && phoneIdent === envPhone && env.SUPERADMIN_PIN && credentialsMatch(secret, env.SUPERADMIN_PIN));
      const userOk = Boolean(
        username && ident &&
        ident.toLowerCase() === username.toLowerCase() &&
        env.SUPERADMIN_PASSWORD &&
        credentialsMatch(secret, env.SUPERADMIN_PASSWORD)
      );

      if (phoneOk || userOk) {
        const role = 'superadmin';
        const token = await generateJWT({
          userId: 'superadmin',
          role,
          organizationId: env.DEFAULT_ORGANIZATION_ID,
          name: 'Super Admin',
        }, env.JWT_SECRET || 'default-secret');
        try {
          await env.DB.prepare(`
            INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, timestamp, details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            `aud-${Date.now()}-login`,
            'superadmin',
            'Super Admin',
            role,
            'Login',
            'Session',
            new Date().toISOString(),
            JSON.stringify({ method: phoneOk ? 'phone' : 'username' })
          ).run();
        } catch {
          /* audit table may be empty on fresh DBs */
        }
        return json({
          success: true,
          token,
          user: {
            id: 'superadmin',
            role,
            name: 'Super Admin',
            phone: env.SUPERADMIN_PHONE || '',
            email: env.SUPERADMIN_USERNAME || '',
            organizationId: env.DEFAULT_ORGANIZATION_ID,
            isProfileCompleted: true,
          },
        });
      }

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

      if (!user) {
        await track({ ...trackBase, eventType: 'login_failed', role: body.role }, env);
        return json({
          success: false,
          error: 'No account found for that email or mobile. Use Join us to create one.',
        }, 404);
      }

      if (!body.password || !user.password_hash || !(await verifyPassword(body.password, user.password_hash))) {
        await track({ ...trackBase, eventType: 'login_failed', role: body.role }, env);
        return json({
          success: false,
          error: user.password_hash
            ? 'Incorrect PIN. Use the PIN you set when you joined.'
            : 'This account has no PIN yet. Re-register with Join us or ask support to reset it.',
        }, 401);
      }

      // "public" viewer accounts are retired and have no dashboard, so signing in
      // with one used to land on the marketing page and look like a failed login.
      // Treat them as tenants and heal the stored role so every later sign-in
      // (and the bootstrap endpoints) resolve to a real dashboard.
      let role = user.role || '';
      if (!role || role === 'public') {
        role = 'resident';
        try {
          await env.DB.prepare(`UPDATE users SET role = 'resident' WHERE id = ?`).bind(user.id).run();
        } catch (error) {
          console.error('role heal failed', error);
        }
      }
      const token = await generateJWT({
        userId: user.id,
        role,
        organizationId: user.organization_id || env.DEFAULT_ORGANIZATION_ID,
        name: user.name,
        email: user.email,
      }, env.JWT_SECRET || 'default-secret');

      await track({
        ...trackBase,
        eventType: 'login_success',
        userId: user.id,
        organizationId: user.organization_id || env.DEFAULT_ORGANIZATION_ID,
        role,
      }, env);

      // `user` was read before the role heal above, so spread the healed role
      // back over it — the client picks its dashboard from this value.
      return json({
        success: true,
        token,
        user: { ...publicUser(user, env.DEFAULT_ORGANIZATION_ID), role },
      });
    } catch (error) {
      console.error('Login error:', error);
      return json({ success: false, error: 'Login failed' }, 400);
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
        verificationId?: string;
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

      if (!body.name || !body.phone || !body.password || !body.email) {
        return json({ success: false, error: 'Name, verified mobile, email and PIN are required' }, 400);
      }
      if (!isValidPhone(body.phone) || !isValidEmail(body.email)) {
        return json({ success: false, error: 'Invalid mobile or email' }, 400);
      }

      // Join us offers exactly two kinds of account: an owner or a tenant.
      // "public" is retired — an unknown or missing role used to be silently
      // downgraded to a public viewer, which created accounts with no dashboard
      // and looked like a broken sign-up. Reject instead of guessing.
      const requestedRole = String(body.role || '').trim().toLowerCase();
      const newRole: 'owner' | 'resident' | null =
        requestedRole === 'owner'
          ? 'owner'
          : requestedRole === 'resident' || requestedRole === 'tenant'
            ? 'resident'
            : null;
      if (!newRole) {
        return json({
          success: false,
          error: 'Choose how you want to join: as an owner or as a tenant.',
        }, 400);
      }

      if (!body.verificationId) {
        return json({ success: false, error: 'Verify the code sent to your email first' }, 400);
      }

      const otp = await env.DB.prepare(
        'SELECT id, target, consumed, expires_at FROM auth_otps WHERE id = ?'
      ).bind(body.verificationId).first<{ id: string; target: string; consumed: number; expires_at: number }>();
      const phone = normalizePhone(body.phone);
      const email = body.email.trim().toLowerCase();
      if (!otp || otp.consumed !== 1 || otp.expires_at < Date.now() || otp.target !== `${phone}|${email}`) {
        return json({ success: false, error: 'Phone/email not verified. Request a new code.' }, 400);
      }

      const role = newRole;
      const existing = await findUserByEmail(env, email) || await findUserByPhone(env, phone);
      if (existing) {
        return json({ success: false, error: 'Account already exists. Try signing in.' }, 409);
      }

      const userId = `user-${Date.now()}`;
      let organizationId = role === 'owner' ? `org-${userId}` : (env.DEFAULT_ORGANIZATION_ID || 'org-default');
      if (role === 'owner') {
        try {
          await env.DB.prepare(
            `INSERT OR IGNORE INTO organizations (id, name, owner_user_id, account_state, subscription_plan) VALUES (?, ?, ?, 'Trial / Pending Setup', 'Trial')`
          ).bind(organizationId, `${body.name.trim()} operations`, userId).run();
        } catch {
          organizationId = env.DEFAULT_ORGANIZATION_ID || 'org-default';
        }
      }
      const passwordHash = await hashPassword(body.password);
      await env.DB.prepare(`
        INSERT INTO users (id, organization_id, name, email, phone, role, is_profile_completed, status, password_hash, email_verified, phone_verified)
        VALUES (?, ?, ?, ?, ?, ?, 0, 'Active', ?, 1, 1)
      `).bind(userId, organizationId, body.name.trim(), email, phone, role, passwordHash).run();
      await env.DB.prepare('UPDATE auth_otps SET consumed = 2 WHERE id = ?').bind(otp.id).run();

      const token = await generateJWT({
        userId,
        role,
        organizationId,
        name: body.name.trim(),
        email,
      }, env.JWT_SECRET || 'default-secret');

      await track({ ...trackBase, eventType: 'register_success', userId, organizationId, role }, env);

      // Welcome mail. Best-effort: registration never fails on email setup.
      try {
        await notifyEvent(env, 'auth.welcome', {
          to: email,
          toName: body.name.trim(),
          userId,
          orgId: organizationId,
          data: { phone, role },
          dedupeKey: `welcome-${userId}`,
        });
      } catch (error) {
        console.error('welcome email failed', error);
      }

      return json({
        success: true,
        token,
        user: {
          id: userId,
          role,
          name: body.name.trim(),
          email,
          phone,
          organizationId,
          isProfileCompleted: false,
          emailVerified: true,
          phoneVerified: true,
        },
      }, 201);
    } catch (error) {
      console.error('Registration error:', error);
      return json({ success: false, error: 'Registration failed' }, 400);
    }
  }

  if (path === '/api/auth/profile' && request.method === 'POST') {
    const authResult = await authMiddleware(request, env);
    if (!authResult.success) return json({ error: authResult.error }, 401);
    try {
      const body = await request.json() as {
        age?: number;
        gender?: string;
        occupation?: string;
        organization?: string;
        permanentAddress?: string;
        city?: string;
        emergencyContactName?: string;
        emergencyContactPhone?: string;
        emergencyContactRelation?: string;
        alternatePhone?: string;
        aadhaar?: string;
        avatar?: string;
        foodPreference?: string;
        bloodGroup?: string;
        vehicleType?: string;
        maritalStatus?: string;
        preferredLanguage?: string;
        extrasOnly?: boolean;
        promoteToResident?: boolean;
        propertyId?: string;
        propertyName?: string;
      };
      const userId = authResult.user!.id;
      const current = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first<DbUser & Record<string, unknown>>();
      if (!current) return json({ success: false, error: 'User not found' }, 404);

      const extras = JSON.stringify({
        foodPreference: body.foodPreference || '',
        bloodGroup: body.bloodGroup || '',
        vehicleType: body.vehicleType || '',
        maritalStatus: body.maritalStatus || '',
        preferredLanguage: body.preferredLanguage || '',
      });

      if (body.extrasOnly && current.is_profile_completed) {
        try {
          await env.DB.prepare(`
            UPDATE users SET
              gender = COALESCE(?, gender),
              occupation = COALESCE(?, occupation),
              organization = COALESCE(?, organization),
              city = COALESCE(?, city),
              emergency_contact_relation = COALESCE(?, emergency_contact_relation),
              avatar = COALESCE(?, avatar),
              permanent_address = COALESCE(?, permanent_address),
              profile_extras = ?
            WHERE id = ?
          `).bind(
            body.gender || null,
            body.occupation || null,
            body.organization || null,
            body.city || null,
            body.emergencyContactRelation || null,
            body.avatar || null,
            body.permanentAddress?.trim() || null,
            extras,
            userId
          ).run();
        } catch {
          await env.DB.prepare(`
            UPDATE users SET
              gender = COALESCE(?, gender),
              occupation = COALESCE(?, occupation),
              organization = COALESCE(?, organization),
              city = COALESCE(?, city)
            WHERE id = ?
          `).bind(body.gender || null, body.occupation || null, body.organization || null, body.city || null, userId).run();
        }
        return json({
          success: true,
          user: {
            ...publicUser(current, env.DEFAULT_ORGANIZATION_ID),
            ...JSON.parse(extras),
            city: body.city,
            occupation: body.occupation,
            organization: body.organization,
            gender: body.gender,
            avatar: body.avatar,
            emergencyContactRelation: body.emergencyContactRelation,
            permanentAddress: body.permanentAddress || current.permanent_address,
            isProfileCompleted: true,
          },
        });
      }

      if (!body.age || body.age < 16 || body.age > 99) {
        return json({ success: false, error: 'Enter a valid age' }, 400);
      }
      if (!body.permanentAddress?.trim()) {
        return json({ success: false, error: 'Permanent address is required' }, 400);
      }
      if (!body.emergencyContactName?.trim() || !isValidPhone(body.emergencyContactPhone || '')) {
        return json({ success: false, error: 'Valid emergency contact is required' }, 400);
      }
      if (!body.aadhaar || !isValidAadhaar(body.aadhaar)) {
        return json({ success: false, error: 'Enter a valid 12-digit Aadhaar number' }, 400);
      }
      const aadhaar = body.aadhaar.replace(/\D/g, '');
      const aadhaarHash = await hashPassword(aadhaar);

      let nextRole = current.role;
      if (body.promoteToResident && current.role === 'public') nextRole = 'resident';

      await env.DB.prepare(`
        UPDATE users SET
          age = ?, gender = ?, occupation = ?, organization = ?,
          permanent_address = ?, city = ?,
          emergency_contact_name = ?, emergency_contact_phone = ?, emergency_contact_relation = ?,
          alternate_phone = ?, aadhaar_last4 = ?, aadhaar_hash = ?,
          is_profile_completed = 1, role = ?
        WHERE id = ?
      `).bind(
        body.age,
        body.gender || null,
        body.occupation || null,
        body.organization || null,
        body.permanentAddress.trim(),
        body.city || null,
        body.emergencyContactName.trim(),
        normalizePhone(body.emergencyContactPhone || ''),
        body.emergencyContactRelation || null,
        body.alternatePhone ? normalizePhone(body.alternatePhone) : null,
        aadhaar.slice(-4),
        aadhaarHash,
        nextRole,
        userId
      ).run();

      const token = await generateJWT({
        userId,
        role: nextRole,
        organizationId: current.organization_id || env.DEFAULT_ORGANIZATION_ID,
        name: current.name,
        email: current.email,
      }, env.JWT_SECRET || 'default-secret');

      return json({
        success: true,
        token,
        user: {
          ...publicUser({ ...current, role: nextRole, is_profile_completed: 1 }, env.DEFAULT_ORGANIZATION_ID),
          age: body.age,
          occupation: body.occupation,
          organization: body.organization,
          city: body.city,
          gender: body.gender,
          permanentAddress: body.permanentAddress.trim(),
          emergencyContactName: body.emergencyContactName.trim(),
          emergencyContactPhone: normalizePhone(body.emergencyContactPhone || ''),
          emergencyContactRelation: body.emergencyContactRelation,
          aadhaarLast4: aadhaar.slice(-4),
        },
      });
    } catch (error) {
      console.error('Profile save', error);
      return json({ success: false, error: 'Could not save profile' }, 500);
    }
  }

  if (path === '/api/auth/staff' && request.method === 'POST') {
    const authResult = await authMiddleware(request, env);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Sign in again as the owner' }, 401);
    }
    if (authResult.user!.role !== 'owner' && !isPlatformAdmin(authResult.user!.role)) {
      return json({ error: 'Only owners can add staff' }, 403);
    }
    try {
      const body = await request.json() as {
        name: string;
        phone: string;
        email?: string;
        staffRole: string;
        pin: string;
        propertyId?: string;
        shift?: string;
      };
      if (!body.name?.trim() || !isValidPhone(body.phone) || !body.pin || body.pin.length < 6) {
        return json({ success: false, error: 'Name, valid mobile and 6-digit PIN required' }, 400);
      }
      const phone = normalizePhone(body.phone);
      const email = (body.email || `${phone}@staff.pgwalo.app`).trim().toLowerCase();
      if (await findUserByPhone(env, phone) || await findUserByEmail(env, email)) {
        return json({ success: false, error: 'This mobile or email is already registered' }, 409);
      }
      const allowed = ['Housekeeping', 'Mess Cook', 'Security Guard', 'Manager', 'Electrician'];
      const staffRole = allowed.includes(body.staffRole) ? body.staffRole : 'Housekeeping';
      const userId = `user-${Date.now()}`;
      const staffId = `staff-${Date.now()}`;
      const passwordHash = await hashPassword(body.pin);
      const orgId = authResult.user!.organizationId || env.DEFAULT_ORGANIZATION_ID;
      // Staff must belong to the owner's organisation, otherwise the owner's
      // bootstrap can never return the row (it filters on organization_id).
      if (!body.propertyId) {
        return json({ success: false, error: 'Assign this staff member to a listed PG' }, 400);
      }

      await env.DB.prepare(`
        INSERT INTO users (id, organization_id, name, email, phone, role, staff_role, property_id, is_profile_completed, status, password_hash, phone_verified)
        VALUES (?, ?, ?, ?, ?, 'staff', ?, ?, 1, 'Active', ?, 1)
      `).bind(userId, orgId, body.name.trim(), email, phone, staffRole, body.propertyId, passwordHash).run();

      try {
        await env.DB.prepare(`
          INSERT INTO staff_members (id, name, role, phone, property_id, shift, today_status, owner_user_id, organization_id)
          VALUES (?, ?, ?, ?, ?, ?, 'Checked-Out', ?, ?)
        `).bind(
          staffId,
          body.name.trim(),
          staffRole,
          phone,
          body.propertyId,
          body.shift || 'Morning (6 AM - 2 PM)',
          authResult.user!.id,
          orgId
        ).run();
      } catch (error) {
        try {
          await env.DB.prepare(`
            INSERT INTO staff_members (id, name, role, phone, property_id, shift, today_status)
            VALUES (?, ?, ?, ?, ?, ?, 'Checked-Out')
          `).bind(
            staffId,
            body.name.trim(),
            staffRole,
            phone,
            body.propertyId,
            body.shift || 'Morning (6 AM - 2 PM)'
          ).run();
        } catch (fallbackError) {
          console.error('staff_members insert', fallbackError);
        }
      }

      return json({
        success: true,
        credentials: { phone, pin: body.pin, role: 'staff', staffRole, name: body.name.trim() },
        userId,
        staffId,
      }, 201);
    } catch (error) {
      console.error('Staff create', error);
      return json({ success: false, error: 'Could not create staff login' }, 500);
    }
  }

  if (path === '/api/auth/logout' && request.method === 'POST') {
    return json({ success: true });
  }

  return json({ error: 'Invalid auth endpoint' }, 400);
}
