import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useOwnerScope } from '../../utils/ownership';
import { toMarketLead, canTransitionLead, deriveBedStatus, MARKET_LEAD_STAGES } from '../../domain/market';
import type { MarketLead, MarketLeadStage, PropertyVisit, BedReservation } from '../../domain/market';
import { WHATSAPP_TEMPLATES, whatsappDeepLink } from '../../domain/messaging';
import {
  fetchVisits, createVisit, patchVisit, fetchReservations, createReservation, patchReservation,
  convertReservationToStay,
} from '../../services/marketApi';
import {
  Bed as BedIcon, Calendar, CheckCircle2, MessageCircle, Phone, Plus, ShieldQuestion,
  UserPlus, XCircle, X,
} from 'lucide-react';

const STAGE_LABELS: Record<MarketLeadStage, string> = {
  new: 'New', contacted: 'Contacted', visit_scheduled: 'Visit scheduled',
  visited: 'Visited', negotiating: 'Negotiating', token_pending: 'Token pending',
  token_paid: 'Token paid', reserved: 'Reserved', moved_in: 'Moved in',
  lost: 'Lost', spam: 'Spam',
};

type View = 'pipeline' | 'followups' | 'visits' | 'reservations';

export const CrmTab: React.FC = () => {
  const { updateLeadStage } = useApp();
  const { leads, beds, properties } = useOwnerScope();
  const [view, setView] = useState<View>('pipeline');
  const [visits, setVisits] = useState<PropertyVisit[]>([]);
  const [reservations, setReservations] = useState<BedReservation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<MarketLead | null>(null);
  const [visitFormFor, setVisitFormFor] = useState<string | null>(null);
  const [reserveFormFor, setReserveFormFor] = useState<string | null>(null);
  const [activityNote, setActivityNote] = useState('');

  React.useEffect(() => {
    if (loaded) return;
    setLoaded(true);
    fetchVisits().then((r) => setVisits(r.visits)).catch(() => setVisits([]));
    fetchReservations().then((r) => setReservations(r.reservations)).catch(() => setReservations([]));
  }, [loaded]);

  const marketLeads = useMemo(() => leads.map(toMarketLead), [leads]);
  const today = new Date().toISOString().slice(0, 10);

  const followUps = useMemo(
    () => marketLeads
      .filter((l) => !['moved_in', 'lost', 'spam'].includes(l.stage) && l.nextFollowUpAt && l.nextFollowUpAt <= today)
      .sort((a, b) => (a.nextFollowUpAt || '').localeCompare(b.nextFollowUpAt || '')),
    [marketLeads, today]
  );

  const availableBeds = useMemo(
    () => beds.filter((b) => ['vacant', 'occupied_notice'].includes(deriveBedStatus({ status: String(b.status) }))),
    [beds]
  );

  const transition = (leadId: string, stage: MarketLeadStage) => {
    if (!canTransitionLeadStage(leadId, stage)) {
      alert('That stage change is not allowed from the current stage. Move through the pipeline in order.');
      return;
    }
    updateLeadStage(leadId, legacyStageFor(stage), `Stage moved to ${STAGE_LABELS[stage]}`);
    setSelected(null);
  };

  const canTransitionLeadStage = (leadId: string, stage: MarketLeadStage): boolean => {
    const lead = marketLeads.find((l) => l.id === leadId);
    if (!lead) return false;
    return canTransitionLead(lead.stage, stage);
  };

  const legacyStageFor = (stage: MarketLeadStage) => {
    const back: Record<MarketLeadStage, LeadStageLegacy> = {
      new: 'New Lead', contacted: 'Contacted', visit_scheduled: 'Visit Scheduled',
      visited: 'Visited', negotiating: 'Interested', token_pending: 'Booking Pending',
      token_paid: 'Booked', reserved: 'Booked', moved_in: 'Moved In',
      lost: 'Lost', spam: 'Lost',
    };
    return back[stage];
  };
  type LeadStageLegacy = Parameters<typeof updateLeadStage>[1];

  const scheduleVisit = async (lead: MarketLead, datetime: string) => {
    const propertyId = lead.propertyId || properties[0]?.id || '';
    if (!propertyId || !datetime) return;
    try {
      await createVisit({ leadId: lead.id, propertyId, scheduledAt: datetime });
      const r = await fetchVisits();
      setVisits(r.visits);
      setVisitFormFor(null);
      transition(lead.id, 'visit_scheduled');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not schedule visit');
    }
  };

  const reserveBed = async (lead: MarketLead, bedId: string, startDate: string, tokenAmount: number) => {
    const propertyId = lead.propertyId || properties[0]?.id || '';
    try {
      await createReservation(
        { bedId, propertyId, startDate, tokenAmount, guestName: lead.fullName, guestPhone: lead.phone, leadId: lead.id },
        { beds: beds.map((b) => ({ id: b.id, status: String(b.status), nextAvailableDate: b.nextAvailableDate })) }
      );
      const r = await fetchReservations();
      setReservations(r.reservations);
      setReserveFormFor(null);
      transition(lead.id, 'token_pending');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not create reservation');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {([
          ['pipeline', 'Pipeline'],
          ['followups', `Follow-ups due (${followUps.length})`],
          ['visits', 'Visits'],
          ['reservations', 'Reservations'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
              view === key ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'pipeline' && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {MARKET_LEAD_STAGES.filter((s) => s !== 'spam').map((stage) => {
              const stageLeads = marketLeads.filter((l) => l.stage === stage);
              return (
                <div key={stage} className="w-60 shrink-0">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">{STAGE_LABELS[stage]}</span>
                    <span className="text-[10px] font-black text-slate-400">{stageLeads.length}</span>
                  </div>
                  <div className="space-y-2 min-h-[60px]">
                    {stageLeads.map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => setSelected(lead)}
                        className="w-full text-left bg-white rounded-2xl border border-slate-200 p-3 hover:border-blue-300 transition shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900 truncate">{lead.fullName}</span>
                          {lead.temperature === 'Hot' && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Hot lead" />}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{lead.phone}</div>
                        {lead.budgetMax ? <div className="text-[11px] font-bold text-slate-600 mt-1">≤ ₹{lead.budgetMax.toLocaleString('en-IN')}</div> : null}
                        {lead.nextFollowUpAt && lead.nextFollowUpAt <= today && (
                          <div className="text-[10px] font-black text-amber-700 bg-amber-50 rounded-lg px-1.5 py-0.5 mt-1.5 inline-block">Follow-up due</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'followups' && (
        followUps.length === 0 ? (
          <EmptyState title="No follow-ups due" body="Every active lead has a future follow-up date. Check the pipeline for new inquiries." />
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100">
            {followUps.map((lead) => (
              <div key={lead.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">{lead.fullName} <span className="text-xs font-semibold text-slate-400">· {STAGE_LABELS[lead.stage]}</span></p>
                  <p className="text-[11px] text-slate-500">Follow-up was due {lead.nextFollowUpAt} · {lead.phone}</p>
                </div>
                <a href={whatsappDeepLink(lead.phone, WHATSAPP_TEMPLATES[0].body({ leadName: lead.fullName, propertyName: lead.propertyName }))} target="_blank" rel="noreferrer"
                  className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
                <a href={`tel:${lead.phone}`} className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-200 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>
                <button onClick={() => setVisitFormFor(lead.id)} className="text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1.5 rounded-lg border border-purple-200 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Visit
                </button>
                <button onClick={() => setSelected(lead)} className="text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                  Move stage
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {view === 'visits' && (
        visits.length === 0 ? (
          <EmptyState title="No visits scheduled" body="Schedule visits from a lead card or the follow-ups list. Visit outcomes feed straight back into the pipeline." />
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100">
            {visits.map((v) => (
              <div key={v.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">{new Date(v.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  <p className="text-[11px] text-slate-500">{v.assignedStaffName ? `Assigned: ${v.assignedStaffName} · ` : ''}{v.notes || 'No notes'}</p>
                </div>
                <VisitStatusChip status={v.status} />
                {['scheduled', 'confirmed', 'rescheduled'].includes(v.status) && (
                  <>
                    <button onClick={async () => { await patchVisit(v.id, { status: 'completed', outcome: 'interested' }); setVisits((prev) => prev.map((x) => x.id === v.id ? { ...x, status: 'completed' } : x)); }}
                      className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">Interested</button>
                    <button onClick={async () => { await patchVisit(v.id, { status: 'no_show' }); setVisits((prev) => prev.map((x) => x.id === v.id ? { ...x, status: 'no_show' } : x)); }}
                      className="text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">No-show</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {view === 'reservations' && (
        reservations.length === 0 ? (
          <EmptyState title="No reservations yet" body="Hold a bed with a token from any lead card. Conflicting holds are rejected automatically." />
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100">
            {reservations.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">{r.guestName} · bed {r.bedNumber || r.bedId}</p>
                  <p className="text-[11px] text-slate-500">Starts {r.startDate} · token ₹{r.tokenAmount.toLocaleString('en-IN')} · expires {new Date(r.expiryAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                  r.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : r.status === 'expired' || r.status === 'cancelled' ? 'bg-slate-100 text-slate-500 border-slate-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {r.status.replace(/_/g, ' ')}
                </span>
                {r.status === 'pending_payment' && (
                  <>
                    <button onClick={async () => { await patchReservation(r.id, { status: 'confirmed', tokenPaymentStatus: 'paid' }); setReservations((prev) => prev.map((x) => x.id === r.id ? { ...x, status: 'confirmed' } : x)); }}
                      className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">Token received</button>
                    <button onClick={async () => { await patchReservation(r.id, { status: 'cancelled', cancellationReason: 'Cancelled by owner' }); setReservations((prev) => prev.map((x) => x.id === r.id ? { ...x, status: 'cancelled' } : x)); }}
                      className="text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">Cancel</button>
                  </>
                )}
                {r.status === 'confirmed' && (
                  <button
                    onClick={async () => {
                      try {
                        const result = await convertReservationToStay(r.id);
                        setReservations((prev) => prev.map((x) => x.id === r.id ? { ...x, status: 'converted_to_stay' as const } : x));
                        alert(`Move-in complete. Resident ${result.residentId} created — finish KYC, agreement and deposit from the Residents tab.`);
                      } catch (error) {
                        alert(error instanceof Error ? error.message : 'Conversion failed');
                      }
                    }}
                    className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-200"
                  >
                    Move in
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Lead detail drawer */}
      {selected && (
        <div className="owner-modal-backdrop fixed inset-0 z-[1000] bg-slate-900/45 backdrop-blur-[2px] flex justify-end" onClick={() => setSelected(null)}>
          <div className="bg-white w-full max-w-xl h-full overflow-y-auto border-l border-slate-200 shadow-2xl p-5 sm:p-7 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">{selected.fullName}</h3>
                <p className="text-xs text-slate-500">{selected.phone}{selected.email ? ` · ${selected.email}` : ''}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Source: {selected.source} · Stage: {STAGE_LABELS[selected.stage]}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {MARKET_LEAD_STAGES.filter((s) => s !== selected.stage).map((stage) => (
                <button
                  key={stage}
                  onClick={() => transition(selected.id, stage)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border text-left ${
                    canTransitionLead(selected.stage, stage)
                      ? 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-slate-700'
                      : 'border-slate-100 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  {STAGE_LABELS[stage]}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Current stage</p>
                <p className="mt-1 text-sm font-black text-slate-900">{STAGE_LABELS[selected.stage]}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Budget</p>
                <p className="mt-1 text-sm font-black text-slate-900">{selected.budgetMax ? `Up to ₹${selected.budgetMax.toLocaleString('en-IN')}` : 'Not specified'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Move-in date</p>
                <p className="mt-1 text-sm font-black text-slate-900">{selected.moveInDate || 'Not specified'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Follow-up</p>
                <p className="mt-1 text-sm font-black text-slate-900">{selected.nextFollowUpAt || 'Not scheduled'}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
              <div>
                <h4 className="text-sm font-black text-slate-900">Lead preferences</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Details captured from the original enquiry.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                <span>Locality: {selected.desiredLocality || 'Not specified'}</span>
                <span>Sharing: {selected.sharingPreference || 'Not specified'}</span>
                <span>Workplace / college: {selected.workplaceOrCollege || 'Not specified'}</span>
                <span>Property: {selected.propertyName || 'Not assigned'}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-black text-slate-900">Activity</h4>
              <p className="text-xs text-slate-500 mt-1">{activityNote || `Last updated ${new Date(selected.updatedAt).toLocaleDateString('en-IN')}. Use the actions below to continue this lead.`}</p>
            </div>

            <div className="flex gap-2 sticky bottom-0 bg-white pt-3">
              <a href={whatsappDeepLink(selected.phone, WHATSAPP_TEMPLATES[0].body({ leadName: selected.fullName, propertyName: selected.propertyName }))} target="_blank" rel="noreferrer"
                className="flex-1 text-center text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-xl border border-emerald-200">WhatsApp</a>
              <button onClick={() => { setVisitFormFor(selected.id); setSelected(null); }} className="flex-1 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-xl border border-purple-200">Schedule visit</button>
              <button onClick={() => { setReserveFormFor(selected.id); setSelected(null); }} className="flex-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-xl border border-amber-200">Hold bed</button>
            </div>

            {activityNote && <p className="text-xs text-slate-500">{activityNote}</p>}
          </div>
        </div>
      )}

      {/* Visit scheduling form */}
      {visitFormFor && (
        <VisitFormModal
          lead={marketLeads.find((l) => l.id === visitFormFor) || null}
          properties={properties.map((p) => ({ id: p.id, name: p.name }))}
          onClose={() => setVisitFormFor(null)}
          onSubmit={(dt) => {
            const lead = marketLeads.find((l) => l.id === visitFormFor);
            if (lead) scheduleVisit(lead, dt);
          }}
        />
      )}

      {/* Bed reservation form */}
      {reserveFormFor && (
        <ReserveFormModal
          lead={marketLeads.find((l) => l.id === reserveFormFor) || null}
          beds={availableBeds.map((b) => ({ id: b.id, bedNumber: b.bedNumber, roomNumber: b.roomNumber, monthlyRent: b.monthlyRent, status: String(b.status), nextAvailableDate: b.nextAvailableDate }))}
          onClose={() => setReserveFormFor(null)}
          onSubmit={(bedId, startDate, token) => {
            const lead = marketLeads.find((l) => l.id === reserveFormFor);
            if (lead) reserveBed(lead, bedId, startDate, token);
          }}
        />
      )}
    </div>
  );
};

const VisitStatusChip: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
    confirmed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    no_show: 'bg-slate-100 text-slate-500 border-slate-200',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
    rescheduled: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${map[status] || map.cancelled}`}>{status.replace('_', ' ')}</span>;
};

const EmptyState: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="bg-white rounded-3xl border border-slate-200 px-6 py-10 text-center">
    <p className="text-sm font-bold text-slate-700">{title}</p>
    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">{body}</p>
  </div>
);

const VisitFormModal: React.FC<{
  lead: MarketLead | null;
  properties: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (datetime: string) => void;
}> = ({ lead, onClose, onSubmit }) => {
  const [dt, setDt] = useState('');
  if (!lead) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-black text-slate-900">Schedule visit — {lead.fullName}</h3>
        <input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">Cancel</button>
          <button onClick={() => dt && onSubmit(dt)} disabled={!dt} className="flex-1 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50">Schedule</button>
        </div>
      </div>
    </div>
  );
};

const ReserveFormModal: React.FC<{
  lead: MarketLead | null;
  beds: { id: string; bedNumber: string; roomNumber: string; monthlyRent: number; status: string; nextAvailableDate?: string }[];
  onClose: () => void;
  onSubmit: (bedId: string, startDate: string, token: number) => void;
}> = ({ lead, beds, onClose, onSubmit }) => {
  const [bedId, setBedId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [token, setToken] = useState('5000');
  if (!lead) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-black text-slate-900">Hold a bed — {lead.fullName}</h3>
        {beds.length === 0 ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            No bookable beds right now. Vacant beds and beds under notice (after their available date) appear here.
          </p>
        ) : (
          <>
            <label className="block">
              <span className="text-[10px] font-black uppercase text-slate-400">Bed</span>
              <select value={bedId} onChange={(e) => setBedId(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 text-sm">
                <option value="">Select a bed…</option>
                {beds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.roomNumber} / {b.bedNumber} · ₹{b.monthlyRent.toLocaleString('en-IN')}/mo{b.nextAvailableDate ? ` (from ${b.nextAvailableDate})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase text-slate-400">Start date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 text-sm" />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase text-slate-400">Token amount (₹)</span>
              <input type="number" value={token} onChange={(e) => setToken(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 text-sm" />
            </label>
          </>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">Cancel</button>
          <button onClick={() => bedId && startDate && onSubmit(bedId, startDate, Number(token) || 0)} disabled={!bedId || !startDate || beds.length === 0}
            className="flex-1 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50">Create hold</button>
        </div>
      </div>
    </div>
  );
};
