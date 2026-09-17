import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  Building2,
  ChevronLeft,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Shield,
  Ticket,
  Users,
  UserCircle,
  BarChart3,
  ClipboardList,
  BedDouble,
  Home,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fetchMeWithWorkers } from '../../services/auth';
import { getAuthToken, isProductionApiEnabled } from '../../services/productionApi';

export type AdminSection =
  | 'dashboard'
  | 'users'
  | 'owners'
  | 'tenants'
  | 'properties'
  | 'rooms'
  | 'bookings'
  | 'agreements'
  | 'payments'
  | 'tickets'
  | 'reports'
  | 'analytics'
  | 'notifications'
  | 'audit'
  | 'settings';

const NAV: { id: AdminSection; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'owners', label: 'PG Owners', icon: UserCircle },
  { id: 'tenants', label: 'Tenants', icon: Home },
  { id: 'properties', label: 'Properties / PGs', icon: Building2 },
  { id: 'rooms', label: 'Rooms & Allocations', icon: BedDouble },
  { id: 'bookings', label: 'Bookings', icon: ClipboardList },
  { id: 'agreements', label: 'Agreements', icon: FileText },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'analytics', label: 'Analytics', icon: Activity },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'audit', label: 'Audit Logs', icon: Shield },
  { id: 'settings', label: 'Admin Settings', icon: Settings },
];

export const SuperAdminShell: React.FC<{
  section: AdminSection;
  onSection: (section: AdminSection) => void;
  children: React.ReactNode;
}> = ({ section, onSection, children }) => {
  const { currentUser, logout, broadcasts, globalSearchQuery, setGlobalSearchQuery } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const unread = broadcasts.length;

  useEffect(() => {
    if (!isProductionApiEnabled() || !getAuthToken()) return;
    fetchMeWithWorkers().then((res) => {
      if (res?.error === 'Invalid or expired token' || res?.error === 'Authentication required') {
        logout();
      }
    }).catch(() => undefined);
  }, [logout]);

  const title = useMemo(() => NAV.find((item) => item.id === section)?.label || 'Dashboard', [section]);

  const navList = (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = section === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onSection(item.id);
              setMobileOpen(false);
            }}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-[100dvh] bg-slate-100 flex text-slate-900">
      <aside className={`hidden md:flex flex-col bg-slate-950 text-white transition-all ${collapsed ? 'w-[72px]' : 'w-64'}`}>
        <div className="flex items-center justify-between px-3 py-4 border-b border-white/10">
          {!collapsed && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-blue-300 font-bold">PGWalo</p>
              <p className="text-sm font-black">Super Admin</p>
            </div>
          )}
          <button type="button" onClick={() => setCollapsed((v) => !v)} className="p-2 rounded-lg hover:bg-white/10">
            {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        {navList}
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-950/60" onClick={() => setMobileOpen(false)}>
          <aside className="w-72 h-full bg-slate-950 text-white flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <p className="font-black">Super Admin</p>
              <button type="button" onClick={() => setMobileOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            {navList}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button type="button" className="md:hidden p-2 rounded-xl bg-slate-100" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-black text-slate-900 text-lg shrink-0">{title}</h1>
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              placeholder="Search users, PGs, bookings, tickets…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="button" className="relative p-2 rounded-xl hover:bg-slate-100" onClick={() => { setShowNotes((v) => !v); onSection('notifications'); }}>
            <Bell className="w-5 h-5 text-slate-600" />
            {unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />}
          </button>
          <div className="hidden sm:block text-right">
            <p className="text-xs font-bold text-slate-900 leading-tight">{currentUser?.name || 'Super Admin'}</p>
            <p className="text-[10px] text-slate-500">Platform control</p>
          </div>
          <button
            type="button"
            onClick={() => { logout(); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 text-white px-3 py-2 text-xs font-bold"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </header>
        {showNotes && (
          <div className="px-4 pt-3">
            <p className="text-xs text-slate-500">Open the Notifications section for the full queue.</p>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
};
