import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Users, IndianRupee, CalendarClock, X } from 'lucide-react';
import {
  fetchInstitutionalLeads, createInstitutionalLead, patchInstitutionalLead,
} from '../../services/marketApi';
import type { InstitutionalLead, InstitutionalStage } from '../../domain/p1';
import { INSTITUTIONAL_STAGES } from '../../domain/p1';

const STAGE_LABELS: Record<InstitutionalStage, string> = {
  new: 'New', shortlisting: 'Shortlisting', allocated: 'Beds Allocated', won: 'Won', lost: 'Lost',
};

const STAGE_TONE: Record<InstitutionalStage, string> = {
  new: 'bg-slate-100 text-slate-600 border-slate-200',
  shortlisting: 'bg-blue-50 text-blue-700 border-blue-200',
  allocated: 'bg-amber-50 text-amber-700 border-amber-200',
  won: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  lost: 'bg-red-50 text-red-600 border-red-200',
};

interface EligibleBed {
  bedId: string; bedNumber: string; roomNumber: string;
  monthlyRent: number; sharingType: string; propertyName: string;
}

/**
 * Institutional / bulk booking pipeline (spec §30). A separate demand source
 * from the consumer CRM: a company/college asks for N beds; the owner
 * shortlists properties, checks real eligible vacant beds and allocates.
 */
