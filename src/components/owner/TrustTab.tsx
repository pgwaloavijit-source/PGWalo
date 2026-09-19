import React, { useEffect, useMemo, useState } from 'react';
import { useOwnerScope } from '../../utils/ownership';
import { COMPLIANCE_TEMPLATE_ITEMS, STATUS_TRUST_LABELS, buildVerificationFacts } from '../../domain/trust';
import type { PropertyComplianceItem } from '../../domain/market';
import { fetchCompliance, upsertComplianceItem, fetchReviews, createInspection, fetchInspections } from '../../services/marketApi';
import type { VerifiedReview, PropertyInspection } from '../../domain/market';
import { FileWarning, ShieldCheck, Upload, MessageSquare, ClipboardCheck } from 'lucide-react';

type View = 'compliance' | 'reviews' | 'inspections';

export const TrustTab: React.FC = () => {
  const { properties } = useOwnerScope();
  const [view, setView] = useState<View>('compliance');
  const [propertyId, setPropertyId] = useState('');

  React.useEffect(() => {
    if (!propertyId && properties.length > 0) setPropertyId(properties[0].id);
  }, [propertyId, properties]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap items-center">
        {([
          ['compliance', 'Compliance center', FileWarning],
          ['reviews', 'Verified reviews', MessageSquare],
          ['inspections', 'Move-in / Move-out evidence', ClipboardCheck],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
              view === key ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
        {properties.length > 0 && (
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="ml-auto px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white"
          >
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {view === 'compliance' && <CompliancePanel propertyId={propertyId} />}
      {view === 'reviews' && <ReviewsPanel propertyId={propertyId} />}
      {view === 'inspections' && <InspectionsPanel />}
    </div>
  );
};

// ------------------------------------------------------------------ compliance

const CompliancePanel: React.FC<{ propertyId: string }> = ({ propertyId }) => {
  const [items, setItems] = useState<PropertyComplianceItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!propertyId) return;
    setLoaded(true);
    fetchCompliance(propertyId).then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [propertyId, loaded]);

  const byTemplate = useMemo(() => {
    const map = new Map<string, PropertyComplianceItem>();
    for (const item of items) map.set(item.templateItemId, item);
    return map;
  }, [items]);

  const save = async (templateItemId: string, status: string) => {
    setSaving(templateItemId);
    try {
      await upsertComplianceItem({ propertyId, templateItemId, status });
      const r = await fetchCompliance(propertyId);
      setItems(r.items);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not update item');
    } finally {
      setSaving(null);
    }
  };

  if (!propertyId) {
    return <p className="text-xs text-slate-500 bg-white rounded-2xl border border-slate-200 px-4 py-6 text-center">List a property to start tracking compliance.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-xs text-blue-900">
        Document status is tracked per jurisdiction item. <strong>Uploaded ≠ verified</strong> — a document only counts after PGWalo verification,
        and verification never implies legal compliance. Expiring documents surface in your Home action center 30 days ahead.
      </div>
      {notice && <p className="text-xs font-bold text-red-600">{notice}</p>}
      <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100">
        {COMPLIANCE_TEMPLATE_ITEMS.map((tpl) => {
          const item = byTemplate.get(tpl.category);
          const status = (item?.status || 'missing') as PropertyComplianceItem['status'];
          const label = STATUS_TRUST_LABELS[status];
          return (
            <div key={tpl.category} className="px-5 py-3.5 flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">{tpl.label}</p>
                <p className="text-[11px] text-slate-500">{tpl.sourceNote}</p>
                {item?.expiresAt && (
                  <p className={`text-[11px] font-bold mt-0.5 ${item.expiresAt < new Date().toISOString().slice(0, 10) ? 'text-red-600' : 'text-amber-600'}`}>
                    Expires {item.expiresAt}
                  </p>
                )}
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                label.tone === 'good' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : label.tone === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200'
                : label.tone === 'bad' ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                {label.label}
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => save(tpl.category, 'uploaded')}
                  disabled={saving === tpl.category}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" /> {item ? 'Re-upload' : 'Upload'}
                </button>
                <button
                  onClick={() => save(tpl.category, 'verified')}
                  disabled={saving === tpl.category}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
                >
                  Mark verified
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --------------------------------------------------------------------- reviews

const ReviewsPanel: React.FC<{ propertyId: string }> = ({ propertyId }) => {
  const [reviews, setReviews] = useState<VerifiedReview[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [response, setResponse] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoaded(true);
    fetchReviews(propertyId || undefined).then((r) => setReviews(r.reviews)).catch(() => setReviews([]));
  }, [propertyId, loaded]);

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <div className="text-[10px] font-black text-slate-400 uppercase">Verified rating</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{avg ?? '—'}</div>
          <div className="text-[11px] text-slate-500">{reviews.length} verified-stay review{reviews.length === 1 ? '' : 's'}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 md:col-span-2">
          <div className="text-[10px] font-black text-slate-400 uppercase">Policy</div>
          <p className="text-xs text-slate-600 mt-1.5">
            Only residents with a completed or active stay can review. You can respond to every review —
            negative reviews cannot be deleted; only platform moderation can hide policy violations.
          </p>
        </div>
      </div>
      {reviews.length === 0 ? (
        <p className="text-xs text-slate-500 bg-white rounded-2xl border border-slate-200 px-4 py-6 text-center">
          No verified reviews yet. They arrive after residents complete their stay and submit the review form.
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-3xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{r.authorName}</p>
                  <p className="text-[11px] text-slate-400">{new Date(r.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })} · verified stay</p>
                </div>
                <span className="text-sm font-black text-amber-500">{'★'.repeat(r.rating)}<span className="text-slate-200">{'★'.repeat(5 - r.rating)}</span></span>
              </div>
              <p className="text-sm text-slate-700 mt-2">{r.comment}</p>
              {r.ownerResponse ? (
                <div className="mt-3 bg-slate-50 rounded-2xl px-3 py-2">
                  <p className="text-[10px] font-black uppercase text-slate-400">Owner response</p>
                  <p className="text-xs text-slate-700 mt-0.5">{r.ownerResponse}</p>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <input
                    value={response[r.id] || ''}
                    onChange={(e) => setResponse((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="Respond publicly…"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                  <button
                    onClick={async () => {
                      const text = response[r.id]?.trim();
                      if (!text) return;
                      const { respondToReview } = await import('../../services/marketApi');
                      await respondToReview(r.id, text);
                      const fresh = await fetchReviews(propertyId || undefined);
                      setReviews(fresh.reviews);
                    }}
                    className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                  >
                    Reply
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------------------- inspections

interface InspItemRow {
  area: string;
  item: string;
  condition: string;
  remarks: string;
}

const INSPECTION_AREAS: { area: string; items: string[] }[] = [
  { area: 'Room', items: ['Walls', 'Floor', 'Windows', 'Door & lock'] },
  { area: 'Furniture', items: ['Bed', 'Mattress', 'Wardrobe', 'Study table'] },
  { area: 'Bathroom', items: ['Fittings', 'Geyser', 'Drainage'] },
  { area: 'Appliances', items: ['Fan', 'Light', 'AC', 'Geyser'] },
  { area: 'Other', items: ['Keys / access card', 'Meter reading'] },
];

const InspectionsPanel: React.FC = () => {
  const { residents, properties } = useOwnerScope();
  const [inspections, setInspections] = useState<PropertyInspection[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchInspections().then((r) => setInspections(r.inspections)).catch(() => setInspections([]));
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500 max-w-lg">
          Structured move-in/move-out evidence prevents deposit disputes. Move-out inspections should reference
          the move-in record so pre-existing damage is documented side-by-side.
        </p>
        <button onClick={() => setShowForm((s) => !s)} className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold shrink-0">
          New inspection
        </button>
      </div>

      {showForm && (
        <InspectionForm
          residents={residents.map((r) => ({ id: r.id, name: r.name, roomNumber: r.roomNumber, propertyId: r.propertyId }))}
          properties={properties.map((p) => ({ id: p.id, name: p.name }))}
          onSaved={(id) => {
            setShowForm(false);
            fetchInspections().then((r) => setInspections(r.inspections)).catch(() => setInspections([]));
          }}
        />
      )}

      {inspections.length === 0 ? (
        <p className="text-xs text-slate-500 bg-white rounded-2xl border border-slate-200 px-4 py-6 text-center">
          No inspections recorded yet. Create one at move-in and again at move-out.
        </p>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100">
          {inspections.map((insp) => (
            <div key={insp.id} className="px-5 py-3.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-slate-900 capitalize">
                    {insp.type.replace('_', '-')} · room {insp.roomNumber}{insp.bedNumber ? ` / ${insp.bedNumber}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {insp.inspectionDate} · {insp.items?.length || 0} items checked
                    {insp.referenceInspectionId ? ' · references move-in record' : ''}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${insp.staffConfirmed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    Staff {insp.staffConfirmed ? 'confirmed' : 'pending'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${insp.residentConfirmed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    Resident {insp.residentConfirmed ? 'confirmed' : 'pending'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const InspectionForm: React.FC<{
  residents: { id: string; name: string; roomNumber: string; propertyId: string }[];
  properties: { id: string; name: string }[];
  onSaved: (id: string) => void;
}> = ({ residents, properties, onSaved }) => {
  const [type, setType] = useState<'move_in' | 'move_out'>('move_in');
  const [residentId, setResidentId] = useState('');
  const [propertyId, setPropertyId] = useState(properties[0]?.id || '');
  const [roomNumber, setRoomNumber] = useState('');
  const [rows, setRows] = useState<InspItemRow[]>(
    INSPECTION_AREAS.flatMap((g) => g.items.map((item) => ({ area: g.area, item, condition: 'Good', remarks: '' })))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!propertyId || !roomNumber) {
      setError('Property and room are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const resident = residents.find((r) => r.id === residentId);
      const ref = type === 'move_out'
        ? (await fetchInspections({ residentId: residentId || undefined, type: 'move_in' })).inspections[0]?.id
        : undefined;
      const result = await createInspection({
        propertyId,
        roomNumber,
        residentId: residentId || undefined,
        type,
        items: rows.map((r) => ({ ...r, condition: r.condition as 'Good' | 'Fair' | 'Damaged' | 'Not Applicable' })),
        referenceInspectionId: ref,
      });
      onSaved(result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save inspection');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
      <div className="grid sm:grid-cols-4 gap-3">
        <label className="block">
          <span className="text-[10px] font-black uppercase text-slate-400">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as 'move_in' | 'move_out')} className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 text-sm">
            <option value="move_in">Move-in</option>
            <option value="move_out">Move-out</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase text-slate-400">Resident (optional)</span>
          <select value={residentId} onChange={(e) => setResidentId(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 text-sm">
            <option value="">—</option>
            {residents.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.roomNumber})</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase text-slate-400">Property</span>
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 text-sm">
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase text-slate-400">Room</span>
          <input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 text-sm" placeholder="204" />
        </label>
      </div>
      <div className="max-h-72 overflow-y-auto overflow-x-auto rounded-2xl border border-slate-100">
        <table className="w-full text-xs min-w-[420px]">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="text-left text-[10px] font-black uppercase text-slate-400">
              <th className="px-3 py-2">Area</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Condition</th>
              <th className="px-3 py-2">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((row, idx) => (
              <tr key={`${row.area}-${row.item}`}>
                <td className="px-3 py-1.5 text-slate-500">{row.area}</td>
                <td className="px-3 py-1.5 font-semibold text-slate-700">{row.item}</td>
                <td className="px-3 py-1.5">
                  <select
                    value={row.condition}
                    onChange={(e) => setRows((prev) => prev.map((r, i) => i === idx ? { ...r, condition: e.target.value } : r))}
                    className="px-2 py-1 rounded-lg border border-slate-200"
                  >
                    {['Good', 'Fair', 'Damaged', 'Not Applicable'].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input
                    value={row.remarks}
                    onChange={(e) => setRows((prev) => prev.map((r, i) => i === idx ? { ...r, remarks: e.target.value } : r))}
                    className="w-full px-2 py-1 rounded-lg border border-slate-200"
                    placeholder="Pre-existing damage, notes…"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50">
        {saving ? 'Saving…' : 'Save inspection'}
      </button>
    </div>
  );
};
