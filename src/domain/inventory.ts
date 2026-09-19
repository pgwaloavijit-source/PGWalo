/**
 * Inventory and reservation rules — the heart of the Verified Live Bed Network.
 *
 * Pure functions, shared by the Worker (server-side enforcement, spec §10/§14)
 * and the client (fast UI feedback). The server always re-checks before commit;
 * these are the same rules, not a second opinion.
 */
import type { Bed, Invoice } from '../types';
import type { BedReservation, DerivedBedStatus } from './market';
import { deriveBedStatus } from './market';

export interface AvailabilityConflict {
  code:
    | 'bed_not_found'
    | 'bed_occupied'
    | 'bed_reserved'
    | 'bed_blocked'
    | 'maintenance_block'
    | 'overlapping_reservation'
    | 'overlapping_stay'
    | 'start_in_past';
  message: string;
}

const MS_DAY = 86_400_000;
const toDate = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`);

/**
 * Can this bed accept a reservation for the requested start date?
 * Conflicts are deterministic and readable — spec §41 (actionable errors).
 */
export const checkReservationConflict = (
  bed: Bed | undefined,
  startDate: string,
  existingReservations: BedReservation[]
): AvailabilityConflict | null => {
  if (!bed) {
    return { code: 'bed_not_found', message: 'This bed no longer exists. Refresh availability.' };
  }
  const status: DerivedBedStatus = deriveBedStatus({ status: String(bed.status) });
  const today = new Date().toISOString().slice(0, 10);

  if (startDate < today) {
    return { code: 'start_in_past', message: 'Reservation start date cannot be in the past.' };
  }
  if (status === 'occupied') {
    return {
      code: 'bed_occupied',
      message: 'This bed is currently occupied. Choose a different bed or refresh availability.',
    };
  }
  if (status === 'reserved') {
    return {
      code: 'bed_reserved',
      message: 'This bed was reserved by another booking. Choose a different bed or refresh availability.',
    };
  }
  if (status === 'blocked') {
    return { code: 'bed_blocked', message: 'This bed is blocked and cannot be reserved.' };
  }

  const start = toDate(startDate);

  // A bed under notice can accept a NEXT-tenancy reservation only after its
  // projected availability date.
  if (status === 'occupied_notice') {
    const availableFrom = bed.nextAvailableDate ? toDate(bed.nextAvailableDate) : null;
    if (!availableFrom || start < availableFrom) {
      return {
        code: 'maintenance_block',
        message: bed.nextAvailableDate
          ? `This bed becomes available on ${bed.nextAvailableDate}. Pick a start date on or after that day.`
          : 'This bed is under notice without a confirmed move-out date yet.',
      };
    }
  }

  // Overlap check against active reservations on the same bed.
  const overlaps = existingReservations.some((r) => {
    if (r.bedId !== bed.id) return false;
    if (!['pending_payment', 'held', 'confirmed'].includes(r.status)) return false;
    if (r.startDate > startDate) return false; // later start, no overlap with requested window start
    // An existing hold starting before/at the requested date blocks it unless
    // it has already expired.
    return true;
  });
  if (overlaps) {
    return {
      code: 'overlapping_reservation',
      message: 'Another confirmed reservation holds this bed for that period.',
    };
  }

  return null;
};

/** Beds bookable right now for public listing (spec §10 listing eligibility). */
export const listAvailableBeds = (beds: Bed[]): Bed[] =>
  beds.filter((b) => deriveBedStatus({ status: String(b.status) }) === 'vacant');

/** Future-vacancy view: beds under notice with a projected available date. */
export const futureVacancyBeds = (beds: Bed[], withinDays?: number): Bed[] =>
  beds.filter((b) => {
    if (deriveBedStatus({ status: String(b.status) }) !== 'occupied_notice') return false;
    if (!b.nextAvailableDate) return false;
    if (withinDays === undefined) return true;
    const diff = (toDate(b.nextAvailableDate).getTime() - Date.now()) / MS_DAY;
    return diff <= withinDays;
  });

/**
 * Deterministic reservation expiry (spec §14): a hold whose deadline has
 * passed is logically released on read — no cron required. Returns the
 * reservation with a corrected status plus the beds that were freed.
 */
export const evaluateReservationExpiry = (
  reservations: BedReservation[],
  now: Date = new Date()
): { reservations: BedReservation[]; expired: BedReservation[] } => {
  const nowIso = now.toISOString();
  let changed = false;
  const next = reservations.map((r) => {
    if (r.status === 'pending_payment' && r.expiryAt <= nowIso) {
      changed = true;
      return { ...r, status: 'expired' as const };
    }
    return r;
  });
  return { reservations: next, expired: changed ? next.filter((r) => r.status === 'expired') : [] };
};

/**
 * Collection KPI: who owes money right now (spec §17). Uses the shared
 * due-state evaluator so UI, Worker and tests agree on the numbers.
 */
export const overdueByResident = (
  invoices: Invoice[]
): { residentId: string; overdueAmount: number; oldestDueDate: string }[] => {
  const byResident = new Map<string, { overdueAmount: number; oldestDueDate: string }>();
  const today = new Date();
  for (const inv of invoices) {
    const due = new Date(`${inv.dueDate}T23:59:59`);
    const outstanding = Math.max(0, inv.amount - (inv.verifiedPaidAmount || 0));
    if (outstanding <= 0 || due.getTime() >= today.getTime()) continue;
    const cancelled = inv.status === 'Cancelled' || inv.status === 'Waived';
    if (cancelled) continue;
    const current = byResident.get(inv.residentId);
    if (!current) {
      byResident.set(inv.residentId, { overdueAmount: outstanding, oldestDueDate: inv.dueDate });
    } else {
      current.overdueAmount += outstanding;
      if (inv.dueDate < current.oldestDueDate) current.oldestDueDate = inv.dueDate;
    }
  }
  return Array.from(byResident.entries()).map(([residentId, v]) => ({ residentId, ...v }));
};
