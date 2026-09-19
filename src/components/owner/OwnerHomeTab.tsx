import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useOwnerScope } from '../../utils/ownership';
import { computeOwnerAnalytics } from '../../domain/analytics';
import { buildActionItems } from '../../domain/actionCenter';
import { deriveBedStatus, toMarketLead } from '../../domain/market';
import type { ActionItem } from '../../domain/market';
import {
  AlertTriangle, ArrowRight, Bed as BedIcon, Calendar, CheckCircle2,
  CreditCard, FileWarning, IndianRupee, ShieldAlert, Users,
} from 'lucide-react';

const PRIORITY_STYLES: Record<ActionItem['priority'], string> = {
  urgent: 'border-red-300 bg-red-50 text-red-900',
  high: 'border-amber-300 bg-amber-50 text-amber-900',
  medium: 'border-blue-200 bg-blue-50 text-blue-900',
  low: 'border-slate-200 bg-slate-50 text-slate-700',
};

const PRIORITY_ICON: Record<ActionItem['priority'], React.ComponentType<{ className?: string }>> = {
  urgent: ShieldAlert,
  high: AlertTriangle,
  medium: Calendar,
  low: CheckCircle2,
};

export const OwnerHomeTab: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { invoices, notices, tickets } = useApp();
  const { beds, properties, residents, leads, visits, reservations, expenses } = useOwnerScope() as ReturnType<typeof useOwnerScope> & {
    visits?: { id: string; leadId?: string; scheduledAt: string; status: string; propertyId: string }[];
    reservations?: { id: string; guestName: string; expiryAt: string; status: string; propertyId: string }[];
    expenses?: { id: string; amount: number; date: string; propertyId?: string; category: string }[];
  };

  const analytics = useMemo(
    () => computeOwnerAnalytics({
      beds,
      properties,
      residents: residents.map((r) => ({ id: r.id, propertyId: r.propertyId, status: r.status, noticeDate: r.noticeDate, expectedCheckoutDate: r.expectedCheckoutDate })),
      invoices,
      leads,
      visits: (visits || []) as never,
      reservations: (reservations || []) as never,
      expenses: (expenses || []) as never,
      depositHeld: residents.reduce((s, r) => s + (r.depositAmount || 0), 0),
    }),
    [beds, properties, residents, invoices, leads, visits, reservations, expenses]
  );

  const actionItems = useMemo(
    () => buildActionItems({
      invoices,
      beds,
      leads: leads.map((l) => {
        const m = toMarketLead(l);
        return { id: m.id, name: m.fullName, stage: m.stage, nextFollowUpAt: m.nextFollowUpAt, propertyId: m.propertyId };
      }),
      visits: (visits || []) as never,
      reservations: (reservations || []) as never,
      tickets,
      notices,
      complianceItems: [],
      depositSettlementsPending: [],
    }),
    [invoices, beds, leads, visits, reservations, tickets, notices]
  );

  const k = analytics.kpis;
  const topActions = actionItems.slice(0, 8);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6">
      {/* KPI strip — the five owner questions, spec §8 */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Beds occupied</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{k.occupiedBeds}<span className="text-sm font-bold text-slate-400">/{k.totalBeds}</span></div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-0.5">{k.occupancyRate}% occupancy</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Vacant now</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{k.vacantBeds}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Sellable beds today</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Vacant in 30d</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{k.futureVacancies30}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Notice beds ({k.futureVacancies7} within 7d)</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Rent overdue</div>
          <div className="text-2xl font-black text-red-600 mt-1">{fmt(k.overdueAmount)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {k.collectionRate !== null ? `${k.collectionRate}% collected this month` : 'No invoices yet'}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Hot leads</div>
          <div className="text-2xl font-black text-purple-600 mt-1">{k.hotLeadsNeedingAction}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Follow-ups due today</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Deposit liability</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{fmt(analytics.depositsLiability)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Held — not revenue</div>
        </div>
      </div>

      {/* Conversion funnel — where leads leak, spec §31 (server-computed in production) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wide">Lead pipeline conversion</h3>
          <button onClick={() => onNavigate('leads')} className="text-[11px] font-bold text-blue-600 hover:text-blue-800">Open CRM →</button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {([
            ['Lead → Visit', analytics.conversions.leadToVisit],
            ['Visit → Token', analytics.conversions.visitToToken],
            ['Token → Move-in', analytics.conversions.tokenToMoveIn],
          ] as const).map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <div className="text-lg font-black text-slate-900">{value !== null ? `${value}%` : '—'}</div>
              <div className="text-[10px] font-bold text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Action center */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900">Action center</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Ranked by urgency — {actionItems.length} item{actionItems.length === 1 ? '' : 's'} need you today</p>
          </div>
          <button
            onClick={() => onNavigate('leads')}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            Open leads <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {topActions.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">All clear</p>
            <p className="text-xs text-slate-500 mt-1">No overdue payments, follow-ups or expiring documents.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {topActions.map((item) => {
              const Icon = PRIORITY_ICON[item.priority];
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onNavigate(mapActionToTab(item))}
                    className={`w-full text-left px-5 py-3 flex items-start gap-3 border-l-4 transition hover:brightness-[0.98] ${PRIORITY_STYLES[item.priority]}`}
                  >
                    <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold">{item.title}</span>
                      {item.detail && <span className="block text-xs opacity-80 mt-0.5">{item.detail}</span>}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wide opacity-60 shrink-0 mt-1">{item.priority}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Portfolio section — multi-property progressive disclosure */}
      {properties.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900">Portfolio</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Occupancy and money by property</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-2.5">Property</th>
                  <th className="px-3 py-2.5">Occupancy</th>
                  <th className="px-3 py-2.5">Vacant</th>
                  <th className="px-3 py-2.5">Overdue</th>
                  <th className="px-3 py-2.5">Future vac. (30d)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.perProperty.map((p) => (
                  <tr key={p.propertyId} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3 font-bold text-slate-800">{p.propertyName}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${p.occupancyRate}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-600">{p.occupancyRate}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700 font-semibold">{p.vacantBeds}</td>
                    <td className={`px-3 py-3 font-bold ${p.overdueAmount > 0 ? 'text-red-600' : 'text-slate-400'}`}>{p.overdueAmount > 0 ? fmt(p.overdueAmount) : '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{p.totalBeds - p.occupiedBeds - p.vacantBeds > 0 ? p.totalBeds - p.occupiedBeds - p.vacantBeds : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

function mapActionToTab(item: ActionItem): string {
  switch (item.entityType) {
    case 'payment': return 'reports';
    case 'lead': return 'leads';
    case 'visit': return 'leads';
    case 'reservation': return 'leads';
    case 'notice': return 'residents';
    case 'maintenance': return 'maintenance';
    case 'compliance': return 'operations';
    case 'deposit': return 'reports';
    default: return 'overview';
  }
}
