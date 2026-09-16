import React, { useEffect, useState } from 'react';
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
import { AccountDetailsPage } from './components/auth/AccountDetailsPage';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { OwnerDashboard } from './components/owner/OwnerDashboard';
import { ResidentDashboard } from './components/resident/ResidentDashboard';
import { StaffDashboard } from './components/staff/StaffDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { WardenDashboard } from './components/warden/WardenDashboard';
import { AccountantDashboard } from './components/accountant/AccountantDashboard';
import { PublicSearchCriteria } from './types';
import { useStandalonePWA } from './hooks/useStandalonePWA';

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
  } = useApp();
  const isStandalone = useStandalonePWA();

  const [currentTab, setCurrentTab] = useState<string>('landing');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [searchParams, setSearchParams] = useState<PublicSearchCriteria>({});

  useEffect(() => {
    if (!shellIntent) return;
    setCurrentTab(shellIntent);
    clearShellIntent();
  }, [shellIntent, clearShellIntent]);

  useEffect(() => {
    if (!currentUser || profileModalOpen) return;
    if (currentTab === 'profile' || currentTab === 'search' || currentTab === 'landing') return;
    if (currentUser.role === 'owner') setCurrentTab('owner');
    else if (currentUser.role === 'resident') setCurrentTab('resident');
    else if (currentUser.role === 'staff') setCurrentTab('staff');
    else if (currentUser.role === 'admin') setCurrentTab('admin');
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

  const isDashboardView =
    currentTab === 'profile' ||
    (role === 'admin' || currentTab === 'admin') ||
    (role === 'warden' || currentTab === 'warden') ||
    (role === 'accountant' || currentTab === 'accountant') ||
    (role === 'owner' || currentTab === 'owner') ||
    (role === 'resident' || currentTab === 'resident') ||
    (role === 'staff' || currentTab === 'staff');

  const showPublicFooter = !isDashboardView || currentTab === 'landing' || currentTab === 'search';

  return (
    <div
      className={`native-app min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white ${
        isStandalone ? 'standalone-shell' : ''
      }`}
    >
      <OfflineIndicator />

      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        showNotifications={showNotifications}
        setShowNotifications={setShowNotifications}
      />

      <main className="flex-1 pb-[calc(var(--app-tab-bar-height)+var(--safe-bottom))] md:pb-0">
        {currentTab === 'profile' ? (
          <AccountDetailsPage />
        ) : currentTab === 'search' ? (
          <SearchPage onSelectPG={handleSelectPG} initialCriteria={searchParams} />
        ) : currentTab === 'landing' ? (
          <LandingPage onExploreClick={handleExploreWithParams} onSelectPG={handleSelectPG} />
        ) : role === 'admin' || currentTab === 'admin' ? (
          <AdminDashboard />
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
      </main>

      {showPublicFooter && (
        <div className="desktop-only">
          <Footer onAreaClick={handleAreaExplore} />
        </div>
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

      <MobileBottomNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onOpenNotifications={() => setShowNotifications(true)}
      />
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
