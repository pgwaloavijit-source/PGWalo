import React, { useEffect, useState } from 'react';
import { Utensils, Plus } from 'lucide-react';
import { fetchMealOps, upsertMealOpsEntry } from '../../services/marketApi';
import type { MealOpsEntry } from '../../domain/p1';
import { MEAL_SLOTS } from '../../domain/p1';

const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/**
 * Food operations card (spec §28, P1): connect meals to cost/waste instead of
 * attendance-only tracking. The owner logs prepared vs attended counts and
 * food cost; the summary surfaces over-preparation and cost per attended meal.
 */
export const MealOpsCard: React.FC<{ properties: { id: string; name: string }[] }> = ({ properties }) => {
  const [entries, setEntries] = useState<MealOpsEntry[]>([]);
  const [summary, setSummary] = useState<{ surplusPercent: number | null; costPerAttendedMeal: number | null; foodCostTotal: number; worstWasteMeal: string | null } | null>(null);
  const [propertyId, setPropertyId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [meal, setMeal] = useState('lunch');
  const [menu, setMenu] = useState('');
  const [prepared, setPrepared] = useState('');
  const [attended, setAttended] = useState('');
  const [cost, setCost] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = (pid?: string) => {
    fetchMealOps(pid ? { propertyId: pid } : {})
      .then((r) => { setEntries(r.entries); setSummary(r.summary); })
      .catch(() => { setEntries([]); setSummary(null); });
  };
  useEffect(() => { refresh(propertyId); }, [propertyId]);

  const save = async () => {
    const pid = propertyId || properties[0]?.id;
    if (!pid) { setError('Create a property first'); return; }
    if (!prepared || !Number.isFinite(Number(prepared))) { setError('Enter how many meals were prepared'); return; }
    setBusy(true); setError(null);
    try {
      await upsertMealOpsEntry({
        propertyId: pid, date, meal, menu: menu || undefined,
        expectedCount: Number(prepared), preparedCount: Number(prepared),
        attendanceCount: attended ? Number(attended) : undefined,
        foodCost: cost ? Number(cost) : undefined,
      });
      setMenu(''); setPrepared(''); setAttended(''); setCost('');
      refresh(propertyId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the entry');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4">
      <div className="flex items-start gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <Utensils className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-900">Food operations & waste</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Log what was prepared, eaten and what it cost — cut wastage, price the mess honestly.</p>
        </div>
      </div>

      {summary && (summary.totalPrepared > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
            <div className="text-base font-black text-slate-900">{summary.totalPrepared}</div>
            <div className="text-[10px] font-bold text-slate-500">meals prepared</div>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
            <div className="text-base font-black text-slate-900">{summary.totalAttendance}</div>
            <div className="text-[10px] font-bold text-slate-500">meals eaten</div>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-2.5">
            <div className="text-base font-black text-amber-700">{summary.surplusPercent !== null ? `${summary.surplusPercent}%` : '—'}</div>
            <div className="text-[10px] font-bold text-amber-600">over-prepared</div>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2.5">
            <div className="text-base font-black text-emerald-700">{summary.costPerAttendedMeal !== null ? fmtINR(summary.costPerAttendedMeal) : '—'}</div>
            <div className="text-[10px] font-bold text-emerald-600">cost / eaten meal</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold sm:col-span-2">
          <option value="">All properties</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold" />
        <select value={meal} onChange={(e) => setMeal(e.target.value)} className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold">
          {MEAL_SLOTS.map((m) => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
        </select>
        <input value={menu} onChange={(e) => setMenu(e.target.value)} placeholder="Menu" className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold" />
        <input value={prepared} onChange={(e) => setPrepared(e.target.value.replace(/\D/g, ''))} placeholder="Prepared #" className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold" />
        <input value={attended} onChange={(e) => setAttended(e.target.value.replace(/\D/g, ''))} placeholder="Eaten #" className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold" />
        <input value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Cost ₹" className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold" />
        <button onClick={save} disabled={busy} className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 text-xs font-bold flex items-center justify-center gap-1 sm:col-span-2">
          <Plus className="w-3.5 h-3.5" /> Log meal
        </button>
      </div>
      {error && <p className="text-[11px] font-bold text-red-600 mt-2">{error}</p>}

      {entries.length > 0 && (
        <ul className="divide-y divide-slate-100 mt-3">
          {entries.slice(0, 6).map((e) => (
            <li key={e.id} className="flex items-center justify-between py-2 text-[11px]">
              <span className="font-bold text-slate-700">{e.date} · {e.meal}{e.menu ? ` · ${e.menu}` : ''}</span>
              <span className="font-semibold text-slate-500">
                {e.preparedCount} prepared
                {e.attendanceCount != null ? ` · ${e.attendanceCount} eaten` : ''}
                {e.foodCost != null ? ` · ${fmtINR(e.foodCost)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
