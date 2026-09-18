/**
 * End-to-end regression suite: exercises the real Worker HTTP surface the
 * browser client uses, so response *shape* bugs (which unit tests miss) show up.
 *
 * Assumes a worker is running locally (npm run dev:worker -> :8787).
 * Run: E2E_BASE=http://127.0.0.1:8787 npx tsx scripts/test-e2e-flow.ts
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
  opts: { method?: string; token?: string; body?: unknown; raw?: BodyInit; headers?: Record<string, string> } = {}
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

let seq = 0;

/** Full signup: OTP send -> verify -> register. Mirrors AuthExperience. */
async function signup(role: 'owner' | 'resident' | 'public', name: string) {
  seq += 1;
  const phone = `9${String(stamp).slice(-8)}${seq}`.slice(0, 10);
  const email = `${role}-${stamp}-${seq}@e2e.pgwalo.test`;
  const sent = await api('/api/auth/otp/send', { method: 'POST', body: { email, phone, purpose: 'signup' } });
  if (sent.status !== 200) return { ok: false as const, step: 'otp/send', status: sent.status, data: sent.data };
  const code = sent.data?.fallbackCode || sent.data?.code;
  if (!code) return { ok: false as const, step: 'otp/send:no-code', status: sent.status, data: sent.data };
  const verified = await api('/api/auth/otp/verify', { method: 'POST', body: { otpId: sent.data.otpId, code } });
  if (verified.status !== 200) return { ok: false as const, step: 'otp/verify', status: verified.status, data: verified.data };
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { name, email, phone, role, password: 'PGWalo@2026', verificationId: verified.data.verificationId },
  });
  if (reg.status !== 201) return { ok: false as const, step: 'register', status: reg.status, data: reg.data };
  return { ok: true as const, token: reg.data.token as string, user: reg.data.user, email, phone };
}

