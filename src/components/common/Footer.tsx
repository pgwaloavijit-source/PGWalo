import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from './BrandLogo';
import {
  ShieldCheck,
  Lock,
  Phone,
  Mail,
  FileText,
  X,
} from 'lucide-react';

export const Footer: React.FC<{
  onAreaClick?: (locality: string, city: string) => void;
}> = ({ onAreaClick }) => {
  const { openAuthModal } = useApp();
  const [legalModal, setLegalModal] = useState<{ title: string; content: string } | null>(null);

  const openPolicy = (title: string, content: string) => {
    setLegalModal({ title, content });
  };

  return (
    <footer className="bg-slate-900 text-slate-300 pt-4 pb-3 border-t border-slate-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-4 pb-4 border-b border-slate-800">
          {/* Brand Col */}
          <div className="space-y-2">
            <BrandLogo size="sm" subtitle="Your Home Away From Home" className="text-white" />
            <p className="text-[11px] text-slate-400 max-w-xl leading-snug">
              PGWALO is India’s trusted paying guest and co-living platform. Connecting tenants with verified, hygienic accommodations with zero brokerage, while empowering PG owners and campus staff with complete digital property management.
            </p>
            <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>100% Verified Properties</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Zero Brokerage</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-blue-400" />
                <span>24/7 Helpline: +91 800-PGNEST (746378)</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                <span>Support: support@pgwalo.com</span>
              </div>
            </div>
          </div>

          {/* Primary actions */}
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => openAuthModal('login', 'superadmin', { path: 'superadmin', source: 'footer', intent: 'dashboard' })}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition text-center"
              >
                Super Admin Login
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Production Legal & Copyright */}
        <div className="pt-3 flex flex-col md:flex-row items-center justify-between gap-2 text-[10px] text-slate-500">
          <div>
            <p>© {new Date().getFullYear()} PGNest Technologies India Pvt. Ltd. All rights reserved.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[10px]">
            <button
              onClick={() =>
                openPolicy(
                  'Privacy Policy',
                  'PGNest respects your privacy. All tenant documents (Aadhaar/ID cards) are encrypted at rest with AES-256 bit encryption and are only utilized for mandatory police verification compliance. We never share your personal contact details with third-party telemarketers.'
                )
              }
              className="hover:text-slate-300 transition"
            >
              Privacy Policy
            </button>
            <span className="text-slate-700">•</span>
            <button
              onClick={() =>
                openPolicy(
                  'Terms of Service',
                  'PGNest provides a verified technology platform connecting co-living residents with licensed PG accommodation providers. All bookings adhere to standardized zero-brokerage rules and transparent security deposit settlement guidelines.'
                )
              }
              className="hover:text-slate-300 transition"
            >
              Terms of Service
            </button>
            <span className="text-slate-700">•</span>
            <button
              onClick={() =>
                openPolicy(
                  'Security & House Guidelines',
                  'All PGNest partner properties enforce 24/7 CCTV surveillance, biometric/digital gate access, and transparent curfew timings. Regular fire safety audits and kitchen hygiene inspections are conducted every 30 days.'
                )
              }
              className="hover:text-slate-300 transition"
            >
              House Guidelines
            </button>
            <span className="text-slate-700">•</span>
            <button
              onClick={() =>
                openPolicy(
                  'Refund & Settlement Policy',
                  'Security deposits are safeguarded under PGNest standard agreement terms. Upon serving notice as per room agreement terms, unadjusted deposit balances are settled directly to the resident verified bank account within 7 banking days.'
                )
              }
              className="hover:text-slate-300 transition"
            >
              Refund Policy
            </button>
          </div>
        </div>
      </div>

      {/* Production Policy Information Modal */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm text-white">{legalModal.title}</h3>
              </div>
              <button
                onClick={() => setLegalModal(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{legalModal.content}</p>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

    </footer>
  );
};
