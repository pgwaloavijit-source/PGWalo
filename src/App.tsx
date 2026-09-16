import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { LandingPage } from './components/public/LandingPage';
import { SearchPage } from './components/public/SearchPage';
import { PGDetailModal } from './components/public/PGDetailModal';
import { AuthModal } from './components/auth/AuthModal';
import { ProfileCompletionModal } from './components/auth/ProfileCompletionModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { OwnerDashboard } from './components/owner/OwnerDashboard';
import { ResidentDashboard } from './components/resident/ResidentDashboard';
import { StaffDashboard } from './components/staff/StaffDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { WardenDashboard } from './components/warden/WardenDashboard';
import { AccountantDashboard } from './components/accountant/AccountantDashboard';
import { PublicSearchCriteria } from './types';

const MainAppContent: React.FC = () => {
  const { role, setRole, currentUser, properties } = useApp();

  // Tab navigation state
  const [currentTab, setCurrentTab] = useState<string>('landing');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [searchParams, setSearchParams] = useState<PublicSearchCriteria>({});

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  const handleSelectPG = (pgId: string) => {
    setSelectedPropertyId(pgId);
  };

  const handleClosePGModal = () => {
    setSelectedPropertyId(null);
  };

  const handleExploreWithParams = (criteria?: PublicSearchCriteria) => {
    setSearchParams(criteria || {});
    setCurrentTab('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAreaExplore = (area?: string, city?: string) => {
    handleExploreWithParams({ location: area, city });
  };

  // Determine which main view to show
  const isDashboardView =
    (role === 'admin' || currentTab === 'admin') ||
    (role === 'warden' || currentTab === 'warden') ||
    (role === 'accountant' || currentTab === 'accountant') ||
    (role === 'owner' || currentTab === 'owner') ||
    (role === 'resident' || currentTab === 'resident') ||
    (role === 'staff' || currentTab === 'staff');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* PWA Offline Banner */}
      <OfflineIndicator />

      {/* Global Minimal Header */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        showNotifications={showNotifications}
        setShowNotifications={setShowNotifications}
      />

      {/* Dynamic View Content Based on Role and Tab */}
      <main className="flex-1 pb-16 md:pb-0">
        {role === 'admin' || currentTab === 'admin' ? (
          <AdminDashboard />
        ) : role === 'warden' || currentTab === 'warden' ? (
          <WardenDashboard />
        ) : role === 'accountant' || currentTab === 'accountant' ? (
          <AccountantDashboard />
        ) : role === 'owner' || (currentUser?.role === 'owner' && currentTab === 'owner') ? (
          <OwnerDashboard />
        ) : role === 'resident' || (currentUser?.role === 'resident' && currentTab === 'resident') ? (
          <ResidentDashboard />
        ) : role === 'staff' || (currentUser?.role === 'staff' && currentTab === 'staff') ? (
          <StaffDashboard />
        ) : currentTab === 'search' ? (
          <SearchPage
            onSelectPG={handleSelectPG}
            initialCriteria={searchParams}
          />
        ) : (
          <LandingPage
            onExploreClick={handleExploreWithParams}
            onSelectPG={handleSelectPG}
          />
        )}
      </main>

      {/* Public Footer (Visible on public discovery views) */}
      {(!isDashboardView || currentTab === 'landing' || currentTab === 'search') && (
        <Footer onAreaClick={handleAreaExplore} />
      )}

      {/* PG Detail / Booking Modal */}
      {selectedProperty && (
        <PGDetailModal
          property={selectedProperty}
          onClose={handleClosePGModal}
          onGoToDashboard={() => {
            setRole('resident');
            setCurrentTab('resident');
          }}
        />
      )}

      {/* Authentication & Registration Modal */}
      <AuthModal />

      {/* Profile Onboarding / Details Form Modal */}
      <ProfileCompletionModal />

      {/* Fixed Mobile Bottom Navigation Bar */}
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
