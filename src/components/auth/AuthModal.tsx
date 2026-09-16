import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { isProductionApiEnabled } from '../../services/productionApi';
import { loginWithWorkers, registerWithWorkers } from '../../services/auth';
import {
  X,
  Mail,
  Lock,
  User,
  Phone,
  Building2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    setAuthModalOpen,
    authModalMode,
    setAuthModalMode,
    authInitialRole,
    login,
    register,
    applyApiSession,
  } = useApp();

  const useCloudAuth = isProductionApiEnabled();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Google / Gmail Sign-In State
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showGoogleAccountPicker, setShowGoogleAccountPicker] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');

  // Registration form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('resident');
  const [regStaffRole, setRegStaffRole] = useState<'Housekeeping' | 'Mess Cook' | 'Security Guard' | 'Manager'>('Manager');
  const [regRoom, setRegRoom] = useState('204');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginRole, setLoginRole] = useState<UserRole>('resident'); // Default to resident login

  React.useEffect(() => {
    if (authInitialRole) {
      setRegRole(authInitialRole);
      setLoginRole(authInitialRole);
    }
  }, [authInitialRole, authModalOpen]);

  if (!authModalOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!email) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      if (useCloudAuth) {
        const res = await loginWithWorkers(email, password, loginRole);
        if (!res.success || !res.user) {
          setErrorMessage(res.error || 'Invalid email or password.');
          return;
        }
        applyApiSession(res.user);
        setSuccessMessage('Logged in successfully!');
      } else {
        const res = login(email, password, loginRole);
        if (!res.success) {
          setErrorMessage(res.message || 'Invalid email or password.');
          return;
        }
        setSuccessMessage(res.message || 'Logged in successfully!');
      }
      setTimeout(() => setSuccessMessage(null), 1500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = (targetEmail?: string) => {
    const chosenEmail = (targetEmail || 'avijit02biswas@gmail.com').trim().toLowerCase();
    setIsGoogleLoading(true);
    setErrorMessage(null);

    setTimeout(() => {
      setIsGoogleLoading(false);
      const res = login(chosenEmail, 'google_oauth_session', 'resident');
      if (res.success) {
        setSuccessMessage(`Signed in successfully as ${chosenEmail}`);
        setTimeout(() => {
          setSuccessMessage(null);
        }, 1200);
      } else {
        setErrorMessage('Google authentication could not be completed. Please try again.');
      }
    }, 450);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!regName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!regPhone.trim()) {
      setErrorMessage('Please enter your phone number.');
      return;
    }
    if (!regPassword) {
      setErrorMessage('Please enter a password.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      if (useCloudAuth) {
        const res = await registerWithWorkers({
          name: regName,
          email: regEmail,
          phone: regPhone,
          role: regRole,
          password: regPassword,
        });
        if (!res.success || !res.user) {
          setErrorMessage(res.error || 'Failed to create account.');
          return;
        }
        applyApiSession(res.user);
        setSuccessMessage('Account created successfully! Welcome to PGWalo.');
      } else {
        const res = register({
          name: regName,
          email: regEmail,
          phone: regPhone,
          role: regRole,
          password: regPassword,
          roomNumber: regRole === 'resident' ? regRoom : undefined,
          staffRole: regRole === 'staff' ? regStaffRole : undefined,
        });
        if (!res.success) {
          setErrorMessage(res.message || 'Failed to create account.');
          return;
        }
        setSuccessMessage('Account created successfully! Welcome to PGWalo.');
      }
      setTimeout(() => setSuccessMessage(null), 1500);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Clean Header */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white p-6 relative">
          <button
            id="auth-modal-close-btn"
            onClick={() => setAuthModalOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition focus:outline-hidden"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white p-1 shadow-md flex items-center justify-center shrink-0">
              <img
                src="/logo.png"
                alt="PGWalo Logo"
                className="w-full h-full object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">
                {authModalMode === 'login' ? 'Welcome to PGWalo' : 'Create Your Account'}
              </h2>
              <p className="text-xs text-blue-100 mt-0.5 leading-relaxed">
                {authModalMode === 'login'
                  ? 'Sign in to access your PGWalo account and manage your stay'
                  : 'Create an account to book your stay and access resident services'}
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {/* Error / Success feedback */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ================= MODE: LOGIN ================= */}
          {authModalMode === 'login' && (
            <div className="space-y-4">
              {!useCloudAuth && (
              <div>
                <button
                  id="google-signin-btn"
                  type="button"
                  disabled={isGoogleLoading || isLoading}
                  onClick={() => handleGoogleSignIn()}
                  className="w-full py-3 px-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white text-slate-700 font-bold text-xs shadow-2xs transition flex items-center justify-center gap-3 active:scale-98 disabled:opacity-50 min-h-[44px]"
                >
                  {isGoogleLoading ? (
                    <span className="text-slate-500">Connecting with Google...</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-end text-[11px] text-slate-500 mt-1.5 px-1">
                  <button
                    type="button"
                    onClick={() => setShowGoogleAccountPicker(!showGoogleAccountPicker)}
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    {showGoogleAccountPicker ? 'Close' : 'Sign in with another Google account'}
                  </button>
                </div>

                {showGoogleAccountPicker && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2 animate-in fade-in">
                    <label className="block text-[11px] font-bold text-slate-600">Enter Your Gmail Address:</label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        placeholder="yourname@gmail.com"
                        value={customGoogleEmail}
                        onChange={(e) => setCustomGoogleEmail(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-hidden focus:border-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customGoogleEmail && customGoogleEmail.includes('@')) {
                            handleGoogleSignIn(customGoogleEmail);
                          } else {
                            setErrorMessage('Please enter a valid Gmail address.');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition"
                      >
                        Sign In
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )}

              {!useCloudAuth && (
              <div className="relative flex py-1 items-center">
                <div className="grow border-t border-slate-200"></div>
                <span className="shrink-0 mx-3 text-slate-400 text-[11px] font-semibold uppercase">
                  Or sign in with email
                </span>
                <div className="grow border-t border-slate-200"></div>
              </div>
              )}

              {/* Role Selection for Login */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  I am a...
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLoginRole('owner')}
                    className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                      loginRole === 'owner'
                        ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                    <span className="text-xs font-semibold">Property Owner</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginRole('resident')}
                    className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                      loginRole === 'resident'
                        ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <User className="w-5 h-5" />
                    <span className="text-xs font-semibold">Resident</span>
                  </button>
                </div>
              </div>

              {/* Email & Password Login Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-email-input"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. yourname@example.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (email && email.includes('@')) {
                          setSuccessMessage(`A password reset link has been dispatched to ${email}.`);
                          setErrorMessage(null);
                        } else {
                          setErrorMessage('Please enter your email address above to reset your password.');
                        }
                      }}
                      className="text-[11px] text-blue-600 hover:underline font-semibold"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-password-input"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded text-blue-600 focus:ring-blue-500" />
                    <span>Remember me on this device</span>
                  </label>
                </div>

                {/* Submit button */}
                <button
                  id="login-submit-btn"
                  type="submit"
                  disabled={isLoading || isGoogleLoading}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
                >
                  {isLoading ? (
                    <span>Signing in...</span>
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
              </form>

              {/* Switch to Create Account */}
              <div className="text-center pt-2">
                <p className="text-xs text-slate-500">
                  Don't have an account yet?{' '}
                  <button
                    id="switch-to-register-btn"
                    type="button"
                    onClick={() => {
                      setAuthModalMode('register');
                      setErrorMessage(null);
                    }}
                    className="text-blue-600 font-bold hover:underline"
                  >
                    Create Account
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ================= MODE: REGISTER ================= */}
          {authModalMode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {!useCloudAuth && (
              <div>
                <button
                  id="google-signup-btn"
                  type="button"
                  disabled={isGoogleLoading || isLoading}
                  onClick={() => handleGoogleSignIn()}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white text-slate-700 font-bold text-xs shadow-2xs transition flex items-center justify-center gap-3 active:scale-98 disabled:opacity-50 min-h-[44px]"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign up with Google</span>
                </button>
              </div>
              )}

              {!useCloudAuth && (
              <div className="relative flex py-1 items-center">
                <div className="grow border-t border-slate-200"></div>
                <span className="shrink-0 mx-3 text-slate-400 text-[11px] font-semibold uppercase">
                  Or register with details
                </span>
                <div className="grow border-t border-slate-200"></div>
              </div>
              )}

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Your Account Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    id="register-role-resident"
                    type="button"
                    onClick={() => setRegRole('resident')}
                    className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                      regRole === 'resident'
                        ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <User className="w-5 h-5 text-blue-600" />
                    <span className="text-xs font-bold leading-tight">Resident</span>
                    <span className="text-[10px] text-slate-500 leading-tight">Living in PG</span>
                  </button>

                  <button
                    id="register-role-owner"
                    type="button"
                    onClick={() => setRegRole('owner')}
                    className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                      regRole === 'owner'
                        ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <span className="text-xs font-bold leading-tight">PG Owner</span>
                    <span className="text-[10px] text-slate-500 leading-tight">Managing PG</span>
                  </button>

                  <button
                    id="register-role-staff"
                    type="button"
                    onClick={() => setRegRole('staff')}
                    className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                      regRole === 'staff'
                        ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                    <span className="text-xs font-bold leading-tight">Staff Member</span>
                    <span className="text-[10px] text-slate-500 leading-tight">Warden / Cook</span>
                  </button>
                </div>
              </div>

              {/* Staff specific role select */}
              {regRole === 'staff' && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 animate-in fade-in">
                  <label className="block text-xs font-bold text-slate-700">
                    Staff Designation / Department
                  </label>
                  <select
                    value={regStaffRole}
                    onChange={(e) => setRegStaffRole(e.target.value as any)}
                    className="w-full py-2 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium focus:outline-hidden focus:border-blue-600"
                  >
                    <option value="Manager">Manager / Campus Supervisor</option>
                    <option value="Mess Cook">Mess Chef & Kitchen Lead</option>
                    <option value="Housekeeping">Housekeeping & Sanitization</option>
                    <option value="Security Guard">Security Guard & Gatekeeper</option>
                  </select>
                </div>
              )}

              {/* Resident specific room */}
              {regRole === 'resident' && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 animate-in fade-in">
                  <label className="block text-xs font-bold text-slate-700">
                    Allocated Room Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={regRoom}
                    onChange={(e) => setRegRoom(e.target.value)}
                    placeholder="e.g. 204 or 301"
                    className="w-full py-2 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium focus:outline-hidden focus:border-blue-600"
                  />
                </div>
              )}

              {/* Personal Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="register-name-input"
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Rohit Verma"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="register-phone-input"
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="register-email-input"
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="e.g. rohit.v@example.com"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="register-password-input"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="register-confirm-password-input"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>

              <button
                id="register-submit-btn"
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2 min-h-[44px]"
              >
                {isLoading ? (
                  <span>Creating account...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Create Account</span>
                  </>
                )}
              </button>

              {/* Switch to Sign In */}
              <div className="text-center pt-2">
                <p className="text-xs text-slate-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    id="switch-to-login-btn"
                    onClick={() => {
                      setAuthModalMode('login');
                      setErrorMessage(null);
                    }}
                    className="text-blue-600 font-bold hover:underline"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
