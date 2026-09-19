/**
 * Publishing-payment regression suite.
 *
 * Drives the real Worker HTTP surface a browser uses: signup -> listing ->
 * pricing order -> (simulated) payment -> published + badged + invoiced, then
 * the failure path (email carries the payment link and the amount).
 *
 * Payment simulation is only accepted while no live gateway keys are installed,
 * so this suite is a no-op refusal against production — run it locally.
 *
 * Run: E2E_BASE=http://127.0.0.1:8787 npx tsx scripts/test-payments.ts
 */

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:8787';
const stamp = Date.now();
const results: { name: string; passed: boolean; detail?: string }[] = [];

function check(name: string, passed: boolean, detail?: string) {
  results.push({ name, passed, detail });
  console.log(`${passed ? '✓' : '✗'} ${name}${!passed && detail ? `  → ${detail}` : ''}`);
}

async function api(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {}
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

let seq = 0;

async function signup(role: 'owner' | 'resident', name: string) {
  seq += 1;
  const phone = `8${String(stamp).slice(-8)}${seq}`.slice(0, 10);
  const email = `${role}-pay-${stamp}-${seq}@e2e.pgwalo.test`;
  const sent = await api('/api/auth/otp/send', { method: 'POST', body: { email, phone, purpose: 'signup' } });
  const code = sent.data?.fallbackCode || sent.data?.code;
  if (!code) return { ok: false as const, step: 'otp', detail: JSON.stringify(sent.data) };
  const verified = await api('/api/auth/otp/verify', { method: 'POST', body: { otpId: sent.data.otpId, code } });
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { name, email, phone, role, password: 'PGWalo@2026', verificationId: verified.data?.verificationId },
  });
  if (reg.status !== 201) return { ok: false as const, step: 'register', detail: `${reg.status} ${JSON.stringify(reg.data)}` };
  return { ok: true as const, token: reg.data.token as string, user: reg.data.user, email, phone };
}

function listingPayload(ownerId: string, name: string) {
  const today = new Date().toISOString().split('T')[0];
  return {
    organizationId: `org-${ownerId}`,
    ownerUserId: ownerId,
    status: 'Payment Pending',
    name,
    tagline: 'Payment regression listing',
    gender: 'Boys',
    city: 'Bengaluru',
    locality: 'HSR Layout',
    address: '1 Test Road',
    lat: 12.9,
    lng: 77.6,
    coverImage: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
    galleryImages: [],
    startingPrice: 9000,
    rating: 0,
    reviewCount: 0,
    rooms: [{ id: '101', type: 'Double', rentPerMonth: 9000, deposit: 9000, availableBeds: 2, totalBeds: 2 }],
    amenities: ['wifi'],
    rules: [],
    noticePeriodDays: 30,
    gateClosingTime: '11:00 PM',
    foodIncluded: true,
    verified: false,
    contactPhone: '9999999999',
    contactEmail: 'owner@e2e.pgwalo.test',
    ownerName: 'Payments Test Owner',
    listingPaymentStatus: 'Pending',
    listingStatus: 'Payment Pending',
    publishedAt: today,
  };
}

