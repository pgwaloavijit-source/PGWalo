import React from 'react';
import { Bell, Home, LogOut, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';
import { UserAvatar } from './UserAvatar';

interface PWAMobileShellProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenNotifications: () => void;
  children: React.ReactNode;
}

export const PWAMobileShell: React.FC<PWAMobileShellProps> = ({
  currentTab,
  setCurrentTab,
  onOpenNotifications,
  children,
}) => {
  const { currentUser, broadcasts, logout, setRole } = useApp();
  const dashboardTab = currentUser?.role || 'resident';

  const goHome = () => {
    setCurrentTab(dashboardTab);
  };

  const handleLogout = () => {
    logout();
    setRole('public');
    setCurrentTab('landing');
  };

  return (
    <div className="pwa-mobile-shell">
      <header className="pwa-mobile-header">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/pwa-192x192.png" alt="PGWalo" className="h-10 w-10 rounded-2xl shadow-sm" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">PGWalo</p>
            <h1 className="truncate text-base font-black text-white">
              {currentUser ? `Hi, ${currentUser.name.split(' ')[0]}` : 'Your stay, elevated'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <PWAInstallButton />
          {currentUser && (
            <button
              onClick={onOpenNotifications}
              className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white"
              aria-label="Open notifications"
            >
              <Bell className="h-5 w-5" />
              {broadcasts.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-300" />}
            </button>
          )}
        </div>
      </header>

      <main className="pwa-mobile-content">{children}</main>

      <nav className="pwa-mobile-tabbar" aria-label="PWA navigation">
        <button onClick={goHome} className={currentTab === dashboardTab ? 'pwa-tab active' : 'pwa-tab'}>
          <Home className="h-5 w-5" />
          <span>Home</span>
        </button>
        <button onClick={() => setCurrentTab('search')} className={currentTab === 'search' ? 'pwa-tab active' : 'pwa-tab'}>
          <Search className="h-5 w-5" />
          <span>Explore</span>
        </button>
        <button onClick={onOpenNotifications} className="pwa-tab">
          <Bell className="h-5 w-5" />
          <span>Alerts</span>
        </button>
        <button onClick={handleLogout} className="pwa-tab">
          <LogOut className="h-5 w-5" />
          <span>Sign out</span>
        </button>
      </nav>
    </div>
  );
};
