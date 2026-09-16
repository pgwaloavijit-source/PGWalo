import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from './BrandLogo';
import {
  MapPin,
  ShieldCheck,
  Building2,
  Lock,
  Phone,
  Mail,
  ChevronRight,
  HelpCircle,
  FileText,
  CheckCircle2,
  X,
  Play,
  Users,
  User,
  Star,
} from 'lucide-react';

export const Footer: React.FC<{
  onAreaClick?: (locality: string, city: string) => void;
}> = ({ onAreaClick }) => {
  const { openAuthModal, login, currentUser, setRoleState } = useApp();
  const [legalModal, setLegalModal] = useState<{ title: string; content: string } | null>(null);
  const [demoModal, setDemoModal] = useState(false);

  const openPolicy = (title: string, content: string) => {
    setLegalModal({ title, content });
  };

  const handleDemoLogin = (role: 'owner' | 'resident' | 'staff' | 'admin') => {
    // Demo login without password
    const demoCredentials = {
      owner: { email: 'demo-owner@pgwalo.com', password: 'demo123', role: 'owner' as const },
      resident: { email: 'demo-resident@pgwalo.com', password: 'demo123', role: 'resident' as const },
      staff: { email: 'demo-staff@pgwalo.com', password: 'demo123', role: 'staff' as const },
      admin: { email: 'demo-admin@pgwalo.com', password: 'demo123', role: 'admin' as const },
    };

    const creds = demoCredentials[role];
    login(creds.email, creds.password, creds.role, true); // true for isDemo
    setDemoModal(false);
  };

  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 pb-12 border-b border-slate-800">
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <BrandLogo size="md" subtitle="Your Home Away From Home" className="text-white" />
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              PGWALO is India’s trusted paying guest and co-living platform. Connecting tenants with verified, hygienic accommodations with zero brokerage, while empowering PG owners and campus staff with complete digital property management.
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-slate-400 pt-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>100% Verified Properties</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Zero Brokerage</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-1 text-xs text-slate-400">
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

          {/* Area Discovery - Bengaluru & Pune */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <span>Bengaluru & Pune</span>
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button
                  onClick={() => onAreaClick?.('HSR Layout', 'Bengaluru')}
                  className="hover:text-blue-400 transition flex items-center gap-1 text-left"
                >
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span>HSR Layout, Bengaluru</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onAreaClick?.('Koramangala', 'Bengaluru')}
                  className="hover:text-blue-400 transition flex items-center gap-1 text-left"
                >
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span>Koramangala, Bengaluru</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onAreaClick?.('Whitefield', 'Bengaluru')}
                  className="hover:text-blue-400 transition flex items-center gap-1 text-left"
                >
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span>Whitefield, Bengaluru</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onAreaClick?.('Hinjewadi', 'Pune')}
                  className="hover:text-blue-400 transition flex items-center gap-1 text-left"
                >
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span>Hinjewadi Phase 1, Pune</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onAreaClick?.('Viman Nagar', 'Pune')}
                  className="hover:text-blue-400 transition flex items-center gap-1 text-left"
                >
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span>Viman Nagar, Pune</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Area Discovery - Hyderabad & Delhi NCR */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <span>Hyderabad & NCR</span>
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button
                  onClick={() => onAreaClick?.('Gachibowli', 'Hyderabad')}
                  className="hover:text-blue-400 transition flex items-center gap-1 text-left"
                >
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span>Gachibowli, Hyderabad</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onAreaClick?.('Madhapur', 'Hyderabad')}
                  className="hover:text-blue-400 transition flex items-center gap-1 text-left"
                >
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span>Madhapur, Hyderabad</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onAreaClick?.('Cyber City', 'Delhi NCR')}
                  className="hover:text-blue-400 transition flex items-center gap-1 text-left"
                >
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span>Cyber City, Gurugram</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onAreaClick?.('Sector 62', 'Delhi NCR')}
                  className="hover:text-blue-400 transition flex items-center gap-1 text-left"
                >
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span>Sector 62, Noida</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Property Owners & Business Partnering */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span>For PG Owners</span>
            </h4>
            <div className="space-y-3 text-xs text-slate-400">
              <p className="text-[11px] leading-relaxed">
                Fill beds faster with verified tenants, automated UPI dues collection & meal management.
              </p>
              <button
                onClick={() => openAuthModal('register', 'owner', { intent: 'owner_list', path: 'owner', source: 'footer' })}
                className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-xs text-center"
              >
                List Your Property
              </button>
              <button
                onClick={() => openAuthModal('login')}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition text-center"
              >
                Owner Portal Sign In
              </button>
            </div>
          </div>

          {/* Demo Section */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3 flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 text-green-400" />
              <span>Try Demo</span>
            </h4>
            <div className="space-y-3 text-xs text-slate-400">
              <p className="text-[11px] leading-relaxed">
                Experience PGWALO without any password. Explore features with demo accounts.
              </p>
              <button
                onClick={() => setDemoModal(true)}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold text-xs transition shadow-xs text-center flex items-center justify-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                Launch Demo
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Production Legal & Copyright */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <p>© {new Date().getFullYear()} PGNest Technologies India Pvt. Ltd. All rights reserved.</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
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

      {/* Demo Login Modal */}
      {demoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-green-400" />
                <h3 className="font-bold text-sm text-white">Try PGWALO Demo</h3>
              </div>
              <button
                onClick={() => setDemoModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Experience PGWALO without any password. Choose a role to explore the platform features with demo data.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleDemoLogin('owner')}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold text-xs transition flex items-center justify-center gap-2"
              >
                <Building2 className="w-4 h-4" />
                <span>Owner Demo</span>
                <Star className="w-3 h-3 text-yellow-400" />
              </button>
              <button
                onClick={() => handleDemoLogin('resident')}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-semibold text-xs transition flex items-center justify-center gap-2"
              >
                <User className="w-4 h-4" />
                <span>Resident Demo</span>
                <Star className="w-3 h-3 text-yellow-400" />
              </button>
              <button
                onClick={() => handleDemoLogin('staff')}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold text-xs transition flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" />
                <span>Staff Demo</span>
                <Star className="w-3 h-3 text-yellow-400" />
              </button>
              <button
                onClick={() => handleDemoLogin('admin')}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold text-xs transition flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin Demo</span>
                <Star className="w-3 h-3 text-yellow-400" />
              </button>
            </div>
            <div className="pt-2 text-center">
              <p className="text-[10px] text-slate-500">Demo accounts use pre-configured data and don't require passwords</p>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