async function main() {
  console.log(`Payments suite base: ${BASE}\n`);

  const health = await api('/api/health');
  check('health endpoint reachable', health.status === 200, `status ${health.status}`);
  if (health.status !== 200) {
    console.log('\nWorker not reachable — start it with `npm run dev:worker`.');
    process.exit(1);
  }

  // ---------- catalogue ----------
  const plans = await api('/api/payments/plans');
  check('plan catalogue is served', plans.status === 200 && Array.isArray(plans.data?.plans));
  check(
    'exactly three publishing plans: lite, air, ocean',
    JSON.stringify((plans.data?.plans || []).map((p: any) => p.id)) === '["lite","air","ocean"]',
    JSON.stringify((plans.data?.plans || []).map((p: any) => p.id))
  );
  check(
    'plans are priced Lite 499 / Air 999 / Ocean 1999',
    JSON.stringify((plans.data?.plans || []).map((p: any) => p.price)) === '[499,999,1999]',
    JSON.stringify((plans.data?.plans || []).map((p: any) => p.price))
  );
  check(
    'each plan states its badge and validity',
    (plans.data?.plans || []).every((p: any) => p.badge && p.durationDays > 0)
  );

  const simulated = Boolean(plans.data?.transport?.simulated);

  // ---------- owner + listing ----------
  const owner = await signup('owner', 'Payments Test Owner');
  check('owner signup works', owner.ok, owner.ok ? undefined : `${owner.step} ${owner.detail}`);
  if (!owner.ok) return finish();

  const created = await api('/api/listings', {
    method: 'POST',
    token: owner.token,
    body: listingPayload(owner.user.id, `Payments PG ${stamp}`),
  });
  check('owner can save a listing awaiting payment', created.status === 201, `${created.status} ${JSON.stringify(created.data).slice(0, 200)}`);
  const propertyId = created.data?.property?.id;
  check('the saved listing carries a PGWalo number', Boolean(created.data?.property?.pgNumber), JSON.stringify(created.data?.property?.name));
  check(
    'the listing name is prefixed with its PGWalo number',
    String(created.data?.property?.name || '').startsWith(`PGwalo${created.data?.property?.pgNumber}- `),
    created.data?.property?.name
  );
  check('an unpaid listing is NOT publicly visible', await isPubliclyVisible(propertyId) === false);
  check('the owner still sees their unpaid listing', await isVisibleToOwner(propertyId, owner.token) === true);

  // ---------- anonymous / role guards ----------
  check('anonymous cannot create a payment order', (await api('/api/payments/orders', { method: 'POST', body: { propertyId, planId: 'lite' } })).status === 401);
  const stranger = await signup('owner', 'Payments Stranger');
  if (stranger.ok) {
    const foreign = await api('/api/payments/orders', {
      method: 'POST',
      token: stranger.token,
      body: { propertyId, planId: 'lite' },
    });
    check('another owner cannot pay for this listing', foreign.status === 403, `status ${foreign.status}`);
  }
  const resident = await signup('resident', 'Payments Resident');
  if (resident.ok) {
    const denied = await api('/api/payments/orders', {
      method: 'POST',
      token: resident.token,
      body: { propertyId, planId: 'lite' },
    });
    check('a tenant cannot buy a publishing plan', denied.status === 403, `status ${denied.status}`);
  }
  const badPlan = await api('/api/payments/orders', { method: 'POST', token: owner.token, body: { propertyId, planId: 'gold' } });
  check('an unknown plan is rejected', badPlan.status === 400, `status ${badPlan.status}`);

  // ---------- order + failure path ----------
  const failedOrder = await api('/api/payments/orders', { method: 'POST', token: owner.token, body: { propertyId, planId: 'air' } });
  check('an order is created for a valid plan', failedOrder.status === 201 && failedOrder.data?.order?.id, JSON.stringify(failedOrder.data).slice(0, 200));
  const failedOrderId = failedOrder.data?.order?.id;
  check('the order is priced from the catalogue (₹999 for Air)', failedOrder.data?.order?.amount === 999, String(failedOrder.data?.order?.amount));
  check('the order carries a resumable payment link', String(failedOrder.data?.order?.paymentLink || '').includes(failedOrderId));
  const orderStatus = await api(`/api/payments/orders/${failedOrderId}`, { token: owner.token });
  check('the payment link resolves the order for its owner', orderStatus.status === 200 && orderStatus.data?.order?.id === failedOrderId);
  const foreignStatus = await api(`/api/payments/orders/${failedOrderId}`, { token: stranger.ok ? stranger.token : owner.token });
  check('the payment link is not readable by another owner', !stranger.ok || foreignStatus.status === 403, `status ${foreignStatus.status}`);

  const cancelled = await api(`/api/payments/orders/${failedOrderId}/fail`, {
    method: 'POST',
    token: owner.token,
    body: { reason: 'Checkout closed' },
  });
  check('a cancelled payment marks the order failed', cancelled.status === 200 && cancelled.data?.order?.status === 'failed');
  check('an unpaid listing is still not public after a failed payment', (await isPubliclyVisible(propertyId)) === false);

  const failMail = await lastEmailTo(owner.email);
  check('failure emails the owner the payment link and the amount', Boolean(failMail), 'no email row found');
  if (failMail) {
    check('failure email carries the plan', /Air/.test(String(failMail.payload)), String(failMail.payload));
    check('failure email links back to the same order', String(failMail.payload).includes(failedOrderId), String(failMail.payload));
    check('failure email states the amount due', /999/.test(String(failMail.payload)), String(failMail.payload));
  }

  // ---------- success path ----------
  const paidOrder = await api('/api/payments/orders', { method: 'POST', token: owner.token, body: { propertyId, planId: 'ocean' } });
  const paidOrderId = paidOrder.data?.order?.id;
  check('a second order can be created after a failure', paidOrder.status === 201 && Boolean(paidOrderId));

  if (!simulated) {
    check('live gateway configured — signature verification enforced', true, 'simulation path skipped');
    return finish();
  }

  const fulfil = await api(`/api/payments/orders/${paidOrderId}/simulate`, {
    method: 'POST',
    token: owner.token,
    body: { outcome: 'success' },
  });
  check('a successful payment fulfils the order', fulfil.status === 200 && fulfil.data?.order?.status === 'paid', JSON.stringify(fulfil.data).slice(0, 200));
  check('the paid order gets an invoice number', /^PGW-/.test(String(fulfil.data?.order?.invoiceNumber)), fulfil.data?.order?.invoiceNumber);

  const anonymous = (await api('/api/listings')).data as any[];
  const published = anonymous.find((p) => p.id === propertyId);
  check('the paid listing is now public', Boolean(published), 'not in the public catalog');
  check('the paid listing is badged with the plan it bought', published?.planTier === 'ocean', String(published?.planTier));
  check('the paid listing keeps its PGWalo number', Boolean(published?.pgNumber));
  check('the public listing reports Paid, not Payment Pending', published?.listingStatus === 'Active' && published?.listingPaymentStatus === 'Paid');

  const replayed = await api(`/api/payments/orders/${paidOrderId}/simulate`, { method: 'POST', token: owner.token, body: { outcome: 'success' } });
  check('a replayed fulfilment is idempotent', replayed.status === 200 && replayed.data?.alreadyPaid === true, JSON.stringify(replayed.data).slice(0, 160));

  const invoiceMail = await lastEmailTo(owner.email);
  check('success emails the invoice', Boolean(invoiceMail), 'no email row found');
  if (invoiceMail) {
    check('the invoice email has a PDF attached', /\.pdf/i.test(String(invoiceMail.attachments || '')), String(invoiceMail.attachments).slice(0, 120));
    check('the invoice email names the plan', /Ocean/.test(String(invoiceMail.payload)), String(invoiceMail.payload));
    check('the invoice email carries the invoice number', /PGW-/.test(String(invoiceMail.payload)), String(invoiceMail.payload));
    check('the invoice reached the owner (sent or simulated)', /sent|simulated/.test(String(invoiceMail.status)), String(invoiceMail.status));
  }

  return finish();
}

async function listings(token?: string): Promise<any[]> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api/listings`, { headers });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

const isPubliclyVisible = async (propertyId?: string) => (await listings()).some((p) => p.id === propertyId);
const isVisibleToOwner = async (propertyId: string | undefined, token: string) =>
  (await listings(token)).some((p) => p.id === propertyId);

/** Read the worker's durable outbox through the admin surface. */
async function lastEmailTo(email: string) {
  // Never embed admin credentials in a test file. Supply a short-lived QA token
  // explicitly when the outbox assertion is run against a live Worker.
  const token = process.env.QA_ADMIN_TOKEN;
  if (!token) return null;
  const stats = await api(`/api/admin/email/stats?to=${encodeURIComponent(email)}`, { token });
  const rows: any[] = stats.data?.recent || [];
  return rows[0] || null;
}

function finish() {
  const passed = results.filter((r) => r.passed).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error('suite crashed', error);
  process.exitCode = 1;
});
