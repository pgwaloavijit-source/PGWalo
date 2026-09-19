/**
 * Demo-mode seed for the market-ready workflows (spec §43).
 *
 * Small, purposeful fixtures — enough to exercise every P0 screen without
 * fake volume. Seeded once into the marketApi demo store when empty.
 */
import type {
  PropertyVisit, BedReservation, PaymentIntent, ExpenseEntry,
  PropertyComplianceItem, VerifiedReview, KycRecord, PropertyInspection,
} from './market';

const iso = (dayOffset: number): string => new Date(Date.now() + dayOffset * 86_400_000).toISOString();
const dateOnly = (dayOffset: number): string => iso(dayOffset).slice(0, 10);

export const DEMO_VISITS: PropertyVisit[] = [
  {
    id: 'visit-demo-1', leadId: 'lead-1', propertyId: 'prop-1',
    scheduledAt: iso(0), status: 'scheduled',
    notes: 'Lead wants to see single rooms and the gym floor.',
    createdAt: iso(-2),
  },
  {
    id: 'visit-demo-2', leadId: 'lead-2', propertyId: 'prop-1',
    scheduledAt: iso(-3), status: 'completed', outcome: 'interested',
    completedAt: iso(-3), notes: 'Liked food quality; parents to confirm.',
    createdAt: iso(-5),
  },
];

export const DEMO_RESERVATIONS: BedReservation[] = [
  {
    id: 'res-demo-1', propertyId: 'prop-1', bedId: 'bed-201-B', bedNumber: '201-B', roomNumber: '201',
    leadId: 'lead-2', guestName: 'Megha Nair', guestPhone: '+91 98451 22334',
    startDate: dateOnly(5), expiryAt: iso(1), tokenAmount: 5000,
    tokenPaymentStatus: 'pending', refundPolicySnapshot: 'refundable',
    status: 'pending_payment', createdAt: iso(-1), updatedAt: iso(-1),
  },
];

export const DEMO_INTENTS: PaymentIntent[] = [
  {
    id: 'pi-demo-1', purpose: 'token', referenceId: 'res-demo-1', leadId: 'lead-2',
    propertyId: 'prop-1', payerName: 'Megha Nair', payerPhone: '+91 98451 22334',
    amount: 5000, currency: 'INR', status: 'created', provider: 'none',
    createdAt: iso(-1), updatedAt: iso(-1),
  },
  {
    id: 'pi-demo-2', purpose: 'rent', residentId: 'res-2', propertyId: 'prop-1',
    payerName: 'Rohan Deshmukh', payerPhone: '+91 90000 11111',
    amount: 14500, currency: 'INR', status: 'paid', provider: 'none',
    utr: 'UTR881234567', createdAt: iso(-9), updatedAt: iso(-8), paidAt: iso(-8),
  },
  {
    id: 'pi-demo-3', purpose: 'rent', residentId: 'res-4', propertyId: 'prop-1',
    payerName: 'Karthik Raja', payerPhone: '+91 90000 44444',
    amount: 4250, currency: 'INR', status: 'created', provider: 'none',
    createdAt: iso(-4), updatedAt: iso(-4),
  },
];

export const DEMO_EXPENSES: ExpenseEntry[] = [
  { id: 'exp-demo-1', propertyId: 'prop-1', category: 'Building Lease/Rent', amount: 85000, date: dateOnly(-3), vendor: 'Landlord', paymentMethod: 'NEFT', createdAt: iso(-3) },
  { id: 'exp-demo-2', propertyId: 'prop-1', category: 'Electricity', amount: 18400, date: dateOnly(-4), vendor: 'BESCOM', paymentMethod: 'Online', createdAt: iso(-4) },
  { id: 'exp-demo-3', propertyId: 'prop-1', category: 'Staff Salary', amount: 62000, date: dateOnly(-2), paymentMethod: 'Cash', createdAt: iso(-2) },
  { id: 'exp-demo-4', propertyId: 'prop-1', category: 'Food', amount: 41000, date: dateOnly(-6), vendor: 'Kirana + mandi', createdAt: iso(-6) },
  { id: 'exp-demo-5', propertyId: 'prop-1', category: 'Repairs', amount: 3200, date: dateOnly(-8), vendor: 'Plumber Suresh', createdAt: iso(-8) },
];

