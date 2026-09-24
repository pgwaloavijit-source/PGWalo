import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { isProductionApiEnabled } from '../../services/productionApi';
import { completePinReset, loginWithWorkers, registerWithWorkers, requestPinReset, sendAuthOtp, verifyAuthOtp } from '../../services/auth';
import { isPlatformAdmin } from '../../utils/platformAdmin';
import {
  trackAuthEvent,
  getLastAuthUser,
  saveLastAuthUser,
  clearLastAuthUser,
  AuthPath,
  AuthOpenMeta,
} from '../../services/authAnalytics';
import {
  X, ArrowLeft, Home, Building2, ShieldCheck,
  CheckCircle2, AlertCircle, Sparkles, LogIn, KeyRound,
} from 'lucide-react';

/**
 * Sign-in and sign-up.
 *
 * Two account types exist, and only two: an **Owner** (lists and runs PGs) and
 * a **Tenant** (the product word for `resident`). There is no "public" account —
 * an anonymous visitor browses without one — and no role picker on sign-in,
 * because the account already knows what it is: the user types their mobile
 * *or* their email plus their PIN and the server answers with the role.
 */

type Step = 'choose' | 'login' | 'signup' | 'otp' | 'pin' | 'forgot' | 'reset';
type AccountKind = 'owner' | 'tenant';

const ACCOUNT_KINDS: Record<AccountKind, {
  label: string;
  sub: string;
  icon: React.ElementType;
  role: UserRole;
  gradient: string;
}> = {
  owner: {
    label: 'As a PG Owner',
    sub: 'List your PG, manage beds, rent and tenants',
    icon: Building2,
    role: 'owner',
    gradient: 'from-blue-600 to-indigo-700',
  },
  tenant: {
    label: 'As a Tenant',
    sub: 'Find a PG, book a visit, pay rent online',
    icon: Home,
    role: 'resident',
    gradient: 'from-emerald-500 to-teal-700',
  },
};

const INTENT_MSG: Record<string, string> = {
  book_pg: 'Sign in to confirm your booking',
  visit_pg: 'Sign in to schedule your visit',
  save_pg: 'Save this PG to your shortlist',
  owner_list: 'Create your owner account to list your PG',
  staff_join: 'Use the mobile and PIN your owner shared',
  alerts: 'Get alerts on new PGs near you',
  dashboard: 'Access your dashboard',
  general: 'Quick sign-in to continue',
};

const identifierToField = (identifier: string) =>
  identifier.includes('@') ? { email: identifier.trim() } : { phone: identifier.trim() };

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const isMobile = (value: string) => /^[6-9]\d{9}$/.test(value.replace(/\D/g, ''));

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

