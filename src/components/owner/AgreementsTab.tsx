import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useOwnerScope } from '../../utils/ownership';
import { Agreement } from '../../types';
import {
  FileText,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  ShieldCheck,
  Download,
  AlertTriangle,
  ClipboardList,
} from 'lucide-react';
import { DigitalAgreementModal } from '../features/DigitalAgreementModal';
import { MoveInInspectionModal } from '../features/MoveInInspectionModal';

export const AgreementsTab: React.FC = () => {
  const { agreements: allAgreements, signAgreement } = useApp();
  const { agreements, residents } = useOwnerScope();
  const sampleAgreement = agreements[0] || allAgreements[0];

  const [activeAgreementModal, setActiveAgreementModal] = useState<Agreement | null>(null);
  const [activeInspectionModal, setActiveInspectionModal] = useState<{ room: string; tenant: string } | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Digital Tenancy Contracts & Digital Signatures
          </h3>
          <p className="text-xs text-slate-500">
            Automated tenancy contracts, notice period clauses, house rules consent, and room handover checklists.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (sampleAgreement) setActiveAgreementModal(sampleAgreement);
            }}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            View Sample Contract
          </button>
        </div>
      </div>

      {/* Agreements List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-extrabold border-b border-slate-200">
            <tr>
              <th className="p-3.5">Tenant Name</th>
              <th className="p-3.5">Room & Bed</th>
              <th className="p-3.5">Term Dates</th>
              <th className="p-3.5">Monthly Rent</th>
              <th className="p-3.5">Deposit</th>
              <th className="p-3.5">Signing Status</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {agreements.map((ag) => (
              <tr key={ag.id} className="hover:bg-slate-50">
                <td className="p-3.5 font-bold text-slate-900">{ag.tenantName || ag.residentName}</td>
                <td className="p-3.5 text-slate-600">
                  Room {ag.roomNumber} ({ag.bedNumber})
                </td>
                <td className="p-3.5 text-slate-500">
                  {ag.startDate} to {ag.endDate}
                  <span className="block text-[10px] text-slate-400">
                    Notice: {ag.termsAndConditions?.noticePeriodDays || ag.noticePeriodDays} days
                  </span>
                </td>
                <td className="p-3.5 font-bold text-slate-800">₹{ag.monthlyRent.toLocaleString('en-IN')}</td>
                <td className="p-3.5 text-slate-600">₹{ag.securityDeposit.toLocaleString('en-IN')}</td>
                <td className="p-3.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                      ag.status === 'Active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : ag.status === 'Tenant Signed'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {ag.status}
                  </span>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    {ag.tenantSignatureDate ? '✓ Tenant' : '○ Pending'}{' '}
                    {ag.ownerSignatureDate ? '• ✓ Owner' : '• ○ Owner'}
                  </div>
                </td>
                <td className="p-3.5 text-right space-x-2">
                  <button
                    onClick={() => setActiveAgreementModal(ag)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors"
                  >
                    Review / Sign
                  </button>
                  <button
                    onClick={() =>
                      setActiveInspectionModal({ room: ag.roomNumber, tenant: ag.tenantName || ag.residentName })
                    }
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
                  >
                    Handover Audit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Dialogs */}
      {activeAgreementModal && (
        <DigitalAgreementModal
          agreement={activeAgreementModal}
          onClose={() => setActiveAgreementModal(null)}
        />
      )}

      {activeInspectionModal && (
        <MoveInInspectionModal
          roomNumber={activeInspectionModal.room}
          tenantName={activeInspectionModal.tenant}
          onClose={() => setActiveInspectionModal(null)}
        />
      )}
    </div>
  );
};
