import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react';
import { useOwnerScope } from '../../utils/ownership';
import { fetchMaintenanceOverview } from '../../services/maintenanceTickets';
import { isProductionApiEnabled } from '../../services/productionApi';
import {
  MaintenanceBreachRow,
  MaintenanceOverview,
  MaintenanceSlaRow,
  MaintenanceStaffStat,
  MaintenanceTicket,
} from '../../types';

const PRIORITY_ORDER = ['Emergency', 'Urgent', 'High', 'Normal', 'Low'];

/** 6.5 -> "6h 30m", 30 -> "1d 6h". */
function formatHours(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  const d = Math.floor(hours / 24);
  const h = Math.round(hours - d * 24);
  return h === 0 ? `${d}d` : `${d}d ${h}h`;
}

const isOpen = (t: MaintenanceTicket) => t.status === 'Reported' || t.status === 'In-Progress';
const isDone = (t: MaintenanceTicket) => t.status === 'Resolved' || t.status === 'Closed';

function hoursBetween(from: string, to: string): number | null {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, (end - start) / 3_600_000);
}

/**
 * Same arithmetic the Worker does, computed over the tickets this browser
 * already holds. Used in demo mode and whenever the overview call fails, so the
 * tab is never blank.
 */
function localOverview(tickets: MaintenanceTicket[], beds: { propertyId: string; status: string }[] = []): MaintenanceOverview {
  const nowIso = new Date().toISOString();
  const now = Date.now();
  const done = tickets.filter(isDone);
  const durations = done
    .map((t) => hoursBetween(t.createdAt, t.updatedAt || t.createdAt))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const median = durations.length === 0
    ? null
    : durations.length % 2 === 1
      ? durations[(durations.length - 1) / 2]
      : (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2;
  const withDeadline = done.filter((t) => t.slaDeadline);
  const inSla = withDeadline.filter((t) => new Date(t.updatedAt || t.createdAt) <= new Date(t.slaDeadline as string));

  const priorities = Array.from(new Set(tickets.map((t) => t.priority || 'Normal')));
  const byPriority: MaintenanceSlaRow[] = priorities.map((priority) => {
    const rows = tickets.filter((t) => (t.priority || 'Normal') === priority);
    const rowsDone = rows.filter(isDone);
    const rowsWithDeadline = rowsDone.filter((t) => t.slaDeadline);
    const rowsInSla = rowsWithDeadline.filter((t) => new Date(t.updatedAt || t.createdAt) <= new Date(t.slaDeadline as string));
    const rowHours = rowsDone
      .map((t) => hoursBetween(t.createdAt, t.updatedAt || t.createdAt))
      .filter((value): value is number => value !== null);
    return {
      priority,
      total: rows.length,
      open: rows.filter(isOpen).length,
      resolved: rowsDone.length,
      breachedOpen: rows.filter((t) => isOpen(t) && t.slaDeadline && new Date(t.slaDeadline).getTime() <= now).length,
      avgResolutionHours: rowHours.length ? Math.round((rowHours.reduce((a, b) => a + b, 0) / rowHours.length) * 10) / 10 : null,
      withinSlaPct: rowsWithDeadline.length ? Math.round((rowsInSla.length / rowsWithDeadline.length) * 100) : null,
    };
  });

  const names = Array.from(new Set(tickets.map((t) => t.assignedStaffName).filter((n): n is string => Boolean(n))));
  const staff: MaintenanceStaffStat[] = names.map((name) => {
    const rows = tickets.filter((t) => t.assignedStaffName === name);
    const rowsDone = rows.filter(isDone);
    const rowHours = rowsDone
      .map((t) => hoursBetween(t.createdAt, t.updatedAt || t.createdAt))
      .filter((value): value is number => value !== null);
    return {
      name,
      assigned: rows.length,
      open: rows.filter(isOpen).length,
      resolved: rowsDone.length,
      avgResolutionHours: rowHours.length ? Math.round((rowHours.reduce((a, b) => a + b, 0) / rowHours.length) * 10) / 10 : null,
      lateResolutions: rowsDone.filter((t) => t.slaDeadline && new Date(t.updatedAt || t.createdAt) > new Date(t.slaDeadline)).length,
      escalations: rows.filter((t) => t.escalatedAt).length,
    };
  });

  const breached: MaintenanceBreachRow[] = tickets
    .filter((t) => isOpen(t) && t.slaDeadline && new Date(t.slaDeadline).getTime() <= now)
    .sort((a, b) => String(a.slaDeadline).localeCompare(String(b.slaDeadline)))
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority || 'Normal',
      status: t.status,
      roomNumber: t.roomNumber,
      propertyName: t.propertyName,
      assignedStaffName: t.assignedStaffName,
      createdAt: t.createdAt,
      slaDeadline: t.slaDeadline,
      escalatedAt: t.escalatedAt,
    }));

  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  // §27 analytics — repeat issues: same category on the same room within 30 days.
  const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
  const repeatMap = new Map<string, { category: string; roomNumber: string; propertyName: string; occurrences: number; lastAt: string }>();
  for (const t of tickets) {
    if (new Date(t.createdAt).getTime() < thirtyDaysAgo) continue;
    const key = `${t.category}|${t.propertyName || ''}|${t.roomNumber}`;
    const row = repeatMap.get(key) || { category: t.category, roomNumber: t.roomNumber, propertyName: t.propertyName || '', occurrences: 0, lastAt: t.createdAt };
    row.occurrences += 1;
    if (t.createdAt > row.lastAt) row.lastAt = t.createdAt;
    repeatMap.set(key, row);
  }
  const repeatIssues = [...repeatMap.values()].filter((r) => r.occurrences >= 2).sort((a, b) => b.occurrences - a.occurrences).slice(0, 8);

  // §27 analytics — verified spend per occupied bed, per property.
  const costMap = new Map<string, { propertyId: string; propertyName: string; totalCost: number }>();
  for (const t of done) {
    if (!t.propertyId || !t.cost || t.cost <= 0) continue;
    const row = costMap.get(t.propertyId) || { propertyId: t.propertyId, propertyName: t.propertyName || '', totalCost: 0 };
    row.totalCost += t.cost;
    costMap.set(t.propertyId, row);
  }
  const costPerBed = [...costMap.values()].map((row) => {
    const occupied = beds.filter(
      (b) => b.propertyId === row.propertyId && ['Occupied', 'Notice Period', 'Vacating'].includes(String(b.status))
    ).length;
    return {
      ...row,
      occupiedBeds: occupied,
      costPerBed: occupied > 0 ? Math.round((row.totalCost / occupied) * 100) / 100 : null,
    };
  }).sort((a, b) => b.totalCost - a.totalCost).slice(0, 50);

  return {
    totals: {
      total: tickets.length,
      open: tickets.filter(isOpen).length,
      resolved: tickets.filter((t) => t.status === 'Resolved').length,
      closed: tickets.filter((t) => t.status === 'Closed').length,
      unassigned: tickets.filter((t) => isOpen(t) && !t.assignedStaffName).length,
      escalated: tickets.filter((t) => t.escalatedAt).length,
    },
    sla: {
      breachedOpen: breached.length,
      resolvedInSla: inSla.length,
      resolvedLate: Math.max(0, withDeadline.length - inSla.length),
      withinSlaPct: withDeadline.length ? Math.round((inSla.length / withDeadline.length) * 100) : null,
      avgResolutionHours: avg === null ? null : Math.round(avg * 10) / 10,
      medianResolutionHours: median === null ? null : Math.round(median * 10) / 10,
      byPriority,
    },
    staff,
    breached,
    repeatIssues,
    costPerBed,
    generatedAt: nowIso,
  };
}

