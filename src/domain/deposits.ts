/**
 * Deposit settlement rules (spec §19) — liability-style deposit ledger math.
 *
 * The existing SecurityDepositRecord already stores deductions with evidence
 * and approval flags; this module adds the validation the settlement flow
 * needs so an unexplained balance reduction is impossible.
 */
import type { SecurityDepositRecord } from '../types';

export interface DeductionLine {
  id: string;
  category: 'Damage' | 'Unpaid Rent' | 'Electricity' | 'Other';
  amount: number;
  reason: string;
  approvedByOwner: boolean;
  evidencePhoto?: string;
}

export interface SettlementComputation {
  depositHeld: number;
  totalDeductions: number;
  refundAmount: number;
  shortfall: number; // deductions exceed deposit — must be collected, never silently netted
}

/**
 * Computes the refund from approved deduction lines. A deduction without a
 * reason is rejected up-front (never allow an unexplained balance reduction).
 * Deductions exceeding the deposit do NOT go negative — they surface as a
 * `shortfall` the owner must collect explicitly.
 */
export const computeSettlement = (
  depositReceived: number,
  deductions: DeductionLine[]
): SettlementComputation => {
  const invalid = deductions.find((d) => !d.reason || !d.reason.trim());
  if (invalid) {
    throw new Error('Every deduction needs a written reason before settlement.');
  }
  const approved = deductions.filter((d) => d.approvedByOwner);
  const totalDeductions = approved.reduce((sum, d) => sum + (d.amount || 0), 0);
  const refundAmount = Math.max(0, depositReceived - totalDeductions);
  const shortfall = Math.max(0, totalDeductions - depositReceived);
  return { depositHeld: depositReceived, totalDeductions, refundAmount, shortfall };
};

/** Evidence required for configurable categories (spec §44). */
export const EVIDENCE_REQUIRED_CATEGORIES: ReadonlySet<string> = new Set(['Damage', 'Other']);

export const validateDeductionLine = (line: DeductionLine): string | null => {
  if (!line.reason || !line.reason.trim()) return 'Deduction reason is required.';
  if (!Number.isFinite(line.amount) || line.amount <= 0) return 'Deduction amount must be greater than zero.';
  if (EVIDENCE_REQUIRED_CATEGORIES.has(line.category) && !line.evidencePhoto) {
    return `Evidence (photo) is required for ${line.category} deductions.`;
  }
  return null;
};

/** Builds the settlement summary the resident sees (transparency, spec §19). */
export const settlementSummary = (record: SecurityDepositRecord): SettlementComputation =>
  computeSettlement(
    record.depositReceived,
    (record.deductions || []).map((d, i) => ({ id: d.id || `ded-${i}`, ...d }))
  );