export const InstitutionalTab: React.FC<{ properties: { id: string; name: string; locality?: string }[] }> = ({ properties }) => {
  const [leads, setLeads] = useState<InstitutionalLead[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [eligible, setEligible] = useState<Record<string, EligibleBed[]>>({});
  const [error, setError] = useState<string | null>(null);

  // form state
  const [institutionName, setInstitutionName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [requiredBeds, setRequiredBeds] = useState(5);
  const [budgetPerBed, setBudgetPerBed] = useState('');
  const [genderEligibility, setGenderEligibility] = useState<'male' | 'female' | 'any'>('any');
  const [moveInDate, setMoveInDate] = useState('');

  const refresh = () => {
    fetchInstitutionalLeads().then((r) => setLeads(r.leads)).catch(() => setLeads([]));
  };
  useEffect(refresh, []);

  const loadEligible = async (lead: InstitutionalLead) => {
    if (eligible[lead.id]) {
      setEligible((prev) => { const next = { ...prev }; delete next[lead.id]; return next; });
      return;
    }
    try {
      const token = (await import('../../services/productionApi')).getAuthToken();
      const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || '';
      const resp = await fetch(`${base}/api/market/institutional/${encodeURIComponent(lead.id)}/eligible-beds`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await resp.json() as { eligibleBeds?: EligibleBed[] };
      setEligible((prev) => ({ ...prev, [lead.id]: data.eligibleBeds || [] }));
    } catch {
      setEligible((prev) => ({ ...prev, [lead.id]: [] }));
    }
  };

  const create = async () => {
    if (!institutionName.trim()) { setError('Institution name is required'); return; }
    setError(null);
    try {
      await createInstitutionalLead({
        institutionName, contactName: contactName || undefined, contactPhone: contactPhone || undefined,
        requiredBeds, genderEligibility, budgetPerBed: budgetPerBed ? Number(budgetPerBed) : undefined,
        moveInDate: moveInDate || undefined,
      });
      setShowForm(false);
      setInstitutionName(''); setContactName(''); setContactPhone(''); setBudgetPerBed(''); setMoveInDate('');
      setRequiredBeds(5);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the request');
    }
  };

  const move = async (lead: InstitutionalLead, status: InstitutionalStage) => {
    try {
      await patchInstitutionalLead(lead.id, { status });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stage change rejected');
    }
  };

  const counts = useMemo(() => {
    const c: Partial<Record<InstitutionalStage, number>> = {};
    for (const l of leads) c[l.status] = (c[l.status] || 0) + 1;
    return c;
  }, [leads]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-slate-900">Institutional & bulk booking</h2>
          <p className="text-[11px] text-slate-500">Companies, colleges and hostels asking for multiple beds — tracked separately from the consumer CRM.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs font-bold flex items-center gap-1.5"
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {showForm ? 'Cancel' : 'New request'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} placeholder="Institution / company name *" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold sm:col-span-2" />
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact person" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold" />
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Contact phone" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold" />
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
            Beds needed
            <input type="number" min={1} value={requiredBeds} onChange={(e) => setRequiredBeds(Math.max(1, Number(e.target.value)))} className="w-20 rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold" />
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
            Budget/bed ₹
            <input value={budgetPerBed} onChange={(e) => setBudgetPerBed(e.target.value.replace(/\D/g, ''))} placeholder="—" className="w-24 rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold" />
          </label>
          <select value={genderEligibility} onChange={(e) => setGenderEligibility(e.target.value as typeof genderEligibility)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">
            <option value="any">Any gender model</option>
            <option value="male">Boys only</option>
            <option value="female">Girls only</option>
          </select>
          <input type="date" value={moveInDate} onChange={(e) => setMoveInDate(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold" />
          <button onClick={create} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-xs font-bold">Create request</button>
        </div>
      )}
      {error && <p className="text-[11px] font-bold text-red-600">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {INSTITUTIONAL_STAGES.map((s) => (
          <div key={s} className={`rounded-xl border px-3 py-2 text-[11px] font-black ${STAGE_TONE[s]}`}>
            {STAGE_LABELS[s]} · {counts[s] || 0}
          </div>
        ))}
      </div>

      {leads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No bulk requests yet</p>
          <p className="text-xs text-slate-500 mt-1">Log a company or college requirement to start tracking it here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {leads.map((l) => (
            <li key={l.id} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-slate-900">{l.institutionName}</p>
                  <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 mt-0.5">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {l.requiredBeds} beds</span>
                    {l.budgetPerBed != null && <span className="flex items-center gap-1"><IndianRupee className="w-3 h-3" /> {l.budgetPerBed.toLocaleString('en-IN')}/bed</span>}
                    {l.moveInDate && <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" /> {l.moveInDate}</span>}
                    {l.contactPhone && <span>· {l.contactPhone}</span>}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STAGE_TONE[l.status]}`}>{STAGE_LABELS[l.status]}</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                {INSTITUTIONAL_STAGES.filter((s) => s !== l.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => move(l, s)}
                    className="text-[10px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 px-2 py-1"
                  >
                    → {STAGE_LABELS[s]}
                  </button>
                ))}
                <button onClick={() => loadEligible(l)} className="text-[10px] font-bold rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 px-2 py-1">
                  {eligible[l.id] ? 'Hide matching beds' : 'Match vacant beds'}
                </button>
              </div>

              {eligible[l.id] && (
                <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3">
                  {eligible[l.id].length === 0 ? (
                    <p className="text-[11px] font-semibold text-slate-500">No vacant beds currently match this request's gender/budget model.</p>
                  ) : (
                    <>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1.5">{eligible[l.id].length} matching vacant bed{eligible[l.id].length === 1 ? '' : 's'}</p>
                      <ul className="space-y-1">
                        {eligible[l.id].slice(0, 8).map((b) => (
                          <li key={b.bedId} className="text-[11px] font-semibold text-slate-700 flex justify-between">
                            <span>{b.propertyName} · Room {b.roomNumber} · Bed {b.bedNumber} ({b.sharingType})</span>
                            <span className="font-black">₹{b.monthlyRent.toLocaleString('en-IN')}</span>
                          </li>
                        ))}
                      </ul>
                      {l.allocatedBedIds.length > 0 && (
                        <p className="text-[10px] font-bold text-emerald-700 mt-2">{l.allocatedBedIds.length} of {l.requiredBeds} beds allocated</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
