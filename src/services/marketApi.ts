/**
 * Market API client — typed wrappers around the Worker's /api/market/* routes,
 * with demo-mode fallbacks that mirror the same domain rules so both modes
 * behave identically.
 */
import { apiUrl } from './apiBase';
import { getAuthToken } from './productionApi';
import { checkReservationConflict } from '../domain/inventory';
import type {
  PropertyVisit, BedReservation, PaymentIntent, ExpenseEntry,
  PropertyInspection, VerifiedReview, ImportCommitResult, KycRecord,
  PropertyComplianceItem, ImportKind, ImportPreview,
} from '../domain/market';
import { parseCsv, buildImportPreview, rejectionReport, CSV_TEMPLATES } from '../domain/csvImport';
import { seedDemoMarketData } from '../domain/demoSeed';
import type { GuardianAccess, InstitutionalLead, InstitutionalStage, MealOpsEntry, GuardianViewPayload } from '../domain/p1';
import { canTransitionInstitutional, summarizeMealOps } from '../domain/p1';

const getAuthTokenFn = getAuthToken;

const jfetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthTokenFn();
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  const response = await fetch(apiUrl(path), { ...init, headers: { ...requestHeaders, ...(init?.headers as Record<string, string>) } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((body as { error?: string }).error || 'Request failed');
  }
  return response.json() as Promise<T>;
};

// ---------------------------------------------------------------- demo stores

const LS_KEY = 'pgwalo_market_demo_v1';

interface DemoStore {
  visits: PropertyVisit[];
  reservations: BedReservation[];
  intents: PaymentIntent[];
  expenses: ExpenseEntry[];
  inspections: PropertyInspection[];
  compliance: PropertyComplianceItem[];
  kyc: KycRecord[];
  reviews: VerifiedReview[];
  reminders: { residentId: string; rule: string; sentAt: string }[];
  guardians: (GuardianAccess & { tokenHash: string })[];
  institutional: InstitutionalLead[];
  mealOps: MealOpsEntry[];
}

const emptyStore = (): DemoStore => ({
  visits: [], reservations: [], intents: [], expenses: [], inspections: [],
  compliance: [], kyc: [], reviews: [], reminders: [],
  guardians: [], institutional: [], mealOps: [],
});

const loadDemo = (): DemoStore => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DemoStore>;
      // Merge over defaults so stores written before a field existed still load.
      return { ...emptyStore(), ...parsed };
    }
  } catch { /* fresh demo */ }
  // Fresh demo store: seed once with the market-ready fixtures (spec §43).
  const fresh = emptyStore();
  seedDemoMarketData(fresh);
  saveDemo(fresh);
  return fresh;
};

const saveDemo = (store: DemoStore) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch { /* ignore quota */ }
};

const mutateDemo = <T>(fn: (store: DemoStore) => T): T => {
  const store = loadDemo();
  const result = fn(store);
  saveDemo(store);
  return result;
};

export const isMarketApiEnabled = (): boolean => {
  const configured = Boolean((import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, ''));
  return import.meta.env.PROD || configured;
};

const mkId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createQS = (params: Record<string, string | undefined>): string =>
  new URLSearchParams(
    Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][]
  ).toString();

// --------------------------------------------------------------------- visits

export interface VisitInput {
  leadId?: string;
  propertyId: string;
  scheduledAt: string;
  assignedStaffName?: string;
  notes?: string;
}

export const fetchVisits = (params: { propertyId?: string; leadId?: string; status?: string } = {}): Promise<{ visits: PropertyVisit[] }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/visits?' + createQS(params))
    : Promise.resolve({ visits: loadDemo().visits });

export const createVisit = (input: VisitInput): Promise<{ ok: boolean; id: string }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/visits', { method: 'POST', body: JSON.stringify(input) })
    : Promise.resolve(mutateDemo((s) => {
      const visit: PropertyVisit = {
        id: mkId('visit'), leadId: input.leadId, propertyId: input.propertyId,
        scheduledAt: input.scheduledAt, assignedStaffName: input.assignedStaffName,
        notes: input.notes, status: 'scheduled', createdAt: new Date().toISOString(),
      };
      s.visits.unshift(visit);
      return { ok: true, id: visit.id };
    }));

