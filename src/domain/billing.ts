/**
 * Billing engine v2 — extends the existing invoice model (never rewrites it).
 *
 * The existing `Invoice` (types.ts) carries `verifiedPaidAmount` and status;
 * the AppContext flow `allocateVerifiedPayment` remains the source of truth
 * for allocation. This module adds what the market build needs on top:
 * - prorated first/final periods
 * - partial-payment math that never mutates historical invoices
 * - a due-state evaluator shared by UI and Worker
 * - line-item builders for the recurring cycle (rent, electricity, food, late fee)
 */
import type { Invoice, Resident, RentPlan } from '../types';

const MS_DAY = 86_400_000;

export const daysInMonth = (year: number, monthIndex: number): number =>
  new Date(year, monthIndex + 1, 0).getDate();

export interface ProrationInput {
  monthlyRent: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // inclusive YYYY-MM-DD
}

/** Prorated rent for an inclusive date range, rounded to whole rupees. */
export const prorateRent = ({ monthlyRent, startDate, endDate }: ProrationInput): number => {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end.getTime() < start.getTime()) return 0;
  const days = Math.round((end.getTime() - start.getTime()) / MS_DAY) + 1; // inclusive
  const dim = daysInMonth(start.getUTCFullYear(), start.getUTCMonth());
  return Math.round((monthlyRent / dim) * days);
};

export const monthKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const monthLabel = (d: Date): string =>
  d.toLocaleString('en-US', { month: 'long', year: 'numeric' });

export interface InvoiceDueState {
  outstanding: number;
  isOverdue: boolean;
  isPartiallyPaid: boolean;
  isSettled: boolean;
}

/** Invoice due-state derived from money, not just the status field. */
export const evaluateInvoiceDueState = (
  invoice: Pick<Invoice, 'amount' | 'verifiedPaidAmount' | 'dueDate'>
): InvoiceDueState => {
  const outstanding = Math.max(0, invoice.amount - (invoice.verifiedPaidAmount || 0));
  const isSettled = outstanding === 0 && (invoice.verifiedPaidAmount || 0) > 0;
  const due = new Date(`${invoice.dueDate}T23:59:59`);
  const isOverdue = outstanding > 0 && due.getTime() < Date.now();
  const isPartiallyPaid = (invoice.verifiedPaidAmount || 0) > 0 && outstanding > 0;
  return { outstanding, isOverdue, isPartiallyPaid, isSettled };
};

export interface CycleLine {
  id: string;
  description: string;
  amount: number;
  type: 'Rent' | 'Previous Due' | 'Electricity' | 'Food' | 'Damage' | 'LateFee' | 'Discount' | 'Other';
}

export interface CycleResult {
  lines: CycleLine[];
  total: number;
  previousDue: number;
}

export interface BuildCycleLinesParams {
  rentPlan: Pick<RentPlan, 'monthlyRent' | 'dueDay'>;
  resident: Pick<Resident, 'previousDues'>;
  monthDate: Date;
  electricity?: number;
  food?: number;
  lateFee?: number;
  discount?: number;
  proratedRent?: number;
}

/**
 * Builds one month's invoice lines for a resident. Never mutates history —
 * the duplicate guard stays in the caller (buildMonthlyInvoice).
 */
export const buildCycleLines = (params: BuildCycleLinesParams): CycleResult => {
  const lines: CycleLine[] = [];
  const stamp = params.monthDate.getTime();
  const rent = params.proratedRent !== undefined ? params.proratedRent : params.rentPlan.monthlyRent;

  if (rent > 0) {
    lines.push({ id: `line-rent-${stamp}`, description: 'Rent', amount: rent, type: 'Rent' });
  }

  const previousDue = params.resident.previousDues || 0;
  if (previousDue > 0) {
    lines.push({ id: `line-prev-${stamp}`, description: 'Previous dues', amount: previousDue, type: 'Previous Due' });
  }

  if (params.electricity && params.electricity > 0) {
    lines.push({ id: `line-elec-${stamp}`, description: 'Electricity', amount: params.electricity, type: 'Electricity' });
  }

  if (params.food && params.food > 0) {
    lines.push({ id: `line-food-${stamp}`, description: 'Food', amount: params.food, type: 'Food' });
  }

  if (params.lateFee && params.lateFee > 0) {
    lines.push({ id: `line-late-${stamp}`, description: 'Late fee', amount: params.lateFee, type: 'LateFee' });
  }

  if (params.discount && params.discount > 0) {
    lines.push({ id: `line-disc-${stamp}`, description: 'Discount', amount: params.discount, type: 'Discount' });
  }

  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  return { lines, total, previousDue };
};
