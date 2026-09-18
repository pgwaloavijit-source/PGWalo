import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from './BrandLogo';
import { UserAvatar } from './UserAvatar';
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
  LayoutDashboard,
  Phone,
  Briefcase,
} from 'lucide-react';
import { UserRole } from '../../types';
import { PWAInstallButton } from './PWAInstallButton';

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
    markNotificationsRead,
    openAuthModal,
    logout,
  } = useApp();

  // Personal notices (complaint status changes etc.) carry a recipient id.
  const isPersonal = (b: (typeof broadcasts)[number]) =>
    Boolean((b as unknown as { recipientId?: string }).recipientId);
  const unreadCount = broadcasts.filter((b) => !b.read).length;

  const [internalShowNotifications, setInternalShowNotifications] = useState(false);
  const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState(false);

  const showNotifications = controlledShowNotifications ?? internalShowNotifications;
  const setShowNotifications = controlledSetShowNotifications ?? setInternalShowNotifications;

  const mobileMenuOpen = controlledMobileMenuOpen ?? internalMobileMenuOpen;
  const setMobileMenuOpen = controlledSetMobileMenuOpen ?? setInternalMobileMenuOpen;

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  // The signed-out header carries exactly one control; everything a visitor
  // needs (download the app, log in, join) lives inside this panel.
  const [publicMenuOpen, setPublicMenuOpen] = useState(false);
  const publicMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!accountMenuRef.current?.contains(e.target as Node)) setAccountMenuOpen(false);
      if (!publicMenuRef.current?.contains(e.target as Node)) setPublicMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const goToDashboard = (userRole?: UserRole) => {
    const r = userRole || currentUser?.role;
    if (r === 'owner') setCurrentTab('owner');
    else if (r === 'staff') setCurrentTab('staff');
    else if (r === 'warden') setCurrentTab('warden');
    else if (r === 'accountant') setCurrentTab('accountant');
    else if (r === 'admin' || r === 'superadmin') setCurrentTab('admin');
    else setCurrentTab('resident');
  };

  const handleLogout = () => {
    // `logout()` clears the session and reloads the page; the state resets below
    // only matter for the instant before the navigation lands.
    setMobileMenuOpen(false);
    setShowNotifications(false);
    setAccountMenuOpen(false);
    setPublicMenuOpen(false);
    logout();
    setRole('public');
    setCurrentTab('landing');
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
      case 'superadmin':
        return 'Super Admin';
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
                    goToDashboard(currentUser.role);
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
              {currentUser && <PWAInstallButton />}
              {currentUser && (
                <button
                  onClick={() => setCurrentTab('support')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 hover:text-indigo-600 rounded-xl min-h-[40px]"
                >
                  Support
                </button>
              )}
              {!currentUser ? (
                /* ================= PUBLIC (UNAUTHENTICATED) HEADER =================
                   Exactly one control: the menu. Every visitor action — download
                   the app, log in, join as an Owner or a Tenant — lives inside
                   the panel it opens, so nothing competes with the brand.
                */
                <div className="relative" ref={publicMenuRef}>
                  <button
                    id="nav-main-menu-btn"
                    onClick={() => setPublicMenuOpen((open) => !open)}
                    aria-expanded={publicMenuOpen}
                    aria-haspopup="menu"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold transition-all shadow-xs min-h-[44px]"
                  >
                    {publicMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                    <span>{publicMenuOpen ? 'Close' : 'Menu'}</span>
                  </button>

                  {publicMenuOpen && (
                    <div
                      role="menu"
                      className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-auto sm:mt-2 w-[calc(100vw-1.5rem)] sm:w-72 rounded-2xl bg-white p-2 shadow-2xl border border-slate-200 z-50 overflow-hidden"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setPublicMenuOpen(false); setCurrentTab('search'); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Search className="w-4 h-4 text-blue-600" />
                        Find PGs near you
                      </button>

                      <div className="px-3 py-2" onClick={() => setPublicMenuOpen(false)}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Download the app
                        </p>
                        <PWAInstallButton />
                      </div>

                      <div className="h-px bg-slate-100 my-1" />

                      <button
                        id="nav-login-btn"
                        type="button"
                        role="menuitem"
                        onClick={() => { setPublicMenuOpen(false); openAuthModal('login'); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <LogIn className="w-4 h-4 text-blue-600" />
                        Login
                      </button>

                      <button
                        id="nav-join-us-btn"
                        type="button"
                        role="menuitem"
                        onClick={() => { setPublicMenuOpen(false); openAuthModal('register'); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-bold text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <UserPlus className="w-4 h-4" />
                        Join us
                      </button>
                      <p className="px-3 pt-2 pb-1 text-[11px] text-slate-400 leading-relaxed">
                        Join as an Owner or as a Tenant — nothing else.
                      </p>
                    </div>
                  )}
                </div>
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
                  <div className="relative hidden md:block" ref={accountMenuRef}>
                    <button
                      id="nav-user-profile-btn"
                      onClick={() => setAccountMenuOpen((open) => !open)}
                      className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer text-left focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      title="Account menu"
                    >
                      <div className="relative">
                        <UserAvatar name={currentUser.name} src={currentUser.avatar} sizeClass="w-7 h-7 text-[10px]" />
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

                    {accountMenuOpen && (
                      <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white shadow-2xl border border-slate-200 z-50 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-100">
                          <p className="text-sm font-black text-slate-900 truncate">{currentUser.name}</p>
                          <p className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                            <Phone className="w-3.5 h-3.5 text-blue-600" />
                            {currentUser.phone || 'Mobile not added'}
                          </p>
                          <p className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                            <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                            {currentUser.occupation || 'Profession not added'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            goToDashboard();
                            setAccountMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-blue-50"
                        >
                          <LayoutDashboard className="w-4 h-4 text-blue-600" />
                          Back to dashboard
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentTab('profile');
                            setAccountMenuOpen(false);
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 border-t border-slate-100"
                        >
                          More
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Notification Bell */}
                  <div className="relative">
                    <button
                      id="notifications-toggle-btn"
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="relative hidden md:flex p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition min-w-[40px] min-h-[40px] items-center justify-center"
                      aria-label="View notifications"
                    >
                      <Bell className="w-4 h-4" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white flex items-center justify-center animate-pulse">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
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
                            {unreadCount > 0 && (
                              <button
                                onClick={() => markNotificationsRead()}
                                className="text-[11px] text-blue-600 hover:text-blue-800 font-bold"
                              >
                                Mark all read
                              </button>
                            )}
                            <button
                              onClick={() => setShowNotifications(false)}
                              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 sm:hidden"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="max-h-72 overflow-y-auto space-y-2 mt-2 divide-y divide-slate-100">
                          {broadcasts.length === 0 && (
                            <p className="text-[11px] text-slate-400 text-center py-6">
                              No notifications yet.
                            </p>
                          )}
                          {broadcasts.slice(0, 8).map((b) => (
                            <div
                              key={b.id}
                              className={`pt-2 px-1 text-xs ${!b.read ? 'bg-blue-50/60 rounded-lg' : ''}`}
                            >
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      isPersonal(b)
                                        ? 'bg-purple-100 text-purple-800'
                                        : b.category === 'Rent'
                                        ? 'bg-amber-100 text-amber-800'
                                        : b.category === 'Food'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}
                                  >
                                    {isPersonal(b) ? 'Update' : b.category}
                                  </span>
                                  {!b.read && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />}
                                </div>
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

                  {/* Logout Button (desktop — mobile keeps it in the drawer) */}
                  <button
                    id="nav-logout-btn"
                    onClick={handleLogout}
                    className="hidden md:flex px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 text-xs font-bold transition items-center gap-1.5 border border-slate-200 hover:border-rose-200 min-h-[40px] active:scale-98"
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
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={currentUser.name} src={currentUser.avatar} sizeClass="w-10 h-10 text-sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</p>
                        <p className="text-[11px] text-slate-600 truncate">{currentUser.phone || 'No mobile'}</p>
                        <p className="text-[11px] text-slate-500 truncate">{currentUser.occupation || 'Profession not added'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentTab('profile');
                        setMobileMenuOpen(false);
                      }}
                      className="mt-3 w-full py-2 rounded-xl bg-white border border-blue-200 text-blue-700 text-xs font-bold"
                    >
                      More
                    </button>
                  </div>

                  {/* Role Specific Quick Navigation */}
                  <div className="space-y-1.5 pt-2">
                    <button
                      onClick={() => {
                        goToDashboard(currentUser.role);
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs min-h-[44px]"
                    >
                      <span>Go to My Dashboard</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {/* Notifications live in the drawer on mobile — the header
                        bell is desktop-only to keep the mobile bar clean. */}
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setShowNotifications(true);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-slate-700 font-medium text-xs min-h-[44px]"
                    >
                      <span className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-blue-600" />
                        Notifications
                      </span>
                      {unreadCount > 0 ? (
                        <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
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