export const patchVisit = (id: string, patch: { status?: string; outcome?: string; notes?: string }): Promise<{ ok: true }> =>
  isMarketApiEnabled()
    ? jfetch(`/api/market/visits/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
    : Promise.resolve(mutateDemo((s) => {
      const visit = s.visits.find((v) => v.id === id);
      if (!visit) throw new Error('Visit not found');
      const flow: Record<string, string[]> = {
        scheduled: ['confirmed', 'rescheduled', 'completed', 'no_show', 'cancelled'],
        confirmed: ['completed', 'no_show', 'rescheduled', 'cancelled'],
        rescheduled: ['confirmed', 'completed', 'no_show', 'cancelled'],
        completed: [], no_show: ['rescheduled'], cancelled: [],
      };
      if (patch.status && !(flow[visit.status] || []).includes(patch.status)) {
        throw new Error(`Cannot move a visit from ${visit.status} to ${patch.status}`);
      }
      if (patch.status) visit.status = patch.status as PropertyVisit['status'];
      if (patch.outcome !== undefined) visit.outcome = patch.outcome as PropertyVisit['outcome'];
      if (patch.notes !== undefined) visit.notes = patch.notes;
      if (patch.status === 'completed') visit.completedAt = new Date().toISOString();
      return { ok: true };
    }));

// --------------------------------------------------------------- reservations

export const fetchReservations = (params: { bedId?: string; status?: string } = {}): Promise<{ reservations: BedReservation[] }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/reservations?' + createQS(params))
    : Promise.resolve({ reservations: loadDemo().reservations });

export interface ReservationInput {
  bedId: string;
  propertyId: string;
  startDate: string;
  expiryAt?: string;
  tokenAmount?: number;
  guestName: string;
  guestPhone: string;
  leadId?: string;
  refundPolicy?: 'refundable' | 'non_refundable';
}

export const createReservation = (
  input: ReservationInput,
  ctx: { beds: { id: string; status: string; nextAvailableDate?: string }[] }
): Promise<{ ok: boolean; id: string }> => {
  if (!isMarketApiEnabled()) {
    // Same conflict rules as the Worker — the client check mirrors, server gates.
    const bed = ctx.beds.find((b) => b.id === input.bedId);
    const active = loadDemo()
      .reservations
      .filter((r) => r.bedId === input.bedId && ['pending_payment', 'held', 'confirmed'].includes(r.status));
    const conflict = checkReservationConflict(bed as never, input.startDate, active);
    if (conflict) return Promise.reject(new Error(conflict.message));
    return Promise.resolve(mutateDemo((s) => {
      const reservation: BedReservation = {
        id: mkId('res'), propertyId: input.propertyId, bedId: input.bedId,
        guestName: input.guestName, guestPhone: input.guestPhone, startDate: input.startDate,
        expiryAt: input.expiryAt || new Date(Date.now() + 24 * 3_600_000).toISOString(),
        tokenAmount: input.tokenAmount || 0, tokenPaymentStatus: 'pending',
        refundPolicySnapshot: input.refundPolicy || 'refundable',
        status: 'pending_payment', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      s.reservations.unshift(reservation);
      return { ok: true, id: reservation.id };
    }));
  }
  return jfetch('/api/market/reservations', { method: 'POST', body: JSON.stringify(input) });
};

export const patchReservation = (id: string, patch: { status?: string; tokenPaymentStatus?: string; cancellationReason?: string }): Promise<{ ok: true }> =>
  isMarketApiEnabled()
    ? jfetch(`/api/market/reservations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
    : Promise.resolve(mutateDemo((s) => {
      const r = s.reservations.find((x) => x.id === id);
      if (!r) throw new Error('Reservation not found');
      const flow: Record<string, string[]> = {
        pending_payment: ['held', 'confirmed', 'expired', 'cancelled'],
        held: ['confirmed', 'expired', 'cancelled'],
        confirmed: ['converted_to_stay', 'cancelled'],
        expired: [], cancelled: [], converted_to_stay: [],
      };
      if (patch.status && patch.status !== r.status && !(flow[r.status] || []).includes(patch.status)) {
        throw new Error(`Cannot move a reservation from ${r.status} to ${patch.status}`);
      }
      if (patch.status) r.status = patch.status as BedReservation['status'];
      if (patch.tokenPaymentStatus) r.tokenPaymentStatus = patch.tokenPaymentStatus as BedReservation['tokenPaymentStatus'];
      if (patch.cancellationReason) r.cancellationReason = patch.cancellationReason;
      r.updatedAt = new Date().toISOString();
      return { ok: true };
    }));

/** Confirmed reservation → resident + stay (spec §14 end of pipeline). */
export const convertReservationToStay = (
  id: string,
  input: { moveInDate?: string; monthlyRent?: number; depositAmount?: number; email?: string } = {},
): Promise<{ ok: boolean; residentId: string; stayId: string }> =>
  isMarketApiEnabled()
    ? jfetch(`/api/market/reservations/${encodeURIComponent(id)}/convert-to-stay`, {
      method: 'POST', body: JSON.stringify(input),
    })
    : Promise.resolve(mutateDemo((s) => {
      const r = s.reservations.find((x) => x.id === id);
      if (!r) throw new Error('Reservation not found');
      if (r.status !== 'confirmed') throw new Error('Only a confirmed reservation can convert to a stay');
      r.status = 'converted_to_stay';
      r.updatedAt = new Date().toISOString();
      const residentId = `res-${Date.now()}`;
      // Demo mode cannot create real residents (they live in AppContext);
      // the owner completes move-in through the Residents tab, which this
      // unlocks by freeing the reservation.
      return { ok: true, residentId, stayId: `stay-${residentId}` };
    }));

// ------------------------------------------------------------ payment intents

export const fetchPaymentIntents = (params: { status?: string; purpose?: string } = {}): Promise<{ intents: PaymentIntent[] }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/payment-intents?' + createQS(params))
    : Promise.resolve({ intents: loadDemo().intents });

export interface PaymentIntentInput {
  purpose: 'token' | 'rent' | 'deposit' | 'other';
  referenceId?: string;
  residentId?: string;
  leadId?: string;
  propertyId?: string;
  payerName: string;
  payerPhone: string;
  amount: number;
}

export interface PaymentIntentResult {
  ok: boolean;
  id: string;
  provider: string;
  paymentLink: string;
  gatewayConfigured: boolean;
}

export const createPaymentIntent = (input: PaymentIntentInput): Promise<PaymentIntentResult> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/payment-intents', { method: 'POST', body: JSON.stringify(input) })
    : Promise.resolve(mutateDemo((s) => {
      const intent: PaymentIntent = {
        id: mkId('pi'), purpose: input.purpose, referenceId: input.referenceId,
        residentId: input.residentId, leadId: input.leadId, propertyId: input.propertyId,
        payerName: input.payerName, payerPhone: input.payerPhone, amount: input.amount,
        currency: 'INR', status: 'created', provider: 'none',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      s.intents.unshift(intent);
      return { ok: true, id: intent.id, provider: 'none', paymentLink: '', gatewayConfigured: false };
    }));

export interface ReconcilePatch {
  status: 'paid' | 'failed' | 'cancelled';
  utr?: string;
  receiptNumber?: string;
  provider?: 'cashfree' | 'none';
}

export const reconcilePaymentIntent = (id: string, patch: ReconcilePatch): Promise<{ ok: true }> => {
  if (!isMarketApiEnabled()) {
    return Promise.resolve(mutateDemo((s) => {
      const intent = s.intents.find((x) => x.id === id);
      if (!intent) throw new Error('Payment intent not found');
      if (intent.status === 'paid' && patch.status !== 'paid') {
        throw new Error('A paid intent cannot be un-paid. Record a refund instead.');
      }
      if (patch.status === 'paid' && intent.provider === 'cashfree') {
        throw new Error('Gateway payments can only be confirmed by webhook verification, not manually.');
      }
      intent.status = patch.status;
      if (patch.utr) intent.utr = patch.utr;
      if (patch.receiptNumber) intent.receiptNumber = patch.receiptNumber;
      if (patch.status === 'paid') intent.paidAt = new Date().toISOString();
      intent.updatedAt = new Date().toISOString();
      return { ok: true };
    }));
  }
  return jfetch(`/api/market/payment-intents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
};

// ------------------------------------------------------------------- expenses

export const fetchExpenses = (params: { propertyId?: string; month?: string } = {}): Promise<{ expenses: ExpenseEntry[] }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/expenses?' + createQS(params))
    : Promise.resolve({ expenses: loadDemo().expenses });

export interface ExpenseInput {
  propertyId?: string;
  category: string;
  amount: number;
  date: string;
  vendor?: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  recurring?: boolean;
}

export const createExpense = (input: ExpenseInput): Promise<{ ok: boolean; id: string }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/expenses', { method: 'POST', body: JSON.stringify(input) })
    : Promise.resolve(mutateDemo((s) => {
      const expense: ExpenseEntry = {
        id: mkId('exp'), propertyId: input.propertyId || null,
        category: input.category as ExpenseEntry['category'],
        amount: input.amount, date: input.date, vendor: input.vendor,
        paymentMethod: input.paymentMethod, reference: input.reference, notes: input.notes,
        recurring: input.recurring, createdBy: 'demo', createdAt: new Date().toISOString(),
      };
      s.expenses.unshift(expense);
      return { ok: true, id: expense.id };
    }));

// ---------------------------------------------------------------- inspections

export const fetchInspections = (params: { residentId?: string; type?: string } = {}): Promise<{ inspections: PropertyInspection[] }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/inspections?' + createQS(params))
    : Promise.resolve({ inspections: loadDemo().inspections });

export interface InspectionInput {
  residentId?: string;
  stayId?: string;
  propertyId: string;
  roomNumber: string;
  bedNumber?: string;
  type: 'move_in' | 'move_out';
  inspectionDate?: string;
  items: { area: string; item: string; condition: string; remarks: string; photoUrl?: string }[];
  overallNotes?: string;
  referenceInspectionId?: string;
  meterReading?: string;
}

export const createInspection = (input: InspectionInput): Promise<{ ok: boolean; id: string }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/inspections', { method: 'POST', body: JSON.stringify(input) })
    : Promise.resolve(mutateDemo((s) => {
      const inspection: PropertyInspection = {
        id: mkId('insp'), residentId: input.residentId, stayId: input.stayId,
        propertyId: input.propertyId, roomNumber: input.roomNumber, bedNumber: input.bedNumber,
        type: input.type,
        inspectionDate: input.inspectionDate || new Date().toISOString().slice(0, 10),
        items: input.items as PropertyInspection['items'],
        residentConfirmed: false, staffConfirmed: true,
        overallNotes: input.overallNotes, referenceInspectionId: input.referenceInspectionId,
        meterReading: input.meterReading,
      };
      s.inspections.unshift(inspection);
      return { ok: true, id: inspection.id };
    }));

// ----------------------------------------------------------------- compliance

export const fetchCompliance = (propertyId: string): Promise<{ items: PropertyComplianceItem[] }> =>
  isMarketApiEnabled()
    ? jfetch(`/api/market/compliance?propertyId=${encodeURIComponent(propertyId)}`)
    : Promise.resolve({ items: loadDemo().compliance.filter((c) => c.propertyId === propertyId) });

export interface ComplianceUpsertInput {
  propertyId: string;
  templateItemId: string;
  status: string;
  documentUrl?: string;
  issuedAt?: string;
  expiresAt?: string;
  notes?: string;
}

export const upsertComplianceItem = (input: ComplianceUpsertInput): Promise<{ ok: boolean; id?: string }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/compliance', { method: 'POST', body: JSON.stringify(input) })
    : Promise.resolve(mutateDemo((s) => {
      const existing = s.compliance.find((c) => c.propertyId === input.propertyId && c.templateItemId === input.templateItemId);
      if (existing) {
        existing.status = input.status as PropertyComplianceItem['status'];
        if (input.documentUrl) existing.documentUrl = input.documentUrl;
        if (input.expiresAt) existing.expiresAt = input.expiresAt;
        existing.updatedAt = new Date().toISOString();
        return { ok: true, id: existing.id };
      }
      const item: PropertyComplianceItem = {
        id: mkId('pci'), propertyId: input.propertyId, templateItemId: input.templateItemId,
        status: input.status as PropertyComplianceItem['status'], documentUrl: input.documentUrl,
        expiresAt: input.expiresAt, notes: input.notes, updatedAt: new Date().toISOString(),
      };
      s.compliance.push(item);
      return { ok: true, id: item.id };
    }));

// ------------------------------------------------------------------------ kyc

export const fetchKyc = (params: { residentId?: string; state?: string } = {}): Promise<{ records: KycRecord[] }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/kyc?' + createQS(params))
    : Promise.resolve({ records: loadDemo().kyc });

export interface KycUpsertInput {
  id?: string;
  residentId?: string;
  leadId?: string;
  fullName: string;
  phone: string;
  state: string;
  maskedIdentifier?: string;
  verifiedName?: string;
  provider?: string;
  providerReference?: string;
  consentAt?: string;
}

export const upsertKyc = (input: KycUpsertInput): Promise<{ ok: boolean; id: string }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/kyc', { method: 'POST', body: JSON.stringify(input) })
    : Promise.resolve(mutateDemo((s) => {
      if (input.id) {
        const rec = s.kyc.find((k) => k.id === input.id);
        if (rec) {
          rec.state = input.state as KycRecord['state'];
          if (input.maskedIdentifier) rec.maskedIdentifier = input.maskedIdentifier;
          if (input.verifiedName) rec.verifiedName = input.verifiedName;
          rec.updatedAt = new Date().toISOString();
          return { ok: true, id: rec.id };
        }
      }
      const record: KycRecord = {
        id: input.id || mkId('kyc'), residentId: input.residentId, leadId: input.leadId,
        fullName: input.fullName, phone: input.phone, state: input.state as KycRecord['state'],
        maskedIdentifier: input.maskedIdentifier, verifiedName: input.verifiedName,
        provider: input.provider, providerReference: input.providerReference,
        consentAt: input.consentAt, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      s.kyc.push(record);
      return { ok: true, id: record.id };
    }));

// -------------------------------------------------------------------- reviews

export const fetchReviews = (propertyId?: string): Promise<{ reviews: VerifiedReview[] }> =>
  isMarketApiEnabled()
    ? jfetch(`/api/market/reviews${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`)
    : Promise.resolve({ reviews: loadDemo().reviews.filter((r) => !propertyId || r.propertyId === propertyId) });

export interface ReviewInput {
  propertyId: string;
  rating: number;
  comment: string;
  dimensions?: Record<string, number>;
  authorName?: string;
  allowEdit?: boolean;
}

export const createReview = (input: ReviewInput): Promise<{ ok: boolean; id: string }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/reviews', { method: 'POST', body: JSON.stringify(input) })
    : Promise.resolve(mutateDemo((s) => {
      const review: VerifiedReview = {
        id: mkId('rev'), propertyId: input.propertyId, authorName: input.authorName || 'Resident',
        rating: input.rating, comment: input.comment, dimensions: input.dimensions,
        isVerifiedStay: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      s.reviews.unshift(review);
      return { ok: true, id: review.id };
    }));

// -------------------------------------------------------------------- imports

export const previewImport = (
  kind: ImportKind,
  file: File,
  ctx: { existingPhones?: string[]; existingBedKeys?: string[] }
): Promise<ImportPreview> =>
  file.text().then((text) => {
    const parsed = parseCsv(text);
    return buildImportPreview(kind, parsed, {
      phones: new Set((ctx.existingPhones || []).map((p) => p.replace(/\D/g, '').slice(-10))),
      bedKeys: new Set(ctx.existingBedKeys || []),
    });
  });

export const commitImport = (
  kind: ImportKind,
  propertyId: string,
  rows: Record<string, string>[]
): Promise<ImportCommitResult> => {
  if (!isMarketApiEnabled()) {
    // Demo: the UI layer wires demo commits through AppContext adders.
    return Promise.resolve({ ok: true, committed: rows.length, rejected: 0, jobId: mkId('imp') });
  }
  return jfetch('/api/market/imports/commit', { method: 'POST', body: JSON.stringify({ kind, propertyId, rows }) });
};

export const downloadRejectionReport = (preview: ImportPreview): void => {
  const csv = rejectionReport(preview);
  triggerDownload(csv, `import-rejections-${Date.now()}.csv`);
};

export const downloadCsvTemplate = (kind: ImportKind): void => {
  triggerDownload(CSV_TEMPLATES[kind], `pgwalo-${kind}-template.csv`);
};

const triggerDownload = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ------------------------------------------------------------------ analytics

export interface MarketAnalytics {
  kpis: {
    totalBeds: number;
    occupiedBeds: number;
    vacantBeds: number;
    overdueAmount: number;
    collectionRate: number | null;
    depositLiability: number;
    expensesTotal: number;
    futureVacancies7: number;
    futureVacancies30: number;
    futureVacancies60: number;
  };
  leadFunnel: { stage: string; count: number }[];
  conversions: { leadToVisit: number | null; visitToToken: number | null; tokenToMoveIn: number | null };
  perProperty: {
    propertyId: string;
    propertyName: string;
    total: number;
    occupied: number;
    vacant: number;
  }[];
  definitions?: string;
  generatedAt: string;
}

export const fetchMarketAnalytics = (): Promise<MarketAnalytics> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/analytics/owner')
    : Promise.resolve({
      kpis: { totalBeds: 0, occupiedBeds: 0, vacantBeds: 0, overdueAmount: 0, collectionRate: null, depositLiability: 0, expensesTotal: 0, futureVacancies7: 0, futureVacancies30: 0, futureVacancies60: 0 },
      leadFunnel: [],
      conversions: { leadToVisit: null, visitToToken: null, tokenToMoveIn: null },
      perProperty: [],
      generatedAt: new Date().toISOString(),
    });

// ------------------------------------------------------------------ reminders

/** All recent reminder logs — feeds the collection-cycle engine's suppression set. */
export const fetchAllReminders = (): Promise<{ recent: { residentId: string; invoiceId?: string | null; rule: string; channel?: string; sentAt: string }[] }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/reminders')
    : Promise.resolve({
      recent: loadDemo().reminders.map((r) => ({
        residentId: r.residentId, invoiceId: null, rule: r.rule, channel: 'whatsapp', sentAt: r.sentAt,
      })),
    });

export const logReminder = (input: { residentId: string; invoiceId?: string; rule: string; channel?: string }): Promise<{ ok: boolean }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/reminders', { method: 'POST', body: JSON.stringify(input) })
    : Promise.resolve(mutateDemo((s) => {
      s.reminders.push({ residentId: input.residentId, rule: input.rule, sentAt: new Date().toISOString() });
      return { ok: true };
    }));

export const respondToReview = (reviewId: string, response: string): Promise<{ ok: boolean }> =>
  isMarketApiEnabled()
    ? jfetch(`/api/market/reviews/${encodeURIComponent(reviewId)}/respond`, { method: 'POST', body: JSON.stringify({ response }) })
    : Promise.resolve(mutateDemo((s) => {
      const review = s.reviews.find((r) => r.id === reviewId);
      if (review) {
        review.ownerResponse = response;
        review.ownerRespondedAt = new Date().toISOString();
      }
      return { ok: true };
    }));

export const reminderStatus = (residentId: string, rule: string): Promise<{ recent: { sentAt: string }[] }> =>
  isMarketApiEnabled()
    ? jfetch(`/api/market/reminders?residentId=${encodeURIComponent(residentId)}&rule=${encodeURIComponent(rule)}`)
    : Promise.resolve({
      recent: loadDemo().reminders
        .filter((r) => r.residentId === residentId && r.rule === rule)
        .map((r) => ({ sentAt: r.sentAt })),
    });

// ------------------------------------------------------- P1: guardian access

/** Owner-side list of guardian links (raw tokens are never stored or re-shown). */
export const fetchGuardianAccess = (params: { residentId?: string } = {}): Promise<{ access: GuardianAccess[] }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/guardian-access?' + createQS({ residentId: params.residentId }))
    : Promise.resolve({ access: loadDemo().guardians.map(({ tokenHash: _h, ...g }) => g) });

export interface GuardianInviteResult { ok: boolean; id: string; token: string; inviteLink: string }

/** Invites a guardian; the raw token/invite link is returned exactly once. */
export const inviteGuardianAccess = (input: {
  residentId: string; guardianName: string; guardianPhone?: string; relation?: string;
}): Promise<GuardianInviteResult> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/guardian-access', { method: 'POST', body: JSON.stringify(input) })
    : Promise.resolve(mutateDemo((s) => {
      if (!input.residentId || !input.guardianName.trim()) throw new Error('residentId and guardianName are required');
      const rawToken = `pgw-${mkId('g')}`;
      const id = mkId('guard');
      s.guardians.push({
        id, organizationId: 'demo-org', residentId: input.residentId,
        guardianName: input.guardianName.trim(), guardianPhone: input.guardianPhone || null,
        relation: input.relation || null, status: 'active', createdAt: new Date().toISOString(),
        revokedAt: null, tokenHash: `demo-${id}`,
      });
      return { ok: true, id, token: rawToken, inviteLink: `${window.location.origin}/guardian?token=${rawToken}` };
    }));

export const revokeGuardianAccess = (accessId: string): Promise<{ ok: boolean }> =>
  isMarketApiEnabled()
    ? jfetch(`/api/market/guardian-access/${encodeURIComponent(accessId)}/revoke`, { method: 'POST' })
    : Promise.resolve(mutateDemo((s) => {
      const g = s.guardians.find((x) => x.id === accessId);
      if (!g) throw new Error('Access record not found');
      if (g.status !== 'active') throw new Error('Access already revoked');
      g.status = 'revoked';
      g.revokedAt = new Date().toISOString();
      return { ok: true };
    }));

/** Public guardian read (token-scoped, no auth) — also used by the portal page. */
export const fetchGuardianView = (token: string): Promise<GuardianViewPayload & { guardian: { name: string; relation: string | null } }> =>
  isMarketApiEnabled()
    ? jfetch(`/api/market/guardian-view?token=${encodeURIComponent(token)}`)
    : Promise.reject(new Error('The guardian portal needs a connected backend. Ask the PG owner for a new link.'));

// ------------------------------------------------- P1: institutional booking

export const fetchInstitutionalLeads = (): Promise<{ leads: InstitutionalLead[] }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/institutional')
    : Promise.resolve({ leads: loadDemo().institutional });

export const createInstitutionalLead = (input: {
  institutionName: string; contactName?: string; contactPhone?: string; contactEmail?: string;
  requiredBeds: number; genderEligibility?: 'male' | 'female' | 'any';
  targetLocalities?: string[]; budgetPerBed?: number; moveInDate?: string;
  durationMonths?: number; notes?: string;
}): Promise<{ ok: boolean; id: string }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/institutional', { method: 'POST', body: JSON.stringify(input) })
    : Promise.resolve(mutateDemo((s) => {
      if (!input.institutionName.trim()) throw new Error('institutionName is required');
      const now = new Date().toISOString();
      const lead: InstitutionalLead = {
        id: mkId('inst'), organizationId: 'demo-org', institutionName: input.institutionName.trim(),
        contactName: input.contactName || null, contactPhone: input.contactPhone || null,
        contactEmail: input.contactEmail || null, requiredBeds: Math.max(1, input.requiredBeds || 1),
        genderEligibility: input.genderEligibility || null, targetLocalities: input.targetLocalities || [],
        budgetPerBed: input.budgetPerBed ?? null, moveInDate: input.moveInDate || null,
        durationMonths: input.durationMonths ?? null, status: 'new',
        shortlistedPropertyIds: [], allocatedBedIds: [], notes: input.notes || null,
        createdAt: now, updatedAt: now,
      };
      s.institutional.push(lead);
      return { ok: true, id: lead.id };
    }));

export const patchInstitutionalLead = (id: string, patch: {
  status?: InstitutionalStage; shortlistedPropertyIds?: string[]; allocatedBedIds?: string[]; notes?: string;
}): Promise<{ ok: boolean }> =>
  isMarketApiEnabled()
    ? jfetch(`/api/market/institutional/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
    : Promise.resolve(mutateDemo((s) => {
      const lead = s.institutional.find((x) => x.id === id);
      if (!lead) throw new Error('Institutional lead not found');
      if (patch.status && patch.status !== lead.status && !canTransitionInstitutional(lead.status, patch.status)) {
        throw new Error(`Cannot move institutional lead from ${lead.status} to ${patch.status}`);
      }
      if (patch.allocatedBedIds && patch.allocatedBedIds.length > lead.requiredBeds) {
        throw new Error(`Cannot allocate more than ${lead.requiredBeds} beds for this request`);
      }
      if (patch.status) lead.status = patch.status;
      if (patch.shortlistedPropertyIds) lead.shortlistedPropertyIds = patch.shortlistedPropertyIds;
      if (patch.allocatedBedIds) lead.allocatedBedIds = patch.allocatedBedIds;
      if (patch.notes !== undefined) lead.notes = patch.notes;
      lead.updatedAt = new Date().toISOString();
      return { ok: true };
    }));

// ------------------------------------------------------------- P1: meal ops

export const fetchMealOps = (params: { propertyId?: string } = {}): Promise<{
  entries: MealOpsEntry[];
  summary: { totalPrepared: number; totalAttendance: number; surplusPercent: number | null; foodCostTotal: number; costPerAttendedMeal: number | null; worstWasteMeal: string | null };
}> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/meal-ops?' + createQS({ propertyId: params.propertyId }))
    : Promise.resolve((() => {
      const entries = loadDemo().mealOps.filter((e) => !params.propertyId || e.propertyId === params.propertyId);
      return { entries, summary: summarizeMealOps(entries) };
    })());

export const upsertMealOpsEntry = (input: {
  id?: string; propertyId: string; date: string; meal: string; menu?: string;
  expectedCount: number; preparedCount: number; attendanceCount?: number;
  foodCost?: number; vendor?: string; wasteNote?: string;
}): Promise<{ ok: boolean; id: string }> =>
  isMarketApiEnabled()
    ? jfetch('/api/market/meal-ops', { method: 'POST', body: JSON.stringify(input) })
    : Promise.resolve(mutateDemo((s) => {
      if (!input.propertyId || !input.date || !input.meal) throw new Error('propertyId, date and meal are required');
      const existing = input.id ? s.mealOps.find((e) => e.id === input.id) : undefined;
      if (existing) {
        existing.menu = input.menu || null; existing.expectedCount = input.expectedCount;
        existing.preparedCount = input.preparedCount; existing.attendanceCount = input.attendanceCount ?? null;
        existing.foodCost = input.foodCost ?? null; existing.vendor = input.vendor || null;
        existing.wasteNote = input.wasteNote || null;
        return { ok: true, id: existing.id };
      }
      const entry: MealOpsEntry = {
        id: mkId('meal'), organizationId: 'demo-org', propertyId: input.propertyId,
        date: input.date, meal: input.meal as MealOpsEntry['meal'], menu: input.menu || null,
        expectedCount: input.expectedCount, preparedCount: input.preparedCount,
        attendanceCount: input.attendanceCount ?? null, foodCost: input.foodCost ?? null,
        vendor: input.vendor || null, wasteNote: input.wasteNote || null,
        createdAt: new Date().toISOString(),
      };
      s.mealOps.push(entry);
      return { ok: true, id: entry.id };
    }));
