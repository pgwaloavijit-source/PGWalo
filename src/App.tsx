import React, { Suspense, lazy, useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { LandingPage } from './components/public/LandingPage';
import { SearchPage } from './components/public/SearchPage';
import { PGDetailModal } from './components/public/PGDetailModal';
import { AuthExperience } from './components/auth/AuthExperience';
import { ProfileCompletionModal } from './components/auth/ProfileCompletionModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PWAMobileShell } from './components/common/PWAMobileShell';

// Role dashboards are only reachable after sign-in, so they are split out of
// the public first-paint bundle. Each loads on demand behind the branded loader.
const AccountDetailsPage = lazy(() => import('./components/auth/AccountDetailsPage').then((m) => ({ default: m.AccountDetailsPage })));
const OwnerDashboard = lazy(() => import('./components/owner/OwnerDashboard').then((m) => ({ default: m.OwnerDashboard })));
const ResidentDashboard = lazy(() => import('./components/resident/ResidentDashboard').then((m) => ({ default: m.ResidentDashboard })));
const StaffDashboard = lazy(() => import('./components/staff/StaffDashboard').then((m) => ({ default: m.StaffDashboard })));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const WardenDashboard = lazy(() => import('./components/warden/WardenDashboard').then((m) => ({ default: m.WardenDashboard })));
const AccountantDashboard = lazy(() => import('./components/accountant/AccountantDashboard').then((m) => ({ default: m.AccountantDashboard })));
const SupportCenter = lazy(() => import('./components/common/SupportCenter').then((m) => ({ default: m.SupportCenter })));
import { PGWaloLoader } from './components/common/PGWaloLoader';
import { PublicSearchCriteria } from './types';
import { useStandalonePWA } from './hooks/useStandalonePWA';
import { isPlatformAdmin } from './utils/platformAdmin';
import { dashboardTabForRole, restoredSessionRole } from './utils/roles';
import { getAuthToken, isProductionApiEnabled } from './services/productionApi';
import { requestReactivation } from './services/supportTickets';
import { GuardianPortal } from './components/GuardianPortal';
import { Lock, Send } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const {
    role,
    setRole,
    currentUser,
    properties,
    profileModalOpen,
    selectedPGForDetail,
    setSelectedPGForDetail,
    propertyModalIntent,
    shellIntent,
    clearShellIntent,
    broadcasts,
    productionHydrated,
    accountBlocked,
    logout,
  } = useApp();
  const isStandalone = useStandalonePWA();

  // Guardian portal (spec §29): a token link renders its own standalone,
  // auth-free page before any session/dashboard logic applies.
  const guardianToken = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('guardian') ||
      window.location.pathname.match(/^\/guardian\/([^/]+)\/?$/)?.[1]
    : null;

  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (typeof window !== 'undefined' && (window.location.hash === '#admin' || window.location.pathname === '/admin')) {
      return 'admin';
    }
    // A restored session boots into its own dashboard: a signed-in owner must
    // never land on the public page and wonder whether the login worked.
    return dashboardTabForRole(restoredSessionRole());
  });
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [searchParams, setSearchParams] = useState<PublicSearchCriteria>({});
  // Only a signed-in session has a snapshot worth waiting for; anonymous
  // visitors go straight to the landing page. Decided once, at mount.
  const [awaitingSnapshot] = useState<boolean>(() => isProductionApiEnabled() && Boolean(getAuthToken()));

  useEffect(() => {
    const applyAdminHash = () => {
      if (window.location.hash === '#admin' || window.location.pathname === '/admin') setCurrentTab('admin');
    };
    applyAdminHash();
    window.addEventListener('hashchange', applyAdminHash);
    return () => window.removeEventListener('hashchange', applyAdminHash);
  }, []);

  useEffect(() => {
    if (!shellIntent) return;
    setCurrentTab(shellIntent);
    clearShellIntent();
  }, [shellIntent, clearShellIntent]);

  useEffect(() => {
    if (!currentUser || profileModalOpen) return;
    if (currentUser.role === 'staff' && (currentTab === 'landing' || currentTab === 'search')) {
      setCurrentTab('staff');
      return;
    }
    if (window.location.hash === '#admin' || currentTab === 'admin') {
      if (isPlatformAdmin(currentUser.role)) setCurrentTab('admin');
      return;
    }
    if (currentTab === 'profile' || currentTab === 'search' || currentTab === 'landing') return;
    if (currentUser.role === 'owner') setCurrentTab('owner');
    else if (currentUser.role === 'resident') setCurrentTab('resident');
    else if (currentUser.role === 'staff') setCurrentTab('staff');
    else if (currentUser.role === 'admin' || currentUser.role === 'superadmin') setCurrentTab('admin');
    else if (currentUser.role === 'warden') setCurrentTab('warden');
    else if (currentUser.role === 'accountant') setCurrentTab('accountant');
  }, [currentUser?.id, currentUser?.role, profileModalOpen]);

  const selectedProperty = selectedPGForDetail || properties.find((p) => p.id === selectedPropertyId);

  const handleSelectPG = (pgId: string) => {
    setSelectedPGForDetail(null);
    setSelectedPropertyId(pgId);
  };

  const handleClosePGModal = () => {
    setSelectedPropertyId(null);
    setSelectedPGForDetail(null);
  };

  const handleExploreWithParams = (criteria?: PublicSearchCriteria) => {
    setSearchParams(criteria || {});
    setCurrentTab('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAreaExplore = (area?: string, city?: string) => {
    handleExploreWithParams({ location: area, city });
  };

  const isPlatformAdminSession = isPlatformAdmin(currentUser?.role);
  const wantsAdminRoute = currentTab === 'admin' || (typeof window !== 'undefined' && window.location.hash === '#admin');

  // Disabled/suspended account: hard read-only screen over everything. The
  // server already rejects every write; this makes the state unmistakable and
  // hands the user the reactivation path. The Super Admin console is exempt
  // (they are the ones doing the disabling).
  const blocked = !isPlatformAdminSession && (
    accountBlocked !== null ||
    (currentUser && currentUser.status === 'Disabled') ||
    (currentUser && currentUser.status === 'Suspended')
  );
  const [reactivationState, setReactivationState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [reactivationError, setReactivationError] = useState<string | null>(null);

  useEffect(() => {
    if (isPlatformAdminSession && window.location.hash !== '#admin') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#admin`);
    }
  }, [isPlatformAdminSession]);

  const isDashboardView =
    currentTab === 'profile' ||
    currentTab === 'support' ||
    isPlatformAdminSession ||
    (role === 'admin' || currentTab === 'admin') ||
    (role === 'warden' || currentTab === 'warden') ||
    (role === 'accountant' || currentTab === 'accountant') ||
    (role === 'owner' || currentTab === 'owner') ||
    (role === 'resident' || currentTab === 'resident') ||
    (role === 'staff' || currentTab === 'staff');

  const showPublicFooter = !isDashboardView || currentTab === 'landing' || currentTab === 'search';

  const appContent = (
    <Suspense fallback={<PGWaloLoader done={false} message="Loading this section" />}>
        {guardianToken ? (
          <GuardianPortal token={guardianToken} onExit={() => window.history.replaceState({}, '', '/')} />
        ) : isPlatformAdminSession || wantsAdminRoute ? (
          <AdminDashboard />
        ) : currentUser?.role === 'staff' && currentTab !== 'profile' ? (
          <StaffDashboard />
        ) : currentTab === 'profile' ? (
          <AccountDetailsPage />
        ) : currentTab === 'search' ? (
          <SearchPage onSelectPG={handleSelectPG} initialCriteria={searchParams} />
        ) : currentTab === 'landing' ? (
          <LandingPage onExploreClick={handleExploreWithParams} onSelectPG={handleSelectPG} />
        ) : currentTab === 'support' ? (
          <SupportCenter />
        ) : role === 'warden' || currentTab === 'warden' ? (
          <WardenDashboard />
        ) : role === 'accountant' || currentTab === 'accountant' ? (
          <AccountantDashboard />
        ) : role === 'owner' || (currentUser?.role === 'owner' && currentTab === 'owner') ? (
          <OwnerDashboard />
        ) : role === 'resident' || currentTab === 'resident' ? (
          <ResidentDashboard />
        ) : role === 'staff' || (currentUser?.role === 'staff' && currentTab === 'staff') ? (
          <StaffDashboard />
        ) : (
          <LandingPage onExploreClick={handleExploreWithParams} onSelectPG={handleSelectPG} />
        )}
    </Suspense>
  );

  if (blocked) {
    const suspended = currentUser?.status === 'Suspended' || accountBlocked?.reason === 'Account suspended';
    return (
      <div className="native-app min-h-[100dvh] bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-800 p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-rose-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black">
              {suspended ? 'Account suspended' : 'Account disabled'}
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              The Super Admin has {suspended ? 'suspended' : 'disabled'} this account. Your data is safe,
              but everything is read-only until the account is reactivated.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 text-left space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">To restore access</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              Raise a <span className="font-bold text-white">Reactivation request</span> from the support screen —
              the Super Admin reviews every request and reactivates genuine accounts, usually within a day.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {reactivationState === 'sent' ? (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300 font-bold">
                Request sent. The Super Admin has been notified — you will be able to sign in once they reactivate the account.
              </div>
            ) : (
              <button
                type="button"
                disabled={reactivationState === 'sending'}
                onClick={async () => {
                  setReactivationState('sending');
                  setReactivationError(null);
                  const result = await requestReactivation({
                    email: currentUser?.email || undefined,
                    phone: currentUser?.phone || undefined,
                    message: `Reactivation request from ${currentUser?.name || 'a user'} (${currentUser?.email || currentUser?.phone || 'unknown account'}).`,
                  });
                  if (result.success) setReactivationState('sent');
                  else {
                    setReactivationState('idle');
                    setReactivationError(result.error || 'Could not raise the request');
                  }
                }}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                {reactivationState === 'sending' ? 'Sending…' : 'Raise reactivation request'}
              </button>
            )}
            {reactivationError && (
              <p className="text-xs text-rose-400 font-semibold">{reactivationError}</p>
            )}
            <button
              type="button"
              onClick={() => logout()}
              className="w-full rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 py-2.5 text-sm font-bold transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`native-app min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white ${
        isStandalone ? 'standalone-shell' : ''
      }`}
    >
      <a
        href="#main-content"
        className="skip-link"
      >
        Skip to main content
      </a>
      {awaitingSnapshot && <PGWaloLoader done={productionHydrated} message="Loading your PGWalo workspace" />}
      <OfflineIndicator />
      {isPlatformAdminSession ? (
        <main id="main-content" className="flex-1">{appContent}</main>
      ) : isStandalone ? (
        <PWAMobileShell
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          onOpenNotifications={() => setShowNotifications(true)}
        >
          {appContent}
        </PWAMobileShell>
      ) : (
        <>
          <Navbar
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            mobileMenuOpen={mobileMenuOpen}
            setMobileMenuOpen={setMobileMenuOpen}
            showNotifications={showNotifications}
            setShowNotifications={setShowNotifications}
          />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 pb-[calc(var(--app-tab-bar-height)+var(--safe-bottom))] md:pb-0 outline-none"
          >
            {appContent}
          </main>
          {showPublicFooter && (
            <div className="desktop-only">
              <Footer onAreaClick={handleAreaExplore} />
            </div>
          )}
          <MobileBottomNav
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            onOpenNotifications={() => setShowNotifications(true)}
          />
        </>
      )}

      {selectedProperty && (
        <PGDetailModal
          property={selectedProperty}
          intent={propertyModalIntent}
          onClose={handleClosePGModal}
          onGoToDashboard={() => {
            setRole('resident');
            setCurrentTab('resident');
          }}
        />
      )}
      <AuthExperience />
      <ProfileCompletionModal />
      {isStandalone && showNotifications && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 p-4" onClick={() => setShowNotifications(false)}>
          <div className="mx-auto mt-16 max-w-sm rounded-3xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black text-slate-900">Notifications</h2>
              <button onClick={() => setShowNotifications(false)} className="text-sm font-bold text-blue-600">Done</button>
            </div>
            <div className="space-y-3">
              {broadcasts.slice(0, 5).map((broadcast) => (
                <div key={broadcast.id} className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-900">{broadcast.title}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{broadcast.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainAppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
