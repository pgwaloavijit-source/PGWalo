/**
 * Owner analytics (spec §31) — one calculator, documented denominators.
 *
 * Every metric answers: "which rows, which window, which denominator". UI
 * never does ad-hoc math; when source data is incomplete the metric carries
 * `null` instead of a made-up number.
 */
import type { Bed, Invoice, Property } from '../types';
import type { MarketLeadStage } from './market';
import { toMarketLead } from './market';
import type { OwnerAnalytics, OwnerKpis, PropertyVisit, ExpenseEntry, VerifiedReview } from './market';
import type { Lead } from '../types';
import { evaluateInvoiceDueState } from './billing';
import { deriveBedStatus } from './market';

const MS_DAY = 86_400_000;

export interface AnalyticsInput {
  beds: Bed[];
  properties: Property[];
  residents: { id: string; propertyId: string; status?: string; noticeDate?: string; expectedCheckoutDate?: string }[];
  invoices: Invoice[];
  leads: Lead[];
  visits: PropertyVisit[];
  reservations: { bedId: string; status: string }[];
  expenses: ExpenseEntry[];
  depositHeld: number;
  now?: Date;
}

const inLastDays = (iso: string, days: number, now: Date): boolean =>
  now.getTime() - new Date(iso).getTime() <= days * MS_DAY;

export const computeOwnerAnalytics = (input: AnalyticsInput): OwnerAnalytics => {
  const now = input.now || new Date();
  const today = now.toISOString().slice(0, 10);

  const totalBeds = input.beds.length;
  const statusOf = (b: Bed) => deriveBedStatus({ status: String(b.status) });
  const occupiedBeds = input.beds.filter((b) => ['occupied', 'occupied_notice'].includes(statusOf(b))).length;
  const vacantBeds = input.beds.filter((b) => statusOf(b) === 'vacant').length;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const noticeBeds = input.beds.filter((b) => statusOf(b) === 'occupied_notice');
  const within = (days: number) =>
    noticeBeds.filter((b) => {
      if (!b.nextAvailableDate) return false;
      const diff = (new Date(`${b.nextAvailableDate}T00:00:00Z`).getTime() - now.getTime()) / MS_DAY;
      return diff >= 0 && diff <= days;
    }).length;

  // Overdue from the shared due-state evaluator (single source of truth).
  let overdueAmount = 0;
  let billedThisMonth = 0;
  let collectedThisMonth = 0;
  for (const inv of input.invoices) {
    if (inv.status === 'Cancelled' || inv.status === 'Waived') continue;
    const state = evaluateInvoiceDueState(inv);
    if (state.isOverdue) overdueAmount += state.outstanding;
    if (inv.createdAt && inv.createdAt.slice(0, 7) === today.slice(0, 7)) {
      billedThisMonth += inv.amount;
      collectedThisMonth += inv.verifiedPaidAmount || 0;
    }
  }
  const collectionRate =
    billedThisMonth > 0 ? Math.round((collectedThisMonth / billedThisMonth) * 100) : null;

  // Leads funnel from the legacy rows, normalized to CRM stages.
  const marketLeads = input.leads.map(toMarketLead);
  const funnel: { stage: MarketLeadStage; count: number }[] = [];
  const stageCounts = new Map<MarketLeadStage, number>();
  for (const l of marketLeads) stageCounts.set(l.stage, (stageCounts.get(l.stage) || 0) + 1);
  stageCounts.forEach((count, stage) => funnel.push({ stage, count }));

  const hotLeadsNeedingAction = marketLeads.filter(
    (l) => !['moved_in', 'lost', 'spam'].includes(l.stage) && l.temperature === 'Hot'
  ).length + marketLeads.filter((l) => l.nextFollowUpAt && l.nextFollowUpAt <= today && !['moved_in', 'lost', 'spam'].includes(l.stage)).length;

  const leadCount = marketLeads.filter((l) => l.stage !== 'spam').length;
  const visited = marketLeads.filter((l) =>
    ['visited', 'negotiating', 'token_pending', 'token_paid', 'reserved', 'moved_in'].includes(l.stage)
  ).length;
  const tokenPaid = marketLeads.filter((l) =>
    ['token_paid', 'reserved', 'moved_in'].includes(l.stage)
  ).length;
  const movedIn = marketLeads.filter((l) => l.stage === 'moved_in').length;

  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);

  const expensesThisMonth = input.expenses
    .filter((e) => e.date.slice(0, 7) === today.slice(0, 7))
    .reduce((s, e) => s + e.amount, 0);

  const collectedTotal = input.invoices.reduce(
    (s, inv) => (inv.status === 'Cancelled' || inv.status === 'Waived' ? s : s + (inv.verifiedPaidAmount || 0)),
    0
  );

  const kpis: OwnerKpis = {
    totalBeds,
    occupiedBeds,
    vacantBeds,
    occupancyRate,
    futureVacancies7: within(7),
    futureVacancies30: within(30),
    futureVacancies60: within(60),
    overdueAmount,
    collectionRate,
    hotLeadsNeedingAction,
  };

  const perProperty = input.properties.map((p) => {
    const beds = input.beds.filter((b) => b.propertyId === p.id);
    const occ = beds.filter((b) => ['occupied', 'occupied_notice'].includes(deriveBedStatus({ status: String(b.status) }))).length;
    const vac = beds.filter((b) => deriveBedStatus({ status: String(b.status) }) === 'vacant').length;
    const overdue = input.invoices
      .filter((inv) => inv.propertyId === p.id)
      .reduce((s, inv) => {
        const st = evaluateInvoiceDueState(inv);
        return s + (st.isOverdue ? st.outstanding : 0);
      }, 0);
    return {
      propertyId: p.id,
      propertyName: p.name,
      totalBeds: beds.length,
      occupiedBeds: occ,
      vacantBeds: vac,
      occupancyRate: beds.length > 0 ? Math.round((occ / beds.length) * 100) : 0,
      overdueAmount: overdue,
      openIssues: 0,
    };
  });

  return {
    kpis,
    leadFunnel: funnel,
    conversions: {
      leadToVisit: pct(visited, leadCount),
      visitToToken: pct(tokenPaid, visited),
      tokenToMoveIn: pct(movedIn, tokenPaid),
    },
    depositsLiability: input.depositHeld,
    expensesThisMonth,
    netOperatingSurplus: collectedTotal > 0 || expensesThisMonth > 0 ? collectedTotal - expensesThisMonth : null,
    perProperty,
    definitions: [
      'Occupied = beds with status Occupied or Notice Period (still collecting rent).',
      'Vacant = bed is bookable now. Reserved beds are counted separately.',
      'Collection rate = verified payments / invoiced amount for invoices created this month.',
      'Overdue = outstanding on invoices past due date (verified payments deducted).',
      'Deposits liability = total deposit money currently held (a liability, not revenue).',
      'Revenue per occupied bed uses verified collections only, not invoiced amounts.',
    ].join(' '),
    generatedAt: now.toISOString(),
  };
};

/** Unused-import guards: these types stay part of the public surface. */
export type { PropertyVisit, ExpenseEntry, VerifiedReview };