export const DEMO_COMPLIANCE: PropertyComplianceItem[] = [
  { id: 'pci-demo-1', propertyId: 'prop-1', templateItemId: 'identity', status: 'verified', verifiedAt: iso(-40), updatedAt: iso(-40) },
  { id: 'pci-demo-2', propertyId: 'prop-1', templateItemId: 'location', status: 'verified', verifiedAt: iso(-40), updatedAt: iso(-40) },
  { id: 'pci-demo-3', propertyId: 'prop-1', templateItemId: 'fire_safety', status: 'uploaded', expiresAt: dateOnly(21), updatedAt: iso(-30) },
  { id: 'pci-demo-4', propertyId: 'prop-1', templateItemId: 'food', status: 'missing', updatedAt: iso(-30) },
  { id: 'pci-demo-5', propertyId: 'prop-1', templateItemId: 'security', status: 'uploaded', updatedAt: iso(-25) },
];

export const DEMO_REVIEWS: VerifiedReview[] = [
  {
    id: 'rev-demo-1', propertyId: 'prop-1', residentId: 'res-3', stayId: 'stay-res-3',
    authorName: 'Priya Iyer', rating: 4,
    dimensions: { cleanliness: 5, food: 4, staff_behavior: 5, internet: 3 },
    comment: 'Clean rooms and the warden is genuinely helpful. WiFi dips at night in the corner rooms.',
    ownerResponse: 'Thank you Priya — we have upgraded the corridor access point.',
    ownerRespondedAt: iso(-4),
    isVerifiedStay: true, createdAt: iso(-6), updatedAt: iso(-4),
  },
  {
    id: 'rev-demo-2', propertyId: 'prop-1', residentId: 'res-1', stayId: 'stay-res-1',
    authorName: 'Ananya Sen', rating: 5,
    dimensions: { listing_accuracy: 5, deposit_settlement: 5, billing_transparency: 5 },
    comment: 'Photos matched the room exactly and my deposit settlement was itemized and quick.',
    isVerifiedStay: true, createdAt: iso(-12), updatedAt: iso(-12),
  },
];

export const DEMO_KYC: KycRecord[] = [
  {
    id: 'kyc-demo-1', residentId: 'res-3', fullName: 'Priya Iyer', phone: '+91 90000 22222',
    state: 'verified', provider: 'demo', verificationType: 'aadhaar_offline_xml',
    maskedIdentifier: '•••• •••• 4821', verifiedName: 'Priya Iyer', verifiedAt: iso(-20), consentAt: iso(-21),
    createdAt: iso(-21), updatedAt: iso(-20),
  },
  {
    id: 'kyc-demo-2', leadId: 'lead-2', fullName: 'Megha Nair', phone: '+91 98451 22334',
    state: 'pending', createdAt: iso(-1), updatedAt: iso(-1),
  },
];

export const DEMO_INSPECTIONS: PropertyInspection[] = [
  {
    id: 'insp-demo-1', residentId: 'res-5', propertyId: 'prop-1', roomNumber: '302', bedNumber: '302-A',
    type: 'move_in', inspectionDate: dateOnly(-90), inspectedBy: 'Warden Sunil',
    items: [
      { id: 'ii-1', area: 'Room', item: 'Walls', condition: 'Good', remarks: '' },
      { id: 'ii-2', area: 'Furniture', item: 'Mattress', condition: 'Fair', remarks: 'Minor indentation' },
      { id: 'ii-3', area: 'Other', item: 'Keys / access card', condition: 'Good', remarks: '2 keys issued' },
    ],
    residentConfirmed: true, residentConfirmedAt: iso(-90), staffConfirmed: true, staffConfirmedAt: iso(-90),
    overallNotes: 'Move-in condition documented with resident present.',
  },
];

export const seedDemoMarketData = (target: {
  visits: PropertyVisit[];
  reservations: BedReservation[];
  intents: PaymentIntent[];
  expenses: ExpenseEntry[];
  compliance: PropertyComplianceItem[];
  reviews: VerifiedReview[];
  kyc: KycRecord[];
  inspections: PropertyInspection[];
}): boolean => {
  if (target.visits.length > 0 || target.reservations.length > 0 || target.reviews.length > 0) {
    return false; // already seeded or user-created data exists
  }
  target.visits.push(...DEMO_VISITS);
  target.reservations.push(...DEMO_RESERVATIONS);
  target.intents.push(...DEMO_INTENTS);
  target.expenses.push(...DEMO_EXPENSES);
  target.compliance.push(...DEMO_COMPLIANCE);
  target.reviews.push(...DEMO_REVIEWS);
  target.kyc.push(...DEMO_KYC);
  target.inspections.push(...DEMO_INSPECTIONS);
  return true;
};
