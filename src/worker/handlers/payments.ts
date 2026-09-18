import { Env } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { authMiddleware } from '../middleware/auth';
import { isPlatformAdmin } from '../utils/platformAdmin';
import { notifyEvent } from '../email';
import { LISTING_PLANS, listingPlan, formatInr, formatInrExact } from '../../domain/pricing';
import { pgDisplayName } from '../../utils/pgName';
import {
  activePaymentProvider,
  createGatewayOrder,
  paymentTransportSummary,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from '../payments/provider';
import { invoiceFileName, invoicePdfBase64 } from '../payments/invoicePdf';

/**
 * Owner publishing payments.
 *
 * Lifecycle: the owner picks a plan on the pricing page, an order row is
 * created (and a gateway order, when keys are installed), the checkout is
 * completed, and the order is fulfilled exactly once — the gateway can retry a
 * webhook as often as it likes and nothing is charged or emailed twice.
 *
 * Fulfilment publishes the listing and badges it with the plan tier; failure
 * emails the owner the same resumable link so the "Pay & publish" button can be
 * pressed again at any time.
 */

const APP_URL = 'https://pgwalo.com';
/** A payment link stays usable for a day; the order itself never expires. */
const LINK_TTL_MS = 24 * 60 * 60 * 1000;

interface OrderRow {
  id: string;
  property_id: string;
  property_name: string | null;
  owner_user_id: string | null;
  organization_id: string | null;
  plan_id: string;
  plan_name: string | null;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  payment_link: string | null;
  invoice_number: string | null;
  failure_reason: string | null;
  receipt_email: string | null;
  created_at: string;
  paid_at: string | null;
  expires_at: string | null;
}

interface PropertyRow {
  id: string;
  name: string | null;
  owner_user_id: string | null;
  organization_id: string | null;
  pg_number: number | null;
}

function json(data: unknown, status = 200) {
  return addCorsHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  }));
}

const nowIso = () => new Date().toISOString();

async function columnsOf(env: Env, table: string): Promise<string[]> {
  try {
    const { results } = await env.DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
    return (results || []).map((c) => c.name);
  } catch {
    return [];
  }
}

async function findOrder(env: Env, id: string): Promise<OrderRow | null> {
  return env.DB.prepare('SELECT * FROM listing_payments WHERE id = ?').bind(id).first<OrderRow>();
}

/** The owner of a property, or the account that manages it. */
async function mayManageProperty(env: Env, user: { id: string; role: string; organizationId?: string }, propertyId: string) {
  const property = await env.DB.prepare(
    'SELECT id, name, owner_user_id, organization_id, pg_number FROM properties WHERE id = ?'
  ).bind(propertyId).first<PropertyRow>();
  if (!property) return { ok: false as const, error: 'Property not found', status: 404 as const };
  if (isPlatformAdmin(user.role)) return { ok: true as const, property };
  const owns = property.owner_user_id && property.owner_user_id === user.id;
  const sameOrg = Boolean(property.organization_id && user.organizationId && property.organization_id === user.organizationId);
  if (!owns && !sameOrg) return { ok: false as const, error: 'This listing belongs to another owner', status: 403 as const };
  return { ok: true as const, property };
}

function amountLabel(amountInr: number): string {
  return `${formatInr(amountInr)} (${formatInrExact(amountInr)})`;
}

/** The resumable, our-own-URL payment link (never a gateway-hosted page). */
function buildPaymentLink(orderId: string): string {
  return `${APP_URL}/pay/${encodeURIComponent(orderId)}`;
}

async function ownerEmailFor(env: Env, ownerUserId: string | null): Promise<string | null> {
  if (!ownerUserId) return null;
  const row = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(ownerUserId)
    .first<{ email: string }>();
  return row?.email || null;
}

/**
 * Publish the listing and send the invoice. Idempotent by order status, so a
 * duplicate webhook (or a verify call arriving after one) is a no-op.
 */
