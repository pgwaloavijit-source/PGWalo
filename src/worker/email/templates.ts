/**
 * Transactional email templates.
 *
 * Every product event is declared once in `EVENTS`; the shared `layout()`
 * renders the branded HTML + plain-text pair. Adding an event is a few lines
 * here and nothing else changes anywhere in the codebase.
 */
export type EmailCategory =
  | 'auth' | 'listing' | 'visit' | 'booking' | 'allocation' | 'rent'
  | 'agreement' | 'maintenance' | 'notice' | 'staff' | 'kyc'
  | 'broadcast' | 'admin' | 'support';

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
  category: EmailCategory;
  /** Security mail (OTP/reset) ignores opt-out preferences. */
  security?: boolean;
}

type Data = Record<string, unknown>;
type Row = [string, unknown];

const APP_URL = 'https://pgwalo.com';

export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] || c));
}

const str = (v: unknown): string => (v === null || v === undefined || v === '' ? '' : String(v));
const app = (d: Data) => str(d.appUrl) || APP_URL;
const rows = (pairs: Row[]): Row[] => pairs.filter(([, v]) => str(v) !== '');
const lines = (pairs: Row[]): string =>
  pairs.map(([k, v]) => `${k}: ${str(v)}`).join('\n');

/** Branded wrapper shared by every template. */
export function layout(opts: {
  title: string;
  intro?: string;
  rows?: Row[];
  cta?: { label: string; url: string };
  footnote?: string;
  unsubscribeUrl?: string;
}): { html: string; text: string } {
  const rowHtml = (opts.rows || [])
    .map(([k, v]) => `<tr>
        <td style="padding:6px 0;color:#64748b;font-size:13px;width:44%;vertical-align:top">${esc(k)}</td>
        <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:700">${esc(v)}</td>
      </tr>`)
    .join('');

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr><td style="background:#2563eb;border-radius:16px 16px 0 0;padding:18px 24px">
      <span style="color:#fff;font-size:17px;font-weight:800;letter-spacing:-0.01em">PG<span style="opacity:.85">Walo</span></span>
    </td></tr>
    <tr><td style="background:#ffffff;padding:24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
      <h1 style="margin:0 0 12px;font-size:19px;line-height:1.3;color:#0f172a">${esc(opts.title)}</h1>
      ${opts.intro ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155">${esc(opts.intro)}</p>` : ''}
      ${rowHtml ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:4px 0 16px">${rowHtml}</table>` : ''}
      ${opts.cta ? `<a href="${esc(opts.cta.url)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:11px 20px;border-radius:12px">${esc(opts.cta.label)}</a>` : ''}
      ${opts.footnote ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#64748b">${esc(opts.footnote)}</p>` : ''}
    </td></tr>
    <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:16px 24px">
      <p style="margin:0;font-size:11px;line-height:1.6;color:#94a3b8">
        Sent by PGWalo · pgwalo.com<br/>
        ${opts.unsubscribeUrl
          ? `You can <a href="${esc(opts.unsubscribeUrl)}" style="color:#64748b">turn off these updates</a>. Account and security emails are always delivered.`
          : 'This is an account or security message and cannot be unsubscribed.'}
      </p>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    opts.title,
    opts.intro || '',
    opts.rows?.length ? lines(opts.rows) : '',
    opts.cta ? `${opts.cta.label}: ${opts.cta.url}` : '',
    opts.footnote || '',
    '— PGWalo · pgwalo.com',
    opts.unsubscribeUrl ? `Turn off these updates: ${opts.unsubscribeUrl}` : '',
  ].filter(Boolean).join('\n\n');

  return { html, text };
}

interface EventDef {
  category: EmailCategory;
  security?: boolean;
  subject: (d: Data) => string;
  title: (d: Data) => string;
  intro: (d: Data) => string;
  rows?: (d: Data) => Row[];
  cta?: (d: Data) => { label: string; url: string };
  footnote?: (d: Data) => string;
}

/**
 * The full product event matrix. Data keys are supplied by the caller
 * (worker handler or /api/notify/event); missing keys simply drop their row.
 */
export const EVENTS: Record<string, EventDef> = {
  // ---- account & security -------------------------------------------------
  'auth.otp': {
    category: 'auth', security: true,
    subject: (d) => `${str(d.code)} is your PGWalo verification code`,
    title: () => 'Your verification code',
    intro: (d) => `${str(d.code)} is your one-time code. It expires in 10 minutes. Never share it with anyone.`,
    footnote: () => 'If you did not request this code, you can ignore this email.',
  },
  'auth.welcome': {
    category: 'auth',
    subject: () => 'Welcome to PGWalo',
    title: (d) => `Welcome aboard, ${str(d.recipientName) || 'there'}`,
    intro: () => 'Your PGWalo account is ready. Search verified PGs, schedule free visits, and manage your stay from one place.',
    rows: (d) => rows([['Mobile', d.phone], ['Signed up as', d.role]]),
    cta: (d) => ({ label: 'Find your PG', url: `${app(d)}/search` }),
    footnote: () => 'Complete your profile to book visits and pay rent faster.',
  },
  'auth.password_reset': {
    category: 'auth', security: true,
    subject: () => 'Reset your PGWalo password',
    title: () => 'Reset your password',
    intro: (d) => `Use code ${str(d.code)} to reset your password. It expires in 10 minutes.`,
  },

  // ---- listings -----------------------------------------------------------
  'listing.submitted': {
    category: 'listing',
    subject: (d) => `Listing submitted for review — ${str(d.propertyName)}`,
    title: () => 'Your listing is in review',
    intro: () => 'Thanks for listing with PGWalo. Our team verifies new properties, usually within 24 hours.',
    rows: (d) => rows([['Property', d.propertyName], ['City', d.city], ['Locality', d.locality], ['Reference', d.referenceId]]),
    cta: (d) => ({ label: 'Track verification', url: `${app(d)}/owner` }),
  },
  'listing.approved': {
    category: 'listing',
    subject: (d) => `Listing approved — ${str(d.propertyName)}`,
    title: () => 'Your property is verified',
    intro: () => 'Your listing is approved and can now accept visits and bookings.',
    rows: (d) => rows([['Property', d.propertyName], ['Bed capacity', d.totalBeds]]),
    cta: (d) => ({ label: 'Open owner console', url: `${app(d)}/owner` }),
  },
  'listing.rejected': {
    category: 'listing',
    subject: (d) => `Action needed — ${str(d.propertyName)}`,
    title: () => 'We need a few changes',
    intro: () => 'Your listing needs updates before it can go live.',
    rows: (d) => rows([['Property', d.propertyName], ['Reason', d.reason]]),
    cta: (d) => ({ label: 'Update listing', url: `${app(d)}/owner` }),
  },
  'listing.published': {
    category: 'listing',
    subject: (d) => `${str(d.propertyName)} is live on PGWalo`,
    title: () => 'Your PG is now live',
    intro: () => 'Residents can find and book your property. Every enquiry and visit lands in your owner console.',
    rows: (d) => rows([['Property', d.propertyName], ['Starting rent', d.startingPrice]]),
    cta: (d) => ({ label: 'View live listing', url: `${app(d)}/search` }),
  },

  // ---- visits -------------------------------------------------------------
  'visit.scheduled': {
    category: 'visit',
    subject: (d) => `Visit confirmed — ${str(d.propertyName)}`,
    title: () => 'Your property visit is confirmed',
    intro: () => 'Show the reference below at the gate. You can reschedule any time from the app.',
    rows: (d) => rows([['Property', d.propertyName], ['Date', d.visitDate], ['Time slot', d.visitTimeSlot], ['Contact', d.contact], ['Reference', d.referenceId]]),
    cta: (d) => ({ label: 'View visit', url: `${app(d)}/resident` }),
  },
  'visit.rescheduled': {
    category: 'visit',
    subject: (d) => `Visit rescheduled — ${str(d.propertyName)}`,
    title: () => 'Your visit has been rescheduled',
    intro: () => 'Here are the updated details.',
    rows: (d) => rows([['Property', d.propertyName], ['New date', d.visitDate], ['New slot', d.visitTimeSlot], ['Reference', d.referenceId]]),
  },
  'visit.cancelled': {
    category: 'visit',
    subject: (d) => `Visit cancelled — ${str(d.propertyName)}`,
    title: () => 'Your visit was cancelled',
    intro: () => 'No charges apply. You can book a new slot whenever you are ready.',
    rows: (d) => rows([['Property', d.propertyName], ['Was scheduled', d.visitDate], ['Reference', d.referenceId]]),
    cta: (d) => ({ label: 'Book another visit', url: `${app(d)}/search` }),
  },
  'visit.reminder': {
    category: 'visit',
    subject: (d) => `Reminder: your visit is ${str(d.when) || 'coming up'}`,
    title: () => 'Your PG visit is coming up',
    intro: () => 'See you soon — carry a photo ID for gate entry.',
    rows: (d) => rows([['Property', d.propertyName], ['Date', d.visitDate], ['Time slot', d.visitTimeSlot], ['Reference', d.referenceId]]),
  },

  // ---- bookings -----------------------------------------------------------
  'booking.requested': {
    category: 'booking',
    subject: (d) => `New stay application — ${str(d.propertyName)}`,
    title: (d) => `New application from ${str(d.applicantName) || 'a resident'}`,
    intro: () => 'Review the request and allocate a bed to confirm it.',
    rows: (d) => rows([['Property', d.propertyName], ['Applicant', d.applicantName], ['Sharing', d.roomType], ['Move-in', d.moveInDate], ['Mobile', d.phone], ['Reference', d.referenceId]]),
    cta: (d) => ({ label: 'Review request', url: `${app(d)}/owner` }),
  },
  'booking.approved': {
    category: 'booking',
    subject: (d) => `Room allotted — ${str(d.propertyName)}`,
    title: () => 'Your bed is confirmed',
    intro: () => 'Your stay application is approved and your bed has been allocated. Welcome home.',
    rows: (d) => rows([['Property', d.propertyName], ['Room', d.roomNumber], ['Bed', d.bedNumber], ['Sharing', d.roomType], ['Monthly rent', d.rent], ['Move-in', d.moveInDate]]),
    cta: (d) => ({ label: 'Open resident portal', url: `${app(d)}/resident` }),
    footnote: () => 'Complete your digital agreement and KYC to activate all services.',
  },
  'booking.rejected': {
    category: 'booking',
    subject: (d) => `Stay application update — ${str(d.propertyName)}`,
    title: () => 'We could not confirm this booking',
    intro: () => 'The property is unable to accommodate this request right now. You can apply to other verified PGs near you.',
    rows: (d) => rows([['Property', d.propertyName], ['Reason', d.reason], ['Reference', d.referenceId]]),
    cta: (d) => ({ label: 'Find another PG', url: `${app(d)}/search` }),
  },

  // ---- allocation & stay --------------------------------------------------
  'allocation.room_allotted': {
    category: 'allocation',
    subject: (d) => `Room allotted — ${str(d.roomNumber)} at ${str(d.propertyName)}`,
    title: () => 'Your room is ready',
    intro: () => 'Here are your accommodation details for move-in day.',
    rows: (d) => rows([['Property', d.propertyName], ['Room', d.roomNumber], ['Bed', d.bedNumber], ['Monthly rent', d.rent], ['Deposit', d.deposit], ['Move-in', d.moveInDate]]),
    cta: (d) => ({ label: 'View my stay', url: `${app(d)}/resident` }),
  },
  'allocation.room_changed': {
    category: 'allocation',
    subject: (d) => `Room change — ${str(d.propertyName)}`,
    title: () => 'Your room has been changed',
    intro: () => 'Your allocation was updated by the property team.',
    rows: (d) => rows([['Property', d.propertyName], ['Previous room', d.fromRoom], ['New room', d.toRoom], ['Effective', d.effectiveDate]]),
  },
  'allocation.vacated': {
    category: 'allocation',
    subject: (d) => `Checkout complete — ${str(d.propertyName)}`,
    title: () => 'Your checkout is complete',
    intro: () => 'Thanks for staying with PGWalo. Your deposit settlement is being processed.',
    rows: (d) => rows([['Property', d.propertyName], ['Room', d.roomNumber], ['Checkout date', d.checkoutDate], ['Refund', d.refundAmount]]),
  },

  // ---- rent ---------------------------------------------------------------
  'rent.invoice': {
    category: 'rent',
    subject: (d) => `Rent invoice ${str(d.month)} — ₹${str(d.amount)}`,
    title: () => 'Your monthly invoice is ready',
    intro: () => 'Pay online to avoid late-payment follow-ups. A receipt is issued instantly.',
    rows: (d) => rows([['Invoice', d.invoiceNumber], ['Month', d.month], ['Room', d.roomNumber], ['Amount due', d.amount], ['Due date', d.dueDate]]),
    cta: (d) => ({ label: 'Pay rent', url: `${app(d)}/resident` }),
  },
  'rent.due_reminder': {
    category: 'rent',
    subject: (d) => `Rent due ${str(d.dueDate)} — ₹${str(d.amount)}`,
    title: () => 'Rent is due soon',
    intro: () => 'A quick reminder so you stay ahead of the due date.',
    rows: (d) => rows([['Month', d.month], ['Amount', d.amount], ['Due date', d.dueDate], ['Room', d.roomNumber]]),
    cta: (d) => ({ label: 'Pay now', url: `${app(d)}/resident` }),
  },
  'rent.paid': {
    category: 'rent',
    subject: (d) => `Payment received — ₹${str(d.amount)}`,
    title: () => 'Payment received. Thank you!',
    intro: () => 'Your rent payment is recorded and your receipt is available in the app.',
    rows: (d) => rows([['Amount', d.amount], ['Method', d.method], ['Transaction', d.transactionId], ['Month', d.month], ['Room', d.roomNumber]]),
    cta: (d) => ({ label: 'Download receipt', url: `${app(d)}/resident` }),
  },
  'rent.overdue': {
    category: 'rent',
    subject: (d) => `Rent overdue — ₹${str(d.outstanding)}`,
    title: () => 'Your rent payment is overdue',
    intro: () => 'Please clear the outstanding balance to keep your stay in good standing.',
    rows: (d) => rows([['Outstanding', d.outstanding], ['Due date', d.dueDate], ['Days late', d.daysLate], ['Room', d.roomNumber]]),
    cta: (d) => ({ label: 'Pay now', url: `${app(d)}/resident` }),
  },

  // ---- agreements ---------------------------------------------------------
  'agreement.sent': {
    category: 'agreement',
    subject: (d) => `Sign your stay agreement — ${str(d.propertyName)}`,
    title: () => 'Your digital agreement is ready',
    intro: () => 'Please review and sign. It takes under a minute and is legally valid.',
    rows: (d) => rows([['Property', d.propertyName], ['Room', d.roomNumber], ['Monthly rent', d.rent], ['Start date', d.startDate], ['End date', d.endDate]]),
    cta: (d) => ({ label: 'Review & sign', url: `${app(d)}/resident` }),
  },
  'agreement.signed': {
    category: 'agreement',
    subject: (d) => `Agreement signed — ${str(d.propertyName)}`,
    title: () => 'Agreement signed',
    intro: () => 'A signed copy is attached to your account for download any time.',
    rows: (d) => rows([['Property', d.propertyName], ['Resident', d.residentName], ['Signed on', d.signedDate]]),
    cta: (d) => ({ label: 'Download copy', url: `${app(d)}/resident` }),
  },
  'agreement.expiring': {
    category: 'agreement',
    subject: (d) => `Agreement expires ${str(d.endDate)}`,
    title: () => 'Your stay agreement expires soon',
    intro: () => 'Renew to keep your current room and rent locked in.',
    rows: (d) => rows([['Property', d.propertyName], ['End date', d.endDate], ['Days left', d.daysLeft]]),
    cta: (d) => ({ label: 'Renew now', url: `${app(d)}/resident` }),
  },

  // ---- maintenance --------------------------------------------------------
  'maintenance.raised': {
    category: 'maintenance',
    subject: (d) => `${str(d.priority)} complaint — ${str(d.title)}`,
    title: (d) => `New ${str(d.priority) || ''} complaint from ${str(d.residentName) || 'a resident'}`.trim(),
    intro: () => 'Please inspect and update the status so the resident gets notified.',
    rows: (d) => rows([['Room', d.roomNumber], ['Category', d.category], ['Complaint', d.title], ['Details', d.description], ['Priority', d.priority], ['Fix by', d.slaDeadline], ['Reference', d.referenceId]]),
    cta: (d) => ({ label: 'Open work orders', url: `${app(d)}/staff` }),
  },
  'maintenance.assigned': {
    category: 'maintenance',
    subject: (d) => `Complaint assigned — ${str(d.title)}`,
    title: () => 'A complaint has been assigned to you',
    intro: () => 'Update the status as you inspect and complete the repair.',
    rows: (d) => rows([['Room', d.roomNumber], ['Complaint', d.title], ['Priority', d.priority], ['Fix by', d.slaDeadline], ['Reference', d.referenceId]]),
    cta: (d) => ({ label: 'View task', url: `${app(d)}/staff` }),
  },
  'maintenance.status': {
    category: 'maintenance',
    subject: (d) => `Complaint ${str(d.status)} — ${str(d.title)}`,
    title: (d) => `Your complaint is ${str(d.status)}`,
    intro: (d) => str(d.message) || 'The property team updated your complaint.',
    rows: (d) => rows([['Complaint', d.title], ['Status', d.status], ['Assigned to', d.assignedStaffName], ['Notes', d.notes], ['Reference', d.referenceId]]),
    cta: (d) => ({ label: 'Track complaint', url: `${app(d)}/resident` }),
  },
  'maintenance.escalated': {
    category: 'maintenance',
    subject: (d) => `SLA breached — ${str(d.title)} (${str(d.priority)})`,
    title: () => 'A complaint has breached its fix-by deadline',
    intro: () => 'This escalated past its SLA window and needs attention now.',
    rows: (d) => rows([['Property', d.propertyName], ['Room', d.roomNumber], ['Complaint', d.title], ['Priority', d.priority], ['Hours overdue', d.hoursOverdue], ['Assigned to', d.assignedStaffName], ['Reference', d.referenceId]]),
    cta: (d) => ({ label: 'Open maintenance board', url: `${app(d)}/owner` }),
  },

  // ---- notice period & checkout -------------------------------------------
  'notice.submitted': {
    category: 'notice',
    subject: (d) => `Vacating notice — ${str(d.residentName)} (Room ${str(d.roomNumber)})`,
    title: () => 'A resident has submitted a vacating notice',
    intro: () => 'Plan the checkout inspection and deposit settlement.',
    rows: (d) => rows([['Resident', d.residentName], ['Property', d.propertyName], ['Room', d.roomNumber], ['Notice date', d.noticeDate], ['Move-out', d.checkoutDate], ['Reason', d.reason]]),
  },
  'notice.checkout_scheduled': {
    category: 'notice',
    subject: (d) => `Checkout scheduled — ${str(d.checkoutDate)}`,
    title: () => 'Your checkout date is set',
    intro: () => 'Please clear personal belongings and keep the room ready for inspection.',
    rows: (d) => rows([['Property', d.propertyName], ['Room', d.roomNumber], ['Checkout date', d.checkoutDate], ['Inspection window', d.inspectionWindow]]),
  },
  'notice.settlement': {
    category: 'notice',
    subject: (d) => `Deposit settlement — ₹${str(d.refundAmount)}`,
    title: () => 'Your deposit settlement is ready',
    intro: () => 'Here is the final settlement for your stay.',
    rows: (d) => rows([['Deposit held', d.deposit], ['Deductions', d.deductions], ['Refund', d.refundAmount], ['Settlement date', d.settlementDate]]),
  },

  // ---- staff, KYC, broadcast ---------------------------------------------
  'staff.added': {
    category: 'staff',
    subject: (d) => `You have been added to ${str(d.propertyName)}`,
    title: () => 'Welcome to the PGWalo team',
    intro: () => 'Your staff account is active. Sign in with the mobile number and PIN shared by the owner.',
    rows: (d) => rows([['Property', d.propertyName], ['Role', d.role], ['Shift', d.shift], ['Mobile', d.phone]]),
    cta: (d) => ({ label: 'Open staff dashboard', url: `${app(d)}/staff` }),
  },
  'staff.removed': {
    category: 'staff',
    subject: (d) => `Access removed — ${str(d.propertyName)}`,
    title: () => 'Your staff access has ended',
    intro: () => 'You no longer have access to this property. Contact the owner if this looks wrong.',
    rows: (d) => rows([['Property', d.propertyName], ['Effective', d.effectiveDate]]),
  },
  'kyc.verified': {
    category: 'kyc',
    subject: () => 'KYC verified',
    title: () => 'Your KYC is verified',
    intro: () => 'All resident services are now unlocked on your account.',
    rows: (d) => rows([['Verified on', d.verifiedDate], ['Document', d.documentType]]),
  },
  'kyc.rejected': {
    category: 'kyc', security: true,
    subject: () => 'KYC needs another attempt',
    title: () => 'We could not verify your KYC',
    intro: () => 'Please re-upload the document. Most rejections are blurry photos or mismatched names.',
    rows: (d) => rows([['Reason', d.reason], ['Document', d.documentType]]),
    cta: (d) => ({ label: 'Re-upload KYC', url: `${app(d)}/resident` }),
  },
  'broadcast.announcement': {
    category: 'broadcast',
    subject: (d) => `${str(d.title)} — ${str(d.propertyName)}`,
    title: (d) => str(d.title) || 'Announcement from your PG',
    intro: (d) => str(d.message) || 'You have a new announcement from your property manager.',
    rows: (d) => rows([['Property', d.propertyName], ['Category', d.category], ['From', d.sender]]),
  },

  // ---- support & admin desk ----------------------------------------------
  'support.ticket_raised': {
    category: 'support',
    subject: (d) => `Support ticket ${str(d.referenceId)} — ${str(d.title)}`,
    title: () => 'A new support ticket needs attention',
    intro: () => 'Reply from the support desk to keep the requester informed.',
    rows: (d) => rows([['Raised by', d.requesterName], ['Type', d.ticketType], ['Priority', d.priority], ['Issue', d.title], ['Details', d.description], ['Reference', d.referenceId]]),
    cta: (d) => ({ label: 'Open support desk', url: `${app(d)}/admin` }),
  },
  'support.status': {
    category: 'support',
    subject: (d) => `Ticket ${str(d.referenceId)} updated — ${str(d.status)}`,
    title: (d) => `Your ticket is ${str(d.status)}`,
    intro: (d) => str(d.message) || 'Our team updated your support ticket.',
    rows: (d) => rows([['Ticket', d.title], ['Status', d.status], ['Response', d.response], ['Reference', d.referenceId]]),
    cta: (d) => ({ label: 'View ticket', url: `${app(d)}/support` }),
  },
  'admin.owner_signup': {
    category: 'admin',
    subject: (d) => `New owner signup — ${str(d.ownerName)}`,
    title: () => 'A new property owner registered',
    intro: () => 'Verify the owner and review their first listing.',
    rows: (d) => rows([['Owner', d.ownerName], ['Mobile', d.phone], ['Email', d.email], ['City', d.city], ['Property', d.propertyName]]),
    cta: (d) => ({ label: 'Open admin console', url: `${app(d)}/admin` }),
  },
  'admin.listing_review': {
    category: 'admin',
    subject: (d) => `Listing pending review — ${str(d.propertyName)}`,
    title: () => 'A listing is waiting for verification',
    intro: () => 'Approve or request changes so the owner can go live.',
    rows: (d) => rows([['Property', d.propertyName], ['Owner', d.ownerName], ['City', d.city], ['Locality', d.locality], ['Beds', d.totalBeds]]),
    cta: (d) => ({ label: 'Review listing', url: `${app(d)}/admin` }),
  },

  // ---- owner publishing payments -----------------------------------------
  // Money mail can never be opted out of, and both variants carry the number
  // and the property so the owner can reconcile them without signing in.
  'listing.payment_success': {
    category: 'listing', security: true,
    subject: (d) => `Payment received — ${str(d.propertyName)} is live`,
    title: () => 'Your PG is published',
    intro: () =>
      'Thank you — your payment is confirmed and your listing is live. The tax invoice is attached as a PDF.',
    rows: (d) => rows([
      ['Property', d.propertyName],
      ['Plan', d.planName],
      ['Amount paid', d.amount],
      ['Invoice', d.invoiceNumber],
      ['Payment ID', d.paymentId],
      ['Valid till', d.validTill],
    ]),
    cta: (d) => ({ label: 'View your listing', url: `${app(d)}/owner` }),
    footnote: () => 'Keep this invoice for your records. Renewal is due at the end of the plan period.',
  },
  'listing.payment_failed': {
    category: 'listing', security: true,
    subject: (d) => `Payment could not be completed — ${str(d.propertyName)}`,
    title: () => 'Your payment did not go through',
    intro: (d) =>
      `No money has been taken. Your listing is saved and still waiting — complete the payment of ${str(d.amount)} with the secure link below and it goes live immediately.`,
    rows: (d) => rows([
      ['Property', d.propertyName],
      ['Plan', d.planName],
      ['Amount due', d.amount],
      ['Reason', d.reason],
      ['Link valid till', d.validTill],
    ]),
    cta: (d) => ({ label: 'Complete payment', url: str(d.paymentLink) || `${app(d)}/owner` }),
    footnote: () => 'The link is created for your account only. Nothing is charged until you approve the payment.',
  },
};

/** Render any declared event. Returns null for an unknown event name. */
export function renderEvent(
  event: string,
  data: Data,
  opts?: { unsubscribeUrl?: string }
): EmailContent | null {
  const def = EVENTS[event];
  if (!def) return null;

  const rowList = def.rows ? def.rows(data) : [];
  const cta = def.cta ? def.cta(data) : undefined;
  const { html, text } = layout({
    title: def.title(data),
    intro: def.intro(data),
    rows: rowList,
    cta,
    footnote: def.footnote ? def.footnote(data) : undefined,
    unsubscribeUrl: def.security ? undefined : opts?.unsubscribeUrl,
  });

  return { subject: def.subject(data), html, text, category: def.category, security: def.security };
}

export function isKnownEvent(event: string): boolean {
  return Boolean(EVENTS[event]);
}
