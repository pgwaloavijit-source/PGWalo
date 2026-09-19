/**
 * Rent reminder cycle engine (spec §17).
 *
 * Configurable per property; every property falls back to these defaults.
 * Suppression is per (resident, invoice, rule) within each stage window —
 * the same rule never fires twice for the same invoice in one window.
 */
import type { Invoice } from '../types';

export interface ReminderRule {
  id: string;
  /** Days relative to due date (negative = before). */
  offsetDays: number;
  label: string;
  tone: 'gentle' | 'informational' | 'urgent';
  /** True for the escalation message (spec's "+5 days"). */
  escalation: boolean;
}

export const DEFAULT_REMINDER_RULES: ReminderRule[] = [
  { id: 't_minus_5', offsetDays: -5, label: 'Gentle reminder', tone: 'gentle', escalation: false },
  { id: 't_minus_2', offsetDays: -2, label: 'Upcoming due', tone: 'informational', escalation: false },
  { id: 'due_today', offsetDays: 0, label: 'Due today', tone: 'informational', escalation: false },
  { id: 'plus_2', offsetDays: 2, label: 'Overdue reminder', tone: 'urgent', escalation: false },
  { id: 'plus_5', offsetDays: 5, label: 'Escalation', tone: 'urgent', escalation: true },
];

export type ReminderChannel = 'whatsapp' | 'sms' | 'in_app';

export interface PropertyReminderSettings {
  rules: ReminderRule[];
  channels: ReminderChannel[];
  /** Opt-out flag — the engine skips a resident whose reminder preference is off. */
  suppressedResidents?: string[];
}

export const DEFAULT_REMINDER_SETTINGS: PropertyReminderSettings = {
  rules: DEFAULT_REMINDER_RULES,
  channels: ['whatsapp', 'in_app'],
};

export const dayDiff = (a: string, b: string): number =>
  Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);

export interface ReminderCandidate {
  invoiceId: string;
  residentId: string;
  propertyId?: string;
  rule: ReminderRule;
  dueDate: string;
  amountDue: number;
  channel: ReminderChannel;
}

export interface ReminderLogEntry {
  residentId: string;
  invoiceId: string | null;
  rule: string;
  channel: string;
  sentAt: string;
}

/**
 * Evaluate which reminders to send for a snapshot of invoices.
 * Filters out paid/cancelled invoices and respects per-invoice per-rule
 * suppression so a reminder never goes twice in one window.
 */
export const evaluateReminders = (
  invoices: Invoice[],
  logs: ReminderLogEntry[],
  today: string,
  settings: PropertyReminderSettings = DEFAULT_REMINDER_SETTINGS,
): ReminderCandidate[] => {
  const out: ReminderCandidate[] = [];
  const key = (r: string, i: string, rule: string) => `${r}|${i}|${rule}`;
  const sent = new Set(logs.map((l) => key(l.residentId, l.invoiceId || '', l.rule)));
  const suppressed = new Set(settings.suppressedResidents || []);

  for (const inv of invoices) {
    if (inv.status === 'Paid' || inv.status === 'Cancelled' || inv.status === 'Waived') continue;
    const amountDue = Math.max(0, inv.amount - (inv.verifiedPaidAmount || 0));
    if (amountDue <= 0) continue;
    if (suppressed.has(inv.residentId)) continue;

    const daysToDue = dayDiff(inv.dueDate, today);

    for (const rule of settings.rules) {
      if (daysToDue !== rule.offsetDays) continue;

      // One reminder per (resident, invoice, rule) — a log row already in
      // this stage window means skip. For windows that last multiple days
      // (e.g. overdue escalations that repeat weekly) the owner re-enables
      // by deleting the log row; default behavior is one-shot per rule.
      if (sent.has(key(inv.residentId, inv.id, rule.id))) continue;

      const channels = settings.channels.length ? settings.channels : (['in_app'] as ReminderChannel[]);
      const channel = channels[0];
      out.push({
        invoiceId: inv.id,
        residentId: inv.residentId,
        propertyId: (inv as { propertyId?: string }).propertyId,
        rule,
        dueDate: inv.dueDate,
        amountDue,
        channel,
      });
    }
  }
  return out;
};

/** WhatsApp template body — falls back to wa.me deep link when BSP is off. */
export const buildReminderMessage = (
  residentName: string,
  candidate: ReminderCandidate,
  payLink?: string,
): string => {
  const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const due = rupee(candidate.amountDue);
  const dateStr = new Date(candidate.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  switch (candidate.rule.id) {
    case 't_minus_5':
      return `Hi ${residentName}, a gentle reminder: rent of ${due} for ${dateStr} is coming up. Pay via UPI or ${payLink || 'PGWalo'} to stay on schedule. - Sent via PGWalo`;
    case 't_minus_2':
      return `Hi ${residentName}, your rent of ${due} is due on ${dateStr}. Pay via UPI or ${payLink || 'PGWalo'}. - Sent via PGWalo`;
    case 'due_today':
      return `Hi ${residentName}, rent of ${due} is due today. Pay here: ${payLink || 'PGWalo'}. - Sent via PGWalo`;
    case 'plus_2':
      return `Hi ${residentName}, your rent of ${due} was due on ${dateStr} and is now overdue. Please pay today: ${payLink || 'PGWalo'}. - Sent via PGWalo`;
    case 'plus_5':
      return `Hi ${residentName}, rent of ${due} remains unpaid since ${dateStr}. This is a final reminder before escalation to the owner. Pay here: ${payLink || 'PGWalo'}. - Sent via PGWalo`;
    default:
      return `Hi ${residentName}, rent of ${due} relates to ${dateStr}. Pay here: ${payLink || 'PGWalo'}. - Sent via PGWalo`;
  }
};
