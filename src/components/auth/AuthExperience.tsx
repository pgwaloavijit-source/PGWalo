import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { isProductionApiEnabled } from '../../services/productionApi';
import { loginWithWorkers, registerWithWorkers } from '../../services/auth';
import {
  trackAuthEvent,
  getLastAuthUser,
  saveLastAuthUser,
  AuthPath,
  AuthOpenMeta,
} from '../../services/authAnalytics';
import {
  X, ArrowLeft, Search, Home, Building2, ShieldCheck,
  CheckCircle2, AlertCircle, Sparkles, LogIn,
} from 'lucide-react';

type Step = 'path' | 'login' | 'signup' | 'pin';

const PATH_CONFIG: Record<AuthPath, {
  label: string;
  sub: string;
  icon: React.ElementType;
  role: UserRole;
  gradient: string;
  signupFields: ('name' | 'phone' | 'email' | 'invite')[];
}> = {
  explorer: {
    label: 'Find a PG',
    sub: 'Browse & book — no brokerage',
    icon: Search,
    role: 'public',
    gradient: 'from-sky-500 to-blue-600',
    signupFields: ['name', 'phone'],
  },
  resident: {
    label: 'Resident',
    sub: 'Pay rent, raise requests',
    icon: Home,
    role: 'resident',
    gradient: 'from-emerald-500 to-teal-600',
    signupFields: ['name', 'phone'],
  },
  owner: {
    label: 'PG Owner',
    sub: 'List & manage properties',
    icon: Building2,
    role: 'owner',
    gradient: 'from-violet-500 to-indigo-600',
    signupFields: ['name', 'phone', 'email'],
  },
  staff: {
    label: 'Staff',
    sub: 'Join with invite code',
    icon: ShieldCheck,
    role: 'staff',
    gradient: 'from-amber-500 to-orange-600',
    signupFields: ['invite', 'name', 'phone'],
  },
};

const INTENT_MSG: Record<string, string> = {
  book_pg: 'Sign in to confirm your booking',
  visit_pg: 'Sign in to schedule your visit',
  save_pg: 'Save this PG to your shortlist',
  owner_list: 'Create your owner account to list',
  staff_join: 'Enter your staff invite to join',
  alerts: 'Get alerts on new PGs near you',
  dashboard: 'Access your dashboard',
  general: 'Quick sign-in to continue',
};

function roleToPath(role?: UserRole): AuthPath {
  if (role === 'owner') return 'owner';
  if (role === 'staff' || role === 'warden') return 'staff';
  if (role === 'resident') return 'resident';
  return 'explorer';
}

