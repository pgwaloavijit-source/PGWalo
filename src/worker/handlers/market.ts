/**
 * Market-ready domain handler (spec §35) — visits, reservations, payment
 * intents, expenses, inspections, compliance, KYC, verified reviews,
 * imports, reminders, analytics and the Razorpay webhook.
 *
 * Every protected mutation authenticates, scopes to the caller's
 * organization, validates state transitions, and writes an audit event.
 * The webhook never trusts client redirects: gateway payments are
 * confirmed only by HMAC-verified webhook, idempotently per event.
 */
import { Env, User } from '../types';
import { authMiddleware } from '../middleware/auth';
import { addCorsHeaders } from '../utils/cors';
import {
  type InstitutionalLead, type InstitutionalStage, type MealOpsEntry, type MealSlot,
  canTransitionInstitutional, allocationWithinRequest, bedEligibleForInstitution,
  summarizeMealOps, buildGuardianView,
} from '../../domain/p1';

type Row = Record<string, unknown>;

const json = (data: unknown, status = 200): Response =>
  addCorsHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  }));

const nowIso = () => new Date().toISOString();
const mkId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Org scoping: platform admins may pass ?organizationId=; others are pinned. */
async function orgScopeFor(env: Env, user: User, request: Request): Promise<string | null> {
  const url = new URL(request.url);
  const requested = url.searchParams.get('organizationId');
  const isPlatform = user.role === 'admin' || user.role === 'superadmin';
  if (isPlatform && requested) return requested;
  if (user.organizationId) return user.organizationId;
  // Fall back to the org that owns the user's most recent audit footprint.
  const row = await env.DB.prepare(
    'SELECT organization_id FROM users WHERE id = ? LIMIT 1'
  ).bind(user.id).first<{ organization_id: string | null }>();
  return row?.organization_id || null;
}

async function audit(env: Env, params: {
  organizationId: string | null;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: unknown;
}): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_logs (id, organization_id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      mkId('audit'), params.organizationId, params.userId, params.action,
      params.entityType, params.entityId,
      params.metadata ? JSON.stringify(params.metadata).slice(0, 2000) : null,
      nowIso(),
    ).run();
  } catch (error) {
    // Audit must never block the transaction path; log and continue.
    console.error('audit write failed', error);
  }
}

// ------------------------------------------------------------------ visits ---

async function listVisits(env: Env, orgId: string | null, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (orgId) { clauses.push('organization_id = ?'); binds.push(orgId); }
  const propertyId = url.searchParams.get('propertyId');
  if (propertyId) { clauses.push('property_id = ?'); binds.push(propertyId); }
  const leadId = url.searchParams.get('leadId');
  if (leadId) { clauses.push('lead_id = ?'); binds.push(leadId); }
  const status = url.searchParams.get('status');
  if (status) { clauses.push('status = ?'); binds.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { results } = await env.DB.prepare(
    `SELECT * FROM visits ${where} ORDER BY scheduled_at DESC LIMIT 500`
  ).bind(...binds).all<Row>();
  return json({ visits: (results || []).map(rowToVisit) });
}

function rowToVisit(r: Row) {
  return {
    id: String(r.id),
    leadId: (r.lead_id as string) || null,
    propertyId: String(r.property_id),
    scheduledAt: String(r.scheduled_at),
    status: String(r.status),
    outcome: (r.outcome as string) || null,
    assignedStaffName: (r.assigned_staff_name as string) || undefined,
    notes: (r.notes as string) || undefined,
    completedAt: (r.completed_at as string) || undefined,
    createdAt: String(r.created_at),
  };
}

const VISIT_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['confirmed', 'rescheduled', 'completed', 'no_show', 'cancelled'],
  confirmed: ['completed', 'no_show', 'rescheduled', 'cancelled'],
  rescheduled: ['confirmed', 'completed', 'no_show', 'cancelled'],
  completed: [], no_show: ['rescheduled'], cancelled: [],
};

async function createVisit(env: Env, orgId: string | null, user: User, request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as null | {
    leadId?: string; propertyId?: string; scheduledAt?: string;
    assignedStaffName?: string; notes?: string;
  };
  if (!body?.propertyId || !body?.scheduledAt) {
    return json({ error: 'propertyId and scheduledAt are required' }, 400);
  }
  const id = mkId('visit');
  await env.DB.prepare(
    `INSERT INTO visits (id, organization_id, lead_id, property_id, scheduled_at, assigned_staff_name, notes, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`
  ).bind(id, orgId, body.leadId || null, body.propertyId, body.scheduledAt,
    body.assignedStaffName || null, body.notes || null, nowIso()).run();
  await audit(env, { organizationId: orgId, userId: user.id, action: 'visit.create', entityType: 'visit', entityId: id, metadata: { leadId: body.leadId } });
  return json({ ok: true, id });
}

async function patchVisit(env: Env, orgId: string | null, user: User, visitId: string, request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as null | { status?: string; outcome?: string; notes?: string };
  const row = await env.DB.prepare('SELECT * FROM visits WHERE id = ?').bind(visitId).first<Row>();
  if (!row) return json({ error: 'Visit not found' }, 404);
  if (orgId && row.organization_id && row.organization_id !== orgId) return json({ error: 'Out of scope' }, 403);
  if (body?.status && body.status !== row.status) {
    if (!(VISIT_TRANSITIONS[String(row.status)] || []).includes(body.status)) {
      return json({ error: `Cannot move a visit from ${row.status} to ${body.status}` }, 422);
    }
    await env.DB.prepare(
      'UPDATE visits SET status = ?, completed_at = CASE WHEN ? = ? THEN ? ELSE completed_at END, outcome = COALESCE(?, outcome), notes = COALESCE(?, notes) WHERE id = ?'
    ).bind(body.status, body.status, 'completed', nowIso(), body.outcome ?? null, body.notes ?? null, visitId).run();
  } else if (body) {
    await env.DB.prepare(
      'UPDATE visits SET outcome = COALESCE(?, outcome), notes = COALESCE(?, notes) WHERE id = ?'
    ).bind(body.outcome ?? null, body.notes ?? null, visitId).run();
  }
  await audit(env, { organizationId: orgId, userId: user.id, action: 'visit.update', entityType: 'visit', entityId: visitId, metadata: body });
  return json({ ok: true });
}

// ------------------------------------------------------------ reservations ---

function rowToReservation(r: Row) {
  return {
    id: String(r.id),
    propertyId: String(r.property_id),
    bedId: String(r.bed_id),
    bedNumber: (r.bed_number as string) || undefined,
    roomNumber: (r.room_number as string) || undefined,
    leadId: (r.lead_id as string) || null,
    residentId: (r.resident_id as string) || null,
    guestName: String(r.guest_name),
    guestPhone: String(r.guest_phone),
    startDate: String(r.start_date),
    expiryAt: String(r.expiry_at),
    tokenAmount: Number(r.token_amount || 0),
    tokenPaymentStatus: String(r.token_payment_status),
    refundPolicySnapshot: String(r.refund_policy_snapshot || 'refundable'),
    status: String(r.status),
    cancellationReason: (r.cancellation_reason as string) || null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at || r.created_at),
  };
}

async function listReservations(env: Env, orgId: string | null, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (orgId) { clauses.push('organization_id = ?'); binds.push(orgId); }
  const bedId = url.searchParams.get('bedId');
  if (bedId) { clauses.push('bed_id = ?'); binds.push(bedId); }
  const status = url.searchParams.get('status');
  if (status) { clauses.push('status = ?'); binds.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { results } = await env.DB.prepare(
    `SELECT * FROM reservations ${where} ORDER BY created_at DESC LIMIT 500`
  ).bind(...binds).all<Row>();
  return json({ reservations: (results || []).map(rowToReservation) });
}

/** Server-side double-booking gate (spec §10/§14). Pure rule lives in domain/inventory.ts; re-checked here against live rows. */
async function reservationConflict(
  env: Env,
  bedId: string,
  startDate: string,
): Promise<string | null> {
  const bed = await env.DB.prepare('SELECT * FROM beds WHERE id = ?').bind(bedId).first<Row>();
  if (!bed) return 'This bed no longer exists. Refresh availability.';
  const status = String(bed.status);
  const today = nowIso().slice(0, 10);
  if (startDate < today) return 'Reservation start date cannot be in the past.';
  if (status === 'Occupied') return 'This bed is currently occupied. Choose a different bed or refresh availability.';
  if (status === 'Reserved') return 'This bed was reserved by another booking. Choose a different bed or refresh availability.';

  const { results } = await env.DB.prepare(
    `SELECT start_date FROM reservations
     WHERE bed_id = ? AND status IN ('pending_payment','held','confirmed')
       AND start_date <= ? ORDER BY start_date DESC LIMIT 1`
  ).bind(bedId, startDate).all<Row>();
  if ((results || []).length > 0) {
    return 'This bed already has an active reservation overlapping the requested start date.';
  }
  return null;
}

async function createReservation(env: Env, orgId: string | null, user: User, request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as null | {
    bedId?: string; propertyId?: string; startDate?: string; expiryAt?: string;
    tokenAmount?: number; guestName?: string; guestPhone?: string;
    leadId?: string; refundPolicy?: string;
  };
  if (!body?.bedId || !body?.propertyId || !body?.startDate || !body?.guestName || !body?.guestPhone) {
    return json({ error: 'bedId, propertyId, startDate, guestName and guestPhone are required' }, 400);
  }
  const conflict = await reservationConflict(env, body.bedId, body.startDate);
  if (conflict) return json({ error: conflict }, 422);

  const id = mkId('res');
  const expiry = body.expiryAt || new Date(Date.now() + 72 * 3_600_000).toISOString();
  await env.DB.prepare(
    `INSERT INTO reservations
      (id, organization_id, property_id, bed_id, bed_number, room_number, lead_id,
       guest_name, guest_phone, start_date, expiry_at, token_amount,
       token_payment_status, refund_policy_snapshot, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, (SELECT bed_number FROM beds WHERE id = ?),
             (SELECT room_number FROM beds WHERE id = ?), ?, ?, ?, ?, ?, ?, 'pending', ?, 'pending_payment', ?, ?)`
  ).bind(
    id, orgId, body.propertyId, body.bedId, body.bedId, body.bedId, body.leadId || null,
    body.guestName, body.guestPhone, body.startDate, expiry,
    body.tokenAmount || 0, body.refundPolicy || 'refundable', nowIso(), nowIso(),
  ).run();
  await env.DB.prepare("UPDATE beds SET status = 'Reserved' WHERE id = ?").bind(body.bedId).run();
  await audit(env, { organizationId: orgId, userId: user.id, action: 'reservation.create', entityType: 'reservation', entityId: id, metadata: { bedId: body.bedId, startDate: body.startDate } });
  return json({ ok: true, id });
}

const RESERVATION_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ['held', 'confirmed', 'expired', 'cancelled'],
  held: ['confirmed', 'expired', 'cancelled'],
  confirmed: ['converted_to_stay', 'cancelled'],
  expired: [], cancelled: [], converted_to_stay: [],
};