async function fulfilOrder(
  env: Env,
  order: OrderRow,
  payment: { paymentId?: string; provider?: string }
): Promise<OrderRow> {
  if (order.status === 'paid') return order;

  const plan = listingPlan(order.plan_id) || LISTING_PLANS[0];
  const paidAt = nowIso();
  const paidForPlan = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM listing_payments WHERE status = 'paid'`
  ).first<{ n: number }>();
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const invoiceNumber = order.invoice_number || `PGW-${stamp}-${String((paidForPlan?.n || 0) + 1).padStart(4, '0')}`;
  const expiresAt = new Date(Date.now() + plan.durationDays * 86_400_000).toISOString();

  await env.DB.prepare(
    `UPDATE listing_payments
        SET status = 'paid', provider = ?, provider_payment_id = ?, invoice_number = ?,
            paid_at = ?, updated_at = ?, failure_reason = NULL
      WHERE id = ?`
  ).bind(
    payment.provider || order.provider,
    payment.paymentId || order.provider_payment_id || null,
    invoiceNumber,
    paidAt,
    paidAt,
    order.id
  ).run();

  // Publish + badge the property. Columns are probed so a database that has not
  // run database/payments.sql yet still gets the listing published.
  const propertyCols = await columnsOf(env, 'properties');
  const assignments = ["status = 'Active'", 'verified = 1'];
  const params: Array<string | number> = [];
  if (propertyCols.includes('plan_tier')) {
    assignments.push('plan_tier = ?');
    params.push(plan.id);
  }
  if (propertyCols.includes('plan_expires_at')) {
    assignments.push('plan_expires_at = ?');
    params.push(expiresAt);
  }
  if (propertyCols.includes('featured')) {
    assignments.push('featured = ?');
    params.push(plan.featured ? 1 : 0);
  }
  try {
    await env.DB.prepare(
      `UPDATE properties SET ${assignments.join(', ')} WHERE id = ?`
    ).bind(...params, order.property_id).run();
  } catch (error) {
    console.error('listing publish after payment failed', error);
  }

  const propertyName = pgDisplayName(order.property_name || 'your PG', null);
  const email = order.receipt_email || (await ownerEmailFor(env, order.owner_user_id));
  const paidOrder: OrderRow = {
    ...order,
    status: 'paid',
    invoice_number: invoiceNumber,
    provider_payment_id: payment.paymentId || order.provider_payment_id,
    paid_at: paidAt,
  };

  if (email) {
    const pdf = invoicePdfBase64({
      invoiceNumber,
      issuedAt: paidAt,
      ownerName: (await ownerNameFor(env, order.owner_user_id)) || 'PGWalo Owner',
      ownerEmail: email,
      propertyName,
      planName: `${plan.name} publishing plan`,
      planDays: plan.durationDays,
      amountInr: order.amount,
      paymentId: paidOrder.provider_payment_id || undefined,
      orderId: order.provider_order_id || order.id,
    });
    try {
      await notifyEvent(env, 'listing.payment_success', {
        to: email,
        toName: '',
        userId: order.owner_user_id || undefined,
        orgId: order.organization_id || undefined,
        propertyId: order.property_id,
        entityId: order.id,
        dedupeKey: `pay-success-${order.id}`,
        attachments: [{ filename: invoiceFileName(invoiceNumber), content: pdf, contentType: 'application/pdf' }],
        data: {
          propertyName,
          planName: plan.name,
          amount: amountLabel(order.amount),
          invoiceNumber,
          paymentId: paidOrder.provider_payment_id || '',
          validTill: expiresAt.slice(0, 10),
        },
      });
    } catch (error) {
      console.error('invoice email failed', error);
    }
  }

  return paidOrder;
}

async function ownerNameFor(env: Env, ownerUserId: string | null): Promise<string | null> {
  if (!ownerUserId) return null;
  const row = await env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(ownerUserId)
    .first<{ name: string }>();
  return row?.name || null;
}

/** Mark the attempt failed and email the owner the same link and amount. */
async function failOrder(env: Env, order: OrderRow, reason: string): Promise<OrderRow> {
  if (order.status === 'paid') return order;
  const plan = listingPlan(order.plan_id) || LISTING_PLANS[0];
  const updatedAt = nowIso();
  const link = order.payment_link || buildPaymentLink(order.id);
  const expiresAt = order.expires_at || new Date(Date.now() + LINK_TTL_MS).toISOString();

  await env.DB.prepare(
    `UPDATE listing_payments SET status = 'failed', failure_reason = ?, payment_link = ?,
       expires_at = ?, updated_at = ? WHERE id = ?`
  ).bind(reason || 'Payment not completed', link, expiresAt, updatedAt, order.id).run();

  const email = order.receipt_email || (await ownerEmailFor(env, order.owner_user_id));
  if (email) {
    try {
      await notifyEvent(env, 'listing.payment_failed', {
        to: email,
        userId: order.owner_user_id || undefined,
        orgId: order.organization_id || undefined,
        propertyId: order.property_id,
        entityId: order.id,
        dedupeKey: `pay-failed-${order.id}`,
        data: {
          propertyName: pgDisplayName(order.property_name || 'your PG', null),
          planName: plan.name,
          amount: formatInr(order.amount),
          amountExact: formatInrExact(order.amount),
          reason: reason || 'Payment not completed',
          paymentLink: link,
          validTill: expiresAt.slice(0, 10),
        },
      });
    } catch (error) {
      console.error('payment failure email failed', error);
    }
  }

  return { ...order, status: 'failed', failure_reason: reason, payment_link: link, expires_at: expiresAt };
}

export async function paymentsHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // ---- public catalogue ---------------------------------------------------
  if (path === '/api/payments/plans' && request.method === 'GET') {
    return json({
      plans: LISTING_PLANS,
      transport: paymentTransportSummary(env),
    });
  }

  // ---- gateway webhook (signature-verified, no JWT) -----------------------
  if (path === '/api/payments/webhook' && request.method === 'POST') {
    const raw = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';
    const signatureOk =
      Boolean(env.RAZORPAY_WEBHOOK_SECRET) && (await verifyWebhookSignature(env, raw, signature));

    let payload: {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string; error_description?: string } } };
    } = {};
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = {};
    }
    const payment = payload?.payload?.payment?.entity;
    const orderId = payment?.order_id || '';

    try {
      await env.DB.prepare(
        `INSERT INTO payment_events (id, provider, event_type, payment_id, order_id, signature_ok, payload, received_at, processed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
      ).bind(
        `pe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        'razorpay',
        payload?.event || 'unknown',
        payment?.id || null,
        orderId || null,
        signatureOk ? 1 : 0,
        raw.slice(0, 4000),
        nowIso()
      ).run();
    } catch (error) {
      console.error('payment event log failed', error);
    }

    // A webhook that does not verify is acknowledged with 400 so the gateway
    // retries, but it can never change an order.
    if (!signatureOk) return json({ error: 'Invalid signature' }, 400);

    if (orderId) {
      const order = await env.DB.prepare(
        'SELECT * FROM listing_payments WHERE provider_order_id = ? ORDER BY created_at DESC LIMIT 1'
      ).bind(orderId).first<OrderRow>();
      if (order) {
        const failed = /failed|cancelled/i.test(payload?.event || '');
        if (failed) await failOrder(env, order, payment?.error_description || payload.event || 'Payment failed');
        else await fulfilOrder(env, order, { paymentId: payment?.id, provider: 'razorpay' });
      }
    }
    return json({ ok: true });
  }

  // Everything below needs the signed-in owner.
  const auth = await authMiddleware(request, env);
  if (!auth.success) return json({ error: auth.error || 'Sign in to continue' }, 401);
  const user = auth.user!;
  if (user.role !== 'owner' && !isPlatformAdmin(user.role)) {
    return json({ error: 'Only owners can purchase a publishing plan' }, 403);
  }

  // ---- create an order ----------------------------------------------------
  if (path === '/api/payments/orders' && request.method === 'POST') {
    let body: { propertyId?: string; planId?: string };
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid request body' }, 400);
    }
    const plan = listingPlan(body.planId);
    if (!plan) return json({ error: 'Choose a valid plan (lite, air or ocean)' }, 400);
    if (!body.propertyId) return json({ error: 'Property is required' }, 400);

    const access = await mayManageProperty(env, user, body.propertyId);
    if (!access.ok) return json({ error: access.error }, access.status);
    const property = access.property;

    if (isPlatformAdmin(user.role) && !property.owner_user_id) {
      return json({ error: 'This listing has no owner account to charge' }, 400);
    }

    const id = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ownerUserId = property.owner_user_id || user.id;
    const propertyName = pgDisplayName(property.name || 'PG', property.pg_number);
    const receiptEmail = (await ownerEmailFor(env, ownerUserId)) || user.email || null;

    const gateway = await createGatewayOrder(env, {
      localOrderId: id,
      amountInr: plan.price,
      notes: { propertyId: property.id, propertyName, planId: plan.id, ownerUserId },
    });

    const link = buildPaymentLink(id);
    const expiresAt = new Date(Date.now() + LINK_TTL_MS).toISOString();
    const createdAt = nowIso();

    try {
      await env.DB.prepare(
        `INSERT INTO listing_payments
           (id, property_id, property_name, owner_user_id, organization_id, plan_id, plan_name,
            amount, currency, status, provider, provider_order_id, payment_link, receipt_email,
            created_at, updated_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'INR', 'created', ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        property.id,
        propertyName,
        ownerUserId,
        property.organization_id || user.organizationId || null,
        plan.id,
        plan.name,
        plan.price,
        gateway.provider,
        gateway.ok ? gateway.orderId || null : null,
        link,
        receiptEmail,
        createdAt,
        createdAt,
        expiresAt
      ).run();
    } catch (error) {
      console.error('payment order insert failed', error);
      return json({ error: 'Could not start the payment. Please try again.' }, 500);
    }

    if (!gateway.ok) {
      const order = await findOrder(env, id);
      if (order) await failOrder(env, order, gateway.error || 'Gateway unavailable');
      return json({ error: gateway.error || 'Payment gateway unavailable' }, 502);
    }

    return json({
      success: true,
      order: {
        id,
        propertyId: property.id,
        propertyName,
        planId: plan.id,
        planName: plan.name,
        amount: plan.price,
        currency: 'INR',
        amountPaise: gateway.amountPaise,
        status: 'created',
        provider: gateway.provider,
        providerOrderId: gateway.orderId || null,
        keyId: gateway.keyId || null,
        paymentLink: link,
        simulated: Boolean(gateway.simulated),
        expiresAt,
      },
    }, 201);
  }

  // ---- order status (used by the emailed resume link) ---------------------
  if (path.startsWith('/api/payments/orders/') && request.method === 'GET' && !path.endsWith('/verify')) {
    const id = decodeURIComponent(path.split('/')[4] || '');
    const order = await findOrder(env, id);
    if (!order) return json({ error: 'Payment not found' }, 404);
    const access = await mayManageProperty(env, user, order.property_id);
    if (!access.ok && !isPlatformAdmin(user.role)) return json({ error: 'Not your payment' }, 403);
    return json({
      success: true,
      order: {
        id: order.id,
        propertyId: order.property_id,
        propertyName: order.property_name,
        planId: order.plan_id,
        planName: order.plan_name,
        amount: order.amount,
        currency: order.currency,
        status: order.status,
        provider: order.provider,
        providerOrderId: order.provider_order_id,
        keyId: env.RAZORPAY_KEY_ID || null,
        paymentLink: order.payment_link,
        invoiceNumber: order.invoice_number,
        failureReason: order.failure_reason,
        paidAt: order.paid_at,
        expiresAt: order.expires_at,
      },
    });
  }

  const actionMatch = path.match(/^\/api\/payments\/orders\/([^/]+)\/(verify|fail|simulate)$/);
  if (actionMatch && request.method === 'POST') {
    const [, rawId, action] = actionMatch;
    const id = decodeURIComponent(rawId);
    const order = await findOrder(env, id);
    if (!order) return json({ error: 'Payment not found' }, 404);
    const access = await mayManageProperty(env, user, order.property_id);
    if (!access.ok && !isPlatformAdmin(user.role)) return json({ error: 'Not your payment' }, 403);

    if (order.status === 'paid') {
      return json({ success: true, alreadyPaid: true, order: { id: order.id, status: 'paid', invoiceNumber: order.invoice_number } });
    }

    let body: { razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string; reason?: string; outcome?: string } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    if (action === 'simulate') {
      // Only reachable while no live gateway is configured, so this can never
      // mark a real payment as paid.
      if (activePaymentProvider(env) !== 'none') {
        return json({ error: 'Simulation is disabled once live payment keys are installed' }, 400);
      }
      if (body.outcome === 'failure') {
        const failed = await failOrder(env, order, body.reason || 'Test payment marked as failed');
        return json({ success: true, simulated: true, order: { id: failed.id, status: 'failed', paymentLink: failed.payment_link } });
      }
      const paid = await fulfilOrder(env, order, { paymentId: `sim_pay_${order.id}`, provider: 'none' });
      return json({
        success: true,
        simulated: true,
        order: { id: paid.id, status: 'paid', invoiceNumber: paid.invoice_number, paymentLink: paid.payment_link },
      });
    }

    if (action === 'fail') {
      const failed = await failOrder(env, order, body.reason || 'Payment cancelled');
      return json({ success: true, order: { id: failed.id, status: 'failed', paymentLink: failed.payment_link } });
    }

    // action === 'verify'
    const gatewayOrderId = body.razorpay_order_id || order.provider_order_id || '';
    if (activePaymentProvider(env) !== 'none') {
      const signatureOk = await verifyCheckoutSignature(env, {
        orderId: gatewayOrderId,
        paymentId: body.razorpay_payment_id || '',
        signature: body.razorpay_signature || '',
      });
      if (!signatureOk) {
        await failOrder(env, order, 'Payment signature could not be verified');
        return json({ error: 'Payment could not be verified. No money was taken.' }, 400);
      }
    }
    const paid = await fulfilOrder(env, order, {
      paymentId: body.razorpay_payment_id || `sim_pay_${order.id}`,
      provider: order.provider,
    });
    return json({
      success: true,
      order: {
        id: paid.id,
        status: 'paid',
        invoiceNumber: paid.invoice_number,
        paymentLink: paid.payment_link,
      },
    });
  }

  return json({ error: 'Invalid payments endpoint' }, 404);
}
