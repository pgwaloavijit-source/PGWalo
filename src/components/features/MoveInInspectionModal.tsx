import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Camera,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface InspectionItem {
  id: string;
  name: string;
  category: 'Furniture' | 'Electrical' | 'Washroom' | 'Security';
  condition: 'Good' | 'Minor Wear' | 'Damaged';
  notes: string;
  verified: boolean;
}

const DEFAULT_INSPECTION_ITEMS: InspectionItem[] = [
  { id: 'insp-1', name: 'Bed Frame & Orthopedic Mattress', category: 'Furniture', condition: 'Good', notes: 'Clean mattress protector, zero stains', verified: true },
  { id: 'insp-2', name: 'Personal Wardrobe & Lock Keys', category: 'Furniture', condition: 'Good', notes: '2 wardrobe keys handed over', verified: true },
  { id: 'insp-3', name: 'Study Desk & Rolling Chair', category: 'Furniture', condition: 'Good', notes: 'Smooth desk surface, hydraulics work', verified: true },
  { id: 'insp-4', name: 'Air Conditioner / Ceiling Fan', category: 'Electrical', condition: 'Good', notes: 'Remote provided with fresh batteries, cooled to 22C', verified: true },
  { id: 'insp-5', name: 'Tube Lights & Bedside Reading Lamp', category: 'Electrical', condition: 'Good', notes: 'All functional, no flicker', verified: true },
  { id: 'insp-6', name: 'Attached Washroom Geyser & Taps', category: 'Washroom', condition: 'Good', notes: 'Geyser working, zero tap leakage', verified: true },
  { id: 'insp-7', name: 'Mirror & Sanitary Fixtures', category: 'Washroom', condition: 'Good', notes: 'Clean mirror, flush valve verified', verified: true },
  { id: 'insp-8', name: 'Room Keycard & Biometric Access', category: 'Security', condition: 'Good', notes: 'RFID card #B204 programmed & registered', verified: true },
];

interface MoveInInspectionModalProps {
  roomNumber: string;
  tenantName: string;
  onClose: () => void;
}

export const MoveInInspectionModal: React.FC<MoveInInspectionModalProps> = ({
  roomNumber,
  tenantName,
  onClose,
}) => {
  const { logAuditEvent } = useApp();
  const [items, setItems] = useState<InspectionItem[]>(DEFAULT_INSPECTION_ITEMS);
  const [wardenSigned, setWardenSigned] = useState(true);
  const [residentSigned, setResidentSigned] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleVerify = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, verified: !it.verified } : it))
    );
  };

  const handleConditionChange = (id: string, condition: 'Good' | 'Minor Wear' | 'Damaged') => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, condition } : it))
    );
  };

  const handleCompleteChecklist = () => {
    setResidentSigned(true);
    setSubmitted(true);
    logAuditEvent(
      'Move-In Inspection Completed',
      `Room ${roomNumber} - ${tenantName}`,
      'All 8 fixtures verified by resident and warden'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-6 animate-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <ClipboardCheck className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">Room Handover & Move-in Condition Audit</h3>
              <p className="text-xs text-blue-200">
                Room {roomNumber} • Tenant: {tenantName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              This digital condition checklist documents the condition of room fixtures upon move-in. Any pre-existing wear is recorded here so security deposits are protected upon move-out.
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {items.map((it) => (
              <div key={it.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{it.name}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {it.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{it.notes}</p>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={it.condition}
                    onChange={(e) =>
                      handleConditionChange(it.id, e.target.value as 'Good' | 'Minor Wear' | 'Damaged')
                    }
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border focus:outline-hidden ${
                      it.condition === 'Good'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : it.condition === 'Minor Wear'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    <option value="Good">Good Condition</option>
                    <option value="Minor Wear">Minor Wear</option>
                    <option value="Damaged">Damaged</option>
                  </select>

                  <button
                    onClick={() => toggleVerify(it.id)}
                    className={`p-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${
                      it.verified
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {it.verified ? 'Verified' : 'Verify'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Dual Sign-off Section */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Warden Inspection</span>
                <span className="font-bold text-slate-800">Sunil Kumar (Warden)</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Signed
              </span>
            </div>

            <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Resident Sign-off</span>
                <span className="font-bold text-slate-800">{tenantName}</span>
              </div>
              {residentSigned ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Signed
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  Pending
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100"
          >
            Close
          </button>
          {!residentSigned ? (
            <button
              onClick={handleCompleteChecklist}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Sign & Lock Move-in Condition
            </button>
          ) : (
            <span className="text-emerald-700 text-xs font-bold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Condition checklist saved in resident record
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
