/**
 * Market-ready domain model — additive to the existing PGWalo types.
 * Reuses existing concepts (beds, leads) instead of duplicating them; new
 * lifecycle entities carry explicit state machines. Every type is backed by
 * a Worker route or a demo adapter in services/marketApi.ts.
 */
import type { Bed, Lead } from '../types';

// ------------------------------------------------------------------ leads ---

export type MarketLeadStage =
  | 'new' | 'contacted' | 'visit_scheduled' | 'visited' | 'negotiating'
  | 'token_pending' | 'token_paid' | 'reserved' | 'moved_in'
  | 'lost' | 'spam';

export const MARKET_LEAD_STAGES: MarketLeadStage[] = [
  'new', 'contacted', 'visit_scheduled', 'visited', 'negotiating',
  'token_pending', 'token_paid', 'reserved', 'moved_in', 'lost', 'spam',
];

export const MARKET_STAGE_TRANSITIONS: Record<MarketLeadStage, MarketLeadStage[]> = {
  new: ['contacted', 'lost', 'spam'],
  contacted: ['visit_scheduled', 'visited', 'negotiating', 'lost', 'spam'],
  visit_scheduled: ['visited', 'contacted', 'lost', 'spam'],
  visited: ['negotiating', 'token_pending', 'contacted', 'lost', 'spam'],
  negotiating: ['token_pending', 'visited', 'lost', 'spam'],
  token_pending: ['token_paid', 'negotiating', 'lost', 'spam'],
  token_paid: ['reserved', 'lost'],
  reserved: ['moved_in', 'lost'],
  moved_in: [],
  lost: ['contacted'],
  spam: [],
};

export const canTransitionLead = (from: MarketLeadStage, to: MarketLeadStage): boolean =>
  (MARKET_STAGE_TRANSITIONS[from] ?? []).includes(to);

/** Normalize a legacy Lead row into the CRM pipeline model (spec §11). */
export const toMarketLead = (lead: Lead): MarketLead & { propertyName?: string } => ({
  id: lead.id,
  organizationId: 'demo-org',
  propertyId: lead.propertyId ?? null,
  propertyName: lead.propertyName,
  assignedUserId: lead.assignedTo ?? null,
  fullName: lead.name,
  phone: lead.phone,
  email: lead.email || null,
  source: (lead.source as LeadSource) || 'manual',
  sourceReference: null,
  desiredLocality: null,
  desiredPropertyId: lead.propertyId ?? null,
  moveInDate: lead.preferredMoveIn || lead.expectedMoveInDate || null,
  budgetMin: null,
  budgetMax: lead.budgetMax ?? null,
  gender: null,
  occupantType: null,
  sharingPreference: lead.roomTypePreference ?? null,
  workplaceOrCollege: null,
  stage: (MARKET_LEAD_STAGES as string[]).includes(lead.stage)
    ? (lead.stage as unknown as MarketLeadStage)
    : 'new',
  temperature: lead.budgetMax >= 15000 ? 'Hot' : lead.budgetMax >= 10000 ? 'Warm' : 'Cold',
  nextFollowUpAt: lead.lastFollowUp || null,
  lastContactAt: lead.lastFollowUp || null,
  lostReason: null,
  createdAt: lead.createdAt,
  updatedAt: lead.createdAt,
});