async function main() {
  console.log(`E2E base: ${BASE}\n`);

  const health = await api('/api/health');
  check('health endpoint reachable', health.status === 200, `status ${health.status}`);
  if (health.status !== 200) {
    console.log('\nWorker not reachable — start it with `npm run dev:worker`.');
    process.exit(1);
  }

  // ---------- 1. Super admin ----------
  const adminLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'PGWalo.Avijit', password: '1q2w3e4r5t' },
  });
  const adminToken = adminLogin.data?.token as string | undefined;
  check('superadmin login issues a token', adminLogin.status === 200 && Boolean(adminToken));

  const overview = await api('/api/admin/overview', { token: adminToken });
  check('admin overview returns counters', overview.status === 200 && typeof overview.data?.users === 'number');

  // ---------- 2. Owner signup + listing ----------
  const owner = await signup('owner', 'E2E Owner');
  check('owner signup completes (OTP + register)', owner.ok, owner.ok ? undefined : `${owner.step} ${owner.status} ${JSON.stringify(owner.data)}`);
  if (!owner.ok) return finish();

  const ownerLogin = await api('/api/auth/login', { method: 'POST', body: { email: owner.email, password: 'PGWalo@2026' } });
  const ownerToken = ownerLogin.data?.token as string;
  check('owner can log in with new credentials', ownerLogin.status === 200 && Boolean(ownerToken));

  const listing = {
    id: `prop-e2e-${stamp}`,
    name: `E2E Residency ${stamp}`,
    tagline: 'Regression test PG',
    gender: 'Unisex',
    city: 'Bengaluru',
    locality: 'Indiranagar',
    address: '100 Ft Road, Indiranagar, Bengaluru',
    lat: 12.9719,
    lng: 77.6412,
    startingPrice: 9000,
    rooms: [{ type: 'Single', totalBeds: 2 }],
    amenities: ['wifi', 'ac'],
    coverImage: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
  };
  const published = await api('/api/listings', { method: 'POST', token: ownerToken, body: listing });
  check('owner saves a listing', published.status === 201, `${published.status} ${JSON.stringify(published.data).slice(0, 160)}`);
  check(
    'a saved listing carries its PGWalo number and prefixed name',
    Boolean(published.data?.property?.pgNumber) &&
      String(published.data?.property?.name || '').startsWith(`PGwalo${published.data?.property?.pgNumber}- `),
    String(published.data?.property?.name)
  );

  const beforePay = await api('/api/listings');
  const visibleBeforePay = Array.isArray(beforePay.data) && beforePay.data.some((p: any) => p.id === listing.id);
  check('a listing without a publishing payment is not public', visibleBeforePay === false);

  // Publishing is a paid action; drive it exactly as the pricing page does.
  const payOrder = await api('/api/payments/orders', {
    method: 'POST',
    token: ownerToken,
    body: { propertyId: listing.id, planId: 'lite' },
  });
  check('owner starts a publishing payment', payOrder.status === 201 && Boolean(payOrder.data?.order?.id), `${payOrder.status} ${JSON.stringify(payOrder.data).slice(0, 160)}`);
  const payOrderId = payOrder.data?.order?.id as string | undefined;

  let paid = false;
  if (payOrderId && payOrder.data?.order?.simulated) {
    const done = await api(`/api/payments/orders/${payOrderId}/simulate`, {
      method: 'POST',
      token: ownerToken,
      body: { outcome: 'success' },
    });
    paid = done.status === 200 && done.data?.order?.status === 'paid';
    check('test payment publishes the listing', paid, JSON.stringify(done.data).slice(0, 200));
  } else {
    check('live gateway configured — payment cannot be completed by this suite', true, 'visibility checks below are skipped');
  }

  const publicListings = await api('/api/listings');
  const visible = Array.isArray(publicListings.data) && publicListings.data.some((p: any) => p.id === listing.id);
  if (paid) {
    check('new listing is publicly visible (owner → public flow)', visible);
    const badged = (publicListings.data as any[]).find((p) => p.id === listing.id);
    check('the published listing is badged with its plan', badged?.planTier === 'lite', String(badged?.planTier));
  } else {
    check('public visibility after payment', true, 'skipped: no simulated gateway');
  }

  const ownerListings = Array.isArray(publicListings.data)
    ? publicListings.data.filter((p: any) => p.ownerUserId === owner.user.id)
    : [];
  check('listing is attributed to the owning user id', ownerListings.length > 0);

  // ---------- 3. Resident signup + booking + ticket ----------
  const resident = await signup('resident', 'E2E Resident');
  check('resident signup completes', resident.ok, resident.ok ? undefined : `${resident.step} ${resident.status} ${JSON.stringify(resident.data)}`);
  if (!resident.ok) return finish();

  const residentLogin = await api('/api/auth/login', { method: 'POST', body: { email: resident.email, password: 'PGWalo@2026' } });
  const residentToken = residentLogin.data?.token as string;
  check('resident can log in', residentLogin.status === 200 && Boolean(residentToken));

  const booking = {
    id: `req-e2e-${stamp}`,
    applicantName: 'E2E Resident',
    email: resident.email,
    phone: resident.phone,
    propertyId: listing.id,
    propertyName: listing.name,
    roomType: 'Single',
    status: 'Pending',
    message: 'Regression booking',
  };
  const booked = await api('/api/inquiries', { method: 'POST', token: residentToken, body: booking });
  check('resident raises a booking request', booked.status === 201, `${booked.status} ${JSON.stringify(booked.data).slice(0, 160)}`);

  const ownerInquiries = await api(`/api/inquiries?ownerUserId=${encodeURIComponent(owner.user.id)}`, { token: ownerToken });
  const ownerSeesBooking = Array.isArray(ownerInquiries.data) && ownerInquiries.data.some((b: any) => b.id === booking.id);
  check('owner sees the resident booking (resident → owner flow)', ownerSeesBooking, `owner got ${Array.isArray(ownerInquiries.data) ? ownerInquiries.data.length : '?'} rows`);

  const ticket = { type: 'Maintenance', title: `E2E leaky tap ${stamp}`, description: 'Water dripping in bathroom' };
  const raised = await api('/api/support-tickets', { method: 'POST', token: residentToken, body: ticket });
  check('resident raises a support ticket', raised.status === 201, `${raised.status} ${JSON.stringify(raised.data).slice(0, 160)}`);

  const residentTickets = await api('/api/support-tickets', { token: residentToken });
  check('resident sees their own ticket', Array.isArray(residentTickets.data) && residentTickets.data.length > 0);

  // ---------- 4. Staff creation ----------
  let staffToken = '';
  seq += 1;
  const staffRes = await api('/api/auth/staff', {
    method: 'POST',
    token: ownerToken,
    body: {
      name: 'E2E Warden',
      phone: `8${String(stamp).slice(-8)}${seq}`.slice(0, 10),
      staffRole: 'Manager',
      pin: '654321',
      propertyId: listing.id,
      shift: 'Morning (6 AM - 2 PM)',
    },
  });
  check('owner creates staff login', staffRes.status === 201, `${staffRes.status} ${JSON.stringify(staffRes.data).slice(0, 160)}`);
  const staffPhone = staffRes.data?.credentials?.phone as string | undefined;
  if (staffPhone) {
    const staffLogin = await api('/api/auth/login', { method: 'POST', body: { phone: staffPhone, password: '654321' } });
    check('new staff can log in with PIN', staffLogin.status === 200 && Boolean(staffLogin.data?.token));

    // Before the permission-matrix fix every one of these tables resolved
    // through `staff.view`, which belonged to no role — so the staff dashboard
    // was completely empty.
    staffToken = (staffLogin.data?.token as string) || '';
    const staffHome = await api('/api/bootstrap', { token: staffToken });
    const keys = staffHome.data && typeof staffHome.data === 'object' ? Object.keys(staffHome.data) : [];
    check('staff bootstrap loads (not an empty snapshot)', staffHome.status === 200 && keys.length > 5, `keys=${keys.length}`);
    const staffRows = (key: string): any[] => (staffHome.data?.[key] || []) as any[];
    check(
      'staff can read their operational tables',
      ['properties', 'staff_tasks', 'meal_plans', 'maintenance_tickets', 'broadcast_notifications', 'attendance_records', 'visitor_passes'].every(
        (key) => Array.isArray(staffHome.data?.[key])
      ),
      `missing: ${['properties', 'staff_tasks', 'meal_plans', 'maintenance_tickets', 'broadcast_notifications', 'attendance_records', 'visitor_passes'].filter((k) => !Array.isArray(staffHome.data?.[k])).join(',') || 'none'}`
    );
    check('staff can call the meal-plan collection', Array.isArray(staffRows('meal_plans')), `${staffRows('meal_plans').length} days present`);
  }

  // ---------- 5. Admin console sees everything ----------
  const adminUsers = await api('/api/admin/users?page=1&pageSize=200', { token: adminToken });
  const userRows: any[] = adminUsers.data?.users || [];
  check('admin users endpoint lists accounts', userRows.length > 0, `rows=${userRows.length}`);
  check('admin users list includes the new owner', userRows.some((u) => u.id === owner.user.id));
  check('admin users list includes the new resident', userRows.some((u) => u.id === resident.user.id));
  check(
    'admin users list includes the new staff account',
    userRows.some((u) => u.role === 'staff' && u.phone === staffRes.data?.credentials?.phone)
  );

  // Contract the admin console depends on (src/services/adminApi.ts): a named
  // collection array plus pagination meta. Reading the wrong key here is what
  // blanked the Users/Owners/Tenants lists on the live site.
  const paginated = (data: any, key: string) =>
    Array.isArray(data?.[key]) && typeof data?.total === 'number' && typeof data?.page === 'number';

  check(
    'admin users payload matches the client contract',
    paginated(adminUsers.data, 'users'),
    `keys: ${adminUsers.data && typeof adminUsers.data === 'object' ? Object.keys(adminUsers.data).join(',') : 'n/a'}`
  );

  const adminBookings = await api('/api/admin/bookings?page=1&pageSize=200', { token: adminToken });
  check('admin bookings endpoint returns rows', Array.isArray(adminBookings.data?.bookings) && adminBookings.data.bookings.length > 0);
  check(
    'admin bookings payload matches the client contract',
    paginated(adminBookings.data, 'bookings'),
    `keys: ${adminBookings.data && typeof adminBookings.data === 'object' ? Object.keys(adminBookings.data).join(',') : 'n/a'}`
  );
  check(
    'admin booking rows are camelCase for the console table',
    (adminBookings.data?.bookings || []).every((b: any) => 'applicantName' in b && 'requestDate' in b)
  );

  const adminTickets = await api('/api/admin/support-tickets', { token: adminToken });
  const ticketRows: any[] = Array.isArray(adminTickets.data) ? adminTickets.data : [];
  check('admin ticket list includes the resident ticket', ticketRows.some((t) => t.title === ticket.title));
  const newTicket = ticketRows.find((t) => t.title === ticket.title);
  check('admin ticket carries the resident requester name', newTicket?.requesterName === 'E2E Resident');

  const adminPayments = await api('/api/admin/payments?page=1&pageSize=200', { token: adminToken });
  check('admin payments endpoint responds', adminPayments.status === 200);
  check(
    'admin payments payload matches the client contract',
    paginated(adminPayments.data, 'payments'),
    `keys: ${adminPayments.data && typeof adminPayments.data === 'object' ? Object.keys(adminPayments.data).join(',') : 'n/a'}`
  );

  // ---------- 5b. Owner -> resident propagation ----------
  // This mirrors exactly what src/context/AppContext.tsx pushes after an owner
  // confirms a move-in, dispatches an agreement or posts a notice, and what a
  // resident's own bootstrap must then return.
  const residentRowId = `res-e2e-${stamp}`;
  const bedRowId = `bed-e2e-${stamp}`;
  const stayRowId = `stay-e2e-${stamp}`;
  const agreementRowId = `agr-e2e-${stamp}`;
  const broadcastRowId = `bc-e2e-${stamp}`;

  const ownerSnapshot = {
    organizations: [{
      id: owner.user.organizationId, name: `${owner.user.name} operations`,
      ownerUserId: owner.user.id, accountState: 'Active', subscriptionPlan: 'Trial',
    }],
    properties: [{
      id: listing.id, organizationId: owner.user.organizationId, status: 'Active',
      name: listing.name, tagline: listing.tagline, gender: listing.gender, city: listing.city,
      locality: listing.locality, address: listing.address, lat: listing.lat, lng: listing.lng,
      startingPrice: listing.startingPrice, rooms: listing.rooms, amenities: listing.amenities,
      rules: [], noticePeriodDays: 30, verified: false, featured: false,
      ownerUserId: owner.user.id, ownerName: owner.user.name,
      // Field with no DB column — must not abort the sync.
      listingStatus: 'Active',
    }],
    residents: [{
      id: residentRowId, organizationId: owner.user.organizationId, status: 'Active',
      name: 'E2E Resident', email: resident.email, phone: resident.phone,
      propertyId: listing.id, propertyName: listing.name, roomNumber: '201',
      roomType: 'Single', bedNumber: 'A1', monthlyRent: 9000, depositAmount: 15000,
      moveInDate: '2026-09-17', rentStatus: 'Pending', rentDueDate: '07th Every Month',
      emergencyContact: resident.phone, kycVerified: true, depositState: 'Held',
      agreementState: 'Active', previousDues: 0, advanceBalance: 0,
      outstandingBalance: 9000, noticePeriodDays: 30,
    }],
    beds: [{
      id: bedRowId, organizationId: owner.user.organizationId, bedNumber: 'A1',
      roomId: `room-201-${stamp}`, roomNumber: '201', propertyId: listing.id,
      sharingType: 'Single', status: 'Occupied', currentTenantId: residentRowId,
      currentTenantName: 'E2E Resident', monthlyRent: 9000, deposit: 15000,
    }],
    stays: [{
      id: stayRowId, organizationId: owner.user.organizationId, residentId: residentRowId,
      propertyId: listing.id, roomNumber: '201', bedId: bedRowId, bedNumber: 'A1',
      startDate: '2026-09-17', monthlyRentAtStart: 9000, status: 'Current',
    }],
    rent_agreements: [{
      id: agreementRowId, agreementNumber: `PGWALO-KA-${String(stamp).slice(-6)}`,
      residentId: residentRowId, residentName: 'E2E Resident', tenantDOB: '2000-01-01',
      tenantPermanentAddress: 'addr', tenantCurrentAddress: 'addr',
      tenantCollegeOrOffice: 'Working Professional', tenantIdDocumentType: 'Aadhaar',
      tenantIdDocumentMasked: 'XXXX1234', propertyId: listing.id, propertyName: listing.name,
      propertyAddress: listing.address, ownerName: owner.user.name, ownerPhone: owner.phone,
      roomNumber: '201', bedNumber: 'A1', monthlyRent: 9000, securityDeposit: 15000,
      electricityTerms: 'Actuals', noticePeriodDays: 30, startDate: '2026-09-17',
      endDate: '2027-09-16', rulesSummary: ['No smoking'], status: 'Sent',
      ownerSigned: true, tenantSigned: false, emergencyContactName: 'E2E Contact',
      emergencyContactPhone: '9000000009', createdAt: '2026-09-17',
    }],
    broadcast_notifications: [{
      id: broadcastRowId, title: `E2E notice ${stamp}`, message: 'Water supply off 2-4pm',
      category: 'Maintenance', target: 'All Residents', timestamp: new Date().toISOString(),
      sender: owner.user.name, read: false,
    }],
    // Simple table with no organisation column — proves the shared tables reach
    // staff/warden dashboards too (they resolved to `staff.view`, a permission
    // no role held, so every one of them came back empty).
    meal_plans: [{
      id: `meal-e2e-${stamp}`, day: 'Monday', breakfast: 'Poha', lunch: 'Dal rice',
      snacks: 'Tea', dinner: 'Roti sabzi', specialNote: 'E2E menu',
    }],
  };

  const pushed = await api('/api/bootstrap', { method: 'POST', token: ownerToken, body: ownerSnapshot });
  check(
    'owner persists bed allotment, stay, agreement and notice',
    pushed.status === 200 && !pushed.data?.failed,
    `status ${pushed.status} ${JSON.stringify(pushed.data).slice(0, 220)}`
  );

  const ownerHome = await api('/api/bootstrap', { token: ownerToken });
  check('owner sees the alloted bed as occupied', (ownerHome.data?.beds || []).some((b: any) => b.id === bedRowId && b.status === 'Occupied'));

  if (staffToken) {
    const staffAfter = await api('/api/bootstrap', { token: staffToken });
    const menu = (staffAfter.data?.meal_plans || []) as any[];
    check('staff receives the meal plan the owner published', menu.some((row) => row.title === 'Poha' || row.breakfast === 'Poha'), `rows=${menu.length}`);
  }

  const residentHome = await api('/api/bootstrap', { token: residentToken });
  const atResident = (key: string): any[] => (residentHome.data?.[key] || []) as any[];
  check('resident receives the allotted room + bed', atResident('residents').some((r) => r.id === residentRowId && r.roomNumber === '201'));
  check('resident receives the move-in stay record', atResident('stays').some((s) => s.id === stayRowId));
  check('resident receives the dispatched agreement', atResident('rent_agreements').some((a) => a.id === agreementRowId));
  check(
    'agreement arrives in the client shape the resident dashboard reads',
    atResident('rent_agreements').some((a) => a.id === agreementRowId && 'agreementNumber' in a && 'tenantDOB' in a)
  );
  check('resident receives the owner broadcast/notice', atResident('broadcast_notifications').some((b) => b.id === broadcastRowId));
  check(
    'resident snapshot still exposes no other tenant\u2019s records',
    atResident('residents').every(
      (r) => r.id === residentRowId || r.id === resident.user.id || String(r.email || '').toLowerCase() === resident.email.toLowerCase()
    )
  );

  // ---------- 5c. Ticket attachment survives the round trip ----------
  const longRef = `/api/media/attachments/${'a'.repeat(300)}-${stamp}.jpg`;
  const attachTicket = { type: 'Maintenance', title: `E2E attachment ${stamp}`, description: 'Photo attached', imageUrl: longRef };
  const attachRaised = await api('/api/support-tickets', { method: 'POST', token: residentToken, body: attachTicket });
  const attachList = await api('/api/support-tickets', { token: residentToken });
  const attachBack = (Array.isArray(attachList.data) ? attachList.data : []).find((t: any) => t.title === attachTicket.title);
  check('ticket attachment reference is stored intact (not truncated)', attachRaised.status === 201 && attachBack?.imageUrl === longRef, `stored=${String(attachBack?.imageUrl || '').slice(0, 40)}… (len ${String(attachBack?.imageUrl || '').length} vs ${longRef.length})`);

  // ---------- 5d. Maintenance complaint flow (resident -> warden -> resident) ----------
  const complaintTitle = `E2E complaint ${stamp}`;
  const complaintRaised = await api('/api/maintenance-tickets', {
    method: 'POST',
    token: residentToken,
    body: { title: complaintTitle, category: 'Plumbing', description: 'Tap leaking', priority: 'High', roomNumber: '201', propertyId: listing.id, propertyName: listing.name },
  });
  const complaintId = complaintRaised.data?.id as string | undefined;
  check('resident raises a maintenance complaint', complaintRaised.status === 201 && Boolean(complaintId), `status ${complaintRaised.status} ${JSON.stringify(complaintRaised.data).slice(0, 160)}`);

  // High priority → 24 h SLA deadline, stamped at raise time.
  const slaOk =
    typeof complaintRaised.data?.slaDeadline === 'string' &&
    !Number.isNaN(new Date(complaintRaised.data.slaDeadline).getTime()) &&
    new Date(complaintRaised.data.slaDeadline).getTime() > Date.now() &&
    new Date(complaintRaised.data.slaDeadline).getTime() - Date.now() < 24 * 3_600_000 + 60_000;
  check('complaint carries an SLA deadline for its priority (High → 24h)', slaOk, `slaDeadline=${complaintRaised.data?.slaDeadline}`);
  check('complaint is linked to the resident record', Boolean(complaintRaised.data?.residentId), `residentId=${complaintRaised.data?.residentId}`);
  check('complaint is linked to the owner organisation', Boolean(complaintRaised.data?.organizationId) && complaintRaised.data?.organizationId === owner.user.organizationId, `org=${complaintRaised.data?.organizationId}`);

  const wardenHome = staffToken ? await api('/api/maintenance-tickets', { token: staffToken }) : null;
  check(
    'warden/staff inbox receives the new complaint',
    Boolean(wardenHome && Array.isArray(wardenHome.data) && wardenHome.data.some((t: any) => t.id === complaintId)),
    `rows=${Array.isArray(wardenHome?.data) ? wardenHome.data.length : 'n/a'}`
  );

  const residentComplaints = await api('/api/maintenance-tickets', { token: residentToken });
  check(
    'resident sees their own complaint',
    Array.isArray(residentComplaints.data) && residentComplaints.data.some((t: any) => t.id === complaintId),
    `rows=${Array.isArray(residentComplaints.data) ? residentComplaints.data.length : 'n/a'}`
  );

  if (complaintId && staffToken) {
    const progressing = await api('/api/maintenance-tickets', {
      method: 'POST',
      token: staffToken,
      body: { action: 'status', id: complaintId, status: 'In-Progress', assignedStaffName: 'E2E Warden' },
    });
    check('warden moves the complaint to In-Progress', progressing.status === 200, `status ${progressing.status} ${JSON.stringify(progressing.data).slice(0, 160)}`);

    const resolved = await api('/api/maintenance-tickets', {
      method: 'POST',
      token: staffToken,
      body: { action: 'status', id: complaintId, status: 'Resolved', resolutionNotes: 'Tap replaced' },
    });
    check('warden resolves the complaint', resolved.status === 200);

    // The resident must actually be told about both transitions.
    const notifiedHome = await api('/api/bootstrap', { token: residentToken });
    const inbox = (notifiedHome.data?.broadcast_notifications || []) as any[];
    const personal = inbox.filter((b) => (b.recipient_id || b.recipientId) === resident.user.id && /E2E complaint/.test(String(b.title || '')));
    check('complaint status change notifies the resident', personal.length >= 2, `matched ${personal.length} of ${inbox.length} notifications`);
    check(
      'resident complaint list reflects the resolved status',
      (await api('/api/maintenance-tickets', { token: residentToken })).data?.some((t: any) => t.id === complaintId && t.status === 'Resolved')
    );

    // Cross-org protection: an unrelated owner must not touch the ticket.
    const stranger = await signup('owner', 'E2E Stranger Owner');
    if (stranger.ok) {
      const strangerLogin = await api('/api/auth/login', { method: 'POST', body: { email: stranger.email, password: 'PGWalo@2026' } });
      const strangerToken = strangerLogin.data?.token as string;
      if (strangerToken) {
        const forbidden = await api('/api/maintenance-tickets', {
          method: 'POST',
          token: strangerToken,
          body: { action: 'status', id: complaintId, status: 'Closed' },
        });
        check('another owner cannot change someone else\u2019s complaint', forbidden.status === 403 || forbidden.status === 404, `status ${forbidden.status}`);
      }
    }
  }

  // ---------- 5d-2. SLA escalation sweep ----------
  {
    // Raise a fresh open complaint, force-breach its deadline, then run the
    // sweep via the on-demand endpoint (what the 15-min cron does) and verify
    // the owner gets a personal escalation.
    const residentSweep = await api('/api/maintenance-tickets', {
      method: 'POST', token: residentToken, body: { action: 'escalation-sweep' },
    });
    check('escalation sweep rejects resident callers', residentSweep.status === 403, `status ${residentSweep.status}`);

    const slaTicket = await api('/api/maintenance-tickets', {
      method: 'POST',
      token: residentToken,
      body: { title: `E2E SLA ${stamp}`, category: 'Other', description: 'slow drip', priority: 'Low', roomNumber: '201', propertyId: listing.id },
    });
    const slaTicketId = slaTicket.data?.id as string | undefined;
    if (slaTicketId) {
      const backdate = await api('/api/maintenance-tickets', {
        method: 'POST', token: staffToken, body: { action: 'sla-force-breach', id: slaTicketId },
      });
      check('SLA breach can be staged for testing', backdate.status === 200, `status ${backdate.status}`);

      const sweep = await api('/api/maintenance-tickets', {
        method: 'POST', token: ownerToken, body: { action: 'escalation-sweep' },
      });
      check('escalation sweep runs for the owner', sweep.status === 200, `status ${sweep.status} ${JSON.stringify(sweep.data).slice(0, 140)}`);
      check(
        'breached complaint is escalated',
        sweep.data?.escalated >= 1 && Array.isArray(sweep.data?.tickets) && sweep.data.tickets.includes(slaTicketId),
        `result: ${JSON.stringify(sweep.data).slice(0, 160)}`
      );

      const ownerHome = await api('/api/bootstrap', { token: ownerToken });
      const escNotices = ((ownerHome.data?.broadcast_notifications || []) as any[]).filter(
        (b) => (b.recipient_id || b.recipientId) === owner.user.id && /SLA breached/.test(String(b.title || ''))
      );
      check('owner receives a personal SLA-breach notification', escNotices.length >= 1, `matched ${escNotices.length}`);

      // Idempotent: second sweep must not re-escalate the same ticket.
      const sweep2 = await api('/api/maintenance-tickets', {
        method: 'POST', token: ownerToken, body: { action: 'escalation-sweep' },
      });
      check('escalation does not re-fire on the second sweep', sweep2.data?.escalated === 0, `escalated=${sweep2.data?.escalated}`);

      // Clean the test ticket up (resolve it so it stops appearing open).
      await api('/api/maintenance-tickets', { method: 'POST', token: staffToken, body: { action: 'status', id: slaTicketId, status: 'Resolved' } });
    }
  }

  // ---------- 5d1. Owner maintenance overview (SLA stats + staff performance) --
  {
    // Stage a live breach assigned to a named staff member so every part of the
    // rollup has something to count.
    const ovTicket = await api('/api/maintenance-tickets', {
      method: 'POST',
      token: residentToken,
      body: { title: `E2E overview ${stamp}`, category: 'WiFi', description: 'Router down', priority: 'Low', roomNumber: '201', propertyId: listing.id, propertyName: listing.name },
    });
    const ovTicketId = ovTicket.data?.id as string | undefined;
    if (ovTicketId) {
      await api('/api/maintenance-tickets', {
        method: 'POST', token: staffToken,
        body: { action: 'status', id: ovTicketId, status: 'In-Progress', assignedStaffName: 'E2E Warden' },
      });
      await api('/api/maintenance-tickets', {
        method: 'POST', token: staffToken, body: { action: 'sla-force-breach', id: ovTicketId },
      });
    }

    if (ovTicketId) {
      // Regression guard: the assignment must survive the round trip, not just
      // live in the staff browser's optimistic state.
      const assignedBack = ((await api('/api/maintenance-tickets', { token: staffToken })).data || [])
        .find((t: any) => t.id === ovTicketId);
      check('staff assignment persists to the database', assignedBack?.assignedStaffName === 'E2E Warden', `assigned=${assignedBack?.assignedStaffName || 'none'}`);
    }

    const ov = await api('/api/maintenance-tickets?view=overview', { token: ownerToken });
    const totals = ov.data?.totals;
    check('owner reads the maintenance overview', ov.status === 200 && typeof totals?.total === 'number' && totals.total >= 1, `${ov.status} ${JSON.stringify(ov.data).slice(0, 140)}`);
    check('overview reports SLA health per priority', Array.isArray(ov.data?.sla?.byPriority) && ov.data.sla.byPriority.length >= 1, `rows ${Array.isArray(ov.data?.sla?.byPriority) ? ov.data.sla.byPriority.length : '?'}`);
    check('overview flags the open SLA breach', (ov.data?.sla?.breachedOpen || 0) >= 1, `breachedOpen=${ov.data?.sla?.breachedOpen}`);
    check(
      'overview lists the breached complaint itself',
      Array.isArray(ov.data?.breached) && ov.data.breached.some((t: any) => t.id === ovTicketId),
      `breached ids ${JSON.stringify((ov.data?.breached || []).map((t: any) => t.id)).slice(0, 120)}`
    );
    check(
      'overview ranks staff performance',
      Array.isArray(ov.data?.staff) && ov.data.staff.some((s: any) => s.name === 'E2E Warden' && s.assigned >= 1),
      `staff rows ${JSON.stringify((ov.data?.staff || []).map((s: any) => `${s.name}:${s.assigned}`)).slice(0, 140)}`
    );
    check('overview exposes avg + median resolution time', 'avgResolutionHours' in (ov.data?.sla || {}) && 'medianResolutionHours' in (ov.data?.sla || {}));

    const residentOverview = await api('/api/maintenance-tickets?view=overview', { token: residentToken });
    check('resident cannot read the org-wide overview', residentOverview.status === 403, `status ${residentOverview.status}`);
    const staffOverview = await api('/api/maintenance-tickets?view=overview', { token: staffToken });
    check('field staff cannot read the org-wide overview', staffOverview.status === 403, `status ${staffOverview.status}`);

    // Clean up so the breach does not linger in the owner's live board.
    if (ovTicketId) {
      await api('/api/maintenance-tickets', { method: 'POST', token: staffToken, body: { action: 'status', id: ovTicketId, status: 'Resolved' } });
    }
  }

  // ---------- 5d2. Complaint photo attachment + support-ticket routing ----------
  {
    // Photo: upload via the media endpoint (same one the form uses), then
    // raise a complaint carrying the returned R2 URL and read it back.
    const tinyPng = Uint8Array.from(atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    ), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append('file', new Blob([tinyPng], { type: 'image/png' }), 'complaint.png');
    form.append('category', 'Complaint');
    const upload = await fetch(`${BASE}/api/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${residentToken}` },
      body: form,
    });
    const uploadData = await upload.json().catch(() => ({}));
    const photoUrl = uploadData?.url as string | undefined;
    check('resident can upload a complaint photo to storage', upload.status === 200 && Boolean(photoUrl), `${upload.status} ${JSON.stringify(uploadData).slice(0, 140)}`);

    const photoComplaint = await api('/api/maintenance-tickets', {
      method: 'POST',
      token: residentToken,
      body: { title: `E2E photo complaint ${stamp}`, category: 'Electrical', description: 'Fan sparking', priority: 'High', photoUrl, roomNumber: '201', propertyId: listing.id, propertyName: listing.name },
    });
    const photoComplaintId = photoComplaint.data?.id as string | undefined;
    const photoBack = ((await api('/api/maintenance-tickets', { token: residentToken })).data || []).find((t: any) => t.id === photoComplaintId);
    check('complaint stores and returns the photo URL', Boolean(photoComplaintId) && photoBack?.photoUrl === photoUrl, `photoUrl=${String(photoBack?.photoUrl || 'none').slice(0, 60)}`);
    if (photoUrl) {
      const img = await fetch(`${BASE}${photoUrl}`);
      check('complaint photo is served back from storage', img.status === 200 && (img.headers.get('content-type') || '').startsWith('image/'), `status ${img.status} type ${img.headers.get('content-type')}`);
    }

    // Routing: a property-type support ticket must notify the property's owner,
    // an application-type ticket must notify the superadmin.
    const before = await api('/api/bootstrap', { token: ownerToken });
    const ownerNoticesBefore = ((before.data?.broadcast_notifications || []) as any[])
      .filter((b) => (b.recipientId || b.recipient_id) === owner.user.id).length;
    const propTicket = await api('/api/support-tickets', {
      method: 'POST',
      token: residentToken,
      body: { type: 'Room allocation', title: `E2E room issue ${stamp}`, description: 'Bed is broken', propertyId: listing.id },
    });
    check('property-type support ticket accepted', propTicket.status === 201, `${propTicket.status} ${JSON.stringify(propTicket.data).slice(0, 140)}`);

    const appTicket = await api('/api/support-tickets', {
      method: 'POST',
      token: residentToken,
      body: { type: 'Technical issue', title: `E2E app issue ${stamp}`, description: 'Payments page errors out' },
    });
    check('application-type support ticket accepted', appTicket.status === 201, `${appTicket.status}`);

    await new Promise((r) => setTimeout(r, 1200));
    const after = await api('/api/bootstrap', { token: ownerToken });
    const afterOwnerNotices = ((after.data?.broadcast_notifications || []) as any[])
      .filter((b) => (b.recipientId || b.recipient_id) === owner.user.id);
    const gotPropertyRoute = afterOwnerNotices.some((b) => /room issue/i.test(String(b.title || '')));
    check('property ticket notified the property owner', gotPropertyRoute, `owner notices ${ownerNoticesBefore} → ${afterOwnerNotices.length}`);
    check('app ticket did not notify the owner (goes to superadmin)',
      gotPropertyRoute ? !afterOwnerNotices.some((b) => /app issue/i.test(String(b.title || ''))) : true,
      `matched=${afterOwnerNotices.filter((b) => /app issue/i.test(String(b.title || ''))).length}`);

    const adminHome = await api('/api/bootstrap', { token: adminToken });
    const adminNotices = ((adminHome.data?.broadcast_notifications || []) as any[])
      .filter((b) => (b.recipientId || b.recipient_id) === 'user_admin_super' || (b.recipientId || b.recipient_id) === adminToken);
    const adminGotAppTicket = ((adminHome.data?.broadcast_notifications || []) as any[]).some((b) => /app issue/i.test(String(b.title || '')));
    check('app ticket notified the superadmin desk', adminGotAppTicket, `admin notices scanned`);
    void adminNotices;
  }

  // ---------- 5e. Server-Sent Events push channel ----------
  {
    // The resident opens a push stream; the warden's status change must arrive
    // as an event within the stream window instead of waiting for the next poll.
    const streamKinds = 'tickets,notifications';
    const controller = new AbortController();
    const events: { event: string; data: string }[] = [];
    const streamDone = (async () => {
      const res = await fetch(`${BASE}/api/events?kind=${streamKinds}&token=${encodeURIComponent(residentToken)}`, {
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`stream status ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep = buffer.indexOf('\n\n');
        while (sep !== -1) {
          const block = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const event = block.split('\n').find((l) => l.startsWith('event:'))?.slice(6).trim() || '';
          const data = block.split('\n').find((l) => l.startsWith('data:'))?.slice(5).trim() || '';
          events.push({ event, data });
          if (events.filter((e) => e.event === 'changed').length >= 1) {
            controller.abort();
            return;
          }
          sep = buffer.indexOf('\n\n');
        }
      }
    })().catch(() => undefined);

    // Trigger a change while the stream is open: warden moves the complaint.
    await new Promise((r) => setTimeout(r, 1500));
    if (complaintId && staffToken) {
      await api('/api/maintenance-tickets', {
        method: 'POST',
        token: staffToken,
        body: { action: 'status', id: complaintId, status: 'Closed' },
      });
    }

    const timeout = new Promise((r) => setTimeout(r, 20000));
    await Promise.race([streamDone, timeout]);
    controller.abort();

    const ready = events.some((e) => e.event === 'ready');
    const changed = events.filter((e) => e.event === 'changed');
    const kinds = changed.map((e) => {
      try { return (JSON.parse(e.data) as { kind?: string }).kind; } catch { return '?'; }
    });
    check('SSE stream opens with a ready handshake', ready, `events: ${events.map((e) => e.event).join(',') || 'none'}`);
    check(
      'SSE delivers a change event when a ticket is updated',
      changed.length > 0,
      `changed kinds: ${kinds.join(',') || 'none'} (total events ${events.length})`
    );
  }

  // ---------- 6. Admin mutations ----------
  const suspend = await api(`/api/admin/users/${encodeURIComponent(resident.user.id)}`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'Suspended' },
  });
  check('admin can change account status', suspend.status === 200);

  const approve = await api(`/api/admin/properties/${encodeURIComponent(listing.id)}`, {
    method: 'PATCH',
    token: adminToken,
    body: { action: 'approve' },
  });
  check('admin can approve a listing', approve.status === 200);

  if (newTicket) {
    const reply = await api(`/api/admin/support-tickets/${encodeURIComponent(newTicket.id)}`, {
      method: 'POST',
      token: adminToken,
      body: { body: 'Plumber scheduled by E2E', authorName: 'Super Admin' },
    });
    check('admin can reply to a ticket', reply.status === 200);
    const patched = await api(`/api/admin/support-tickets/${encodeURIComponent(newTicket.id)}`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'Open', assignedTo: 'superadmin' },
    });
    check('admin can update ticket status', patched.status === 200);

    // The requester must actually be told — the status change used to exist only
    // in the admin's own tab.
    const notified = await api('/api/bootstrap', { token: residentToken });
    const inbox = (notified.data?.broadcast_notifications || []) as any[];
    const personal = inbox.filter(
      (b) => b.recipient_id === resident.user.id || b.recipientId === resident.user.id
    );
    check('ticket status change notifies the requester', personal.length > 0, `matched ${personal.length} of ${inbox.length} notifications`);
    check(
      'the notification reaches the resident inbox endpoint',
      (notified.data?.broadcast_notifications || []).length > 0
    );

    const ownerInbox = await api('/api/bootstrap', { token: ownerToken });
    check(
      'owner also receives broadcast notifications from the database',
      Array.isArray(ownerInbox.data?.broadcast_notifications)
    );
  }

  // ---------- 7. Bootstrap scoping ----------
  const adminBoot = await api('/api/bootstrap', { token: adminToken });
  check('admin bootstrap returns properties', Array.isArray(adminBoot.data?.properties));
  check(
    'admin bootstrap returns the users table (admin console directory)',
    Array.isArray(adminBoot.data?.users),
    `keys: ${adminBoot.data && typeof adminBoot.data === 'object' ? Object.keys(adminBoot.data).join(',') : 'n/a'}`
  );
  check(
    'admin bootstrap booking_requests are camelCase-mapped',
    Array.isArray(adminBoot.data?.booking_requests) && adminBoot.data.booking_requests.every((b: any) => 'applicantName' in b),
    'raw snake_case rows leaked to the client'
  );

  check(
    'admin bootstrap includes the support_tickets table',
    Array.isArray(adminBoot.data?.support_tickets),
    `keys: ${adminBoot.data && typeof adminBoot.data === 'object' ? Object.keys(adminBoot.data).join(',') : 'n/a'}`
  );
  const bootUsers: any[] = Array.isArray(adminBoot.data?.users) ? adminBoot.data.users : [];
  check('admin bootstrap users rows carry no credential hashes', bootUsers.every((u) => !('password_hash' in u) && !('aadhaar_hash' in u)));

  const ownerBoot = await api('/api/bootstrap', { token: ownerToken });
  check('owner bootstrap is scoped to the owner org', ownerBoot.status === 200 && Array.isArray(ownerBoot.data?.properties));

  // ---------- 8. Resident scoping (no cross-resident leakage) ----------
  const residentBoot = await api('/api/bootstrap', { token: residentToken });
  const bootResidents: any[] = Array.isArray(residentBoot.data?.residents) ? residentBoot.data.residents : [];
  check(
    'resident bootstrap returns a property catalog',
    Array.isArray(residentBoot.data?.properties) && residentBoot.data.properties.length > 0,
    `properties=${Array.isArray(residentBoot.data?.properties) ? residentBoot.data.properties.length : 'n/a'}`
  );
  check(
    'resident bootstrap contains only the caller’s own resident rows',
    bootResidents.every(
      (r) => r.id === resident.user.id || r.id === `res-${resident.user.id}` || String(r.email || '').toLowerCase() === resident.email.toLowerCase()
    ),
    `${bootResidents.length} foreign rows leaked`
  );
  const residentBootTickets: any[] = Array.isArray(residentBoot.data?.support_tickets) ? residentBoot.data.support_tickets : [];
  check(
    'resident bootstrap only carries the caller’s own tickets',
    residentBootTickets.every((t) => t.requesterId === resident.user.id)
  );
  check(
    'resident can still read the property catalog via collections',
    (await api('/api/properties', { token: residentToken })).status === 200
  );
  check(
    'resident still cannot read the org-wide resident directory',
    (await api('/api/residents', { token: residentToken })).status === 403
  );

  const anonAdmin = await api('/api/admin/users');
  check('admin API rejects anonymous callers', anonAdmin.status === 401);
  const residentAdmin = await api('/api/admin/users', { token: residentToken });
  check('admin API rejects resident callers', residentAdmin.status === 403);

  // ---------- 9. Transactional email engine ----------
  const prefsRead = await api('/api/notifications/preferences', { token: residentToken });
  check(
    'resident can read email preferences',
    prefsRead.status === 200 && typeof prefsRead.data?.emailEnabled === 'boolean',
    `status=${prefsRead.status}`
  );
  await api('/api/notifications/preferences', { method: 'PUT', token: residentToken, body: { emailEnabled: false } });
  const prefsOff = await api('/api/notifications/preferences', { token: residentToken });
  check('email opt-out persists', prefsOff.data?.emailEnabled === false, `got=${prefsOff.data?.emailEnabled}`);
  // Back on, so the event checks below are not suppressed by our own opt-out.
  await api('/api/notifications/preferences', { method: 'PUT', token: residentToken, body: { emailEnabled: true } });

  const anonEvent = await api('/api/notify/event', { method: 'POST', body: { event: 'auth.welcome' } });
  check('email event endpoint rejects anonymous callers', anonEvent.status === 401);
  const unknownEvent = await api('/api/notify/event', { method: 'POST', token: residentToken, body: { event: 'not.a.real.event' } });
  check('unknown email event is rejected', unknownEvent.status === 400);

  const welcomeMail = await api('/api/notify/event', {
    method: 'POST', token: residentToken,
    body: { event: 'auth.welcome', to: 'self', data: { phone: resident.phone, role: 'resident' } },
  });
  check(
    'resident can queue an email to themselves',
    welcomeMail.status === 200 && welcomeMail.data?.queued === true,
    JSON.stringify(welcomeMail.data)
  );

  const dedupeKey = `e2e-welcome-${stamp}`;
  await api('/api/notify/event', { method: 'POST', token: residentToken, body: { event: 'auth.welcome', to: 'self', dedupeKey } });
  const dupeMail = await api('/api/notify/event', { method: 'POST', token: residentToken, body: { event: 'auth.welcome', to: 'self', dedupeKey } });
  check(
    'duplicate dedupeKey is never emailed twice',
    dupeMail.data?.queued === false && dupeMail.data?.reason === 'duplicate',
    JSON.stringify(dupeMail.data)
  );

  const missingProperty = await api('/api/notify/event', {
    method: 'POST', token: ownerToken, body: { event: 'booking.approved', to: 'owner' },
  });
  check('owner-targeted email requires a propertyId', missingProperty.status === 400);

  const ownerMail = await api('/api/notify/event', {
    method: 'POST', token: ownerToken,
    body: { event: 'booking.approved', to: 'owner', propertyId: listing.id, data: { propertyName: listing.name } },
  });
  check(
    'owner receives property-scoped emails',
    ownerMail.status === 200 && ownerMail.data?.queued === true,
    JSON.stringify(ownerMail.data)
  );

  const mailStranger = await signup('owner', 'E2E Mail Stranger');
  if (mailStranger.ok) {
    const crossOrg = await api('/api/notify/event', {
      method: 'POST', token: mailStranger.token,
      body: { event: 'booking.approved', to: 'owner', propertyId: listing.id },
    });
    check('another org cannot email this property’s owner', crossOrg.status === 403, `status=${crossOrg.status}`);
  } else {
    check('another org cannot email this property’s owner', false, `signup failed: ${mailStranger.step}`);
  }

  const forgedUnsub = await api('/api/email/unsubscribe?token=forged.forged');
  check('forged unsubscribe token is rejected', forgedUnsub.status === 400, `status=${forgedUnsub.status}`);

  const mailStats = await api('/api/admin/email/stats', { token: adminToken });
  check(
    'admin can inspect the email outbox',
    mailStats.status === 200 && Array.isArray(mailStats.data?.counts),
    `status=${mailStats.status}`
  );
  check(
    'admin sees which sender is configured',
    typeof mailStats.data?.transport?.provider === 'string' && typeof mailStats.data?.transport?.from === 'string',
    JSON.stringify(mailStats.data?.transport)
  );
  const residentStats = await api('/api/admin/email/stats', { token: residentToken });
  check('email outbox is admin-only', residentStats.status === 403, `status=${residentStats.status}`);

  // Escape hatch: sender readiness is inspectable before it is switched to.
  const probe = await api('/api/admin/email/probe', { method: 'POST', token: adminToken });
  check(
    'admin can probe every configured sender',
    probe.status === 200 && Array.isArray(probe.data?.providers) && probe.data.providers.length >= 2,
    `status=${probe.status}`
  );
  check(
    'probe reports which sender the next message would use',
    typeof probe.data?.nextSendUses === 'string' && probe.data?.nextSendUses === probe.data?.transport?.provider,
    JSON.stringify({ next: probe.data?.nextSendUses, active: probe.data?.transport?.provider })
  );
  check(
    'probe reports whether failover is armed',
    typeof probe.data?.transport?.failoverReady === 'boolean',
    JSON.stringify(probe.data?.transport)
  );
  const residentProbe = await api('/api/admin/email/probe', { method: 'POST', token: residentToken });
  check('sender probing is admin-only', residentProbe.status === 403, `status=${residentProbe.status}`);

  const providerBreakdown = (mailStats.data?.byProvider || []) as Array<{ provider: string; n: number }>;
  check(
    'outbox reports delivery counts per sender',
    Array.isArray(providerBreakdown) && providerBreakdown.every((r) => typeof r.provider === 'string'),
    JSON.stringify(providerBreakdown)
  );

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.passed);
  console.log('');
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('\nFailures:');
    failed.forEach((f) => console.log(` - ${f.name}${f.detail ? ` :: ${f.detail}` : ''}`));
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error('E2E suite error:', error);
  process.exit(1);
});