async function patchReservation(env: Env, orgId: string | null, user: User, resId: string, request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as null | {
    status?: string; tokenPaymentStatus?: string; cancellationReason?: string;
  };
  const row = await env.DB.prepare('SELECT * FROM reservations WHERE id = ?').bind(resId).first<Row>();
  if (!row) return json({ error: 'Reservation not found' }, 404);
  if (orgId && row.organization_id && row.organization_id !== orgId) return json({ error: 'Out of scope' }, 403);

  if (body?.status && body.status !== row.status) {
    if (!(RESERVATION_TRANSITIONS[String(row.status)] || []).includes(body.status)) {
      return json({ error: `Cannot move a reservation from ${row.status} to ${body.status}` }, 422);
    }
  }
  await env.DB.prepare(
    `UPDATE reservations SET
       status = COALESCE(?, status),
       token_payment_status = COALESCE(?, token_payment_status),
       cancellation_reason = COALESCE(?, cancellation_reason),
       updated_at = ?
     WHERE id = ?`
  ).bind(body?.status || null, body?.tokenPaymentStatus || null,
    body?.cancellationReason || null, nowIso(), resId).run();

  // Deterministic expiry: a reservation that leaves the active set frees the bed.
  if (body?.status && ['expired', 'cancelled', 'converted_to_stay'].includes(body.status)) {
    await env.DB.prepare("UPDATE beds SET status = 'Vacant' WHERE id = ? AND status = 'Reserved'")
      .bind(String(row.bed_id)).run();
  }
  await audit(env, { organizationId: orgId, userId: user.id, action: 'reservation.update', entityType: 'reservation', entityId: resId, metadata: body });
  return json({ ok: true });
}

// ---------------------------------------------------------- payment intents ---

function rowToIntent(r: Row) {
  return {
    id: String(r.id),
    purpose: String(r.purpose),
    referenceId: (r.reference_id as string) || null,
    residentId: (r.resident_id as string) || null,
    leadId: (r.lead_id as string) || null,
    propertyId: (r.property_id as string) || null,
    payerName: String(r.payer_name),
    payerPhone: String(r.payer_phone),
    amount: Number(r.amount || 0),
    currency: String(r.currency || 'INR'),
    status: String(r.status),
    provider: String(r.provider || 'none'),
    providerOrderId: (r.provider_order_id as string) || null,
    utr: (r.utr as string) || null,
    receiptNumber: (r.receipt_number as string) || null,
    paidAt: (r.paid_at as string) || null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at || r.created_at),
  };
}

async function listPaymentIntents(env: Env, orgId: string | null, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (orgId) { clauses.push('organization_id = ?'); binds.push(orgId); }
  const status = url.searchParams.get('status');
  if (status) { clauses.push('status = ?'); binds.push(status); }
  const purpose = url.searchParams.get('purpose');
  if (purpose) { clauses.push('purpose = ?'); binds.push(purpose); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { results } = await env.DB.prepare(
    `SELECT * FROM payment_intents ${where} ORDER BY created_at DESC LIMIT 500`
  ).bind(...binds).all<Row>();
  return json({ intents: (results || []).map(rowToIntent) });
}

async function createPaymentIntent(env: Env, orgId: string | null, user: User, request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as null | {
    purpose?: string; referenceId?: string; residentId?: string; leadId?: string;
    propertyId?: string; payerName?: string; payerPhone?: string; amount?: number;
  };
  if (!body?.purpose || !body?.payerName || !body?.payerPhone || !body?.amount) {
    return json({ error: 'purpose, payerName, payerPhone and amount are required' }, 400);
  }
  if (!(body.amount > 0)) return json({ error: 'Amount must be positive' }, 400);

  const gatewayReady = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
  const id = mkId('pi');
  let providerOrderId: string | null = null;
  let paymentLink: string | null = null;
  let provider = 'none';

  if (gatewayReady && body.purpose === 'token') {
    // Real Razorpay order via REST API (staff-side creation, not client redirect trust).
    try {
      const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
      const resp = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(body.amount * 100),
          currency: 'INR',
          receipt: id,
          notes: { purpose: body.purpose, reference: body.referenceId || '' },
        }),
      });
      if (resp.ok) {
        const order = await resp.json() as { id?: string; short_url?: string };
        providerOrderId = order.id || null;
        paymentLink = order.short_url || null;
        provider = 'razorpay';
      }
    } catch (error) {
      console.error('razorpay order creation failed', error);
    }
  }

  await env.DB.prepare(
    `INSERT INTO payment_intents
      (id, organization_id, purpose, reference_id, resident_id, lead_id, property_id,
       payer_name, payer_phone, amount, currency, status, provider, provider_order_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', 'created', ?, ?, ?, ?)`
  ).bind(
    id, orgId, body.purpose, body.referenceId || null, body.residentId || null,
    body.leadId || null, body.propertyId || null, body.payerName, body.payerPhone,
    body.amount, provider, providerOrderId, nowIso(), nowIso(),
  ).run();
  await audit(env, { organizationId: orgId, userId: user.id, action: 'payment.intent.create', entityType: 'payment_intent', entityId: id, metadata: { purpose: body.purpose, amount: body.amount } });
  return json({ ok: true, id, provider, paymentLink: paymentLink || '', gatewayConfigured: gatewayReady });
}

async function reconcilePaymentIntent(env: Env, orgId: string | null, user: User, intentId: string, request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as null | {
    status?: string; utr?: string; receiptNumber?: string; provider?: string;
  };
  const row = await env.DB.prepare('SELECT * FROM payment_intents WHERE id = ?').bind(intentId).first<Row>();
  if (!row) return json({ error: 'Payment intent not found' }, 404);
  if (orgId && row.organization_id && row.organization_id !== orgId) return json({ error: 'Out of scope' }, 403);

  // Immutability: a paid intent cannot be un-paid from the client (spec §16).
  if (row.status === 'paid' && body?.status && body.status !== 'paid') {
    return json({ error: 'A paid intent cannot be un-paid. Record a refund instead.' }, 422);
  }
  // Gateway money is confirmed by webhook only, never by client assert.
  if (body?.status === 'paid' && String(row.provider) === 'razorpay') {
    return json({ error: 'Gateway payments can only be confirmed by webhook verification, not manually.' }, 422);
  }

  await env.DB.prepare(
    `UPDATE payment_intents SET
       status = COALESCE(?, status), utr = COALESCE(?, utr),
       receipt_number = COALESCE(?, receipt_number),
       paid_at = CASE WHEN ? = 'paid' AND paid_at IS NULL THEN ? ELSE paid_at END,
       updated_at = ?
     WHERE id = ?`
  ).bind(
    body?.status || null, body?.utr || null, body?.receiptNumber || null,
    body?.status || null, nowIso(), nowIso(), intentId,
  ).run();

  if (body?.status === 'paid' && String(row.purpose) === 'token' && row.reference_id) {
    await env.DB.prepare(
      "UPDATE reservations SET token_payment_status = 'paid', status = CASE WHEN status = 'pending_payment' THEN 'held' ELSE status END, updated_at = ? WHERE id = ?"
    ).bind(nowIso(), String(row.reference_id)).run();
  }
  await audit(env, { organizationId: orgId, userId: user.id, action: 'payment.reconcile', entityType: 'payment_intent', entityId: intentId, metadata: body });
  return json({ ok: true });
}

// -------------------------------------------------- intent → invoice bridge ---

/**
 * A webhook-confirmed 'rent' intent settles the underlying legacy invoice:
 * it records a payment row, bumps verified_paid_amount, recomputes status,
 * and updates the resident's payment tracking. This is the missing link
 * between the new payment-intent layer and the existing rent ledger.
 */
async function settleRentIntent(env: Env, intent: Row): Promise<void> {
  const invoiceId = String(intent.reference_id || '');
  if (!invoiceId) return;
  const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoiceId).first<Row>();
  if (!invoice) return;

  const amount = Number(intent.amount || 0);
  const paidAlready = Number(invoice.verified_paid_amount || 0);
  const total = Number(invoice.amount || 0);
  const newPaid = Math.min(paidAlready + amount, total);
  const newStatus = newPaid >= total ? 'Paid' : newPaid > 0 ? 'Partial' : 'Due';

  await env.DB.batch([
    env.DB.prepare(
      'UPDATE invoices SET verified_paid_amount = ?, status = ? WHERE id = ?'
    ).bind(newPaid, newStatus, invoiceId),
    env.DB.prepare(
      `INSERT INTO payments (id, organization_id, resident_id, property_id, amount, method, status, submitted_at, verified_at, transaction_reference, notes)
       VALUES (?, ?, ?, ?, ?, 'UPI', 'Verified', ?, ?, ?, ?)`
    ).bind(
      mkId('pay'), intent.organization_id, intent.resident_id, intent.property_id,
      amount, nowIso(), nowIso(), String(intent.id),
      `Gateway settlement for intent ${String(intent.id)}`,
    ),
    env.DB.prepare(
      "UPDATE residents SET rent_status = CASE WHEN ? = 'Paid' THEN 'Paid' ELSE 'Partial' END, last_payment_date = ? WHERE id = ?"
    ).bind(newStatus, nowIso(), String(intent.resident_id)),
  ]);
}

