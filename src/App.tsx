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
import { getAuthToken, isProductionApiEnabled } from './services/productionApi';

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
  } = useApp();
  const isStandalone = useStandalonePWA();

  const [currentTab, setCurrentTab] = useState<string>(() =>
    typeof window !== 'undefined' && (window.location.hash === '#admin' || window.location.pathname === '/admin')
      ? 'admin'
      : 'landing'
  );
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
        {isPlatformAdminSession || wantsAdminRoute ? (
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

  return (
    <div
      className={`native-app min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white ${
        isStandalone ? 'standalone-shell' : ''
      }`}
    >
      {awaitingSnapshot && <PGWaloLoader done={productionHydrated} message="Loading your PGWalo workspace" />}
      <OfflineIndicator />
      {isPlatformAdminSession ? (
        <main className="flex-1">{appContent}</main>
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
          <main className="flex-1 pb-[calc(var(--app-tab-bar-height)+var(--safe-bottom))] md:pb-0">{appContent}</main>
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
