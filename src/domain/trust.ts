/**
 * KYC, compliance and verification facts — state machines (spec §21, §22, §23).
 *
 * KYC: no unsafe DIY identity verification. States + provider boundary only;
 * masked identifiers and consent timestamps; no full Aadhaar anywhere.
 */

// ---------------------------------------------------------------------- kyc

import type { KycRecord, KycState, ComplianceItemStatus } from './market';

export const KYC_TRANSITIONS: Record<KycState, KycState[]> = {
  not_started: ['pending'],
  pending: ['submitted', 'expired'],
  submitted: ['verified', 'rejected', 'expired'],
  verified: ['expired'],
  rejected: ['pending'],
  expired: ['pending'],
};

export const canTransitionKyc = (from: KycState, to: KycState): boolean =>
  (KYC_TRANSITIONS[from] || []).includes(to);

export const maskAadhaar = (last4: string): string => `•••• •••• ${last4.slice(0, 4)}`;

/** Only masked identifiers ever leave the provider boundary. */
export const redactKycForDisplay = (record: KycRecord): KycRecord => ({
  ...record,
  providerReference: record.providerReference ? `${record.providerReference.slice(0, 6)}…` : undefined,
  maskedIdentifier: record.maskedIdentifier ? maskAadhaar(record.maskedIdentifier.replace(/\D/g, '').slice(-4)) : undefined,
});

// ---------------------------------------------------------------- compliance

export const COMPLIANCE_TRANSITIONS: Record<ComplianceItemStatus, ComplianceItemStatus[]> = {
  not_applicable: ['missing'],
  missing: ['uploaded'],
  uploaded: ['under_review', 'verified', 'rejected', 'expired'],
  under_review: ['verified', 'rejected', 'expired'],
  verified: ['expired'],
  rejected: ['uploaded'],
  expired: ['uploaded'],
};

export const canTransitionCompliance = (from: ComplianceItemStatus, to: ComplianceItemStatus): boolean =>
  (COMPLIANCE_TRANSITIONS[from] || []).includes(to);

/**
 * The compliance center's honesty rules (spec §22): uploaded ≠ verified ≠
 * self-declared, and "verified" never means "legally compliant".
 */
export const STATUS_TRUST_LABELS: Record<ComplianceItemStatus, { label: string; tone: 'neutral' | 'warn' | 'good' | 'bad' }> = {
  not_applicable: { label: 'Not applicable', tone: 'neutral' },
  missing: { label: 'Missing', tone: 'bad' },
  uploaded: { label: 'Uploaded — not yet verified', tone: 'warn' },
  under_review: { label: 'Under review', tone: 'warn' },
  verified: { label: 'Verified by PGWalo', tone: 'good' },
  rejected: { label: 'Rejected — re-upload', tone: 'bad' },
  expired: { label: 'Expired — re-upload', tone: 'bad' },
};

export const COMPLIANCE_TEMPLATE_ITEMS: { category: string; label: string; requiresExpiry: boolean; sourceNote: string }[] = [
  { category: 'identity', label: 'Owner/operator identity document', requiresExpiry: false, sourceNote: 'Platform KYC of the operator account' },
  { category: 'location', label: 'Property address/ownership proof', requiresExpiry: false, sourceNote: 'Ownership or lease document' },
  { category: 'registration', label: 'Local registration/licence', requiresExpiry: true, sourceNote: 'Varies by city — Delhi, Noida, Gurugram, Ghaziabad, Faridabad differ' },
  { category: 'fire_safety', label: 'Fire/safety documentation', requiresExpiry: true, sourceNote: 'Fire NOC or safety declaration where applicable' },
  { category: 'structural', label: 'Structural/use permission', requiresExpiry: false, sourceNote: 'Land-use or building-use permission where applicable' },
  { category: 'security', label: 'CCTV/security declaration', requiresExpiry: false, sourceNote: 'Self-declared security measures' },
  { category: 'food', label: 'FSSAI registration (food served)', requiresExpiry: true, sourceNote: 'Required when food is served' },
  { category: 'police', label: 'Tenant police verification tracking', requiresExpiry: false, sourceNote: 'Form C / tenant verification per jurisdiction' },
  { category: 'emergency', label: 'Emergency contact board', requiresExpiry: false, sourceNote: 'Visible emergency contacts at property' },
  { category: 'inspection', label: 'Last inspection record', requiresExpiry: false, sourceNote: 'Internal inspection history' },
];

// ------------------------------------------------------- verification facts

export interface VerificationFact {
  key: string;
  label: string;
  status: 'verified' | 'self_declared' | 'absent';
  verifiedAt?: string;
  expiresAt?: string;
}

/**
 * Public facts a listing may show (spec §23). Each fact carries its source
 * status and timestamps; nothing private is exposed. "Self-declared" is
 * always labeled as such — never rendered as a verified badge.
 */
export const buildVerificationFacts = (params: {
  propertyVerified: boolean;
  identityVerified: boolean;
  liveInventory: boolean;
  complianceVerifiedItems: { label: string; verifiedAt?: string; expiresAt?: string }[];
  fssaiVerified: boolean;
  digitalAgreementSupported: boolean;
  depositPolicyPublished: boolean;
  lastAvailabilityUpdate: string;
  verifiedReviewCount: number;
}): VerificationFact[] => {
  const facts: VerificationFact[] = [];
  facts.push({ key: 'identity', label: 'Owner identity verified', status: params.identityVerified ? 'verified' : 'absent' });
  facts.push({ key: 'live_inventory', label: 'Live bed availability', status: params.liveInventory ? 'verified' : 'absent', verifiedAt: params.lastAvailabilityUpdate });
  for (const item of params.complianceVerifiedItems) {
    facts.push({ key: `doc_${item.label}`, label: item.label, status: 'verified', verifiedAt: item.verifiedAt, expiresAt: item.expiresAt });
  }
  facts.push({
    key: 'fssai',
    label: 'Food licence (FSSAI) verified',
    status: params.fssaiVerified ? 'verified' : 'absent',
  });
  facts.push({
    key: 'digital_agreement',
    label: 'Digital agreement supported',
    status: params.digitalAgreementSupported ? 'self_declared' : 'absent',
  });
  facts.push({
    key: 'deposit_policy',
    label: 'Deposit policy published',
    status: params.depositPolicyPublished ? 'self_declared' : 'absent',
  });
  return facts;
};
