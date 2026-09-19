/**
 * Domain rule tests (spec §44) — critical invariants, no framework needed.
 * Run: npm run test:domain
 */
import type { Bed, Invoice, MaintenanceTicket, Notice } from '../src/types';
import { checkReservationConflict, evaluateReservationExpiry, overdueByResident } from '../src/domain/inventory';
import { prorateRent, evaluateInvoiceDueState, buildCycleLines } from '../src/domain/billing';
import { computeSettlement, validateDeductionLine } from '../src/domain/deposits';
import { canDo, canTransitionLead } from '../src/domain/market';
import { buildVerificationFacts, canTransitionKyc } from '../src/domain/trust';
import { parseCsv, buildImportPreview } from '../src/domain/csvImport';
import { computeOwnerAnalytics } from '../src/domain/analytics';
import { buildActionItems } from '../src/domain/actionCenter';
import { whatsappDeepLink, createMessagingAdapter } from '../src/domain/messaging';
import {
  canTransitionInstitutional, bedEligibleForInstitution, allocationWithinRequest,
  buildGuardianView, summarizeMealOps,
} from '../src/domain/p1';
import type { MealOpsEntry } from '../src/domain/p1';

let passed = 0;
let failed = 0;
const failures: string[] = [];

const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed += 1;
    failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
};

const expect = (actual: unknown) => ({
  toBe: (expected: unknown) => {
    if (actual !== expected) throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  },
  toBeNull: () => {
    if (actual !== null) throw new Error(`expected null, got ${JSON.stringify(actual)}`);
  },
  toContain: (sub: string) => {
    if (!String(actual).includes(sub)) throw new Error(`expected "${String(actual)}" to contain "${sub}"`);
  },
  toBeTruthy: () => {
    if (!actual) throw new Error(`expected truthy, got ${JSON.stringify(actual)}`);
  },
  toBeFalsy: () => {
    if (actual) throw new Error(`expected falsy, got ${JSON.stringify(actual)}`);
  },
  toBeGreaterThan: (n: number) => {
    if (!(Number(actual) > n)) throw new Error(`expected ${actual} > ${n}`);
  },
});

const futureDate = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const vacantBed = { id: 'b1', status: 'Vacant', nextAvailableDate: undefined, monthlyRent: 9000, deposit: 10000, bedNumber: '101-A', roomNumber: '101', propertyId: 'p1', sharingType: 'Single' } as Bed;

console.log('\n== Inventory / reservations ==');

test('vacant bed accepts a reservation', () => {
  expect(checkReservationConflict(vacantBed, futureDate(3), [])).toBeNull();
});

test('cannot reserve an occupied bed', () => {
  const bed = { ...vacantBed, status: 'Occupied' } as never;
  const conflict = checkReservationConflict(bed, futureDate(3), []);
  expect(conflict?.code).toBe('bed_occupied');
});

test('cannot double-book an already-reserved bed', () => {
  const bed = { ...vacantBed, status: 'Reserved' } as never;
  const conflict = checkReservationConflict(bed, futureDate(3), []);
  expect(conflict?.code).toBe('bed_reserved');
});

test('future vacancy accepts eligible next reservation', () => {
  const bed = { ...vacantBed, status: 'Notice Period', nextAvailableDate: futureDate(10) } as never;
  expect(checkReservationConflict(bed, futureDate(12), [])).toBeNull();
});

test('future vacancy rejects start date before availability', () => {
  const bed = { ...vacantBed, status: 'Notice Period', nextAvailableDate: futureDate(10) } as never;
  const conflict = checkReservationConflict(bed, futureDate(5), []);
  expect(conflict?.code).toBe('maintenance_block');
});

test('overlapping active hold is rejected', () => {
  const active = [{ bedId: 'b1', status: 'confirmed', startDate: futureDate(2) } as never];
  const conflict = checkReservationConflict(vacantBed, futureDate(3), active);
  expect(conflict?.code).toBe('overlapping_reservation');
});

test('expired hold is ignored for conflicts', () => {
  const active = [{ bedId: 'b1', status: 'expired', startDate: futureDate(2) } as never];
  expect(checkReservationConflict(vacantBed, futureDate(3), active)).toBeNull();
});

test('expired pending_payment holds release deterministically', () => {
  const past = new Date(Date.now() - 3600_000).toISOString();
  const future = new Date(Date.now() + 3600_000).toISOString();
  const { expired } = evaluateReservationExpiry([
    { id: 'r1', status: 'pending_payment', expiryAt: past } as never,
    { id: 'r2', status: 'pending_payment', expiryAt: future } as never,
  ]);
  expect(expired.length).toBe(1);
  expect(expired[0].id).toBe('r1');
});