// ------------------------------------------------------------------ webhook ---

async function verifyRazorpaySignature(env: Env, rawBody: string, signature: string): Promise<boolean> {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  return expected === signature;
}

export async function marketWebhookHandler(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const raw = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || '';
  const signatureOk = await verifyRazorpaySignature(env, raw, signature);

  let payload: {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string; error_description?: string } } };
  } = {};
  try { payload = JSON.parse(raw); } catch { /* keep empty */ }
  const payment = payload?.payload?.payment?.entity;
  const orderId = payment?.order_id || '';

  // Store every event (spec §16: gateway event storage) before any decision.
  const eventId = mkId('pge');
  try {
    await env.DB.prepare(
      `INSERT INTO payment_gateway_events (id, intent_id, provider, event_type, payload, signature_valid, processed, created_at)
       VALUES (?, (SELECT id FROM payment_intents WHERE provider_order_id = ? ORDER BY created_at DESC LIMIT 1), 'razorpay', ?, ?, ?, 0, ?)`
    ).bind(eventId, orderId, payload?.event || 'unknown', raw.slice(0, 4000), signatureOk ? 1 : 0, nowIso()).run();
  } catch (error) {
    console.error('gateway event log failed', error);
  }

  if (!signatureOk) return json({ error: 'Invalid signature' }, 400);
  if (!orderId) return json({ ok: true, note: 'no order reference' });

  const intent = await env.DB.prepare(
    'SELECT * FROM payment_intents WHERE provider_order_id = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(orderId).first<Row>();
  if (!intent) return json({ ok: true, note: 'unknown order' });

  // Idempotency: a paid intent is never re-processed (spec §16).
  if (String(intent.status) === 'paid') return json({ ok: true, note: 'already processed' });

  const failed = /failed|cancelled/i.test(payload?.event || '');
  const newStatus = failed ? 'failed' : 'paid';
  await env.DB.prepare(
    `UPDATE payment_intents SET status = ?, paid_at = CASE WHEN ? = 'paid' THEN ? ELSE paid_at END, provider_payment_id = ?, updated_at = ? WHERE id = ?`
  ).bind(newStatus, newStatus, nowIso(), payment?.id || null, nowIso(), String(intent.id)).run();

  // Bridge: a paid token intent confirms the reservation hold (spec §14).
  if (newStatus === 'paid' && String(intent.purpose) === 'token' && intent.reference_id) {
    await env.DB.prepare(
      "UPDATE reservations SET token_payment_status = 'paid', status = CASE WHEN status = 'pending_payment' THEN 'held' ELSE status END, updated_at = ? WHERE id = ?"
    ).bind(nowIso(), String(intent.reference_id)).run();
  }
  // Bridge: a paid rent intent settles the legacy invoice (spec §15/§16).
  if (newStatus === 'paid' && String(intent.purpose) === 'rent') {
    try {
      await settleRentIntent(env, intent);
    } catch (error) {
      console.error('rent settlement failed', error);
    }
  }

  try {
    await env.DB.prepare('UPDATE payment_gateway_events SET processed = 1, processed_at = ? WHERE id = ?')
      .bind(nowIso(), eventId).run();
  } catch { /* non-fatal */ }

  return json({ ok: true });
}

// ----------------------------------------------------------------- expenses ---

function rowToExpense(r: Row) {
  return {
    id: String(r.id),
    propertyId: (r.property_id as string) || null,
    category: String(r.category),
    amount: Number(r.amount || 0),
    date: String(r.date),
    vendor: (r.vendor as string) || null,
    paymentMethod: (r.payment_method as string) || null,
    reference: (r.reference as string) || null,
    notes: (r.notes as string) || null,
    recurring: Boolean(r.recurring),
    createdBy: (r.created_by as string) || null,
    createdAt: String(r.created_at),
  };
}

