import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Home,
  Search,
  LogIn,
  UserPlus,
  User,
  Bell,
  Menu,
  Building2,
  ShieldCheck,
  CreditCard,
  Settings,
} from 'lucide-react';

interface MobileBottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenMobileMenu: () => void;
  onOpenNotifications: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  setCurrentTab,
  onOpenMobileMenu,
  onOpenNotifications,
}) => {
  const { currentUser, broadcasts, openAuthModal, setRole } = useApp();

  const getRoleDashboardIcon = () => {
    if (!currentUser) return User;
    switch (currentUser.role) {
      case 'owner':
        return Building2;
      case 'staff':
      case 'warden':
        return ShieldCheck;
      case 'accountant':
        return CreditCard;
      case 'admin':
        return Settings;
      default:
        return User;
    }
  };

  const DashboardIcon = getRoleDashboardIcon();

  return (
    <nav
      id="mobile-bottom-navigation"
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-2 py-1.5 transition-transform"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-around">
        {!currentUser ? (
          /* Unauthenticated Public Mobile Bottom Nav */
          <>
            <button
              id="mobile-nav-home-btn"
              onClick={() => {
                setRole('public');
                setCurrentTab('landing');
              }}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl min-w-[56px] min-h-[44px] transition-all active:scale-95 ${
                currentTab === 'landing' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Home className={`w-5 h-5 ${currentTab === 'landing' ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[10px] mt-1 leading-none">Home</span>
            </button>

            <button
              id="mobile-nav-search-btn"
              onClick={() => {
                setRole('public');
                setCurrentTab('search');
              }}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl min-w-[56px] min-h-[44px] transition-all active:scale-95 ${
                currentTab === 'search' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Search className={`w-5 h-5 ${currentTab === 'search' ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[10px] mt-1 leading-none">Find PG</span>
            </button>

            <button
              id="mobile-nav-login-btn"
              onClick={() => openAuthModal('login')}
              className="flex flex-col items-center justify-center py-1 px-3 rounded-xl min-w-[56px] min-h-[44px] text-slate-600 hover:text-blue-600 transition-all active:scale-95"
            >
              <LogIn className="w-5 h-5" />
              <span className="text-[10px] mt-1 leading-none">Login</span>
            </button>

            <button
              id="mobile-nav-join-btn"
              onClick={() => openAuthModal('register')}
              className="flex flex-col items-center justify-center py-1 px-3 rounded-xl min-w-[56px] min-h-[44px] text-blue-600 font-semibold transition-all active:scale-95"
            >
              <UserPlus className="w-5 h-5" />
              <span className="text-[10px] mt-1 leading-none">Join Us</span>
            </button>
          </>
        ) : (
          /* Authenticated User Mobile Bottom Nav */
          <>
            <button
              id="mobile-nav-dashboard-btn"
              onClick={() => {
                if (currentUser.role === 'owner') setCurrentTab('owner');
                else if (currentUser.role === 'resident') setCurrentTab('resident');
                else if (currentUser.role === 'staff') setCurrentTab('staff');
                else if (currentUser.role === 'warden') setCurrentTab('warden');
                else if (currentUser.role === 'accountant') setCurrentTab('accountant');
                else if (currentUser.role === 'admin') setCurrentTab('admin');
              }}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl min-w-[56px] min-h-[44px] transition-all active:scale-95 ${
                currentTab !== 'search' && currentTab !== 'landing'
                  ? 'text-blue-600 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <DashboardIcon className={`w-5 h-5 ${currentTab !== 'search' && currentTab !== 'landing' ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[10px] mt-1 leading-none">Dashboard</span>
            </button>

            <button
              id="mobile-nav-explore-btn"
              onClick={() => setCurrentTab('search')}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl min-w-[56px] min-h-[44px] transition-all active:scale-95 ${
                currentTab === 'search' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Search className={`w-5 h-5 ${currentTab === 'search' ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[10px] mt-1 leading-none">Search</span>
            </button>

            <button
              id="mobile-nav-alerts-btn"
              onClick={onOpenNotifications}
              className="flex flex-col items-center justify-center py-1 px-3 rounded-xl min-w-[56px] min-h-[44px] text-slate-500 hover:text-slate-800 transition-all active:scale-95 relative"
            >
              <div className="relative">
                <Bell className="w-5 h-5" />
                {broadcasts.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-600 rounded-full ring-2 ring-white" />
                )}
              </div>
              <span className="text-[10px] mt-1 leading-none">Alerts</span>
            </button>

            <button
              id="mobile-nav-menu-btn"
              onClick={onOpenMobileMenu}
              className="flex flex-col items-center justify-center py-1 px-3 rounded-xl min-w-[56px] min-h-[44px] text-slate-500 hover:text-slate-800 transition-all active:scale-95"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] mt-1 leading-none">Menu</span>
            </button>
          </>
        )}
      </div>
    </nav>
  );
};