export interface MarketLead {
  id: string;
  organizationId: string;
  propertyId: string | null;
  propertyName?: string;
  assignedUserId: string | null;
  fullName: string;
  phone: string;
  email: string | null;
  source: LeadSource;
  sourceReference: string | null;
  desiredLocality: string | null;
  desiredPropertyId: string | null;
  moveInDate: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  gender: 'male' | 'female' | 'any' | null;
  occupantType: string | null;
  sharingPreference: string | null;
  workplaceOrCollege: string | null;
  stage: MarketLeadStage;
  temperature: 'Hot' | 'Warm' | 'Cold' | null;
  nextFollowUpAt: string | null;
  lastContactAt: string | null;
  lostReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LeadSource =
  | 'marketplace' | 'owner_website' | 'walk_in' | 'phone' | 'whatsapp'
  | 'referral' | 'broker' | 'college_company' | 'csv_import'
  | 'manual' | 'external_portal';

export const MARKET_LEAD_SOURCES: LeadSource[] = [
  'marketplace', 'owner_website', 'walk_in', 'phone', 'whatsapp', 'referral',
  'broker', 'college_company', 'csv_import', 'manual', 'external_portal',
];

// ----------------------------------------------------------------- visits ---

export type VisitStatus =
  | 'scheduled' | 'confirmed' | 'rescheduled' | 'completed'
  | 'no_show' | 'cancelled';

export interface PropertyVisit {
  id: string;
  leadId: string | null;
  propertyId: string;
  scheduledAt: string;
  status: VisitStatus;
  outcome?: string | null;
  assignedStaffName?: string;
  notes?: string;
  completedAt?: string;
  createdAt: string;
}

// ----------------------------------------------------------- reservations ---

export type ReservationStatus =
  | 'pending_payment' | 'held' | 'confirmed' | 'expired' | 'cancelled'
  | 'converted_to_stay';

export interface BedReservation {
  id: string;
  propertyId: string;
  bedId: string;
  bedNumber?: string;
  roomNumber?: string;
  leadId?: string | null;
  guestName: string;
  guestPhone: string;
  startDate: string;
  expiryAt: string;
  tokenAmount: number;
  tokenPaymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  refundPolicySnapshot: string;
  status: ReservationStatus;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------- payment intents ---

export type PaymentIntentPurpose = 'token' | 'rent' | 'deposit' | 'other';

export interface PaymentIntent {
  id: string;
  purpose: PaymentIntentPurpose;
  referenceId?: string | null;
  residentId?: string | null;
  leadId?: string | null;
  propertyId?: string | null;
  payerName: string;
  payerPhone: string;
  amount: number;
  currency: string;
  status: 'created' | 'paid' | 'failed' | 'cancelled';
  provider: string;
  paymentLink?: string | null;
  providerOrderId?: string | null;
  utr?: string | null;
  receiptNumber?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// --------------------------------------------------------------- expenses ---

export type ExpenseCategory =
  | 'Building Lease/Rent' | 'Electricity' | 'Water' | 'Staff Salary' | 'Food'
  | 'LPG' | 'Housekeeping Supplies' | 'Laundry' | 'Repairs' | 'Internet'
  | 'Broker Commission' | 'Marketing' | 'Maintenance/Vendor' | 'Software'
  | 'Taxes/Fees' | 'Miscellaneous';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Building Lease/Rent', 'Electricity', 'Water', 'Staff Salary', 'Food',
  'LPG', 'Housekeeping Supplies', 'Laundry', 'Repairs', 'Internet',
  'Broker Commission', 'Marketing', 'Maintenance/Vendor', 'Software',
  'Taxes/Fees', 'Miscellaneous',
];

export interface ExpenseEntry {
  id: string;
  propertyId: string | null;
  category: ExpenseCategory;
  amount: number;
  date: string;
  vendor?: string | null;
  paymentMethod?: string | null;
  reference?: string | null;
  notes?: string | null;
  recurring?: boolean | null;
  createdBy?: string | null;
  createdAt: string;
}

// ------------------------------------------------------------------- kyc ---

export type KycState =
  | 'not_started' | 'pending' | 'submitted' | 'verified' | 'rejected' | 'expired';

export interface KycRecord {
  id: string;
  residentId?: string | null;
  leadId?: string | null;
  fullName: string;
  phone: string;
  state: KycState;
  provider?: string | null;
  providerReference?: string | null;
  verificationType?: string | null;
  maskedIdentifier?: string | null;
  verifiedName?: string | null;
  consentAt?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------- inspections ---

export type InspectionType = 'move_in' | 'move_out';

export interface InspectionItem {
  id: string;
  area: string;
  item: string;
  condition: string;
  remarks: string;
  photoUrl?: string;
}

export interface PropertyInspection {
  id: string;
  residentId?: string | null;
  stayId?: string | null;
  propertyId: string;
  roomNumber: string;
  bedNumber?: string | null;
  type: InspectionType;
  inspectionDate: string;
  inspectedBy?: string | null;
  items: InspectionItem[];
  meterReading?: string | null;
  residentConfirmed: boolean;
  residentConfirmedAt?: string | null;
  staffConfirmed: boolean;
  staffConfirmedAt?: string | null;
  overallNotes?: string | null;
  referenceInspectionId?: string | null;
  createdAt?: string;
}

// ------------------------------------------------------------- compliance ---

export type ComplianceItemStatus =
  | 'not_applicable' | 'missing' | 'uploaded' | 'under_review' | 'verified'
  | 'rejected' | 'expired';

export interface PropertyComplianceItem {
  id: string;
  propertyId: string;
  templateItemId: string;
  status: ComplianceItemStatus;
  documentUrl?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  notes?: string | null;
  updatedAt: string;
}

// ---------------------------------------------------------------- reviews ---

export interface VerifiedReview {
  id: string;
  propertyId: string;
  residentId?: string | null;
  stayId?: string | null;
  authorName: string;
  rating: number;
  dimensions?: Record<string, number>;
  comment: string;
  ownerResponse?: string | null;
  ownerRespondedAt?: string | null;
  moderation?: 'pending' | 'approved' | 'rejected';
  isVerifiedStay: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------- imports ---

export type ImportKind = 'beds' | 'residents' | 'dues' | 'deposits' | 'leads';

export interface ImportRowError {
  row: number;
  field: string | null;
  message: string;
}

export interface ImportPreview {
  kind: ImportKind;
  headers: string[];
  mappedRows: Record<string, string>[];
  errors: ImportRowError[];
  validCount: number;
  errorCount: number;
  duplicates: number;
}

export interface ImportCommitResult {
  ok: boolean;
  committed: number;
  rejected: number;
  jobId: string;
}

// -------------------------------------------------------------- reminders ---

export type ReminderRuleKey = 't_minus_5' | 't_minus_2' | 'due' | 'plus_2' | 'plus_5';

export interface ReminderRule {
  key: ReminderRuleKey;
  offsetDays: number;
  label: string;
  message: string;
}

export const DEFAULT_REMINDER_RULES: ReminderRule[] = [
  { key: 't_minus_5', offsetDays: -5, label: 'T-5', message: 'Friendly reminder: rent is due in 5 days.' },
  { key: 't_minus_2', offsetDays: -2, label: 'T-2', message: 'Rent due in 2 days — please keep the amount ready.' },
  { key: 'due', offsetDays: 0, label: 'Due today', message: 'Rent is due today. Pay via UPI to avoid late fees.' },
  { key: 'plus_2', offsetDays: 2, label: '+2 days', message: 'Your rent is overdue by 2 days. Please pay today.' },
  { key: 'plus_5', offsetDays: 5, label: '+5 days', message: 'Rent overdue 5 days — this payment is now escalated to the owner.' },
];

// ----------------------------------------------------------- action center ---

export type ActionItemType =
  | 'payment_overdue' | 'lead_followup_overdue' | 'visit_today'
  | 'reservation_expiring' | 'notice_received' | 'maintenance_sla_missed'
  | 'compliance_expiring' | 'deposit_settlement_pending' | 'kyc_pending';

export interface ActionItem {
  id: string;
  entityType: string;
  actionType: ActionItemType;
  title: string;
  detail: string | null;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  dueAt?: string | null;
  propertyId: string | null;
  deepLink: string | null;
}

// --------------------------------------------------------------- analytics ---

export interface OwnerKpis {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyRate: number;
  futureVacancies7: number;
  futureVacancies30: number;
  futureVacancies60: number;
  overdueAmount: number;
  collectionRate: number | null;
  hotLeadsNeedingAction: number;
}

export interface PropertyAnalyticsRow {
  propertyId: string;
  propertyName: string;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyRate: number;
  overdueAmount: number;
  openIssues: number;
}

export interface OwnerAnalytics {
  kpis: OwnerKpis;
  leadFunnel: { stage: MarketLeadStage; count: number }[];
  conversions: {
    leadToVisit: number | null;
    visitToToken: number | null;
    tokenToMoveIn: number | null;
  };
  depositsLiability: number;
  expensesThisMonth: number;
  netOperatingSurplus: number | null;
  perProperty: PropertyAnalyticsRow[];
  definitions: string;
  generatedAt: string;
}

// ------------------------------------------------------------ capabilities ---

export type Capability =
  | 'property.read' | 'property.write' | 'inventory.read' | 'inventory.write'
  | 'lead.read' | 'lead.write' | 'lead.assign' | 'visit.manage'
  | 'reservation.manage' | 'resident.read' | 'resident.write'
  | 'billing.read' | 'billing.write' | 'payment.record' | 'payment.reconcile'
  | 'deposit.read' | 'deposit.settle' | 'expense.read' | 'expense.write'
  | 'maintenance.read' | 'maintenance.assign' | 'maintenance.resolve'
  | 'staff.manage' | 'compliance.read' | 'compliance.upload'
  | 'compliance.verify' | 'agreement.manage' | 'kyc.manage'
  | 'review.moderate' | 'analytics.read' | 'admin.platform';

export type CapabilityPresetKey =
  | 'owner' | 'property_manager' | 'finance' | 'warden' | 'security'
  | 'housekeeping' | 'maintenance' | 'kitchen' | 'viewer';

export const CAPABILITY_PRESETS: Record<CapabilityPresetKey, Capability[]> = {
  owner: ['admin.platform'],
  property_manager: [
    'property.read', 'property.write', 'inventory.read', 'inventory.write',
    'lead.read', 'lead.write', 'lead.assign', 'visit.manage',
    'reservation.manage', 'resident.read', 'resident.write',
    'maintenance.read', 'maintenance.assign', 'maintenance.resolve',
    'agreement.manage', 'kyc.manage', 'compliance.read', 'compliance.upload',
    'analytics.read',
  ],
  finance: [
    'billing.read', 'billing.write', 'payment.record', 'payment.reconcile',
    'deposit.read', 'deposit.settle', 'expense.read', 'expense.write',
    'resident.read', 'analytics.read',
  ],
  warden: [
    'resident.read', 'inventory.read', 'maintenance.read',
    'maintenance.assign', 'compliance.read',
  ],
  security: ['resident.read', 'maintenance.read'],
  housekeeping: ['maintenance.read'],
  maintenance: ['maintenance.read', 'maintenance.resolve'],
  kitchen: ['maintenance.read'],
  viewer: ['analytics.read'],
};

/** Role → capabilities. Legacy roles map to presets (spec §7 compat rule). */
export const ROLE_CAPABILITIES: Record<string, Capability[]> = {
  owner: [...CAPABILITY_PRESETS.owner],
  superadmin: ['admin.platform'],
  admin: ['admin.platform'],
  warden: CAPABILITY_PRESETS.warden,
  accountant: CAPABILITY_PRESETS.finance,
  staff: [],
};

export const canDo = (role: string, capability: Capability): boolean => {
  const caps = ROLE_CAPABILITIES[role] ?? [];
  return caps.includes(capability) || caps.includes('admin.platform');
};

// ------------------------------------------------------------ bed status ----

export type DerivedBedStatus =
  | 'vacant' | 'occupied' | 'reserved' | 'occupied_notice' | 'maintenance' | 'blocked';

export const deriveBedStatus = (bed: { status: string }): DerivedBedStatus => {
  switch (bed.status) {
    case 'Occupied': return 'occupied';
    case 'Reserved':
    case 'Booking Pending': return 'reserved';
    case 'Notice Period':
    case 'Vacating': return 'occupied_notice';
    case 'Maintenance':
    case 'Cleaning': return 'maintenance';
    case 'Disabled': return 'blocked';
    default: return 'vacant';
  }
};
