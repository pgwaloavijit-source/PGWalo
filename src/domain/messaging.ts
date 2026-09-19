/**
 * WhatsApp-first messaging — provider-agnostic boundary (spec §12).
 *
 * Never fabricates delivery. When no BSP credentials exist the adapter
 * produces wa.me deep links (always available) and records the outbound
 * intent; automation (send via API) activates only when configured.
 */
export interface SendTemplateResult {
  ok: boolean;
  /** true only when a real provider call was attempted and accepted */
  sent: boolean;
  /** 'deep_link' = client-side wa.me handoff; 'api' = provider call */
  transport: 'deep_link' | 'api' | 'none';
  deepLink?: string;
  intentId?: string;
  error?: string;
}

export interface WhatsAppTemplate {
  id: string;
  label: string;
  body: (ctx: WhatsAppTemplateContext) => string;
}

export interface WhatsAppTemplateContext {
  leadName?: string;
  propertyName?: string;
  locality?: string;
  visitTime?: string;
  tokenAmount?: number;
  paymentLink?: string;
  dueDate?: string;
  amount?: number;
  deepLinkUrl?: string;
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'lead_ack',
    label: 'Lead acknowledgement',
    body: (c) =>
      `Hello ${c.leadName || 'there'}! Thank you for your interest in ${c.propertyName || 'our PG'}${c.locality ? ` (${c.locality})` : ''}. Reply here and we will share availability, pricing and a visit slot.`,
  },
  {
    id: 'property_details',
    label: 'Property details',
    body: (c) =>
      `${c.propertyName || 'Our PG'}${c.locality ? `, ${c.locality}` : ''}: photos, pricing and live availability here: ${c.deepLinkUrl || ''}`,
  },
  {
    id: 'visit_confirm',
    label: 'Visit confirmation',
    body: (c) =>
      `Your visit to ${c.propertyName || 'the PG'} is confirmed for ${c.visitTime || 'the scheduled time'}. Address and directions: ${c.deepLinkUrl || ''}`,
  },
  {
    id: 'visit_reminder',
    label: 'Visit reminder',
    body: (c) => `Reminder: your visit to ${c.propertyName || 'the PG'} is coming up at ${c.visitTime || ''}. See you soon!`,
  },
  {
    id: 'token_link',
    label: 'Token / reservation link',
    body: (c) =>
      `Reserve your bed at ${c.propertyName || 'the PG'} with a token of ₹${c.tokenAmount ?? ''}. Secure link: ${c.paymentLink || ''}`,
  },
  {
    id: 'kyc_link',
    label: 'KYC onboarding link',
    body: (c) => `Complete your quick KYC to confirm your stay: ${c.deepLinkUrl || ''}`,
  },
  {
    id: 'rent_reminder',
    label: 'Rent reminder',
    body: (c) => `Gentle reminder: rent of ₹${c.amount ?? ''} for ${c.propertyName || 'your stay'} is due on ${c.dueDate || ''}. Pay here: ${c.paymentLink || ''}`,
  },
  {
    id: 'payment_receipt',
    label: 'Payment receipt',
    body: (c) => `Payment received: ₹${c.amount ?? ''}. Thank you! Receipt: ${c.deepLinkUrl || ''}`,
  },
  {
    id: 'maintenance_update',
    label: 'Maintenance update',
    body: (c) => `Update on your request at ${c.propertyName || 'the PG'}. Details: ${c.deepLinkUrl || ''}`,
  },
  {
    id: 'notice_ack',
    label: 'Notice acknowledgement',
    body: (c) => `Your notice has been recorded. Move-out date: ${c.dueDate || ''}. Settlement details will follow after inspection.`,
  },
  {
    id: 'deposit_summary',
    label: 'Deposit settlement summary',
    body: (c) => `Deposit settlement: ₹${c.amount ?? ''} refund processed. Details: ${c.deepLinkUrl || ''}`,
  },
];

/** Builds the universal WhatsApp deep link — works without any provider. */
export const whatsappDeepLink = (phone: string, message: string): string => {
  const digits = (phone || '').replace(/\D/g, '');
  const withCc = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCc}?text=${encodeURIComponent(message)}`;
};

/**
 * The "adapter": in this build the transport is always the deep link handoff
 * (client opens WhatsApp). A BSP adapter (Gupshup/Interakt/Meta Cloud API)
 * plugs in by implementing `sendViaApi` — the interface and message intent
 * records stay identical. Credentials absent ⇒ sent=false, transport stays
 * 'deep_link', nothing is fabricated.
 */
export interface MessagingAdapter {
  sendTemplateMessage: (
    phone: string,
    template: WhatsAppTemplate,
    ctx: WhatsAppTemplateContext
  ) => Promise<SendTemplateResult>;
}

export const createMessagingAdapter = (opts?: {
  sendViaApi?: (phone: string, body: string) => Promise<{ ok: boolean; error?: string }>;
}): MessagingAdapter => ({
  sendTemplateMessage: async (phone, template, ctx) => {
    const body = template.body(ctx);
    const deepLink = whatsappDeepLink(phone, body);
    if (!opts?.sendViaApi) {
      return { ok: true, sent: false, transport: 'deep_link', deepLink };
    }
    try {
      const result = await opts.sendViaApi(phone, body);
      return result.ok
        ? { ok: true, sent: true, transport: 'api', deepLink }
        : { ok: false, sent: false, transport: 'api', deepLink, error: result.error || 'Provider rejected the message' };
    } catch (error) {
      return { ok: false, sent: false, transport: 'api', deepLink, error: error instanceof Error ? error.message : 'Provider error' };
    }
  },
});