const PinPad: React.FC<{ value: string; onChange: (v: string) => void; length?: number }> = ({
  value, onChange, length = 6,
}) => {
  const add = (d: string) => { if (value.length < length) onChange(value + d); };
  const del = () => onChange(value.slice(0, -1));

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2">
        {Array.from({ length }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-all ${
              i < value.length ? 'bg-blue-600 scale-110' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key) => (
          <button
            key={key || 'empty'}
            type="button"
            disabled={!key}
            onClick={() => key === '⌫' ? del() : key && add(key)}
            className={`h-14 rounded-2xl text-lg font-semibold transition active:scale-95 ${
              key ? 'bg-slate-100 hover:bg-slate-200 text-slate-800' : 'invisible'
            }`}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
};

export const AuthExperience: React.FC = () => {
  const {
    authModalOpen, setAuthModalOpen, authModalMode, setAuthModalMode,
    authInitialRole, authMeta, applyApiSession, login, register,
    setRoleState, runPendingAuthAction,
  } = useApp();

  const useCloud = isProductionApiEnabled();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const [step, setStep] = useState<Step>('path');
  const [path, setPath] = useState<AuthPath>('explorer');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [invite, setInvite] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const meta: AuthOpenMeta = {
    mode: authModalMode,
    path,
    intent: authMeta.intent,
    propertyId: authMeta.propertyId,
    source: authMeta.source,
    role: PATH_CONFIG[path].role,
  };

  const reset = useCallback(() => {
    setStep('path');
    setPin('');
    setError(null);
    setSuccess(false);
  }, []);

  useEffect(() => {
    if (!authModalOpen) return;
    const p = authMeta.path || roleToPath(authInitialRole);
    setPath(p);
    setStep(authModalMode === 'register' || authMeta.path ? (authModalMode === 'register' ? 'signup' : 'login') : 'path');
    trackAuthEvent('modal_opened', { ...meta, path: p, mode: authModalMode });
    const last = getLastAuthUser();
    if (last && authModalMode === 'login') {
      setPhone(last.email.includes('@') ? '' : last.email);
      setEmail(last.email.includes('@') ? last.email : '');
      setPath(last.path);
    }
  }, [authModalOpen, authModalMode, authInitialRole, authMeta.path]);

  const close = () => {
    trackAuthEvent('modal_dismissed', meta);
    setAuthModalOpen(false);
    reset();
  };

  const finishAuth = (user: { id: string; role: UserRole; name?: string; email?: string; phone?: string }) => {
    setSuccess(true);
    if (useCloud) {
      applyApiSession(user);
      saveLastAuthUser(user.phone || user.email || '', user.name || '', path);
    }
    setRoleState(user.role);
    setTimeout(() => {
      runPendingAuthAction();
      close();
    }, 600);
  };

  const submitLogin = async () => {
    if (pin.length < 6) { setError('Enter your 6-digit PIN'); return; }
    setLoading(true);
    setError(null);
    try {
      if (useCloud) {
        const id = phone.length >= 10 ? { phone } : email ? { email } : { phone };
        const res = await loginWithWorkers(id, pin, meta);
        if (!res.success || !res.user) { setError(res.error || 'Sign in failed'); return; }
        finishAuth(res.user);
      } else {
        const res = login(email || phone, pin, PATH_CONFIG[path].role);
        if (!res.success) { setError(res.message || 'Sign in failed'); return; }
        setAuthModalOpen(false);
        runPendingAuthAction();
      }
    } finally {
      setLoading(false);
    }
  };

  const submitSignup = async () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    if (phone.replace(/\D/g, '').length < 10) { setError('Enter valid 10-digit mobile'); return; }
    if (path === 'staff' && !invite.trim()) { setError('Enter staff invite code'); return; }
    if (path === 'owner' && !email.includes('@')) { setError('Enter business email'); return; }
    if (pin.length < 6) { setStep('pin'); return; }

    setLoading(true);
    setError(null);
    try {
      if (useCloud) {
        const res = await registerWithWorkers({
          name: name.trim(),
          phone,
          email: email || undefined,
          role: PATH_CONFIG[path].role,
          password: pin,
          inviteCode: invite || undefined,
        }, meta);
        if (!res.success || !res.user) { setError(res.error || 'Signup failed'); return; }
        finishAuth(res.user);
      } else {
        const res = register({
          name, email: email || `${phone}@pgwalo.app`, phone,
          role: PATH_CONFIG[path].role, password: pin,
        });
        if (!res.success) { setError(res.message || 'Signup failed'); return; }
        setAuthModalOpen(false);
        runPendingAuthAction();
      }
    } finally {
      setLoading(false);
    }
  };

  const guestContinue = () => {
    trackAuthEvent('guest_continue', meta);
    setRoleState('public');
    close();
  };

  if (!authModalOpen) return null;

  const cfg = PATH_CONFIG[path];
  const intentMsg = INTENT_MSG[authMeta.intent || 'general'] || INTENT_MSG.general;
  const shell = isMobile
    ? 'fixed inset-0 z-50 flex flex-col bg-white'
    : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm';

  return (
    <div className={shell} role="dialog" aria-modal="true">
      <div className={`relative flex flex-col bg-white overflow-hidden ${
        isMobile ? 'h-full w-full' : 'w-full max-w-md rounded-3xl shadow-2xl max-h-[90vh]'
      }`}>
        {/* Header */}
        <div className={`bg-gradient-to-r ${cfg.gradient} text-white px-5 pt-safe pb-5 shrink-0`}>
          <div className="flex items-center justify-between pt-4">
            {step !== 'path' ? (
              <button type="button" onClick={() => setStep(step === 'pin' ? 'signup' : 'path')} className="p-2 -ml-2 rounded-full hover:bg-white/10">
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : <div className="w-9" />}
            <button type="button" onClick={close} className="p-2 rounded-full hover:bg-white/10" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
          {authMeta.intent && authMeta.intent !== 'general' && (
            <p className="text-white/90 text-xs font-medium mt-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> {intentMsg}
            </p>
          )}
          <h2 className="text-xl font-bold mt-2">
            {step === 'path' ? 'Continue as…' : step === 'login' ? 'Welcome back' : step === 'pin' ? 'Set your PIN' : `Join as ${cfg.label}`}
          </h2>
          <p className="text-white/80 text-sm mt-0.5">
            {step === 'path' ? 'One tap — we’ll show only what you need' : cfg.sub}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs flex gap-2">
              <CheckCircle2 className="w-4 h-4" /> You&apos;re in!
            </div>
          )}

          {/* Step: Path picker */}
          {step === 'path' && (
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(PATH_CONFIG) as AuthPath[]).map((key) => {
                const c = PATH_CONFIG[key];
                const Icon = c.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setPath(key);
                      trackAuthEvent('path_selected', { ...meta, path: key });
                      setStep(authModalMode === 'register' ? 'signup' : 'login');
                    }}
                    className="p-4 rounded-2xl border-2 border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 text-left transition active:scale-[0.98] min-h-[100px]"
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center mb-2`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="font-bold text-slate-900 text-sm">{c.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{c.sub}</p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step: Login */}
          {step === 'login' && (
            <div className="space-y-4">
              {getLastAuthUser() && (
                <button
                  type="button"
                  onClick={() => {
                    const l = getLastAuthUser()!;
                    setEmail(l.email.includes('@') ? l.email : '');
                    setPath(l.path);
                  }}
                  className="w-full p-3 rounded-2xl bg-blue-50 border border-blue-100 text-left text-sm font-semibold text-blue-800"
                >
                  Welcome back, {getLastAuthUser()?.name} 👋
                </button>
              )}
              <div>
                <label className="text-xs font-bold text-slate-600">Mobile number</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="10-digit mobile"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="mt-1 w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-lg tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {path === 'owner' && (
                <div>
                  <label className="text-xs font-bold text-slate-600">Or email</label>
                  <input
                    type="email"
                    placeholder="owner@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-600 mb-2 block">6-digit PIN</label>
                <PinPad value={pin} onChange={setPin} />
              </div>
              <button
                type="button"
                disabled={loading || pin.length < 6}
                onClick={submitLogin}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" /> {loading ? 'Signing in…' : 'Sign in'}
              </button>
              <button type="button" onClick={() => { setAuthModalMode('register'); setStep('signup'); setPin(''); }} className="w-full text-sm text-blue-600 font-semibold">
                New here? Create account
              </button>
            </div>
          )}

          {/* Step: Signup fields */}
          {step === 'signup' && (
            <div className="space-y-3">
              {cfg.signupFields.includes('invite') && (
                <input placeholder="Staff invite code (e.g. STAFF-2026)" value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 uppercase tracking-widest font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              )}
              <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-base focus:ring-2 focus:ring-blue-500 outline-none" />
              <input type="tel" inputMode="numeric" placeholder="Mobile number" value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              {cfg.signupFields.includes('email') && (
                <input type="email" placeholder="Business email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
              )}
              <button type="button" onClick={() => setStep('pin')} className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold">
                Continue → Set PIN
              </button>
              <button type="button" onClick={() => { setAuthModalMode('login'); setStep('login'); }} className="w-full text-sm text-slate-500">
                Already have an account? Sign in
              </button>
            </div>
          )}

          {step === 'pin' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 text-center">Choose a 6-digit PIN — use it to sign in quickly</p>
              <PinPad value={pin} onChange={setPin} />
              <button type="button" disabled={loading || pin.length < 6} onClick={submitSignup}
                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold disabled:opacity-50">
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </div>
          )}
        </div>

        {/* Footer: guest + switch */}
        {step === 'path' && path === 'explorer' && (
          <div className="px-5 pb-safe pb-5 shrink-0 border-t border-slate-100 pt-3">
            <button type="button" onClick={guestContinue} className="w-full py-3 text-sm font-semibold text-slate-500 hover:text-slate-800">
              Continue as guest — no sign-up needed
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const AuthModal = AuthExperience;