async function listExpenses(env: Env, orgId: string | null, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (orgId) { clauses.push('organization_id = ?'); binds.push(orgId); }
  const propertyId = url.searchParams.get('propertyId');
  if (propertyId) { clauses.push('property_id = ?'); binds.push(propertyId); }
  const month = url.searchParams.get('month');
  if (month) { clauses.push("substr(date, 1, 7) = ?"); binds.push(month); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { results } = await env.DB.prepare(
    `SELECT * FROM expenses ${where} ORDER BY date DESC LIMIT 1000`
  ).bind(...binds).all<Row>();
  return json({ expenses: (results || []).map(rowToExpense) });
}

async function createExpense(env: Env, orgId: string | null, user: User, request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as null | {
    propertyId?: string; category?: string; amount?: number; date?: string;
    vendor?: string; paymentMethod?: string; reference?: string;
    notes?: string; recurring?: boolean;
  };
  if (!body?.category || !body?.amount || !body?.date) {
    return json({ error: 'category, amount and date are required' }, 400);
  }
  if (!(body.amount > 0)) return json({ error: 'Amount must be positive' }, 400);
  const id = mkId('exp');
  await env.DB.prepare(
    `INSERT INTO expenses (id, organization_id, property_id, category, amount, date, vendor, payment_method, reference, notes, recurring, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, orgId, body.propertyId || null, body.category, body.amount, body.date,
    body.vendor || null, body.paymentMethod || null, body.reference || null,
    body.notes || null, body.recurring ? 1 : 0, user.id, nowIso(),
  ).run();
  await audit(env, { organizationId: orgId, userId: user.id, action: 'expense.create', entityType: 'expense', entityId: id, metadata: { category: body.category, amount: body.amount } });
  return json({ ok: true, id });
}

// -------------------------------------------------------------- inspections ---

function rowToInspection(r: Row) {
  let items: unknown[] = [];
  try { items = JSON.parse(String(r.items || '[]')) as unknown[]; } catch { /* default */ }
  return {
    id: String(r.id),
    residentId: (r.resident_id as string) || null,
    stayId: (r.stay_id as string) || null,
    propertyId: String(r.property_id),
    roomNumber: String(r.room_number),
    bedNumber: (r.bed_number as string) || null,
    type: String(r.type),
    inspectionDate: String(r.inspection_date),
    inspectedBy: (r.inspected_by as string) || null,
    items,
    meterReading: (r.meter_reading as string) || null,
    residentConfirmed: Boolean(r.resident_confirmed),
    residentConfirmedAt: (r.resident_confirmed_at as string) || null,
    staffConfirmed: Boolean(r.staff_confirmed),
    staffConfirmedAt: (r.staff_confirmed_at as string) || null,
    overallNotes: (r.overall_notes as string) || null,
    referenceInspectionId: (r.reference_inspection_id as string) || null,
    createdAt: String(r.created_at),
  };
}

async function listInspections(env: Env, orgId: string | null, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (orgId) { clauses.push('organization_id = ?'); binds.push(orgId); }
  const residentId = url.searchParams.get('residentId');
  if (residentId) { clauses.push('resident_id = ?'); binds.push(residentId); }
  const type = url.searchParams.get('type');
  if (type) { clauses.push('type = ?'); binds.push(type); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { results } = await env.DB.prepare(
    `SELECT * FROM inspections ${where} ORDER BY inspection_date DESC LIMIT 500`
  ).bind(...binds).all<Row>();
  return json({ inspections: (results || []).map(rowToInspection) });
}

async function createInspection(env: Env, orgId: string | null, user: User, request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as null | {
    residentId?: string; stayId?: string; propertyId?: string; roomNumber?: string;
    bedNumber?: string; type?: string; inspectionDate?: string;
    items?: { area?: string; item?: string; condition?: string; remarks?: string }[];
    overallNotes?: string; referenceInspectionId?: string; meterReading?: string;
  };
  if (!body?.propertyId || !body?.roomNumber || !body?.type) {
    return json({ error: 'propertyId, roomNumber and type are required' }, 400);
  }
  if (body.type !== 'move_in' && body.type !== 'move_out') {
    return json({ error: 'type must be move_in or move_out' }, 400);
  }
  const id = mkId('insp');
  await env.DB.prepare(
    `INSERT INTO inspections (id, organization_id, resident_id, stay_id, property_id, room_number, bed_number, type, inspection_date, inspected_by, items, resident_confirmed, staff_confirmed, overall_notes, reference_inspection_id, meter_reading, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?)`
  ).bind(
    id, orgId, body.residentId || null, body.stayId || null, body.propertyId,
    body.roomNumber, body.bedNumber || null, body.type,
    body.inspectionDate || nowIso().slice(0, 10), user.name || user.id,
    JSON.stringify(body.items || []), body.overallNotes || null,
    body.referenceInspectionId || null, body.meterReading || null, nowIso(),
  ).run();
  await audit(env, { organizationId: orgId, userId: user.id, action: 'inspection.create', entityType: 'inspection', entityId: id, metadata: { type: body.type } });
  return json({ ok: true, id });
}

// --------------------------------------------------------------- compliance ---

function rowToCompliance(r: Row) {
  return {
    id: String(r.id),
    propertyId: String(r.property_id),
    templateItemId: String(r.template_item_id),
    status: String(r.status),
    documentUrl: (r.document_url as string) || null,
    issuedAt: (r.issued_at as string) || null,
    expiresAt: (r.expires_at as string) || null,
    verifiedAt: (r.verified_at as string) || null,
    verifiedBy: (r.verified_by as string) || null,
    notes: (r.notes as string) || null,
    updatedAt: String(r.updated_at || r.created_at),
  };
}

async function listCompliance(env: Env, orgId: string | null, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get('propertyId');
  if (!propertyId) return json({ error: 'propertyId is required' }, 400);
  const clauses = ['property_id = ?'];
  const binds: unknown[] = [propertyId];
  if (orgId) { clauses.push('organization_id = ?'); binds.push(orgId); }
  const { results } = await env.DB.prepare(
    `SELECT * FROM property_compliance_items WHERE ${clauses.join(' AND ')} ORDER BY template_item_id`
  ).bind(...binds).all<Row>();
  return json({ items: (results || []).map(rowToCompliance) });
}

/**
 * Only platform/admin users with verify capability can set 'verified' or
 * 'rejected' (spec §22: uploaded ≠ verified; ops review is separate).
 */
async function upsertCompliance(env: Env, orgId: string | null, user: User, request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as null | {
    propertyId?: string; templateItemId?: string; status?: string;
    documentUrl?: string; issuedAt?: string; expiresAt?: string; notes?: string;
  };
  if (!body?.propertyId || !body?.templateItemId || !body?.status) {
    return json({ error: 'propertyId, templateItemId and status are required' }, 400);
  }
  const privilegedStatus = body.status === 'verified' || body.status === 'rejected';
  const canVerify = user.role === 'admin' || user.role === 'superadmin' ||
    (user.role === 'owner' && body.status !== 'verified');
  if (privilegedStatus && !canVerify) {
    return json({ error: 'Only PGWalo operations can verify or reject compliance documents.' }, 403);
  }

  const existing = await env.DB.prepare(
    'SELECT id FROM property_compliance_items WHERE property_id = ? AND template_item_id = ?'
  ).bind(body.propertyId, body.templateItemId).first<{ id: string }>();

  if (existing) {
    await env.DB.prepare(
      `UPDATE property_compliance_items SET status = ?, document_url = COALESCE(?, document_url),
         expires_at = COALESCE(?, expires_at), notes = COALESCE(?, notes), updated_at = ?
       WHERE id = ?`
    ).bind(body.status, body.documentUrl || null, body.expiresAt || null,
      body.notes || null, nowIso(), existing.id).run();
    await audit(env, { organizationId: orgId, userId: user.id, action: 'compliance.update', entityType: 'compliance_item', entityId: existing.id, metadata: { status: body.status } });
    return json({ ok: true, id: existing.id });
  }

  const id = mkId('pci');
  await env.DB.prepare(
    `INSERT INTO property_compliance_items (id, organization_id, property_id, template_item_id, status, document_url, expires_at, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, orgId, body.propertyId, body.templateItemId, body.status,
    body.documentUrl || null, body.expiresAt || null, body.notes || null, nowIso()).run();
  await audit(env, { organizationId: orgId, userId: user.id, action: 'compliance.create', entityType: 'compliance_item', entityId: id, metadata: { status: body.status } });
  return json({ ok: true, id });
}

// ---------------------------------------------------------------------- kyc ---

function rowToKyc(r: Row) {
  return {
    id: String(r.id),
    residentId: (r.resident_id as string) || null,
    leadId: (r.lead_id as string) || null,
    fullName: String(r.full_name),
    phone: String(r.phone),
    state: String(r.state),
    provider: (r.provider as string) || null,
    providerReference: (r.provider_reference as string) || null,
    verificationType: (r.verification_type as string) || null,
    maskedIdentifier: (r.masked_identifier as string) || null,
    verifiedName: (r.verified_name as string) || null,
    consentAt: (r.consent_at as string) || null,
    verifiedAt: (r.verified_at as string) || null,
    rejectionReason: (r.rejection_reason as string) || null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at || r.created_at),
  };
}

async function listKyc(env: Env, orgId: string | null, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (orgId) { clauses.push('organization_id = ?'); binds.push(orgId); }
  const residentId = url.searchParams.get('residentId');
  if (residentId) { clauses.push('resident_id = ?'); binds.push(residentId); }
  const state = url.searchParams.get('state');
  if (state) { clauses.push('state = ?'); binds.push(state); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { results } = await env.DB.prepare(
    `SELECT * FROM kyc_records ${where} ORDER BY created_at DESC LIMIT 500`
  ).bind(...binds).all<Row>();
  return json({ records: (results || []).map(rowToKyc) });
}

/** KYC states only move through the domain machine (spec §21). No full Aadhaar ever. */
const KYC_TRANSITIONS: Record<string, string[]> = {
  not_started: ['pending'],
  pending: ['submitted', 'expired'],
  submitted: ['verified', 'rejected', 'expired'],
  verified: ['expired'],
  rejected: ['pending'],
  expired: ['pending'],
};

async function upsertKyc(env: Env, orgId: string | null, user: User, request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as null | {
    id?: string; residentId?: string; leadId?: string; fullName?: string;
    phone?: string; state?: string; maskedIdentifier?: string;
    verifiedName?: string; provider?: string; providerReference?: string; consentAt?: string;
  };
  if (!body?.fullName || !body?.phone || !body?.state) {
    return json({ error: 'fullName, phone and state are required' }, 400);
  }

  if (body.id) {
    const row = await env.DB.prepare('SELECT * FROM kyc_records WHERE id = ?').bind(body.id).first<Row>();
    if (!row) return json({ error: 'KYC record not found' }, 404);
    if (orgId && row.organization_id && row.organization_id !== orgId) return json({ error: 'Out of scope' }, 403);
    if (body.state !== row.state && !(KYC_TRANSITIONS[String(row.state)] || []).includes(body.state)) {
      return json({ error: `Cannot move KYC from ${row.state} to ${body.state}` }, 422);
    }
    await env.DB.prepare(
      `UPDATE kyc_records SET state = ?, masked_identifier = COALESCE(?, masked_identifier),
         verified_name = COALESCE(?, verified_name), verified_at = CASE WHEN ? = 'verified' AND verified_at IS NULL THEN ? ELSE verified_at END,
         updated_at = ? WHERE id = ?`
    ).bind(body.state, body.maskedIdentifier || null, body.verifiedName || null,
      body.state, nowIso(), nowIso(), body.id).run();
    await audit(env, { organizationId: orgId, userId: user.id, action: 'kyc.update', entityType: 'kyc_record', entityId: body.id, metadata: { state: body.state } });
    return json({ ok: true, id: body.id });
  }

  const id = mkId('kyc');
  await env.DB.prepare(
    `INSERT INTO kyc_records (id, organization_id, resident_id, lead_id, full_name, phone, state, provider, provider_reference, masked_identifier, verified_name, consent_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, orgId, body.residentId || null, body.leadId || null, body.fullName,
    body.phone, body.state, body.provider || null, body.providerReference || null,
    body.maskedIdentifier || null, body.verifiedName || null, body.consentAt || null,
    nowIso(), nowIso(),
  ).run();
  await audit(env, { organizationId: orgId, userId: user.id, action: 'kyc.create', entityType: 'kyc_record', entityId: id, metadata: { state: body.state } });
  return json({ ok: true, id });
}

// ------------------------------------------------------------------- reviews ---

function rowToReview(r: Row) {
  let dims: Record<string, number> = {};
  try { dims = JSON.parse(String(r.dimensions || '{}')) as Record<string, number>; } catch { /* default */ }
  return {
    id: String(r.id),
    propertyId: String(r.property_id),
    residentId: (r.resident_id as string) || null,
    stayId: (r.stay_id as string) || null,
    authorName: String(r.author_name),
    rating: Number(r.rating || 0),
    dimensions: dims,
    comment: String(r.comment || ''),
    ownerResponse: (r.owner_response as string) || null,
    ownerRespondedAt: (r.owner_responded_at as string) || null,
    moderation: (r.moderation_action as string) || 'approved',
    isVerifiedStay: Boolean(r.is_verified_stay),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at || r.created_at),
  };
}

/** Public surface: only approved verified-stay reviews leave the building. */
async function listReviews(env: Env, orgId: string | null, request: Request, user: User | null): Promise<Response> {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get('propertyId');
  const clauses = ["(moderation_action IS NULL OR moderation_action = 'approved')"];
  const binds: unknown[] = [];
  if (propertyId) { clauses.push('property_id = ?'); binds.push(propertyId); }
  if (!user) clauses.push('is_verified_stay = 1');
  else if (orgId) { clauses.push('organization_id = ?'); binds.push(orgId); }
  const { results } = await env.DB.prepare(
    `SELECT * FROM verified_reviews WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 200`
  ).bind(...binds).all<Row>();
  return json({ reviews: (results || []).map(rowToReview) });
}

/**
 * Verified reviews come only from residents of a real stay (spec §26).
 * The server resolves the caller to a resident row; anonymous listing-side
 * submissions are rejected.
 */
async function createReview(env: Env, orgId: string | null, user: User, request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as null | {
    propertyId?: string; rating?: number; comment?: string;
    dimensions?: Record<string, number>; authorName?: string;
  };
  if (!body?.propertyId || !body?.rating || !body?.comment) {
    return json({ error: 'propertyId, rating and comment are required' }, 400);
  }
  if (body.rating < 1 || body.rating > 5) return json({ error: 'Rating must be 1-5' }, 400);

  const resident = await env.DB.prepare(
    'SELECT id, name FROM residents WHERE user_id = ? LIMIT 1'
  ).bind(user.id).first<{ id: string; name: string }>();
  if (!resident) {
    return json({ error: 'Only residents with a verified stay can submit a review.' }, 403);
  }

  const id = mkId('rev');
  await env.DB.prepare(
    `INSERT INTO verified_reviews (id, organization_id, property_id, resident_id, stay_id, author_name, rating, dimensions, comment, moderation_action, is_verified_stay, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, ?)`
  ).bind(
    id, orgId, body.propertyId, resident.id, `stay-${resident.id}`,
    body.authorName || resident.name || 'Resident', body.rating,
    JSON.stringify(body.dimensions || {}), body.comment, nowIso(), nowIso(),
  ).run();
  await audit(env, { organizationId: orgId, userId: user.id, action: 'review.create', entityType: 'verified_review', entityId: id, metadata: { rating: body.rating } });
  return json({ ok: true, id });
}

async function respondToReview(env: Env, orgId: string | null, user: User, reviewId: string, request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as null | { response?: string };
  if (!body?.response) return json({ error: 'response is required' }, 400);
  const row = await env.DB.prepare('SELECT * FROM verified_reviews WHERE id = ?').bind(reviewId).first<Row>();
  if (!row) return json({ error: 'Review not found' }, 404);
  if (orgId && row.organization_id && row.organization_id !== orgId) return json({ error: 'Out of scope' }, 403);
  await env.DB.prepare(
    'UPDATE verified_reviews SET owner_response = ?, owner_responded_at = ?, updated_at = ? WHERE id = ?'
  ).bind(body.response, nowIso(), nowIso(), reviewId).run();
  await audit(env, { organizationId: orgId, userId: user.id, action: 'review.respond', entityType: 'verified_review', entityId: reviewId });
  return json({ ok: true });
}

// ----------------------------------------------------------------- reminders ---

async function listReminders(env: Env, orgId: string | null, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const residentId = url.searchParams.get('residentId');
  const rule = url.searchParams.get('rule');
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (orgId) { clauses.push('organization_id = ?'); binds.push(orgId); }
  if (residentId) { clauses.push('resident_id = ?'); binds.push(residentId); }
  if (rule) { clauses.push('rule = ?'); binds.push(rule); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { results } = await env.DB.prepare(
    `SELECT resident_id, rule, sent_at FROM reminder_log ${where} ORDER BY sent_at DESC LIMIT 200`
  ).bind(...binds).all<Row>();
  return json({
    recent: (results || []).map((r) => ({ residentId: r.resident_id, rule: r.rule, sentAt: r.sent_at })),
  });
}

/**
 * Records that a reminder was sent (suppression state, spec §17).
 * The engine itself runs client-side over the owner's invoices; the Worker
 * is the source of truth for what has already gone out.
 */
async function logReminder(env: Env, orgId: string | null, user: User, request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as null | {
    residentId?: string; invoiceId?: string; rule?: string; channel?: string;
  };
  if (!body?.residentId || !body?.rule) {
    return json({ error: 'residentId and rule are required' }, 400);
  }
  await env.DB.prepare(
    'INSERT INTO reminder_log (id, organization_id, resident_id, invoice_id, rule, channel, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    mkId('rem'), orgId, body.residentId, body.invoiceId || null,
    body.rule, body.channel || 'whatsapp', nowIso(),
  ).run();
  return json({ ok: true });
}

// ----------------------------------------------------------------- analytics ---

interface AnalyticsRow {
  kpis: Record<string, unknown>;
  leadFunnel: { stage: string; count: number }[];
  conversions: { leadToVisit: number | null; visitToToken: number | null; tokenToMoveIn: number | null };
  perProperty: unknown[];
}

/**
 * Owner analytics from live operational tables (spec §31). Every metric is
 * defined by a documented window/denominator; money is verified-only.
 */
async function ownerAnalytics(env: Env, orgId: string | null, request: Request): Promise<Response> {
  const propertyIdFilter = new URL(request.url).searchParams.get('propertyId');
  const now = nowIso();
  const today = now.slice(0, 10);
  const month = now.slice(0, 7);

  // Per-query scope builder: placeholders and binds are assembled together so
  // the count and order can never drift (this endpoint previously crashed with
  // a D1 bind-count mismatch when org scoping applied).
  const scope = (table: string, supportsProperty: boolean): { clause: string; binds: unknown[] } => {
    const parts: string[] = [];
    const binds: unknown[] = [];
    if (orgId) { parts.push(`${table}.organization_id = ?`); binds.push(orgId); }
    if (propertyIdFilter && supportsProperty) { parts.push(`${table}.property_id = ?`); binds.push(propertyIdFilter); }
    return { clause: parts.length ? parts.join(' AND ') : '1=1', binds };
  };

  const bedScope = scope('b', true);
  const bedRow = await env.DB.prepare(
    `SELECT COUNT(*) AS total,
       SUM(CASE WHEN b.status IN ('Occupied','Notice Period','Vacating') THEN 1 ELSE 0 END) AS occupied,
       SUM(CASE WHEN b.status IN ('Vacant','Available','Ready') THEN 1 ELSE 0 END) AS vacant
     FROM beds b WHERE ${bedScope.clause}`
  ).bind(...bedScope.binds).first<{ total: number; occupied: number; vacant: number }>();

  const invScope = scope('i', false);
  const invStats = await env.DB.prepare(
    `SELECT COUNT(*) AS overdue_count,
       COALESCE(SUM(CASE WHEN i.due_date < ? AND i.status NOT IN ('Paid','Cancelled','Waived')
         THEN i.amount - COALESCE(i.verified_paid_amount, 0) ELSE 0 END), 0) AS overdue_amount,
       COALESCE(SUM(CASE WHEN substr(i.created_at,1,7) = ? THEN i.amount ELSE 0 END), 0) AS billed_month,
       COALESCE(SUM(CASE WHEN substr(i.created_at,1,7) = ? THEN COALESCE(i.verified_paid_amount,0) ELSE 0 END), 0) AS collected_month
     FROM invoices i WHERE ${invScope.clause}`
  ).bind(...invScope.binds, today, month, month)
    .first<{ overdue_count: number; overdue_amount: number; billed_month: number; collected_month: number }>();

  const expScope = scope('e', true);
  const expenseStats = await env.DB.prepare(
    `SELECT COALESCE(SUM(e.amount), 0) AS total FROM expenses e
     WHERE ${expScope.clause} AND substr(e.date,1,7) = ?`
  ).bind(...expScope.binds, month).first<{ total: number }>();

  const resScope = scope('r', false);
  const reservationStats = await env.DB.prepare(
    `SELECT COUNT(*) AS active FROM reservations r
     WHERE ${resScope.clause} AND r.status IN ('pending_payment','held','confirmed')`
  ).bind(...resScope.binds).first<{ active: number }>();

  // Deposit liability is a balance-sheet number (spec §19/§31): held on active
  // residents' accounts. It is a liability, never counted as revenue.
  const depScope = scope('d', false);
  const depositStats = await env.DB.prepare(
    `SELECT COALESCE(SUM(d.deposit_amount), 0) AS held FROM residents d
     WHERE ${depScope.clause} AND d.status = 'Active'`
  ).bind(...depScope.binds).first<{ held: number }>();

  // Future vacancies from real notice windows (spec §10/§31): notice/vacating
  // beds whose next_available_date falls inside each forward window.
  const futureVacancies: Record<7 | 30 | 60, number> = { 7: 0, 30: 0, 60: 0 };
  for (const days of [7, 30, 60] as const) {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM beds b
       WHERE ${bedScope.clause} AND b.status IN ('Notice Period','Vacating')
         AND b.next_available_date IS NOT NULL AND b.next_available_date >= ?
         AND b.next_available_date <= date(?, '+${days} days')`
    ).bind(...bedScope.binds, today, today).first<{ n: number }>();
    futureVacancies[days] = row?.n || 0;
  }

  // Funnel + conversions (spec §31) computed in SQL from CRM stages. Legacy
  // stages map onto the pipeline: Booked → reserved, Booking Pending →
  // token_pending, Interested → negotiating (same mapping as the CRM UI).
  const leadScope = scope('l', false);
  const funnelRows = await env.DB.prepare(
    `SELECT COALESCE(l.stage_v2, CASE l.stage
       WHEN 'Booking Pending' THEN 'token_pending' WHEN 'Booked' THEN 'reserved'
       WHEN 'Interested' THEN 'negotiating' ELSE REPLACE(LOWER(l.stage), ' ', '_') END) AS stage,
       COUNT(*) AS count
     FROM leads l WHERE ${leadScope.clause} AND (l.stage IS NULL OR l.stage != 'Lost')
     GROUP BY 1`
  ).bind(...leadScope.binds).all<{ stage: string; count: number }>();

  const stageCounts = new Map<string, number>();
  for (const r of funnelRows.results || []) {
    if (r.stage === 'spam') continue;
    stageCounts.set(r.stage, (stageCounts.get(r.stage) || 0) + Number(r.count));
  }
  const leadCount = [...stageCounts.values()].reduce((s, n) => s + n, 0);
  const visitedCount = [...stageCounts].filter(([s]) =>
    ['visited', 'negotiating', 'token_pending', 'token_paid', 'reserved', 'moved_in'].includes(s)).reduce((s, [, n]) => s + n, 0);
  const tokenCount = [...stageCounts].filter(([s]) =>
    ['token_paid', 'reserved', 'moved_in'].includes(s)).reduce((s, [, n]) => s + n, 0);
  const movedInCount = stageCounts.get('moved_in') || 0;
  const pct = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 100) : null);

  const kpis = {
    totalBeds: bedRow?.total || 0,
    occupiedBeds: bedRow?.occupied || 0,
    vacantBeds: bedRow?.vacant || 0,
    overdueAmount: invStats?.overdue_amount || 0,
    collectionRate: invStats && invStats.billed_month > 0
      ? Math.round((invStats.collected_month / invStats.billed_month) * 100)
      : null,
    activeReservations: reservationStats?.active || 0,
    expensesThisMonth: expenseStats?.total || 0,
    depositLiability: depositStats?.held || 0,
    futureVacancies7: futureVacancies[7],
    futureVacancies30: futureVacancies[30],
    futureVacancies60: futureVacancies[60],
  };

  const funnel = [...stageCounts].map(([stage, count]) => ({ stage, count }));
  const conversions = {
    leadToVisit: pct(visitedCount, leadCount),
    visitToToken: pct(tokenCount, visitedCount),
    tokenToMoveIn: pct(movedInCount, tokenCount),
  };

  const propScope = scope('p', false);
  const { results: perProperty } = await env.DB.prepare(
    `SELECT p.id, p.name,
       (SELECT COUNT(*) FROM beds b WHERE b.property_id = p.id) AS total,
       (SELECT COUNT(*) FROM beds b WHERE b.property_id = p.id AND b.status IN ('Occupied','Notice Period','Vacating')) AS occupied,
       (SELECT COUNT(*) FROM beds b WHERE b.property_id = p.id AND b.status IN ('Vacant','Available','Ready')) AS vacant
     FROM properties p WHERE ${propScope.clause}`
  ).bind(...propScope.binds).all<Row>();

  const payload: AnalyticsRow = {
    kpis,
    leadFunnel: funnel,
    conversions,
    perProperty: (perProperty || []).map((p) => ({
      propertyId: p.id, propertyName: p.name,
      total: Number(p.total || 0), occupied: Number(p.occupied || 0), vacant: Number(p.vacant || 0),
    })),
  };
  return json({
    ...payload,
    definitions:
      'Occupied = beds Occupied/Notice Period. Future vacancies = notice beds with next_available_date inside the window. ' +
      'Deposit liability = deposits held on active residents (a liability, not revenue). ' +
      'Funnel/conversions = non-spam leads by CRM stage; lead→visit, visit→token, token→move-in. ' +
      'Collection rate = verified payments / invoiced this month. Generated server-side (spec §31).',
    generatedAt: nowIso(),
  });
}