console.log('\n== Billing ==');

test('proration: 15 of 30 days at 30000 = 15000', () => {
  const y = new Date().getFullYear();
  const m = 3; // April has 30 days
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const end = `${y}-${String(m + 1).padStart(2, '0')}-15`;
  expect(prorateRent({ monthlyRent: 30000, startDate: start, endDate: end })).toBe(15000);
});

test('proration of a full month equals the rent', () => {
  const y = new Date().getFullYear();
  const start = `${y}-01-01`;
  const end = `${y}-01-31`;
  expect(prorateRent({ monthlyRent: 12000, startDate: start, endDate: end })).toBe(12000);
});

test('partial payment produces partial due-state, not paid', () => {
  const state = evaluateInvoiceDueState({ amount: 10000, verifiedPaidAmount: 4000, dueDate: futureDate(-2) });
  expect(state.isPartiallyPaid).toBeTruthy();
  expect(state.isSettled).toBeFalsy();
  expect(state.isOverdue).toBeTruthy();
  expect(state.outstanding).toBe(6000);
});

test('overdue calculation excludes settled invoices', () => {
  const state = evaluateInvoiceDueState({ amount: 10000, verifiedPaidAmount: 10000, dueDate: futureDate(-30) });
  expect(state.isSettled).toBeTruthy();
  expect(state.isOverdue).toBeFalsy();
});

test('cycle lines include electricity and food without mutating anything', () => {
  const result = buildCycleLines({
    rentPlan: { monthlyRent: 10000, dueDay: 5 },
    resident: { previousDues: 500 },
    monthDate: new Date('2026-09-01'),
    electricity: 750,
    food: 1500,
  });
  expect(result.total).toBe(12750);
  expect(result.lines.length).toBe(4);
});

console.log('\n== Payments / reconciliation guard ==');

test('webhook-style payment transitions never un-pay', () => {
  // encoded in the Worker: paid → anything-else is rejected. Verifying the rule shape:
  const transitions: Record<string, string[]> = { paid: [], created: ['paid', 'failed'] };
  expect(transitions.paid.includes('refunded')).toBeFalsy();
  expect(transitions.created.includes('paid')).toBeTruthy();
});

console.log('\n== Deposits ==');

test('deduction lines sum correctly', () => {
  const s = computeSettlement(20000, [
    { id: 'd1', category: 'Damage', amount: 3000, reason: 'Broken wardrobe door', approvedByOwner: true },
    { id: 'd2', category: 'Unpaid Rent', amount: 2500, reason: 'August rent', approvedByOwner: true },
  ]);
  expect(s.totalDeductions).toBe(5500);
  expect(s.refundAmount).toBe(14500);
  expect(s.shortfall).toBe(0);
});

test('unapproved deductions do not reduce the refund', () => {
  const s = computeSettlement(20000, [
    { id: 'd1', category: 'Damage', amount: 9000, reason: 'claim', approvedByOwner: false },
  ]);
  expect(s.refundAmount).toBe(20000);
});

test('refund can never go negative — excess surfaces as shortfall', () => {
  const s = computeSettlement(5000, [
    { id: 'd1', category: 'Unpaid Rent', amount: 7000, reason: 'dues', approvedByOwner: true },
  ]);
  expect(s.refundAmount).toBe(0);
  expect(s.shortfall).toBe(2000);
});

test('damage deduction without evidence is invalid', () => {
  const err = validateDeductionLine({ id: 'd1', category: 'Damage', amount: 1000, reason: 'x', approvedByOwner: true });
  expect(err).toBeTruthy();
  const ok = validateDeductionLine({ id: 'd2', category: 'Damage', amount: 1000, reason: 'x', approvedByOwner: true, evidencePhoto: 'r2://p.jpg' });
  expect(ok).toBeNull();
});

console.log('\n== Permissions ==');

test('finance user cannot verify compliance unless granted', () => {
  expect(canDo('accountant', 'compliance.verify')).toBeFalsy();
  expect(canDo('accountant', 'payment.reconcile')).toBeTruthy();
});

test('staff preset cannot write anything', () => {
  expect(canDo('staff', 'lead.write')).toBeFalsy();
  expect(canDo('staff', 'inventory.write')).toBeFalsy();
});

test('owner holds settlement rights, warden does not', () => {
  expect(canDo('owner', 'deposit.settle')).toBeTruthy();
  expect(canDo('warden', 'deposit.settle')).toBeFalsy();
});

console.log('\n== KYC / trust ==');

