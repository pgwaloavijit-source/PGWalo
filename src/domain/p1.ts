/**
 * P1 domain model (spec §28–§30) — guardian access, institutional booking,
 * meal operations. Pure functions only: the Worker and demo adapter share
 * these rules so both modes behave identically.
 *
 * §29 privacy rule: the guardian view is a fixed allow-list of non-invasive
 * facts. Nothing here can expose movement tracking or other residents' data.
 */

// ------------------------------------------------------------- §29 guardian

export type GuardianAccessStatus = 'active' | 'revoked';

export interface GuardianAccess {
  id: string;
  organizationId: string | null;
  residentId: string;
  guardianName: string;
  guardianPhone: string | null;
  relation: string | null;
  status: GuardianAccessStatus;
  createdAt: string;
  revokedAt: string | null;
}

export const canRevokeGuardianAccess = (
  access: Pick<GuardianAccess, 'status'>,
): boolean => access.status === 'active';

/**
 * The exact payload a guardian token may fetch. Deliberately narrow: payment
 * and receipt summary, executed agreement state, emergency/property contacts,
 * property notices, deposit status and public verification facts only.
 */
export interface GuardianViewPayload {
  resident: { name: string; propertyName: string; roomNumber: string; bedNumber: string };
  /** Derived from the bed's live status — a plain fact, not movement tracking. */
  currentlyCheckedIn: boolean;
  rent: {
    monthlyRent: number;
    outstanding: number;
    lastPayment: { amount: number; date: string; method: string; receiptNumber: string | null } | null;
    paymentStatus: 'Paid' | 'Partial' | 'Pending' | 'Overdue';
  };
  agreementState: string | null;
  deposit: { expected: number; state: string };
  emergencyContacts: string[];
  propertyNotices: { title: string; date: string }[];
}

export const buildGuardianView = (input: {
  resident: {
    name: string; propertyName: string; roomNumber: string; bedNumber: string;
    monthlyRent: number; depositAmount: number; agreementState?: string | null;
  };
  currentlyCheckedIn: boolean;
  outstanding: number;
  lastPayment: GuardianViewPayload['rent']['lastPayment'];
  depositState: string;
  emergencyContacts: string[];
  propertyNotices: { title: string; date: string }[];
}): GuardianViewPayload => ({
  resident: {
    name: input.resident.name,
    propertyName: input.resident.propertyName,
    roomNumber: input.resident.roomNumber,
    bedNumber: input.resident.bedNumber,
  },
  currentlyCheckedIn: input.currentlyCheckedIn,
  rent: {
    monthlyRent: input.resident.monthlyRent,
    outstanding: input.outstanding,
    lastPayment: input.lastPayment,
    paymentStatus:
      input.outstanding <= 0 ? 'Paid' : input.lastPayment ? 'Partial' : 'Pending',
  },
  agreementState: input.resident.agreementState ?? null,
  deposit: { expected: input.resident.depositAmount, state: input.depositState },
  emergencyContacts: input.emergencyContacts,
  propertyNotices: input.propertyNotices,
});

// --------------------------------------------------------- §30 institutions

export type InstitutionalStage = 'new' | 'shortlisting' | 'allocated' | 'won' | 'lost';

export const INSTITUTIONAL_STAGES: InstitutionalStage[] = [
  'new', 'shortlisting', 'allocated', 'won', 'lost',
];

export const INSTITUTIONAL_TRANSITIONS: Record<InstitutionalStage, InstitutionalStage[]> = {
  new: ['shortlisting', 'lost'],
  shortlisting: ['allocated', 'lost', 'new'],
  allocated: ['won', 'shortlisting', 'lost'],
  won: [],
  lost: ['shortlisting'],
};

export const canTransitionInstitutional = (from: InstitutionalStage, to: InstitutionalStage): boolean =>
  (INSTITUTIONAL_TRANSITIONS[from] || []).includes(to);