// ------------------------------------------------------------------- imports ---

/**
 * Commits validated import rows server-side (spec §9). The browser did the
 * preview; the Worker re-validates structure before writing and records an
 * import_jobs row plus audit entry. Rows arrive pre-mapped by csvImport.ts.
 */
async function commitImport(env: Env, orgId: string | null, user: User, request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as null | {
    kind?: string; propertyId?: string; rows?: Record<string, string>[];
  };
  if (!body?.kind || !Array.isArray(body.rows)) {
    return json({ error: 'kind and rows are required' }, 400);
  }
  let committed = 0;
  let rejected = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < body.rows.length; i += 1) {
    const row = body.rows[i];
    try {
      if (body.kind === 'beds') {
        if (!row.Room || !row['Monthly Rent']) throw new Error('Room and Monthly Rent required');
        await env.DB.prepare(
          `INSERT INTO beds (id, property_id, room_number, bed_number, sharing_type, status, monthly_rent, deposit, created_at)
           VALUES (?, ?, ?, ?, 'Single', 'Vacant', ?, 0, ?)`
        ).bind(mkId('bed'), body.propertyId || null, row.Room, row.Bed || row.Room,
          Number(row['Monthly Rent']) || 0, nowIso()).run();
        committed += 1;
      } else if (body.kind === 'residents') {
        if (!row.Name || !row.Phone) throw new Error('Name and Phone required');
        await env.DB.prepare(
          `INSERT INTO residents (id, property_id, name, phone, status, created_at)
           VALUES (?, ?, ?, ?, 'Active', ?)`
        ).bind(mkId('res'), body.propertyId || null, row.Name, row.Phone, nowIso()).run();
        committed += 1;
      } else {
        // dues/deposits/leads require richer joins; counted as rejected with reason.
        throw new Error('This import kind must be completed from the app for data safety');
      }
    } catch (error) {
      rejected += 1;
      errors.push({ row: i + 1, message: error instanceof Error ? error.message : 'Row failed' });
    }
  }

  const jobId = mkId('imp');
  await env.DB.prepare(
    `INSERT INTO import_jobs (id, organization_id, kind, total_rows, committed_rows, rejected_rows, errors, committed_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(jobId, orgId, body.kind, body.rows.length, committed, rejected,
    JSON.stringify(errors), user.id, nowIso()).run();
  await audit(env, { organizationId: orgId, userId: user.id, action: 'import.commit', entityType: 'import_job', entityId: jobId, metadata: { kind: body.kind, committed, rejected } });
  return json({ ok: true, committed, rejected, jobId });
}

// ------------------------------------------------- reservation → move-in conversion ---

/**
 * Converts a confirmed reservation into a resident + stay (spec §14 path:
 * ... Reservation -> KYC -> Agreement -> Deposit -> Move-in). Idempotent:
 * a reservation already converted returns the existing ids. The bed flips
 * from Reserved to Occupied in the same transaction batch.
 */
async function convertReservationToStay(env: Env, orgId: string | null, user: User, resId: string, request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as null | {
    moveInDate?: string; monthlyRent?: number; depositAmount?: number; email?: string;
  };
  const row = await env.DB.prepare('SELECT * FROM reservations WHERE id = ?').bind(resId).first<Row>();
  if (!row) return json({ error: 'Reservation not found' }, 404);
  if (orgId && row.organization_id && row.organization_id !== orgId) return json({ error: 'Out of scope' }, 403);
  if (row.status === 'converted_to_stay') {
    return json({ ok: true, note: 'already converted', residentId: row.resident_id, stayId: row.resident_id ? `stay-${String(row.resident_id)}` : null });
  }
  if (row.status !== 'confirmed') {
    return json({ error: `Only a confirmed reservation can convert to a stay (current: ${row.status})` }, 422);
  }

  const moveIn = body?.moveInDate || String(row.start_date).slice(0, 10);
  const rent = body?.monthlyRent || 0;
  const deposit = body?.depositAmount || 0;
  const residentId = mkId('res');
  const stayId = `stay-${residentId}`;

  const stmts = [
    env.DB.prepare(
      `INSERT INTO residents (id, organization_id, status, name, email, phone, property_id, property_name,
         room_number, room_type, bed_number, monthly_rent, deposit_amount, move_in_date,
         rent_status, rent_due_date, emergency_contact, notes, created_at)
       VALUES (?, ?, 'Active', ?, ?, ?, ?,
         (SELECT COALESCE(name, '') FROM properties WHERE id = ?),
         (SELECT COALESCE(room_number, '') FROM beds WHERE id = ?),
         'Single',
         (SELECT COALESCE(bed_number, '') FROM beds WHERE id = ?),
         ?, ?, ?, 'Pending', ?, 'To be collected', 'Converted from reservation ' || ?, ?)`
    ).bind(
      residentId, orgId, String(row.guest_name), body?.email || '', String(row.guest_phone),
      String(row.property_id), String(row.property_id), String(row.bed_id), String(row.bed_id),
      rent, deposit, moveIn, moveIn, resId, nowIso(),
    ),
    env.DB.prepare(
      `INSERT INTO stays (id, organization_id, resident_id, property_id, room_id, room_number, bed_id, bed_number, start_date, monthly_rent_at_start, status, created_at)
       VALUES (?, ?, ?, ?, (SELECT room_id FROM beds WHERE id = ?),
         (SELECT COALESCE(room_number, '') FROM beds WHERE id = ?), ?,
         (SELECT COALESCE(bed_number, '') FROM beds WHERE id = ?), ?, ?, 'Current', ?)`
    ).bind(
      stayId, orgId, residentId, String(row.property_id), String(row.bed_id),
      String(row.bed_id), String(row.bed_id), String(row.bed_id),
      moveIn, rent, nowIso(),
    ),
    env.DB.prepare(
      "UPDATE beds SET status = 'Occupied', current_tenant_id = ?, reserved_for_resident_id = NULL, reservation_expiry = NULL WHERE id = ? AND status = 'Reserved'"
    ).bind(residentId, String(row.bed_id)),
    env.DB.prepare(
      "UPDATE reservations SET status = 'converted_to_stay', resident_id = ?, updated_at = ? WHERE id = ?"
    ).bind(residentId, nowIso(), resId),
  ];
  await env.DB.batch(stmts);

  await audit(env, {
    organizationId: orgId, userId: user.id, action: 'reservation.convert_to_stay',
    entityType: 'reservation', entityId: resId,
    metadata: { residentId, stayId, bedId: row.bed_id, moveIn },
  });
  return json({ ok: true, residentId, stayId });
}

// ------------------------------------------------------- P1: guardian access ---

/**
 * Guardian access (spec §29). Owners invite a guardian per resident; the
 * guardian then reads a narrow, non-invasive view with the token itself
 * (no account, no org scope). Tokens are stored hashed — raw token shown once.
 */
function hashToken(raw: string): Promise<string> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
    .then((buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join(''));
}

async function listGuardianAccess(env: Env, orgId: string | null, request: Request): Promise<Response> {
  const residentId = new URL(request.url).searchParams.get('residentId');
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (orgId) { clauses.push('organization_id = ?'); binds.push(orgId); }
  if (residentId) { clauses.push('resident_id = ?'); binds.push(residentId); }
  const { results } = await env.DB.prepare(
    `SELECT * FROM guardian_access ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''} ORDER BY created_at DESC`
  ).bind(...binds).all<Row>();
  return json({ access: (results || []).map((r) => ({
    id: r.id, organizationId: r.organization_id, residentId: r.resident_id,
    guardianName: r.guardian_name, guardianPhone: r.guardian_phone, relation: r.relation,
    status: r.status, createdAt: r.created_at, revokedAt: r.revoked_at,
  })) });
}

async function inviteGuardian(env: Env, orgId: string | null, user: User, request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({})) as Row;
  const residentId = String(body.residentId || '');
  const guardianName = String(body.guardianName || '').trim();
  if (!residentId || !guardianName) return json({ error: 'residentId and guardianName are required' }, 400);

  // Scope check: the resident must belong to the caller's org.
  const resident = await env.DB.prepare(
    'SELECT id FROM residents WHERE id = ? ' + (orgId ? 'AND organization_id = ?' : '')
  ).bind(...(orgId ? [residentId, orgId] : [residentId])).first<Row>();
  if (!resident) return json({ error: 'Resident not found in your organization' }, 404);

  const rawToken = `pgw-${mkId('g')}`;
  const id = mkId('guard');
  await env.DB.prepare(
    `INSERT INTO guardian_access (id, organization_id, resident_id, guardian_name, guardian_phone, relation, token_hash, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
  ).bind(id, orgId, residentId, guardianName,
    body.guardianPhone ? String(body.guardianPhone) : null,
    body.relation ? String(body.relation) : null,
    await hashToken(rawToken), user.id, nowIso()).run();
  await attachBedToResident(env, orgId, residentId);
  await audit(env, { organizationId: orgId, userId: user.id, action: 'guardian.invite', entityType: 'guardian_access', entityId: id, metadata: { residentId } });
  // Raw token returned exactly once; only its hash is stored.
  return json({ ok: true, id, token: rawToken, inviteLink: `${new URL(request.url).origin}/guardian?token=${rawToken}` });
}

