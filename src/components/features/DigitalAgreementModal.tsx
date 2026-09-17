import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { RentAgreement } from '../../types';
import {
  X,
  FileCheck2,
  Download,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Building,
  UserCheck,
  PenTool,
  AlertCircle,
} from 'lucide-react';

interface DigitalAgreementModalProps {
  agreement: RentAgreement;
  onClose: () => void;
}

export const DigitalAgreementModal: React.FC<DigitalAgreementModalProps> = ({ agreement, onClose }) => {
  const { signAgreement, role, currentUser, logAuditEvent } = useApp();
  const tenantDisplayName = agreement.tenantName || agreement.residentName;
  const [signatureText, setSignatureText] = useState(
    role === 'owner' ? `${agreement.ownerName} (Authorized Owner)` : tenantDisplayName
  );
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasSignedSuccessfully, setHasSignedSuccessfully] = useState(false);

  const canSignAsOwner = role === 'owner' || role === 'admin' || role === 'manager';
  const canSignAsTenant = role === 'resident';

  const handleSign = (signAs: 'owner' | 'tenant') => {
    if (!agreedToTerms) return;
    signAgreement(agreement.id, signAs);
    setHasSignedSuccessfully(true);
    logAuditEvent(
      'Digital Tenancy Agreement Executed',
      `Agreement ${agreement.id}`,
      `Digitally signed by ${signatureText} as ${signAs}`
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-6 animate-in zoom-in-95 duration-200 print:border-none print:shadow-none print:rounded-none">
        {/* Modal Header (Hidden on Print) */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">Standard Residential Tenancy Agreement</h3>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    agreement.status === 'Active'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                  }`}
                >
                  {agreement.status}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Legally binding e-stamped agreement under Model Tenancy Act principles
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / PDF
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Agreement Document Body */}
        <div className="p-8 max-h-[70vh] overflow-y-auto font-serif text-slate-800 space-y-6 text-sm leading-relaxed border-b border-slate-200 print:max-h-none print:p-0">
          {/* Official Stamp Banner */}
          <div className="border-2 border-slate-900 p-4 text-center space-y-1 font-sans">
            <span className="text-[11px] font-bold tracking-widest uppercase text-slate-500 block">
              Indian Non-Judicial Stamp Paper Draft • {agreement.stampPaperState || 'India'} • Certificate Reference #{agreement.id.toUpperCase()}
            </span>
            <h1 className="text-xl font-black text-slate-900 uppercase">
              Residential Paying Guest Tenancy Contract
            </h1>
            <p className="text-xs text-slate-600">
              Valid From: <strong>{agreement.startDate}</strong> to <strong>{agreement.endDate}</strong> (Lock-in: {agreement.lockInPeriodMonths || 1} Month)
            </p>
          </div>

          {/* Parties Involved */}
          <div className="font-sans grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-slate-500 uppercase tracking-wider block">First Party (Lessor / Owner)</span>
              <p className="font-bold text-slate-900 text-sm">{agreement.ownerName}</p>
              <p className="text-slate-600">Authorized PG Operator / Landlord</p>
              <p className="text-slate-600">Representing: {agreement.propertyName}</p>
            </div>
            <div className="space-y-1">
              <span className="font-bold text-slate-500 uppercase tracking-wider block">Second Party (Lessee / Resident)</span>
              <p className="font-bold text-slate-900 text-sm">{tenantDisplayName}</p>
              <p className="text-slate-600">ID Proof: {agreement.tenantAadhaarMasked || agreement.tenantIdDocumentMasked}</p>
              <p className="text-slate-600">Assigned: Room {agreement.roomNumber} (Bed {agreement.bedId || agreement.bedNumber})</p>
            </div>
          </div>

          {/* Terms & Clauses */}
          <div className="space-y-4">
            <div>
              <h4 className="font-sans font-bold text-slate-900 text-base mb-1">
                Clause 1: Monthly Rent & Electricity Surcharge
              </h4>
              <p className="text-slate-700">
                The Tenant agrees to pay a monthly rent of <strong>₹{agreement.monthlyRent.toLocaleString('en-IN')}</strong> payable on or before the 5th day of every calendar month. Sub-metered electricity will be billed additionally at the actual meter reading tariff as per the state electricity regulatory board policy.
              </p>
            </div>

            <div>
              <h4 className="font-sans font-bold text-slate-900 text-base mb-1">
                Clause 2: Refundable Security Deposit & Move-out Settlement
              </h4>
              <p className="text-slate-700">
                The Tenant has remitted a security deposit of <strong>₹{agreement.securityDeposit.toLocaleString('en-IN')}</strong>. This deposit is fully refundable at the conclusion of tenancy, subject to:
                (a) complete payment of outstanding rent and power utility bills;
                (b) inspection of room fixtures and inventory with zero unapproved structural damage;
                (c) formal serving of a minimum <strong>{agreement.noticePeriodDays}-day notice period</strong>.
              </p>
            </div>

            <div>
              <h4 className="font-sans font-bold text-slate-900 text-base mb-1">
                Clause 3: House Conduct, Safety & Gate Curfew
              </h4>
              <p className="text-slate-700">
                The resident agrees to observe strict decorum within the property premises. Main gate entry closes at <strong>11:30 PM</strong> for biometric access. Hazardous substances, smoking in rooms, and unapproved overnight visitors are strictly prohibited.
              </p>
            </div>

            <div>
              <h4 className="font-sans font-bold text-slate-900 text-base mb-1">
                Clause 4: Key Legal Terms
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                {(agreement.terms || agreement.rulesSummary || []).map((term, idx) => (
                  <li key={idx}>{term}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Signatures Block */}
          <div className="font-sans grid grid-cols-2 gap-8 pt-6 border-t border-slate-300">
            <div className="border border-slate-300 p-4 rounded-xl bg-slate-50 text-center">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Owner / Authorized Signatory
              </span>
              {agreement.ownerSigned ? (
                <div className="flex flex-col items-center">
                  <span className="font-serif italic text-lg font-bold text-blue-900">{agreement.ownerName}</span>
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3 h-3" /> Digitally Verified
                  </span>
                  <span className="text-[9px] text-slate-400 mt-0.5">Signed: {agreement.signedDate || 'Active'}</span>
                </div>
              ) : (
                <div className="py-4 text-xs font-bold text-amber-600 flex items-center justify-center gap-1">
                  <AlertCircle className="w-4 h-4" /> Awaiting Owner Signature
                </div>
              )}
            </div>

            <div className="border border-slate-300 p-4 rounded-xl bg-slate-50 text-center">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Resident / Tenant Signatory
              </span>
              {agreement.tenantSigned ? (
                <div className="flex flex-col items-center">
                  <span className="font-serif italic text-lg font-bold text-blue-900">{tenantDisplayName}</span>
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3 h-3" /> Digitally Verified
                  </span>
                  <span className="text-[9px] text-slate-400 mt-0.5">Signed: {agreement.signedDate || 'Active'}</span>
                </div>
              ) : (
                <div className="py-4 text-xs font-bold text-amber-600 flex items-center justify-center gap-1">
                  <AlertCircle className="w-4 h-4" /> Awaiting Resident Signature
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Digital Signature Action Panel (Hidden on Print) */}
        <div className="bg-slate-50 p-6 font-sans border-t border-slate-200 print:hidden space-y-4">
          {(!agreement.ownerSigned && canSignAsOwner) || (!agreement.tenantSigned && canSignAsTenant) ? (
            <div className="space-y-3 bg-blue-50/60 p-4 rounded-xl border border-blue-200">
              <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                <PenTool className="w-4 h-4 text-blue-600" />
                Sign Tenancy Agreement as {canSignAsOwner ? 'Owner' : 'Tenant'}
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  value={signatureText}
                  onChange={(e) => setSignatureText(e.target.value)}
                  className="w-full sm:w-80 px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  placeholder="Type Full Legal Name"
                />
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  I agree to the terms, rent schedule, and house rules.
                </label>
                <button
                  disabled={!agreedToTerms || !signatureText.trim()}
                  onClick={() => handleSign(canSignAsOwner ? 'owner' : 'tenant')}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md shadow-blue-500/20 whitespace-nowrap transition-all"
                >
                  Confirm & Apply Digital Signature
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold">
                <ShieldCheck className="w-4 h-4" />
                Agreement has all required signatures and is legally archived.
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
              >
                Close Viewer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
