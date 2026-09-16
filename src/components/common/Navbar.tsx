import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from './BrandLogo';
import {
  Bell,
  X,
  LogIn,
  LogOut,
  UserPlus,
  Building2,
  Search,
  User,
  ShieldCheck,
  CreditCard,
  Settings,
  ChevronRight,
  Menu,
  Sparkles,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  showNotifications?: boolean;
  setShowNotifications?: React.Dispatch<React.SetStateAction<boolean>>;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  mobileMenuOpen: controlledMobileMenuOpen,
  setMobileMenuOpen: controlledSetMobileMenuOpen,
  showNotifications: controlledShowNotifications,
  setShowNotifications: controlledSetShowNotifications,
}) => {
  const {
    role,
    setRole,
    currentUser,
    broadcasts,
    openAuthModal,
    logout,
    setProfileModalOpen,
  } = useApp();

  const [internalShowNotifications, setInternalShowNotifications] = useState(false);
  const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState(false);

  const showNotifications = controlledShowNotifications ?? internalShowNotifications;
  const setShowNotifications = controlledSetShowNotifications ?? setInternalShowNotifications;

  const mobileMenuOpen = controlledMobileMenuOpen ?? internalMobileMenuOpen;
  const setMobileMenuOpen = controlledSetMobileMenuOpen ?? setInternalMobileMenuOpen;

  const handleLogout = () => {
    logout();
    setRole('public');
    setCurrentTab('landing');
    setMobileMenuOpen(false);
    setShowNotifications(false);
  };

  const getRoleLabel = (r: string) => {
    switch (r) {
      case 'owner':
        return 'Owner';
      case 'resident':
        return 'Resident';
      case 'staff':
        return 'Staff';
      case 'warden':
        return 'Warden';
      case 'accountant':
        return 'Accountant';
      case 'admin':
        return 'Admin';
      default:
        return 'User';
    }
  };

  const getRoleBadgeColor = (r: string) => {
    switch (r) {
      case 'owner':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'resident':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'staff':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'warden':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'accountant':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'admin':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand Logo & Platform Name */}
            <div className="flex items-center">
              <button
                id="brand-logo-btn"
                onClick={() => {
                  if (!currentUser) {
                    setRole('public');
                    setCurrentTab('landing');
                  } else {
                    // Navigate to respective dashboard or landing
                    if (currentUser.role === 'owner') setCurrentTab('owner');
                    else if (currentUser.role === 'resident') setCurrentTab('resident');
                    else if (currentUser.role === 'staff') setCurrentTab('staff');
                    else if (currentUser.role === 'warden') setCurrentTab('warden');
                    else if (currentUser.role === 'accountant') setCurrentTab('accountant');
                    else if (currentUser.role === 'admin') setCurrentTab('admin');
                    else setCurrentTab('landing');
                  }
                }}
                className="flex items-center group text-left focus:outline-hidden py-1 min-h-[44px]"
                aria-label="PGWalo Home"
              >
                <BrandLogo size="md" subtitle="" />
              </button>
            </div>

            {/* Right Action Section */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {!currentUser ? (
                /* ================= PUBLIC (UNAUTHENTICATED) HEADER =================
                   Contains strictly:
                   - Logo & Platform Name (on the left)
                   - Login
                   - Join Us
                   - Mobile hamburger toggle
                */
                <>
                  <button
                    id="nav-search-link-btn"
                    onClick={() => setCurrentTab('search')}
                    className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-blue-600 rounded-xl transition min-h-[40px]"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Find PGs</span>
                  </button>

                  <button
                    id="nav-login-btn"
                    onClick={() => openAuthModal('login')}
                    className="px-4 py-2 rounded-xl border border-slate-300 hover:border-blue-600 text-slate-700 hover:text-blue-600 text-xs font-bold transition-all shadow-2xs min-h-[40px] flex items-center gap-1.5 active:scale-98"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Login</span>
                  </button>

                  <button
                    id="nav-join-us-btn"
                    onClick={() => openAuthModal('register')}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold transition-all shadow-xs min-h-[40px] flex items-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Join Us</span>
                  </button>

                  {/* Mobile Menu Button */}
                  <button
                    id="mobile-menu-toggle-btn"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 min-w-[44px] min-h-[44px] flex items-center justify-center transition active:scale-95"
                    aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Navigation Menu'}
                  >
                    {mobileMenuOpen ? <X className="w-5 h-5 text-slate-900" /> : <Menu className="w-5 h-5" />}
                  </button>
                </>
              ) : (
                /* ================= AUTHENTICATED HEADER =================
                   Contains strictly:
                   - Logo/Brand Name (on the left)
                   - User chip (name & role badge)
                   - Notification Bell
                   - Logout
                   - Mobile hamburger toggle
                */
                <>
                  {/* User Profile Chip */}
                  <button
                    id="nav-user-profile-btn"
                    onClick={() => setProfileModalOpen(true)}
                    className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer text-left focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    title="Click to view/edit your profile (name, age, phone, role...)"
                  >
                    <div className="relative">
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.name}
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-lg object-cover border border-slate-300 shrink-0"
                      />
                      {currentUser.isDemo && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                          <Sparkles className="w-2 h-2 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="hidden sm:block text-left pr-1">
                      <p className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[110px]">
                        {currentUser.name.split(' ')[0]}
                      </p>
                      <span
                        className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold border uppercase leading-none ${getRoleBadgeColor(
                          currentUser.role
                        )}`}
                      >
                        {currentUser.isDemo ? 'Demo' : getRoleLabel(currentUser.role)}
                      </span>
                    </div>
                  </button>

                  {/* Notification Bell */}
                  <div className="relative">
                    <button
                      id="notifications-toggle-btn"
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="relative p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition min-w-[40px] min-h-[40px] flex items-center justify-center"
                      aria-label="View notifications"
                    >
                      <Bell className="w-4 h-4" />
                      {broadcasts.length > 0 && (
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-blue-600 rounded-full ring-2 ring-white animate-pulse" />
                      )}
                    </button>

                    {/* Notification flyout */}
                    {showNotifications && (
                      <div className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-auto sm:mt-2 w-[calc(100vw-1.5rem)] sm:w-96 rounded-2xl bg-white p-3 shadow-2xl border border-slate-200 z-50 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 px-2">
                          <div className="flex items-center gap-1.5">
                            <Bell className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-bold text-slate-900">Notifications & Alerts</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                              {broadcasts.length} notices
                            </span>
                            <button
                              onClick={() => setShowNotifications(false)}
                              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 sm:hidden"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="max-h-72 overflow-y-auto space-y-2 mt-2 divide-y divide-slate-100">
                          {broadcasts.slice(0, 6).map((b) => (
                            <div key={b.id} className="pt-2 px-1 text-xs">
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    b.category === 'Rent'
                                      ? 'bg-amber-100 text-amber-800'
                                      : b.category === 'Food'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {b.category}
                                </span>
                                <span className="text-[10px] text-slate-400">{b.timestamp}</span>
                              </div>
                              <p className="font-semibold text-slate-900">{b.title}</p>
                              <p className="text-slate-600 mt-0.5 text-[11px] leading-relaxed line-clamp-2">
                                {b.message}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Logout Button */}
                  <button
                    id="nav-logout-btn"
                    onClick={handleLogout}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 hover:border-rose-200 min-h-[40px] active:scale-98"
                    title={currentUser?.isDemo ? "Exit Demo Mode" : "Logout of your account"}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{currentUser?.isDemo ? 'Exit Demo' : 'Logout'}</span>
                  </button>

                  {/* Mobile Menu Button */}
                  <button
                    id="mobile-menu-toggle-btn"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 min-w-[44px] min-h-[44px] flex items-center justify-center transition active:scale-95"
                    aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Navigation Menu'}
                  >
                    {mobileMenuOpen ? <X className="w-5 h-5 text-slate-900" /> : <Menu className="w-5 h-5" />}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Slide-out Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="fixed inset-y-0 right-0 max-w-full w-80 bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <BrandLogo size="sm" subtitle="Mobile" />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-200/70 min-w-[40px] min-h-[40px] flex items-center justify-center"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!currentUser ? (
                <>
                  {/* Public Quick Links */}
                  <div className="space-y-1.5">
                    <button
                      onClick={() => {
                        setRole('public');
                        setCurrentTab('landing');
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition min-h-[44px] ${
                        currentTab === 'landing'
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="text-xs font-bold">Home</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>

                    <button
                      onClick={() => {
                        setCurrentTab('search');
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition min-h-[44px] ${
                        currentTab === 'search'
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Search className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold">Find & Book PGs</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        openAuthModal('login');
                      }}
                      className="w-full py-3 rounded-xl border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-50 transition min-h-[44px]"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Sign In</span>
                    </button>

                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        openAuthModal('register');
                      }}
                      className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs hover:bg-blue-700 transition min-h-[44px]"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Join PGWalo</span>
                    </button>
                  </div>

                  {/* Partner With Us entry point */}
                  <div className="pt-4 border-t border-slate-100">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2 text-slate-900 font-bold text-xs mb-1">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        <span>Are you a PG Owner?</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                        List your property, automate rent collections, and manage tenants.
                      </p>
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          openAuthModal('register', 'owner', { intent: 'owner_list', path: 'owner', source: 'navbar' });
                        }}
                        className="w-full py-2 bg-white border border-blue-200 text-blue-600 rounded-xl font-bold text-xs hover:bg-blue-50 transition"
                      >
                        List Your Property
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Logged in User Card */}
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setProfileModalOpen(true);
                    }}
                    className="w-full text-left p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <img
                          src={currentUser.avatar}
                          alt={currentUser.name}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-xl object-cover border border-slate-300 shrink-0"
                        />
                        {currentUser.isDemo && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                            <Sparkles className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{currentUser.email}</p>
                        <span
                          className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase ${getRoleBadgeColor(
                            currentUser.role
                          )}`}
                        >
                          {currentUser.isDemo ? 'Demo' : getRoleLabel(currentUser.role)}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg shrink-0">
                      Edit Info
                    </span>
                  </button>

                  {/* Role Specific Quick Navigation */}
                  <div className="space-y-1.5 pt-2">
                    <button
                      onClick={() => {
                        if (currentUser.role === 'owner') setCurrentTab('owner');
                        else if (currentUser.role === 'resident') setCurrentTab('resident');
                        else if (currentUser.role === 'staff') setCurrentTab('staff');
                        else if (currentUser.role === 'warden') setCurrentTab('warden');
                        else if (currentUser.role === 'accountant') setCurrentTab('accountant');
                        else if (currentUser.role === 'admin') setCurrentTab('admin');
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs min-h-[44px]"
                    >
                      <span>Go to My Dashboard</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setCurrentTab('search');
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-slate-700 font-medium text-xs min-h-[44px]"
                    >
                      <span>Explore PG Listings</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>

                  {/* Logout */}
                  <div className="pt-4 border-t border-slate-100">
                    <button
                      onClick={handleLogout}
                      className="w-full py-3 rounded-xl bg-rose-50 text-rose-600 font-bold text-xs flex items-center justify-center gap-2 hover:bg-rose-100 transition min-h-[44px]"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{currentUser?.isDemo ? 'Exit Demo Mode' : 'Sign Out'}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
