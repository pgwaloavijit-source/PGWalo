/**
 * Unified action center (spec §32) — one ranked feed instead of scattered
 * counters. Builds ActionItems from every domain signal the owner needs to
 * act on today. Deterministic: same inputs ⇒ same ranked list.
 */
import type { ActionItem } from './market';
import type { Bed, Invoice, MaintenanceTicket, Notice } from '../types';
import { evaluateInvoiceDueState } from './billing';
import { deriveBedStatus } from './market';

export interface BuildActionsInput {
  invoices: Invoice[];
  beds: Bed[];
  leads: { id: string; name: string; stage: string; nextFollowUpAt?: string; propertyId?: string }[];
  visits: { id: string; leadId?: string; scheduledAt: string; status: string; propertyId: string }[];
  reservations: { id: string; guestName: string; expiryAt: string; status: string; propertyId: string }[];
  tickets: MaintenanceTicket[];
  notices: Notice[];
  complianceItems: { id: string; label: string; expiresAt?: string; status: string; propertyId: string }[];
  depositSettlementsPending: { id: string; residentName: string; propertyId: string }[];
  now?: Date;
}

const PRIORITY_ORDER: Record<ActionItem['priority'], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const buildActionItems = (input: BuildActionsInput): ActionItem[] => {
  const now = input.now || new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const inDaysIso = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  const items: ActionItem[] = [];

  // Overdue payments — top of the money stack
  for (const inv of input.invoices) {
    const st = evaluateInvoiceDueState(inv);
    if (!st.isOverdue) continue;
    const daysOver = Math.floor((now.getTime() - new Date(`${inv.dueDate}T23:59:59`).getTime()) / 86_400_000);
    items.push({
      id: `act-pay-${inv.id}`,
      entityType: 'payment',
      actionType: 'payment_overdue',
      title: 'Rent overdue — follow up for payment',
      detail: `Outstanding ₹${st.outstanding.toLocaleString('en-IN')} past due ${inv.dueDate}${daysOver > 5 ? ' (5+ days — escalate)' : ''}`,
      priority: daysOver > 5 ? 'urgent' : 'high',
      dueAt: inv.dueDate,
      propertyId: inv.propertyId,
      deepLink: 'money?focus=overdue',
    });
  }

  // Lead follow-ups overdue/today
  for (const lead of input.leads) {
    if (['moved_in', 'lost', 'spam'].includes(lead.stage)) continue;
    if (lead.nextFollowUpAt && lead.nextFollowUpAt <= todayIso) {
      items.push({
        id: `act-lead-${lead.id}`,
        entityType: 'lead',
        actionType: 'lead_followup_overdue',
        title: `Follow up with ${lead.name}`,
        detail: 'Next follow-up date reached — call or WhatsApp today',
        priority: 'high',
        dueAt: lead.nextFollowUpAt,
        propertyId: lead.propertyId,
        deepLink: 'leads',
      });
    }
  }

  // Visits today
  for (const v of input.visits) {
    if (v.status !== 'scheduled' && v.status !== 'confirmed') continue;
    const day = v.scheduledAt.slice(0, 10);
    if (day === todayIso) {
      items.push({
        id: `act-visit-${v.id}`,
        entityType: 'visit',
        actionType: 'visit_today',
        title: 'Property visit scheduled today',
        detail: v.leadId ? `Lead visit — mark the outcome afterwards` : 'Walk-in/prospect visit',
        priority: 'high',
        dueAt: v.scheduledAt,
        propertyId: v.propertyId,
        deepLink: 'leads?view=visits',
      });
    }
  }

  // Reservations expiring within 24h
  for (const r of input.reservations) {
    if (r.status !== 'held' && r.status !== 'pending_payment') continue;
    const hoursLeft = (new Date(r.expiryAt).getTime() - now.getTime()) / 3_600_000;
    if (hoursLeft <= 24 && hoursLeft > 0) {
      items.push({
        id: `act-res-${r.id}`,
        entityType: 'reservation',
        actionType: 'reservation_expiring',
        title: `Reservation for ${r.guestName} expires soon`,
        detail: `Bed hold releases in ${Math.max(1, Math.round(hoursLeft))}h — collect token or extend`,
        priority: hoursLeft <= 4 ? 'urgent' : 'high',
        dueAt: r.expiryAt,
        propertyId: r.propertyId,
        deepLink: 'leads?view=reservations',
      });
    }
  }

  // Resident notices received
  for (const n of input.notices) {
    if (n.status !== 'Submitted') continue;
    items.push({
      id: `act-notice-${n.id}`,
      entityType: 'notice',
      actionType: 'notice_received',
      title: 'Resident notice received — approve checkout date',
      detail: `Requested ${n.requestedCheckoutDate}`,
      priority: 'medium',
      dueAt: n.requestedCheckoutDate,
      propertyId: n.propertyId,
      deepLink: 'residents?focus=notices',
    });
  }

  // Maintenance SLA breached (open past deadline)
  for (const t of input.tickets) {
    const open = t.status === 'Reported' || t.status === 'In-Progress';
    if (!open) continue;
    if (t.slaDeadline && t.slaDeadline < now.toISOString()) {
      items.push({
        id: `act-maint-${t.id}`,
        entityType: 'maintenance',
        actionType: 'maintenance_sla_missed',
        title: `Maintenance SLA missed: ${t.title}`,
        detail: `Deadline ${t.slaDeadline.slice(0, 10)} — ${t.priority} priority`,
        priority: 'urgent',
        dueAt: t.slaDeadline,
        propertyId: t.propertyId,
        deepLink: 'operations?focus=maintenance',
      });
    }
  }

  // Compliance documents expiring within 30 days
  for (const c of input.complianceItems) {
    if (c.status !== 'verified' && c.status !== 'uploaded') continue;
    if (!c.expiresAt) continue;
    const expIso = c.expiresAt.slice(0, 10);
    if (expIso <= inDaysIso(30)) {
      items.push({
        id: `act-comp-${c.id}`,
        entityType: 'compliance',
        actionType: 'compliance_expiring',
        title: `Document expiring: ${c.label}`,
        detail: `Expires ${expIso}${expIso < todayIso ? ' (already expired)' : ''}`,
        priority: expIso < todayIso ? 'high' : 'medium',
        dueAt: c.expiresAt,
        propertyId: c.propertyId,
        deepLink: 'compliance',
      });
    }
  }

  // Deposit settlements pending
  for (const d of input.depositSettlementsPending) {
    items.push({
      id: `act-dep-${d.id}`,
      entityType: 'deposit',
      actionType: 'deposit_settlement_pending',
      title: `Deposit settlement pending — ${d.residentName}`,
      detail: 'Complete move-out inspection and refund',
      priority: 'medium',
      propertyId: d.propertyId,
      deepLink: 'money?focus=deposits',
    });
  }

  return items.sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    const ad = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bd = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return ad - bd;
  });
};