export interface InstitutionalLead {
  id: string;
  organizationId: string | null;
  institutionName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  requiredBeds: number;
  genderEligibility: 'male' | 'female' | 'any' | null;
  targetLocalities: string[];
  budgetPerBed: number | null;
  moveInDate: string | null;
  durationMonths: number | null;
  status: InstitutionalStage;
  shortlistedPropertyIds: string[];
  allocatedBedIds: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A bed is eligible for an institutional request when it is genuinely free
 * (not occupied, not reserved) and matches the requested gender model.
 * intendedSharing/price filters are the caller's choice; safety is enforced here.
 */
export const bedEligibleForInstitution = (params: {
  bed: { status: string; sharingType: string; monthlyRent: number };
  genderEligibility: 'male' | 'female' | 'any' | null;
  propertyGenderModel?: string | null;
  budgetPerBed?: number | null;
}): boolean => {
  const status = String(params.bed.status).toLowerCase();
  if (!['vacant', 'available', 'ready'].includes(status)) return false;
  if (params.genderEligibility === 'male' && params.propertyGenderModel === 'female') return false;
  if (params.genderEligibility === 'female' && params.propertyGenderModel === 'male') return false;
  if (params.budgetPerBed != null && params.bed.monthlyRent > params.budgetPerBed) return false;
  return true;
};

/** Capacity check before allocating: never allocate more beds than requested. */
export const allocationWithinRequest = (allocatedCount: number, requiredBeds: number): boolean =>
  allocatedCount <= requiredBeds;

// ------------------------------------------------------------- §28 meal ops

export type MealSlot = 'breakfast' | 'lunch' | 'snacks' | 'dinner';

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snacks', 'dinner'];

export interface MealOpsEntry {
  id: string;
  organizationId: string | null;
  propertyId: string;
  date: string;
  meal: MealSlot;
  menu: string | null;
  expectedCount: number;
  preparedCount: number;
  attendanceCount: number | null;
  foodCost: number | null;
  vendor: string | null;
  wasteNote: string | null;
  createdAt: string;
}

export interface MealOpsSummary {
  totalPrepared: number;
  totalAttendance: number;
  surplusPercent: number | null;
  foodCostTotal: number;
  costPerAttendedMeal: number | null;
  worstWasteMeal: MealSlot | null;
}

/**
 * Waste reduction math (spec §28 goal): compare prepared vs attended to
 * surface over-preparation. Returns null metrics when data is incomplete
 * rather than inventing numbers.
 */
export const summarizeMealOps = (entries: MealOpsEntry[]): MealOpsSummary => {
  if (entries.length === 0) {
    return { totalPrepared: 0, totalAttendance: 0, surplusPercent: null, foodCostTotal: 0, costPerAttendedMeal: null, worstWasteMeal: null };
  }
  const totalPrepared = entries.reduce((s, e) => s + e.preparedCount, 0);
  const attended = entries.reduce((s, e) => s + (e.attendanceCount ?? 0), 0);
  const knownAttendance = entries.filter((e) => e.attendanceCount != null);
  const surplusPercent = knownAttendance.length > 0 && totalPrepared > 0
    ? Math.max(0, Math.round(((totalPrepared - attended) / totalPrepared) * 100))
    : null;
  const foodCostTotal = entries.reduce((s, e) => s + (e.foodCost ?? 0), 0);
  const costPerAttendedMeal = foodCostTotal > 0 && attended > 0
    ? Math.round((foodCostTotal / attended) * 100) / 100
    : null;

  let worstWasteMeal: MealSlot | null = null;
  let worstSurplus = -1;
  const byMeal = new Map<MealSlot, { prepared: number; attended: number }>();
  for (const e of knownAttendance) {
    const agg = byMeal.get(e.meal) || { prepared: 0, attended: 0 };
    agg.prepared += e.preparedCount;
    agg.attended += e.attendanceCount ?? 0;
    byMeal.set(e.meal, agg);
  }
  byMeal.forEach((agg, meal) => {
    if (agg.prepared > 0) {
      const surplus = (agg.prepared - agg.attended) / agg.prepared;
      if (surplus > worstSurplus) {
        worstSurplus = surplus;
        worstWasteMeal = meal;
      }
    }
  });

  return { totalPrepared, totalAttendance: attended, surplusPercent, foodCostTotal, costPerAttendedMeal, worstWasteMeal };
};