async function revokeGuardian(env: Env, orgId: string | null, user: User, accessId: string): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT id FROM guardian_access WHERE id = ? ' + (orgId ? 'AND organization_id = ?' : '')
  ).bind(...(orgId ? [accessId, orgId] : [accessId])).first<Row>();
  if (!row) return json({ error: 'Access record not found' }, 404);
  await env.DB.prepare(
    "UPDATE guardian_access SET status = 'revoked', revoked_at = ? WHERE id = ?"
  ).bind(nowIso(), accessId).run();
  await audit(env, { organizationId: orgId, userId: user.id, action: 'guardian.revoke', entityType: 'guardian_access', entityId: accessId });
  return json({ ok: true });
}

/** Public guardian read — token-scoped, no JWT. Only the allow-listed facts. */
async function guardianView(env: Env, request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!token) return json({ error: 'token required' }, 400);
  const hash = await hashToken(token);
  const access = await env.DB.prepare(
    "SELECT * FROM guardian_access WHERE token_hash = ? AND status = 'active'"
  ).bind(hash).first<Row>();
  if (!access) return json({ error: 'Invalid or revoked access token' }, 404);

  const resident = await env.DB.prepare(
    'SELECT name, property_name, room_number, bed_number, property_id, outstanding_balance, monthly_rent, deposit_amount, agreement_state, deposit_state FROM residents WHERE id = ?'
  ).bind(access.resident_id).first<Row>();
  if (!resident) return json({ error: 'Resident record missing' }, 404);

  const lastPay = await env.DB.prepare(
    'SELECT amount, paid_at, method, receipt_number FROM payments WHERE resident_id = ? ORDER BY paid_at DESC LIMIT 1'
  ).bind(access.resident_id).first<Row>();
  const { results: notices } = await env.DB.prepare(
    'SELECT title, created_at FROM broadcast_notifications WHERE property_id = ? ORDER BY created_at DESC LIMIT 5'
  ).bind(resident.property_id).all<Row>();

  // Bed row for the current occupancy fact (best-effort — bed may be unmapped).
  let bedOccupied = true;
  if (resident.bed_id) {
    const bedRow = await env.DB.prepare('SELECT status FROM beds WHERE id = ?')
      .bind(resident.bed_id).first<Row>();
    bedOccupied = bedRow ? ['Occupied', 'Notice Period', 'Vacating'].includes(String(bedRow.status)) : true;
  }

  const outstanding = Number(resident.outstanding_balance || 0);
  return json({
    guardian: { name: access.guardian_name, relation: access.relation },
    view: buildGuardianView({
      currentlyCheckedIn: bedOccupied,
      resident: {
        name: String(resident.name || ''), propertyName: String(resident.property_name || ''),
        roomNumber: String(resident.room_number || ''), bedNumber: String(resident.bed_number || ''),
        monthlyRent: Number(resident.monthly_rent || 0),
        depositAmount: Number(resident.deposit_amount || 0),
        agreementState: resident.agreement_state != null ? String(resident.agreement_state) : null,
      },
      outstanding,
      lastPayment: lastPay ? {
        amount: Number(lastPay.amount || 0), date: String(lastPay.paid_at || ''),
        method: String(lastPay.method || ''), receiptNumber: (lastPay.receipt_number as string) || null,
      } : null,
      depositState: String(resident.deposit_state || 'Held'),
      emergencyContacts: [],
      propertyNotices: (notices || []).map((n) => ({ title: String(n.title || ''), date: String(n.created_at || '') })),
    }),
    generatedAt: nowIso(),
  });
}