const PinPad: React.FC<{
  value: string;
  /** Functional updates: a fast double-tap must not drop a digit. */
  onChange: React.Dispatch<React.SetStateAction<string>>;
  length?: number;
}> = ({ value, onChange, length = 6 }) => {
  const add = (d: string) => onChange((prev) => (prev.length < length ? prev + d : prev));
  const del = () => onChange((prev) => prev.slice(0, -1));

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

const PinField: React.FC<{
  value: string;
  onChange: (v: string) => void;
  label: string;
  autoFocus?: boolean;
}> = ({ value, onChange, label, autoFocus }) => (
  <div>
    <label className="text-xs font-bold text-slate-600">{label}</label>
    <div className="relative mt-1">
      <KeyRound className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
      <input
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        autoFocus={autoFocus}
        placeholder="6-digit PIN"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="w-full pl-9 pr-3 py-3.5 rounded-2xl border border-slate-200 text-lg tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  </div>
);

// ---------------------------------------------------------------------------

export const AuthExperience: React.FC = () => {
  const {
    authModalOpen, setAuthModalOpen, authModalMode, setAuthModalMode,
    authInitialRole, authMeta, applyApiSession, login, register,
    setRoleState, runPendingAuthAction, openRoleDashboard, pendingAction,
  } = useApp();

  const useCloud = isProductionApiEnabled();
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;

  const [step, setStep] = useState<Step>('choose');
  const [kind, setKind] = useState<AccountKind>('tenant');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [otpId, setOtpId] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [otpHint, setOtpHint] = useState('');
  const [passwordText, setPasswordText] = useState('');
  const [adminMode, setAdminMode] = useState<'pin' | 'password'>('password');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const isAdminPath = authMeta.path === 'superadmin';

  const meta: AuthOpenMeta = {
    mode: authModalMode,
    path: authMeta.path,
    intent: authMeta.intent,
    propertyId: authMeta.propertyId,
    source: authMeta.source,
    role: isAdminPath ? 'superadmin' : ACCOUNT_KINDS[kind].role,
  };

  const reset = useCallback(() => {
    setStep('choose');
    setPin('');
    setResetCode('');
    setNewPin('');
    setConfirmNewPin('');
    setPasswordText('');
    setOtpId('');
    setVerificationId('');
    setOtpHint('');
    setError(null);
    setSuccess(false);
  }, []);

  useEffect(() => {
    if (!authModalOpen) return;

    // The Super Admin console is a platform surface, not a customer account.
    if (authMeta.path === 'superadmin') {
      setStep('login');
      trackAuthEvent('modal_opened', { ...meta, path: 'superadmin', mode: authModalMode });
      return;
    }

    // An explicit owner/tenant entry point (e.g. "List your PG", or booking
    // from a PG page) skips the chooser; a plain "Join us" always shows the two
    // account types. Deliberately keyed on the entry point and not on the last
    // role used on this device, which used to skip the chooser by accident.
    const impliedKind: AccountKind | null =
      authMeta.path === 'owner' ? 'owner' : authMeta.path ? 'tenant' : null;

    if (authModalMode === 'register') {
      if (impliedKind) {
        setKind(impliedKind);
        setStep('signup');
      } else {
        setStep('choose');
      }
    } else {
      if (impliedKind) setKind(impliedKind);
      setStep('login');
      const last = getLastAuthUser();
      if (last && !identifier) setIdentifier(last.email || '');
    }
    trackAuthEvent('modal_opened', { ...meta, mode: authModalMode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authModalOpen, authModalMode, authInitialRole, authMeta.path]);

  const close = () => {
    trackAuthEvent('modal_dismissed', meta);
    setAuthModalOpen(false);
    reset();
  };

  const finishAuth = (user: {
    id: string; role: UserRole; name?: string; email?: string; phone?: string;
    isProfileCompleted?: boolean; staffRole?: string; organizationId?: string;
  }, path: AuthPath) => {
    setSuccess(true);
    if (useCloud) {
      applyApiSession(user);
      saveLastAuthUser(user.phone || user.email || '', user.name || '', path);
    }
    setRoleState(user.role);
    // Land on the account's own dashboard. A pending booking or visit keeps the
    // user where they were so they can see that confirmation instead.
    if (!pendingAction) openRoleDashboard(user.role);
  };

  const requestOtp = async () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    if (!isMobile(phone)) { setError('Enter a valid 10-digit mobile number'); return; }
    if (!isEmail(email)) { setError('Enter a valid email so we can send your verification code'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await sendAuthOtp(email, phone, 'signup');
      if (!res.success) { setError(res.error || 'Could not send the code'); return; }
      setOtpId(res.otpId);
      setOtpHint(res.fallbackCode ? `Code: ${res.fallbackCode}` : res.message || '');
      setStep('otp');
    } finally {
      setLoading(false);
    }
  };

  const confirmOtp = async () => {
    if (pin.length < 6) { setError('Enter the 6-digit code we sent you'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await verifyAuthOtp(otpId, pin);
      if (!res.success) { setError(res.error || 'Incorrect code'); return; }
      setVerificationId(res.verificationId);
      setPin('');
      setStep('pin');
    } finally {
      setLoading(false);
    }
  };

  const startForgotPin = () => {
    setError(null);
    setSuccess(false);
    setResetCode('');
    setNewPin('');
    setConfirmNewPin('');
    setStep('forgot');
  };

  const submitPinResetRequest = async () => {
    const value = identifier.trim();
    if (!isEmail(value) && !isMobile(value)) {
      setError('Enter the email or 10-digit mobile number on your account');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await requestPinReset(value);
      if (!res.success) { setError(res.error || 'Could not start PIN recovery'); return; }
      setOtpId(res.otpId || '');
      setOtpHint(res.message || 'Check the email linked to your account for a reset code.');
      setStep('reset');
    } finally {
      setLoading(false);
    }
  };

  const submitPinReset = async () => {
    if (!otpId) { setError('Request a new reset code'); return; }
    if (resetCode.length < 6) { setError('Enter the 6-digit reset code'); return; }
    if (newPin.length !== 6) { setError('Choose a 6-digit PIN'); return; }
    if (newPin !== confirmNewPin) { setError('The PINs do not match'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await completePinReset(otpId, resetCode, newPin);
      if (!res.success) { setError(res.error || 'Could not reset your PIN'); return; }
      setPin('');
      setSuccess(false);
      setError(null);
      setStep('login');
      setOtpHint('PIN reset complete. Sign in with your new PIN.');
    } finally {
      setLoading(false);
    }
  };

  const submitSignup = async () => {
    if (pin.length < 6) { setError('Choose a 6-digit PIN'); return; }
    if (!verificationId) { setError('Verify the email code first'); return; }
    setLoading(true);
    setError(null);
    const role = ACCOUNT_KINDS[kind].role;
    try {
      if (useCloud) {
        const res = await registerWithWorkers(
          { name: name.trim(), phone, email: email.trim(), role, password: pin, verificationId },
          meta
        );
        if (!res.success || !res.user) { setError(res.error || 'Could not create your account'); return; }
        finishAuth(res.user, kind);
        return;
      }
      const res = register({ name, email, phone, role, password: pin });
      if (!res.success) { setError(res.message || 'Could not create your account'); return; }
      setAuthModalOpen(false);
      openRoleDashboard(role);
      runPendingAuthAction();
    } finally {
      setLoading(false);
    }
  };

  const submitLogin = async () => {
    const credential = isAdminPath ? (passwordText || pin) : pin;
    if (isAdminPath && !passwordText && pin.length < 6) { setError('Enter the Super Admin password or PIN'); return; }
    if (!isAdminPath && pin.length < 6) { setError('Enter your 6-digit PIN'); return; }
    if (isAdminPath && !passwordText && !identifier.trim()) { setError('Enter the Super Admin phone'); return; }
    setLoading(true);
    setError(null);
    try {
      if (isAdminPath) {
        const id = identifier.includes('@')
          ? { email: identifier, phone: identifier }
          : { phone: identifier, email: identifier };
        const apiRes = await loginWithWorkers(id, credential, meta);
        if (!apiRes.success || !apiRes.user) { setError(apiRes.error || 'Sign in failed'); return; }
        if (!isPlatformAdmin(apiRes.user.role)) { setError('This account is not a Super Admin.'); return; }
        finishAuth(apiRes.user, 'superadmin');
        return;
      }

      const value = identifier.trim();
      if (!value) { setError('Enter your mobile number or email'); return; }
      if (!isEmail(value) && !isMobile(value)) {
        setError('Enter the 10-digit mobile number or the email on your account');
        return;
      }

      if (useCloud) {
        const apiRes = await loginWithWorkers(identifierToField(value), pin, meta);
        if (!apiRes.success || !apiRes.user) {
          setError(
            apiRes.error === 'Invalid credentials'
              ? 'Wrong PIN, or no account matches that mobile / email.'
              : apiRes.error || 'Sign in failed'
          );
          return;
        }
        finishAuth(apiRes.user, apiRes.user.role === 'owner' ? 'owner' : 'resident');
        return;
      }

      // Demo mode (no API configured) understands email accounts only.
      const res = login(value, pin, undefined);
      if (!res.success) { setError(res.message || 'Sign in failed'); return; }
      setAuthModalOpen(false);
      if (!pendingAction) openRoleDashboard(res.user?.role);
      runPendingAuthAction();
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

  const intentMsg = INTENT_MSG[authMeta.intent || 'general'] || INTENT_MSG.general;
  const cfg = ACCOUNT_KINDS[kind];
  const heading =
    step === 'choose' ? 'Join PGWalo'
      : step === 'login' ? (isAdminPath ? 'Super Admin sign in' : 'Welcome back')
        : step === 'otp' ? 'Verify your email'
          : step === 'pin' ? 'Set your login PIN'
            : step === 'forgot' ? 'Recover your PIN'
              : step === 'reset' ? 'Create a new PIN'
            : `Join as ${kind === 'owner' ? 'an Owner' : 'a Tenant'}`;

  const shell = isMobileViewport
    ? 'fixed inset-0 z-50 flex flex-col bg-white'
    : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm';

  return (
    <div className={shell} role="dialog" aria-modal="true">
      <div className={`relative flex flex-col bg-white overflow-hidden ${
        isMobileViewport ? 'h-full w-full' : 'w-full max-w-md rounded-3xl shadow-2xl max-h-[90vh]'
      }`}>
        {/* Header */}
        <div className={`bg-gradient-to-r ${isAdminPath ? 'from-slate-700 to-slate-950' : cfg.gradient} text-white px-5 pt-safe pb-5 shrink-0`}>
          <div className="flex items-center justify-between pt-4">
            {step !== 'choose' && !isAdminPath ? (
              <button
                type="button"
                onClick={() => setStep(
                  step === 'reset' ? 'forgot' : step === 'forgot' ? 'login' : step === 'pin' ? 'otp' : step === 'otp' ? 'signup' : 'choose'
                )}
                className="p-2 -ml-2 rounded-full hover:bg-white/10"
                aria-label="Back"
              >
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
          <h2 className="text-xl font-bold mt-2">{heading}</h2>
          <p className="text-white/80 text-sm mt-0.5">
            {step === 'choose'
              ? 'Two accounts only — owners and tenants.'
              : isAdminPath
                ? 'Platform administrator access'
                : step === 'signup'
                  ? cfg.sub
                  : step === 'login'
                    ? 'Mobile or email · 6-digit PIN'
                    : step === 'otp'
                      ? `Code sent to ${email}`
                      : step === 'forgot'
                        ? 'We will email a one-time recovery code'
                        : step === 'reset'
                          ? 'Use the code from your email to choose a new PIN'
                      : 'Use it to sign in quickly next time'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> <span>{error}</span>
            </div>
          )}
          {step === 'login' && otpHint && !error && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs flex gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> <span>{otpHint}</span>
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs flex gap-2">
              <CheckCircle2 className="w-4 h-4" /> You&apos;re in!
            </div>
          )}

          {/* ---- 1. Who is joining: Owner or Tenant, nothing else ---- */}
          {step === 'choose' && (
            <div className="space-y-3">
              {(Object.keys(ACCOUNT_KINDS) as AccountKind[]).map((id) => {
                const option = ACCOUNT_KINDS[id];
                const Icon = option.icon;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setKind(id);
                      setError(null);
                      trackAuthEvent('path_selected', { ...meta, path: id === 'owner' ? 'owner' : 'resident' });
                      setStep('signup');
                    }}
                    className="w-full p-4 rounded-2xl border-2 border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 text-left transition active:scale-[0.99] flex items-start gap-3"
                  >
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${option.gradient} flex items-center justify-center shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm">{option.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{option.sub}</p>
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => { setStep('login'); setError(null); }}
                className="w-full pt-2 text-sm font-bold text-blue-600"
              >
                Already have an account? Sign in
              </button>
            </div>
          )}

          {/* ---- 2. Sign in ---- */}
          {step === 'login' && (
            <div className="space-y-4">
              {isAdminPath ? (
                <>
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100">
                    <button type="button" onClick={() => setAdminMode('password')} className={`py-2 rounded-xl text-xs font-bold ${adminMode === 'password' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Username</button>
                    <button type="button" onClick={() => setAdminMode('pin')} className={`py-2 rounded-xl text-xs font-bold ${adminMode === 'pin' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Phone + PIN</button>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">
                      {adminMode === 'password' ? 'Username' : 'Phone'}
                    </label>
                    <input
                      type="text"
                      autoComplete="username"
                      placeholder={adminMode === 'password' ? 'Super Admin username' : 'Registered admin phone'}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="mt-1 w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {adminMode === 'password' ? (
                    <div>
                      <label className="text-xs font-bold text-slate-600">Password</label>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={passwordText}
                        onChange={(e) => setPasswordText(e.target.value)}
                        className="mt-1 w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <PinField label="6-digit PIN" value={pin} onChange={setPin} />
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Mobile number or email</label>
                    <input
                      type="text"
                      autoComplete="username"
                      inputMode="email"
                      placeholder="98765 43210 or you@email.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="mt-1 w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <PinField label="6-digit PIN" value={pin} onChange={setPin} />
                  <p className="text-[11px] text-slate-500">
                    Staff and wardens sign in here too, with the mobile and PIN your owner shared.
                  </p>
                </>
              )}

              <button
                type="button"
                disabled={loading || (!isAdminPath && pin.length < 6) || (isAdminPath && adminMode === 'password' ? !passwordText : pin.length < 6)}
                onClick={submitLogin}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" /> {loading ? 'Signing in…' : 'Sign in'}
              </button>

              {!isAdminPath && (
                <button type="button" onClick={startForgotPin} className="w-full text-sm font-bold text-blue-600 hover:text-blue-700">
                  Forgot PIN?
                </button>
              )}

              {!isAdminPath && (
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setAuthModalMode('register'); setStep('choose'); setPin(''); setError(null); }}
                    className="w-full text-sm text-blue-600 font-semibold"
                  >
                    New here? Join as an Owner or a Tenant
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearLastAuthUser();
                      setIdentifier('');
                      setPin('');
                    }}
                    className="w-full text-[11px] text-slate-400 hover:text-slate-600"
                  >
                    Not you? Clear this device
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ---- PIN recovery ---- */}
          {step === 'forgot' && !isAdminPath && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-sm font-semibold text-blue-900">Recover access securely</p>
                <p className="text-xs text-blue-700 mt-1 leading-relaxed">Enter the mobile number or email linked to your account. We&apos;ll send a one-time code to the account email.</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">Mobile number or email</label>
                <input
                  type="text"
                  autoComplete="username"
                  inputMode="email"
                  placeholder="98765 43210 or you@email.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="mt-1 w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button type="button" disabled={loading} onClick={submitPinResetRequest} className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50">
                {loading ? 'Sending code…' : 'Send recovery code'}
              </button>
              <button type="button" onClick={() => { setStep('login'); setError(null); }} className="w-full text-sm text-slate-500">
                Back to sign in
              </button>
            </div>
          )}

          {step === 'reset' && !isAdminPath && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 text-center">Enter the code sent to the email linked to your account.</p>
              {otpHint && <p className="text-xs text-center text-blue-700 bg-blue-50 rounded-xl p-2">{otpHint}</p>}
              <div>
                <label className="text-xs font-bold text-slate-600">Recovery code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="mt-1 w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-lg tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••"
                />
              </div>
              <PinField label="New 6-digit PIN" value={newPin} onChange={setNewPin} autoFocus />
              <PinField label="Confirm new PIN" value={confirmNewPin} onChange={setConfirmNewPin} />
              <button type="button" disabled={loading} onClick={submitPinReset} className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50">
                {loading ? 'Resetting PIN…' : 'Reset PIN'}
              </button>
            </div>
          )}

          {/* ---- 3. Signup details ---- */}
          {step === 'signup' && !isAdminPath && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                {React.createElement(cfg.icon, { className: 'w-4 h-4 text-blue-600' })}
                <span className="text-xs font-bold text-slate-700">{cfg.label}</span>
                <button
                  type="button"
                  onClick={() => setStep('choose')}
                  className="ml-auto text-[11px] font-bold text-blue-600"
                >
                  Change
                </button>
              </div>
              <input
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-base focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="tel"
                inputMode="numeric"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="email"
                placeholder="Email (we send a verification code here)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                type="button"
                onClick={requestOtp}
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold disabled:opacity-60"
              >
                {loading ? 'Sending code…' : 'Send verification code'}
              </button>
              <button
                type="button"
                onClick={() => { setAuthModalMode('login'); setStep('login'); setError(null); }}
                className="w-full text-sm text-slate-500"
              >
                Already have an account? Sign in
              </button>
            </div>
          )}

          {/* ---- 4. Email OTP ---- */}
          {step === 'otp' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 text-center">Enter the 6-digit code sent to {email}</p>
              {otpHint && <p className="text-xs text-center text-blue-700 bg-blue-50 rounded-xl p-2">{otpHint}</p>}
              <PinPad value={pin} onChange={setPin} />
              <button
                type="button"
                disabled={loading || pin.length < 6}
                onClick={confirmOtp}
                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold disabled:opacity-50"
              >
                {loading ? 'Checking…' : 'Verify code'}
              </button>
            </div>
          )}

          {/* ---- 5. Choose the PIN ---- */}
          {step === 'pin' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 text-center">
                Choose a 6-digit PIN — you will use it to sign in, so keep it memorable.
              </p>
              <PinField label="New 6-digit PIN" value={pin} onChange={setPin} autoFocus />
              <button
                type="button"
                disabled={loading || pin.length < 6}
                onClick={submitSignup}
                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold disabled:opacity-50"
              >
                {loading ? 'Creating account…' : `Create ${kind === 'owner' ? 'owner' : 'tenant'} account`}
              </button>
            </div>
          )}
        </div>

        {/* Footer: browsing needs no account */}
        {step === 'choose' && (
          <div className="px-5 pb-safe pb-5 shrink-0 border-t border-slate-100 pt-3">
            <button type="button" onClick={guestContinue} className="w-full py-3 text-sm font-semibold text-slate-500 hover:text-slate-800">
              Continue as a guest — browse without an account
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const AuthModal = AuthExperience;