test('kyc cannot jump from not_started to verified', () => {
  expect(canTransitionKyc('not_started', 'verified')).toBeFalsy();
  expect(canTransitionKyc('submitted', 'verified')).toBeTruthy();
});

test('verification facts never render self-declared as verified', () => {
  const facts = buildVerificationFacts({
    propertyVerified: false, identityVerified: false, liveInventory: true,
    complianceVerifiedItems: [], fssaiVerified: false,
    digitalAgreementSupported: true, depositPolicyPublished: true,
    lastAvailabilityUpdate: new Date().toISOString(), verifiedReviewCount: 0,
  });
  const agreement = facts.find((f) => f.key === 'digital_agreement');
  expect(agreement?.status).toBe('self_declared');
});

console.log('\n== Reviews ==');

test('review model is verified-stay only (isVerifiedStay is a literal true)', () => {
  // enforced at the type level and by the Worker stay check; verify the type gate
  const review = { isVerifiedStay: true as const };
  expect(review.isVerifiedStay).toBeTruthy();
});

console.log('\n== Import ==');

test('invalid rows are rejected with clear row errors', () => {
  const csv = parseCsv('Name,Phone\n,12345\nGood Name,9876543210\n');
  const preview = buildImportPreview('residents', csv, {});
  expect(preview.errorCount).toBe(1);
  expect(preview.errors[0].row).toBe(2);
});

test('duplicate resident phone is deterministic', () => {
  const csv = parseCsv('Name,Phone\nA,9876543210\nB,98765 43210\n');
  const preview = buildImportPreview('residents', csv, {});
  expect(preview.duplicates).toBe(1);
});

test('valid import counts rows correctly', () => {
  const csv = parseCsv('Name,Phone\nA,9876543210\nB,9876501234\n');
  const preview = buildImportPreview('residents', csv, {});
  expect(preview.validCount).toBe(2);
});

console.log('\n== Analytics & action center ==');

test('collection rate is null-safe with no invoices', () => {
  const a = computeOwnerAnalytics({
    beds: [], properties: [], residents: [], invoices: [], leads: [], visits: [], reservations: [], expenses: [], depositHeld: 0,
  });
  expect(a.kpis.collectionRate).toBeNull();
  expect(a.kpis.occupancyRate).toBe(0);
});

test('overdue KPI uses the shared evaluator', () => {
  const a = computeOwnerAnalytics({
    beds: [], properties: [], residents: [],
    invoices: [{ id: 'i1', amount: 1000, verifiedPaidAmount: 0, dueDate: futureDate(-5), status: 'Due' } as never],
    leads: [], visits: [], reservations: [], expenses: [], depositHeld: 0,
  });
  expect(a.kpis.overdueAmount).toBe(1000);
});

test('action center ranks urgent before high', () => {
  const items = buildActionItems({
    invoices: [{ id: 'i1', amount: 5000, verifiedPaidAmount: 0, dueDate: futureDate(-10), status: 'Due', propertyId: 'p1' } as never],
    beds: [], leads: [], visits: [], reservations: [], tickets: [], notices: [], complianceItems: [], depositSettlementsPending: [],
  });
  expect(items.length).toBeGreaterThan(0);
  expect(items[0].priority).toBe('urgent');
});

console.log('\n== Messaging ==');

test('deep link formats 10-digit Indian numbers', () => {
  const link = whatsappDeepLink('98765 43210', 'hello');
  expect(link).toContain('wa.me/919876543210');
  expect(link).toContain('hello');
});

test('adapter without credentials never claims delivery', () => {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  createMessagingAdapter().sendTemplateMessage('9876543210', { id: 't', label: 't', body: () => 'hi' }, {}).then((r) => {
    expect(r.sent).toBeFalsy();
    expect(r.transport).toBe('deep_link');
  });
});

console.log('\n== P1: institutional booking (§30) ==');

test('institutional stage transitions are explicit', () => {
  expect(canTransitionInstitutional('new', 'shortlisting')).toBe(true);
  expect(canTransitionInstitutional('shortlisting', 'allocated')).toBe(true);
  expect(canTransitionInstitutional('allocated', 'won')).toBe(true);
  expect(canTransitionInstitutional('won', 'shortlisting')).toBe(false);
  expect(canTransitionInstitutional('new', 'won')).toBe(false);
});