function KpiCard({
  label,
  value,
  sub,
  tone = 'slate',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'slate' | 'danger' | 'good' | 'warn';
}) {
  const valueTone =
    tone === 'danger' ? 'text-red-600' : tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-900';
  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
      <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase block">{label}</span>
      <span className={`text-xl sm:text-2xl font-black block mt-1 ${valueTone}`}>{value}</span>
      {sub && <span className="text-[11px] text-slate-500 font-semibold mt-1 block">{sub}</span>}
    </div>
  );
}

const SLA_BAR = (pct: number | null) => {
  if (pct === null) return 'bg-slate-200';
  if (pct >= 90) return 'bg-emerald-500';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-red-500';
};

export const OwnerMaintenanceTab: React.FC = () => {
  const { tickets, staff, propertyIds, residents, beds } = useOwnerScope();
  const [remote, setRemote] = useState<MaintenanceOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Complaints belong to the org's properties; fall back to the resident name
  // only for legacy rows raised before property_id was stamped.
  const scopedTickets = useMemo(() => {
    const names = new Set(residents.map((r) => r.name));
    return tickets.filter(
      (t) => (t.propertyId ? propertyIds.has(t.propertyId) : true) && (t.propertyId || !t.residentName || names.has(t.residentName))
    );
  }, [tickets, propertyIds, residents]);

  const fallback = useMemo(() => localOverview(scopedTickets, beds), [scopedTickets, beds]);

  const load = useCallback(async () => {
    if (!isProductionApiEnabled()) return;
    setLoading(true);
    const data = await fetchMaintenanceOverview();
    setLoading(false);
    if (data) {
      setRemote(data);
      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const data = remote ?? fallback;
  const live = Boolean(remote);

  // Staff with no complaints yet should still appear, with zeros — a silent
  // roster member is exactly what an owner wants to notice.
  const staffRows: MaintenanceStaffStat[] = useMemo(() => {
    const byName = new Map<string, MaintenanceStaffStat>(
      data.staff.map((row) => [row.name.toLowerCase(), row] as [string, MaintenanceStaffStat])
    );
    for (const member of staff) {
      const key = member.name.toLowerCase();
      if (!byName.has(key)) {
        byName.set(key, {
          name: member.name,
          assigned: 0,
          open: 0,
          resolved: 0,
          avgResolutionHours: null,
          lateResolutions: 0,
          escalations: 0,
        });
      }
    }
    return Array.from(byName.values()).sort(
      (a, b) => b.resolved - a.resolved || b.assigned - a.assigned || a.name.localeCompare(b.name)
    );
  }, [data.staff, staff]);

  const priorities = useMemo(() => {
    const rows = [...data.sla.byPriority];
    return rows.sort(
      (a, b) =>
        (PRIORITY_ORDER.indexOf(a.priority) === -1 ? 99 : PRIORITY_ORDER.indexOf(a.priority)) -
        (PRIORITY_ORDER.indexOf(b.priority) === -1 ? 99 : PRIORITY_ORDER.indexOf(b.priority))
    );
  }, [data.sla.byPriority]);

  const unassigned = data.totals.unassigned;
  const breachTone = data.sla.breachedOpen > 0 ? 'danger' : 'good';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Maintenance</p>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" /> Complaint SLA &amp; Staff Performance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {data.totals.total} complaint{data.totals.total === 1 ? '' : 's'} across{' '}
            {propertyIds.size} propert{propertyIds.size === 1 ? 'y' : 'ies'}
            {lastSync ? ` · updated ${lastSync}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded-full text-[10px] font-extrabold border ${
              live ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {live ? 'Live data' : 'Local data'}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="Open complaints"
          value={String(data.totals.open)}
          sub={unassigned > 0 ? `${unassigned} waiting for an assignee` : 'All have an assignee'}
          tone={unassigned > 0 ? 'warn' : 'slate'}
        />
        <KpiCard
          label="Past fix-by deadline"
          value={String(data.sla.breachedOpen)}
          sub={
            data.totals.escalated > 0
              ? `${data.totals.escalated} escalated to you`
              : 'None escalated yet'
          }
          tone={breachTone}
        />
        <KpiCard
          label="Avg resolution time"
          value={formatHours(data.sla.avgResolutionHours)}
          sub={`Median ${formatHours(data.sla.medianResolutionHours)}`}
          tone="slate"
        />
        <KpiCard
          label="Resolved within SLA"
          value={data.sla.withinSlaPct === null ? '—' : `${data.sla.withinSlaPct}%`}
          sub={
            data.sla.resolvedInSla + data.sla.resolvedLate > 0
              ? `${data.sla.resolvedInSla} on time · ${data.sla.resolvedLate} late`
              : 'No closed complaints yet'
          }
          tone={data.sla.withinSlaPct === null ? 'slate' : data.sla.withinSlaPct >= 70 ? 'good' : 'danger'}
        />
      </div>

      {data.sla.breachedOpen > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-extrabold text-red-800">
            <AlertTriangle className="w-4 h-4" /> Complaints past their fix-by deadline
          </div>
          <div className="space-y-1.5">
            {data.breached.map((ticket) => {
              const overdue = ticket.slaDeadline ? formatHours(hoursBetween(ticket.slaDeadline, new Date().toISOString()) || 0) : '—';
              return (
                <div key={ticket.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-white/70 border border-red-100 px-3 py-2">
                  <span className="text-xs font-bold text-slate-900">{ticket.title}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">{ticket.priority}</span>
                  <span className="text-[11px] text-slate-500">
                    {ticket.propertyName || 'Property'} {ticket.roomNumber ? `· Room ${ticket.roomNumber}` : ''}
                  </span>
                  <span className="text-[11px] font-bold text-red-700 ml-auto">overdue {overdue}</span>
                  <span className="text-[11px] text-slate-500">
                    {ticket.assignedStaffName ? `with ${ticket.assignedStaffName}` : 'unassigned'}
                    {ticket.escalatedAt ? ' · escalated' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" /> SLA health by priority
          </h3>
          {priorities.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">No complaints recorded yet.</p>
          ) : (
            <div className="space-y-2.5">
              {priorities.map((row) => (
                <div key={row.priority} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-800">{row.priority}</span>
                    <span className="text-slate-500">
                      {row.total} total · {row.open} open
                      {row.breachedOpen > 0 && <span className="text-red-600 font-bold"> · {row.breachedOpen} late</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${SLA_BAR(row.withinSlaPct)}`}
                        style={{ width: `${row.withinSlaPct ?? 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 w-24 text-right">
                      {row.resolved === 0
                        ? 'no closures'
                        : row.withinSlaPct === null
                          ? 'no deadline set'
                          : `${row.withinSlaPct}% on time`}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    {row.resolved} closed · avg fix {formatHours(row.avgResolutionHours)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" /> Staff performance
          </h3>
          {staffRows.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">No team members on this account yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase text-slate-400">
                    <th className="text-left font-bold pb-2">Member</th>
                    <th className="text-right font-bold pb-2">Jobs</th>
                    <th className="text-right font-bold pb-2">Done</th>
                    <th className="text-right font-bold pb-2">Avg fix</th>
                    <th className="text-right font-bold pb-2">Late</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffRows.map((row) => (
                    <tr key={row.name}>
                      <td className="py-2">
                        <span className="font-bold text-slate-800">{row.name}</span>
                        <span className="block text-[10px] text-slate-400">
                          {row.open} open
                          {row.escalations > 0 ? ` · ${row.escalations} escalated` : ''}
                        </span>
                      </td>
                      <td className="py-2 text-right font-semibold text-slate-600">{row.assigned}</td>
                      <td className="py-2 text-right font-semibold text-slate-900">{row.resolved}</td>
                      <td className="py-2 text-right font-semibold text-slate-600">{formatHours(row.avgResolutionHours)}</td>
                      <td className={`py-2 text-right font-bold ${row.lateResolutions > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {row.lateResolutions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <Clock className="w-4 h-4 text-slate-400" />
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Median fix time</span>
            <span className="text-sm font-black text-slate-900">{formatHours(data.sla.medianResolutionHours)}</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Resolved</span>
            <span className="text-sm font-black text-slate-900">{data.totals.resolved}</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Unassigned</span>
            <span className="text-sm font-black text-slate-900">{unassigned}</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Escalations</span>
            <span className="text-sm font-black text-slate-900">{data.totals.escalated}</span>
          </div>
        </div>
      </div>

      {(data.repeatIssues?.length > 0 || data.costPerBed?.some((c) => c.totalCost > 0)) && (
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-600" /> Repeat issues (last 30 days)
            </h3>
            {data.repeatIssues.length === 0 ? (
              <p className="text-xs text-slate-400">No category recurring on the same room — good sign.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.repeatIssues.map((r, i) => (
                  <li key={i} className="py-2 text-xs flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      {r.category} · Room {r.roomNumber}
                      {r.propertyName ? <span className="text-slate-400 font-semibold"> — {r.propertyName}</span> : null}
                    </span>
                    <span className="text-[11px] font-black text-amber-600">{r.occurrences}× tickets</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-600" /> Maintenance cost per occupied bed
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase text-slate-400">
                    <th className="text-left font-bold pb-2">Property</th>
                    <th className="text-right font-bold pb-2">Spend</th>
                    <th className="text-right font-bold pb-2">Beds</th>
                    <th className="text-right font-bold pb-2">Per bed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.costPerBed.filter((c) => c.totalCost > 0).slice(0, 8).map((c) => (
                    <tr key={c.propertyId}>
                      <td className="py-2 font-bold text-slate-800">{c.propertyName || c.propertyId}</td>
                      <td className="py-2 text-right font-semibold text-slate-600">₹{c.totalCost.toLocaleString('en-IN')}</td>
                      <td className="py-2 text-right font-semibold text-slate-600">{c.occupiedBeds}</td>
                      <td className="py-2 text-right font-black text-slate-900">{c.costPerBed !== null ? `₹${c.costPerBed.toLocaleString('en-IN')}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