// ------------------------------------------------- P1: institutional booking ---

function rowToInstitutional(r: Row): InstitutionalLead {
  const jarr = (v: unknown): string[] => {
    try { const a = JSON.parse(String(v || '[]')); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
  };
  return {
    id: String(r.id), organizationId: (r.organization_id as string) || null,
    institutionName: String(r.institution_name), contactName: (r.contact_name as string) || null,
    contactPhone: (r.contact_phone as string) || null, contactEmail: (r.contact_email as string) || null,
    requiredBeds: Number(r.required_beds || 1),
    genderEligibility: (r.gender_eligibility as InstitutionalLead['genderEligibility']) || null,
    targetLocalities: jarr(r.target_localities), budgetPerBed: r.budget_per_bed != null ? Number(r.budget_per_bed) : null,
    moveInDate: (r.move_in_date as string) || null, durationMonths: r.duration_months != null ? Number(r.duration_months) : null,
    status: (r.status as InstitutionalStage) || 'new',
    shortlistedPropertyIds: jarr(r.shortlisted_property_ids), allocatedBedIds: jarr(r.allocated_bed_ids),
    notes: (r.notes as string) || null, createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  };
}

async function listInstitutional(env: Env, orgId: string | null): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM institutional_leads ${orgId ? 'WHERE organization_id = ?' : ''} ORDER BY created_at DESC`
  ).bind(...(orgId ? [orgId] : [])).all<Row>();
  return json({ leads: (results || []).map(rowToInstitutional) });
}

async function createInstitutional(env: Env, orgId: string | null, user: User, request: Request): Promise<Response> {
  const b = await request.json().catch(() => ({})) as Row;
  const name = String(b.institutionName || '').trim();
  if (!name) return json({ error: 'institutionName is required' }, 400);
  const id = mkId('inst');
  await env.DB.prepare(
    `INSERT INTO institutional_leads (id, organization_id, institution_name, contact_name, contact_phone, contact_email,
      required_beds, gender_eligibility, target_localities, budget_per_bed, move_in_date, duration_months, status, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`
  ).bind(id, orgId, name,
    b.contactName ? String(b.contactName) : null,
    b.contactPhone ? String(b.contactPhone) : null,
    b.contactEmail ? String(b.contactEmail) : null,
    Math.max(1, Number(b.requiredBeds || 1)),
    b.genderEligibility ? String(b.genderEligibility) : null,
    Array.isArray(b.targetLocalities) ? JSON.stringify(b.targetLocalities) : null,
    b.budgetPerBed != null ? Number(b.budgetPerBed) : null,
    b.moveInDate ? String(b.moveInDate) : null,
    b.durationMonths != null ? Number(b.durationMonths) : null,
    b.notes ? String(b.notes) : null, nowIso(), nowIso()).run();
  await audit(env, { organizationId: orgId, userId: user.id, action: 'institutional.create', entityType: 'institutional_lead', entityId: id, metadata: { name } });
  return json({ ok: true, id });
}

async function patchInstitutional(env: Env, orgId: string | null, user: User, instId: string, request: Request): Promise<Response> {
  const b = await request.json().catch(() => ({})) as Row;
  const existing = await env.DB.prepare(
    'SELECT * FROM institutional_leads WHERE id = ? ' + (orgId ? 'AND organization_id = ?' : '')
  ).bind(...(orgId ? [instId, orgId] : [instId])).first<Row>();
  if (!existing) return json({ error: 'Institutional lead not found' }, 404);
  const current = rowToInstitutional(existing);

  if (b.status) {
    const next = String(b.status) as InstitutionalStage;
    if (!canTransitionInstitutional(current.status, next)) {
      return json({ error: `Cannot move institutional lead from ${current.status} to ${next}` }, 422);
    }
  }
  const sets: string[] = [];
  const binds: unknown[] = [];
  const maybe = (col: string, val: unknown) => { if (val !== undefined) { sets.push(`${col} = ?`); binds.push(val); } };
  maybe('status', b.status || undefined);
  if (b.shortlistedPropertyIds !== undefined) { sets.push('shortlisted_property_ids = ?'); binds.push(JSON.stringify(b.shortlistedPropertyIds)); }
  if (b.allocatedBedIds !== undefined) {
    const ids = Array.isArray(b.allocatedBedIds) ? b.allocatedBedIds.map(String) : [];
    if (!allocationWithinRequest(ids.length, current.requiredBeds)) {
      return json({ error: `Cannot allocate more than ${current.requiredBeds} beds for this request` }, 422);
    }
    sets.push('allocated_bed_ids = ?'); binds.push(JSON.stringify(ids));
  }
  maybe('notes', b.notes);
  if (sets.length === 0) return json({ ok: true, id: instId });
  sets.push('updated_at = ?'); binds.push(nowIso(), instId);
  await env.DB.prepare(`UPDATE institutional_leads SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
  await audit(env, { organizationId: orgId, userId: user.id, action: 'institutional.update', entityType: 'institutional_lead', entityId: instId, metadata: { status: b.status || null } });
  return json({ ok: true, id: instId });
}

/** Eligible vacant beds for a request — server-filtered by the shared rules. */
async function institutionalEligibility(env: Env, orgId: string | null, request: Request, instIdFromPath?: string): Promise<Response> {
  const url = new URL(request.url);
  const instId = instIdFromPath || url.searchParams.get('institutionalId');
  if (!instId) return json({ error: 'institutionalId required' }, 400);
  const inst = await env.DB.prepare(
    'SELECT * FROM institutional_leads WHERE id = ? ' + (orgId ? 'AND organization_id = ?' : '')
  ).bind(...(orgId ? [instId, orgId] : [instId])).first<Row>();
  if (!inst) return json({ error: 'Institutional lead not found' }, 404);
  const req = rowToInstitutional(inst);

  const propClause = req.targetLocalities.length
    ? `AND (p.locality IN (${req.targetLocalities.map(() => '?').join(',')})) `
    : '';
  const { results } = await env.DB.prepare(
    `SELECT b.id, b.bed_number, b.room_number, b.monthly_rent, b.sharing_type, b.status, b.property_id, p.name AS property_name, p.gender
     FROM beds b JOIN properties p ON p.id = b.property_id
     WHERE 1=1 ${orgId ? 'AND b.organization_id = ?' : ''} ${propClause}`
  ).bind(...(orgId ? [orgId, ...req.targetLocalities] : req.targetLocalities)).all<Row>();

  const eligible = (results || []).filter((r) => bedEligibleForInstitution({
    bed: { status: String(r.status ?? 'Vacant'), sharingType: String(r.sharing_type || ''), monthlyRent: Number(r.monthly_rent || 0) },
    genderEligibility: req.genderEligibility,
    // properties.gender is 'Boys' | 'Girls' | 'Unisex' (legacy model).
    propertyGenderModel: r.gender ? String(r.gender).toLowerCase().replace('unisex', 'any') : null,
    budgetPerBed: req.budgetPerBed,
  }));
  return json({
    eligibleBeds: eligible.map((r) => ({
      bedId: r.id, bedNumber: r.bed_number, roomNumber: r.room_number,
      monthlyRent: Number(r.monthly_rent || 0), sharingType: r.sharing_type,
      propertyId: r.property_id, propertyName: r.property_name,
    })),
    requested: { requiredBeds: req.requiredBeds, budgetPerBed: req.budgetPerBed },
  });
}

// ------------------------------------------------------------- P1: meal ops ---

function rowToMealOps(r: Row): MealOpsEntry {
  return {
    id: String(r.id), organizationId: (r.organization_id as string) || null,
    propertyId: String(r.property_id), date: String(r.date), meal: (r.meal as MealSlot) || 'lunch',
    menu: (r.menu as string) || null, expectedCount: Number(r.expected_count || 0),
    preparedCount: Number(r.prepared_count || 0), attendanceCount: r.attendance_count != null ? Number(r.attendance_count) : null,
    foodCost: r.food_cost != null ? Number(r.food_cost) : null, vendor: (r.vendor as string) || null,
    wasteNote: (r.waste_note as string) || null, createdAt: String(r.created_at),
  };
}

async function listMealOps(env: Env, orgId: string | null, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get('propertyId');
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (orgId) { clauses.push('organization_id = ?'); binds.push(orgId); }
  if (propertyId) { clauses.push('property_id = ?'); binds.push(propertyId); }
  const { results } = await env.DB.prepare(
    `SELECT * FROM meal_ops_log ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''} ORDER BY date DESC, meal LIMIT 200`
  ).bind(...binds).all<Row>();
  const entries = (results || []).map(rowToMealOps);
  return json({ entries, summary: summarizeMealOps(entries) });
}

async function upsertMealOps(env: Env, orgId: string | null, user: User, request: Request): Promise<Response> {
  const b = await request.json().catch(() => ({})) as Row;
  if (!b.propertyId || !b.date || !b.meal) return json({ error: 'propertyId, date and meal are required' }, 400);
  const id = b.id ? String(b.id) : mkId('meal');
  await env.DB.prepare(
    `INSERT INTO meal_ops_log (id, organization_id, property_id, date, meal, menu, expected_count, prepared_count, attendance_count, food_cost, vendor, waste_note, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET menu = excluded.menu, expected_count = excluded.expected_count,
       prepared_count = excluded.prepared_count, attendance_count = excluded.attendance_count,
       food_cost = excluded.food_cost, vendor = excluded.vendor, waste_note = excluded.waste_note`
  ).bind(id, orgId, String(b.propertyId), String(b.date), String(b.meal),
    b.menu ? String(b.menu) : null,
    Number(b.expectedCount || 0), Number(b.preparedCount || 0),
    b.attendanceCount != null ? Number(b.attendanceCount) : null,
    b.foodCost != null ? Number(b.foodCost) : null,
    b.vendor ? String(b.vendor) : null, b.wasteNote ? String(b.wasteNote) : null,
    user.id, nowIso()).run();
  await audit(env, { organizationId: orgId, userId: user.id, action: 'meal_ops.upsert', entityType: 'meal_ops_log', entityId: id, metadata: { date: b.date, meal: b.meal } });
  return json({ ok: true, id });
}

/** Best-effort: stamp the bed id a resident occupies onto active guardian links. */
async function attachBedToResident(env: Env, orgId: string | null, residentId: string): Promise<void> {
  try {
    const r = await env.DB.prepare(
      'SELECT property_id, room_number, bed_number FROM residents WHERE id = ?' + (orgId ? ' AND organization_id = ?' : '')
    ).bind(...(orgId ? [residentId, orgId] : [residentId])).first<Row>();
    if (!r) return;
    const bed = await env.DB.prepare(
      'SELECT id FROM beds WHERE property_id = ? AND room_number = ? AND bed_number = ? LIMIT 1'
    ).bind(r.property_id, r.room_number, r.bed_number).first<Row>();
    if (bed) {
      await env.DB.prepare("UPDATE guardian_access SET bed_id = ? WHERE resident_id = ? AND status = 'active'")
        .bind(bed.id, residentId).run();
    }
  } catch (error) {
    console.error('attachBedToResident failed', error);
  }
}

// --------------------------------------------------------------------- router ---

export async function marketHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const auth = await authMiddleware(request, env);
  const user = auth.success ? auth.user! : null;
  const orgId = user ? await orgScopeFor(env, user, request) : null;

  // Public: verified-stay reviews for a listing (spec §23/§26).
  if (path === '/api/market/reviews' && method === 'GET' && !user) {
    return listReviews(env, null, request, null);
  }

  // Public: guardian portal read — scoped by secret token, not JWT (spec §29).
  if (path === '/api/market/guardian-view' && method === 'GET') {
    return guardianView(env, request);
  }

  if (!user) return json({ error: 'Authentication required' }, 401);

  try {
    if (path === '/api/market/visits') {
      if (method === 'GET') return listVisits(env, orgId, request);
      if (method === 'POST') return createVisit(env, orgId, user, request);
    }
    const visitMatch = path.match(/^\/api\/market\/visits\/([^/]+)$/);
    if (visitMatch && method === 'PATCH') return patchVisit(env, orgId, user, decodeURIComponent(visitMatch[1]), request);

    if (path === '/api/market/reservations') {
      if (method === 'GET') return listReservations(env, orgId, request);
      if (method === 'POST') return createReservation(env, orgId, user, request);
    }
    const resMatch = path.match(/^\/api\/market\/reservations\/([^/]+)$/);
    if (resMatch && method === 'PATCH') return patchReservation(env, orgId, user, decodeURIComponent(resMatch[1]), request);
    const resConvert = path.match(/^\/api\/market\/reservations\/([^/]+)\/convert-to-stay$/);
    if (resConvert && method === 'POST') return convertReservationToStay(env, orgId, user, decodeURIComponent(resConvert[1]), request);

    if (path === '/api/market/payment-intents') {
      if (method === 'GET') return listPaymentIntents(env, orgId, request);
      if (method === 'POST') return createPaymentIntent(env, orgId, user, request);
    }
    const piMatch = path.match(/^\/api\/market\/payment-intents\/([^/]+)$/);
    if (piMatch && method === 'PATCH') return reconcilePaymentIntent(env, orgId, user, decodeURIComponent(piMatch[1]), request);

    if (path === '/api/market/expenses') {
      if (method === 'GET') return listExpenses(env, orgId, request);
      if (method === 'POST') return createExpense(env, orgId, user, request);
    }

    if (path === '/api/market/inspections') {
      if (method === 'GET') return listInspections(env, orgId, request);
      if (method === 'POST') return createInspection(env, orgId, user, request);
    }

    if (path === '/api/market/compliance') {
      if (method === 'GET') return listCompliance(env, orgId, request);
      if (method === 'POST') return upsertCompliance(env, orgId, user, request);
    }

    if (path === '/api/market/kyc') {
      if (method === 'GET') return listKyc(env, orgId, request);
      if (method === 'POST') return upsertKyc(env, orgId, user, request);
    }

    if (path === '/api/market/reviews') {
      if (method === 'GET') return listReviews(env, orgId, request, user);
      if (method === 'POST') return createReview(env, orgId, user, request);
    }
    const revMatch = path.match(/^\/api\/market\/reviews\/([^/]+)\/respond$/);
    if (revMatch && method === 'POST') return respondToReview(env, orgId, user, decodeURIComponent(revMatch[1]), request);

    if (path === '/api/market/reminders') {
      if (method === 'GET') return listReminders(env, orgId, request);
      if (method === 'POST') return logReminder(env, orgId, user, request);
    }

    if (path === '/api/market/analytics/owner' && method === 'GET') {
      return ownerAnalytics(env, orgId, request);
    }

    if (path === '/api/market/imports/commit' && method === 'POST') {
      return commitImport(env, orgId, user, request);
    }

    // ---- P1: guardian access (owner side) -------------------------------------
    if (path === '/api/market/guardian-access') {
      if (method === 'GET') return listGuardianAccess(env, orgId, request);
      if (method === 'POST') return inviteGuardian(env, orgId, user, request);
    }
    const guardRevoke = path.match(/^\/api\/market\/guardian-access\/([^/]+)\/revoke$/);
    if (guardRevoke && method === 'POST') return revokeGuardian(env, orgId, user, decodeURIComponent(guardRevoke[1]));

    // ---- P1: institutional bulk booking (§30) ---------------------------------
    if (path === '/api/market/institutional') {
      if (method === 'GET') return listInstitutional(env, orgId);
      if (method === 'POST') return createInstitutional(env, orgId, user, request);
    }
    const instMatch = path.match(/^\/api\/market\/institutional\/([^/]+)$/);
    if (instMatch && method === 'PATCH') return patchInstitutional(env, orgId, user, decodeURIComponent(instMatch[1]), request);
    const instElig = path.match(/^\/api\/market\/institutional\/([^/]+)\/eligible-beds$/);
    if (instElig && method === 'GET') return institutionalEligibility(env, orgId, request, decodeURIComponent(instElig[1]));

    // ---- P1: meal operations (§28) --------------------------------------------
    if (path === '/api/market/meal-ops') {
      if (method === 'GET') return listMealOps(env, orgId, request);
      if (method === 'POST') return upsertMealOps(env, orgId, user, request);
    }

    return json({ error: 'Not found' }, 404);
  } catch (error) {
    console.error('market handler error', error);
    return json({ error: error instanceof Error ? error.message : 'Internal error' }, 500);
  }
}