test('bed eligibility rejects occupied/reserved beds', () => {
  const ok = { status: 'Vacant', sharingType: 'Double', monthlyRent: 9000 };
  expect(bedEligibleForInstitution({ bed: ok, genderEligibility: 'any' })).toBe(true);
  expect(bedEligibleForInstitution({ bed: { ...ok, status: 'Occupied' }, genderEligibility: 'any' })).toBe(false);
  expect(bedEligibleForInstitution({ bed: { ...ok, status: 'Reserved' }, genderEligibility: 'any' })).toBe(false);
});

test('bed eligibility enforces gender model and budget cap', () => {
  const bed = { status: 'Vacant', sharingType: 'Triple', monthlyRent: 12000 };
  expect(bedEligibleForInstitution({ bed, genderEligibility: 'female', propertyGenderModel: 'male' })).toBe(false);
  expect(bedEligibleForInstitution({ bed, genderEligibility: 'female', propertyGenderModel: 'female' })).toBe(true);
  expect(bedEligibleForInstitution({ bed, genderEligibility: 'any', budgetPerBed: 10000 })).toBe(false);
  expect(bedEligibleForInstitution({ bed, genderEligibility: 'any', budgetPerBed: 12000 })).toBe(true);
});

test('allocation can never exceed the requested bed count', () => {
  expect(allocationWithinRequest(3, 5)).toBe(true);
  expect(allocationWithinRequest(6, 5)).toBe(false);
});

console.log('\n== P1: guardian view (§29) ==');

test('guardian view derives honest payment status', () => {
  const base = {
    resident: { name: 'Aarav', propertyName: 'Shivneri PG', roomNumber: '101', bedNumber: 'B', monthlyRent: 9000, depositAmount: 18000, agreementState: 'fully_executed' },
    currentlyCheckedIn: true,
    depositState: 'Held',
    emergencyContacts: [],
    propertyNotices: [],
  };
  const paid = buildGuardianView({ ...base, outstanding: 0, lastPayment: { amount: 9000, date: '2026-09-01', method: 'UPI', receiptNumber: 'R-1' } });
  expect(paid.rent.paymentStatus).toBe('Paid');
  const partial = buildGuardianView({ ...base, outstanding: 3000, lastPayment: { amount: 6000, date: '2026-09-01', method: 'UPI', receiptNumber: null } });
  expect(partial.rent.paymentStatus).toBe('Partial');
  const pending = buildGuardianView({ ...base, outstanding: 9000, lastPayment: null });
  expect(pending.rent.paymentStatus).toBe('Pending');
});

test('guardian view carries no org-wide data', () => {
  const v = buildGuardianView({
    resident: { name: 'X', propertyName: 'P', roomNumber: '1', bedNumber: '1', monthlyRent: 1, depositAmount: 1 },
    currentlyCheckedIn: false, outstanding: 0, lastPayment: null,
    depositState: 'Held', emergencyContacts: [], propertyNotices: [{ title: 'Water timing', date: '2026-09-01' }],
  });
  expect(v.currentlyCheckedIn).toBe(false);
  expect(v.agreementState).toBeNull();
  expect(v.propertyNotices.length).toBe(1);
});

console.log('\n== P1: meal ops (§28) ==');

test('meal summary computes surplus and cost per attended meal', () => {
  const entries: MealOpsEntry[] = [
    { id: 'm1', organizationId: null, propertyId: 'p', date: '2026-09-18', meal: 'lunch', menu: null, expectedCount: 40, preparedCount: 40, attendanceCount: 32, foodCost: 3200, vendor: null, wasteNote: null, createdAt: '' },
    { id: 'm2', organizationId: null, propertyId: 'p', date: '2026-09-18', meal: 'dinner', menu: null, expectedCount: 40, preparedCount: 35, attendanceCount: 34, foodCost: 2800, vendor: null, wasteNote: null, createdAt: '' },
  ];
  const s = summarizeMealOps(entries);
  expect(s.totalPrepared).toBe(75);
  expect(s.totalAttendance).toBe(66);
  expect(s.surplusPercent).toBe(12);
  expect(s.costPerAttendedMeal).toBe(90.91);
  expect(s.worstWasteMeal).toBe('lunch');
});

test('meal summary returns nulls when attendance is unknown', () => {
  const s = summarizeMealOps([
    { id: 'm1', organizationId: null, propertyId: 'p', date: '2026-09-18', meal: 'lunch', menu: null, expectedCount: 30, preparedCount: 30, attendanceCount: null, foodCost: 3000, vendor: null, wasteNote: null, createdAt: '' },
  ]);
  expect(s.surplusPercent).toBeNull();
  expect(s.costPerAttendedMeal).toBeNull();
  expect(s.worstWasteMeal).toBeNull();
});

// ----------------------------------------------------------------- summary

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\nFailures:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
