import { Env } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { authMiddleware } from '../middleware/auth';
import { deliverEmail } from '../utils/otp';

function json(data: unknown, status = 200) {
  return addCorsHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch] || ch));
}

export async function notifyHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/notify/visit' || request.method !== 'POST') {
    return json({ error: 'Not found' }, 404);
  }

  const authResult = await authMiddleware(request, env);
  if (!authResult.success) return json({ error: authResult.error }, 401);

  const body = await request.json() as {
    propertyId?: string;
    propertyName?: string;
    ownerEmail?: string;
    ownerName?: string;
    visitorName?: string;
    visitorEmail?: string;
    visitorPhone?: string;
    visitorProfession?: string;
    visitDate?: string;
    visitSlot?: string;
    message?: string;
    referenceId?: string;
  };

  const ownerEmail = (body.ownerEmail || '').trim().toLowerCase();
  const visitDate = body.visitDate || '';
  const slack = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (!visitDate || visitDate < slack) {
    return json({ success: false, error: 'Visit must be today or a future date.' }, 400);
  }
  if (!ownerEmail.includes('@')) {
    return json({ success: false, error: 'Property owner email is missing.' }, 400);
  }

  const subject = `PG visit booked: ${body.visitorName || 'A visitor'} · ${body.propertyName || 'your PG'}`;
  const html = `
    <p>Hello ${esc(body.ownerName || 'Owner')},</p>
    <p>A potential resident scheduled a walkthrough of <strong>${esc(body.propertyName || '')}</strong>.</p>
    <ul>
      <li><strong>Visitor:</strong> ${esc(body.visitorName || '')}</li>
      <li><strong>Mobile:</strong> ${esc(body.visitorPhone || '')}</li>
      <li><strong>Email:</strong> ${esc(body.visitorEmail || '')}</li>
      <li><strong>Profession:</strong> ${esc(body.visitorProfession || '—')}</li>
      <li><strong>Date:</strong> ${esc(visitDate)}</li>
      <li><strong>Slot:</strong> ${esc(body.visitSlot || '')}</li>
      <li><strong>Reference:</strong> ${esc(body.referenceId || '')}</li>
    </ul>
    ${body.message ? `<p>Note: ${esc(body.message)}</p>` : ''}
    <p>— PGWalo</p>
  `;
  const text = `Visit booked for ${body.propertyName}. ${body.visitorName} (${body.visitorPhone}, ${body.visitorEmail}) on ${visitDate} ${body.visitSlot}. Ref ${body.referenceId}.`;

  const delivered = await deliverEmail(env, ownerEmail, subject, html, text);
  const id = `vn-${Date.now()}`;
  try {
    await env.DB.prepare(
      `INSERT INTO visit_notifications (id, property_id, owner_email, visitor_name, visitor_email, visitor_phone, visit_date, visit_slot, delivered)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      body.propertyId || null,
      ownerEmail,
      body.visitorName || null,
      body.visitorEmail || null,
      body.visitorPhone || null,
      visitDate,
      body.visitSlot || null,
      delivered ? 1 : 0
    ).run();
  } catch {
    // Table may not exist yet; email attempt still counts.
  }

  return json({ success: true, delivered, id });
}
