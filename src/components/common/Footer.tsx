import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from './BrandLogo';
import { ShieldCheck, Lock, Mail, FileText, X } from 'lucide-react';
import { legalPolicies, legalStatus, type LegalPolicy } from '../../content/legalPolicies';

export const Footer: React.FC<{ onAreaClick?: (locality: string, city: string) => void }> = () => {
  const { openAuthModal } = useApp();
  const [legalModal, setLegalModal] = useState<LegalPolicy | null>(null);

  return (
    <footer className="bg-slate-900 text-slate-300 pt-4 pb-3 border-t border-slate-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-4 pb-4 border-b border-slate-800">
          <div className="space-y-2">
            <BrandLogo size="sm" subtitle="Your Home Away From Home" className="text-white" />
            <p className="text-[11px] text-slate-400 max-w-xl leading-snug">
              PGWALO is a technology platform for discovering and managing paying guest and co-living accommodation. Listing details, availability, safety conditions and resident-owner agreements remain the responsibility of the relevant property owner.
            </p>
            <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-blue-400" /><span>Listing checks shown clearly</span></div>
              <div className="flex items-center gap-1.5"><Lock className="w-4 h-4 text-emerald-400" /><span>Direct owner-resident terms</span></div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400"><Mail className="w-3.5 h-3.5 text-blue-400" /><span>Support: support@pgwalo.com</span></div>
          </div>
          <button onClick={() => openAuthModal('login', 'superadmin', { path: 'superadmin', source: 'footer', intent: 'dashboard' })} className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition text-center">
            Super Admin Login
          </button>
        </div>

        <div className="pt-3 flex flex-col md:flex-row items-center justify-between gap-2 text-[10px] text-slate-500">
          <p>© {new Date().getFullYear()} PGWALO. Operator and grievance details will be published before legal launch.</p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-[10px]">
            {legalPolicies.map((policy, index) => (
              <React.Fragment key={policy.id}>
                {index > 0 && <span className="text-slate-700">•</span>}
                <button onClick={() => setLegalModal(policy)} className="hover:text-slate-300 transition">{policy.title.replace(' Policy', '').replace('Terms of Use', 'Terms')}</button>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in" role="dialog" aria-modal="true" aria-label={legalModal.title}>
          <div className="relative flex max-h-[min(88vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5">
              <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-blue-400" /><div><h3 className="font-bold text-sm text-white">{legalModal.title}</h3><p className="mt-1 text-[10px] text-slate-400">{legalStatus.version} · Updated {legalStatus.lastUpdated}</p></div></div>
              <button aria-label="Close policy" onClick={() => setLegalModal(null)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-5 sm:p-6 space-y-5">
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100"><span className="font-bold">{legalStatus.label}:</span> {legalStatus.notice}</div>
              <p className="text-sm leading-relaxed text-slate-300">{legalModal.summary}</p>
              {legalModal.sections.map((section) => <section key={section.heading} className="space-y-1.5"><h4 className="text-sm font-bold text-white">{section.heading}</h4><p className="text-xs leading-relaxed text-slate-300">{section.body}</p></section>)}
            </div>
            <div className="border-t border-slate-800 p-4 flex justify-end"><button onClick={() => setLegalModal(null)} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition">Close</button></div>
          </div>
        </div>
      )}
    </footer>
  );
};
