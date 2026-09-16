import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Shield,
  Users,
  Building2,
  Lock,
  Settings as SettingsIcon,
  FileSpreadsheet,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  Sliders,
  DollarSign,
  TrendingUp,
  Save,
  Check,
  Eye,
  Key,
  LogIn,
} from 'lucide-react';
import { RolePermissions } from '../../types';
import { AuthAnalyticsCard } from '../auth/AuthAnalyticsCard';

export const AdminDashboard: React.FC = () => {
  const {
    properties,
    residents,
    beds,
    users,
    auditLogs,
    settings,
    updateSettings,
    rolePermissions,
    updateRolePermissions,
    logAuditEvent,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'kpis' | 'auth' | 'rbac' | 'properties' | 'users' | 'audit' | 'settings'>('kpis');
  const [selectedRole, setSelectedRole] = useState<string>('manager');
  const [searchAudit, setSearchAudit] = useState('');
  const [auditFilterAction, setAuditFilterAction] = useState('all');

  // Settings form state
  const [tempSettings, setTempSettings] = useState(settings);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Platform Metrics
  const totalBedsCount = beds.length;
  const occupiedBedsCount = beds.filter((b) => b.status === 'Occupied').length;
  const globalOccupancy = totalBedsCount > 0 ? Math.round((occupiedBedsCount / totalBedsCount) * 100) : 84;
  const estimatedMonthlyGMV = residents.reduce((sum, r) => sum + r.monthlyRent, 0);

  const handleTogglePermission = (
    module: keyof RolePermissions,
    action: 'view' | 'create' | 'edit' | 'delete'
  ) => {
    const currentRolePerms = rolePermissions[selectedRole] || {
      canManageProperties: false,
      canManageRoomsAndBeds: false,
      canManageTenants: false,
      canCollectRent: false,
      canReconcileElectricity: false,
      canManageAgreements: false,
      canManageMaintenance: false,
      canViewFinancialReports: false,
      canConfigureSystem: false,
    };

    const updated = {
      ...currentRolePerms,
      [module]: !currentRolePerms[module],
    };

    updateRolePermissions(selectedRole, updated);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(tempSettings);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  const filteredAuditLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchAudit.toLowerCase()) ||
      log.entity.toLowerCase().includes(searchAudit.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchAudit.toLowerCase()) ||
      log.details.toLowerCase().includes(searchAudit.toLowerCase());
    const matchesAction = auditFilterAction === 'all' || log.action.toLowerCase().includes(auditFilterAction.toLowerCase());
    return matchesSearch && matchesAction;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Platform Admin Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold tracking-wide border border-blue-400/30">
              <Shield className="w-3.5 h-3.5" />
              Platform Super Administration
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Enterprise Governance & RBAC Console
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Global multi-property controls, role-based access delegation, electricity reconciliation parameters, and immutable system audit ledger.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/15 text-center">
              <span className="text-[11px] font-medium text-slate-300 block">System Health</span>
              <span className="text-sm font-black text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                99.98% Operational
              </span>
            </div>
          </div>
        </div>

        {/* Global KPI Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800/80">
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Total Properties</span>
            <span className="text-2xl font-black text-white">{properties.length}</span>
            <span className="text-[11px] text-emerald-400 block mt-0.5">100% Verified</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Total Beds Managed</span>
            <span className="text-2xl font-black text-white">{totalBedsCount}</span>
            <span className="text-[11px] text-blue-300 block mt-0.5">{occupiedBedsCount} Occupied ({globalOccupancy}%)</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Monthly GMV</span>
            <span className="text-2xl font-black text-white">₹{estimatedMonthlyGMV.toLocaleString('en-IN')}</span>
            <span className="text-[11px] text-emerald-400 block mt-0.5">+14.2% MoM</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Platform Users</span>
            <span className="text-2xl font-black text-white">{users.length}</span>
            <span className="text-[11px] text-indigo-300 block mt-0.5">6 Active Roles</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs with smooth mobile horizontal scroll */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pb-2 border-b border-slate-200 text-xs sm:text-sm font-bold">
        <button
          onClick={() => setActiveTab('kpis')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
            activeTab === 'kpis' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          Platform Overview
        </button>
        <button
          onClick={() => setActiveTab('auth')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
            activeTab === 'auth' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <LogIn className="w-4 h-4" />
          Auth Analytics
        </button>
        <button
          onClick={() => setActiveTab('rbac')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
            activeTab === 'rbac' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Lock className="w-4 h-4" />
          RBAC Matrix & Permissions
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
            activeTab === 'users' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          User Directory ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
            activeTab === 'audit' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Audit Logs ({auditLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
            activeTab === 'settings' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          System Settings
        </button>
      </div>

      {activeTab === 'auth' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Sign-up & login funnel (tracked)</h3>
          <AuthAnalyticsCard />
        </div>
      )}

      {/* Tab: Platform Overview */}
      {activeTab === 'kpis' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-base">Network Occupancy</h3>
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  Healthy
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>Occupied Beds ({occupiedBedsCount})</span>
                  <span>{globalOccupancy}%</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full" style={{ width: `${globalOccupancy}%` }}></div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-2">
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-bold block">Available</span>
                    <span className="text-xs font-extrabold text-emerald-600">
                      {beds.filter((b) => b.status === 'Available').length}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-bold block">Notice</span>
                    <span className="text-xs font-extrabold text-amber-600">
                      {beds.filter((b) => b.status === 'Notice Period').length}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-bold block">Cleaning</span>
                    <span className="text-xs font-extrabold text-purple-600">
                      {beds.filter((b) => b.status === 'Cleaning').length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-base">Collections & Reconciliation</h3>
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                  Current Cycle
                </span>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Rent Collected:</span>
                  <span className="font-bold text-slate-900">
                    ₹{residents.filter((r) => r.rentStatus === 'Paid').reduce((s, r) => s + r.monthlyRent, 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Overdue Rent Pending:</span>
                  <span className="font-bold text-rose-600">
                    ₹{residents.filter((r) => r.rentStatus === 'Overdue').reduce((s, r) => s + r.monthlyRent, 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Electricity Billed:</span>
                  <span className="font-bold text-slate-900">₹6,885 (810 units)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Power Variance:</span>
                  <span className="font-bold text-emerald-600">+₹135 (Surplus)</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-base">Service SLAs & Helpdesk</h3>
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
                  Active
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Average Resolution Time:</span>
                  <span className="font-bold text-slate-900">4.2 Hours</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Target SLA Met:</span>
                  <span className="font-bold text-emerald-600">96.8%</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-slate-800 block">Security Gate Logins Today</span>
                  <span className="text-slate-500">148 Biometric Passes • 6 Visitors Cleared</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: RBAC Matrix */}
      {activeTab === 'rbac' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-600" />
                Role-Based Access Control (RBAC) Matrix
              </h3>
              <p className="text-xs text-slate-500">
                Grant or restrict capability scopes across system modules for each stakeholder role.
              </p>
            </div>

            {/* Role Selector Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
              {['admin', 'owner', 'manager', 'warden', 'accountant', 'staff'].map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRole(r)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                    selectedRole === r ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Permissions Matrix Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-extrabold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Module / Feature Domain</th>
                  <th className="p-3.5">Scope Description</th>
                  <th className="p-3.5 text-center">Assigned Permission</th>
                  <th className="p-3.5 text-right">Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  {
                    key: 'canManageProperties',
                    title: 'Property Infrastructure',
                    desc: 'Add, edit, or archive PG buildings, address coordinates, and amenities',
                  },
                  {
                    key: 'canManageRoomsAndBeds',
                    title: 'Room & Bed Inventory',
                    desc: 'Configure room types, tariffs, bed statuses, and allocation matrix',
                  },
                  {
                    key: 'canManageTenants',
                    title: 'Resident Management & Leads',
                    desc: 'Onboard tenants, approve booking requests, track move-in/out checklists',
                  },
                  {
                    key: 'canCollectRent',
                    title: 'Rent Billing & Receipts',
                    desc: 'Mark rent status, collect payments, issue invoices and reminders',
                  },
                  {
                    key: 'canReconcileElectricity',
                    title: 'Sub-Meter Electricity & Reconciliation',
                    desc: 'Input meter readings, verify rate-per-unit, audit utility variance',
                  },
                  {
                    key: 'canManageAgreements',
                    title: 'Digital Tenancy Agreements',
                    desc: 'Generate, sign, and archive legally binding rental contracts',
                  },
                  {
                    key: 'canManageMaintenance',
                    title: 'Maintenance Tickets & SLAs',
                    desc: 'Assign tickets to vendors/staff, update resolution lifecycle',
                  },
                  {
                    key: 'canViewFinancialReports',
                    title: 'Financial Statements & Ledgers',
                    desc: 'View RevPAB, Net Operating Income, security deposit settlements',
                  },
                  {
                    key: 'canConfigureSystem',
                    title: 'Global System Configuration',
                    desc: 'Modify billing due dates, grace period, and platform defaults',
                  },
                ].map((item) => {
                  const permKey = item.key as keyof RolePermissions;
                  const isEnabled = Boolean(rolePermissions[selectedRole]?.[permKey]);

                  return (
                    <tr key={item.key} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900">{item.title}</td>
                      <td className="p-3.5 text-slate-500">{item.desc}</td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] ${
                            isEnabled
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isEnabled ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Granted
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Restricted
                            </>
                          )}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleTogglePermission(permKey, 'edit')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            isEnabled
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          {isEnabled ? 'Revoke Access' : 'Grant Access'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Users Directory */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Platform Accounts Directory</h3>
              <p className="text-xs text-slate-500">All registered system users, roles, and access credentials.</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-800">
              {users.length} Registered Accounts
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-extrabold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Phone</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Account Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="p-3.5 flex items-center gap-3">
                      <img
                        src={u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}
                        alt={u.name}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200"
                      />
                      <span className="font-bold text-slate-900">{u.name}</span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">{u.email}</td>
                    <td className="p-3.5 text-slate-600">{u.phone}</td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold capitalize bg-blue-50 text-blue-700 border border-blue-200">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500">{u.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                Immutable System Audit Logs
              </h3>
              <p className="text-xs text-slate-500">
                Chronological ledger capturing every bed change, agreement execution, reading logging, and security action.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchAudit}
                  onChange={(e) => setSearchAudit(e.target.value)}
                  placeholder="Search logs..."
                  className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-600 w-48"
                />
              </div>

              <select
                value={auditFilterAction}
                onChange={(e) => setAuditFilterAction(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:outline-hidden"
              >
                <option value="all">All Event Types</option>
                <option value="Bed">Bed Actions</option>
                <option value="Agreement">Agreement Actions</option>
                <option value="Meter">Electricity Actions</option>
                <option value="Deposit">Deposit Actions</option>
                <option value="Visitor">Visitor Actions</option>
              </select>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-extrabold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Entity</th>
                  <th className="p-3.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {filteredAuditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-3.5 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                    <td className="p-3.5 font-bold text-slate-800 whitespace-nowrap">
                      {log.userName} ({log.userRole})
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-700 whitespace-nowrap">{log.entity}</td>
                    <td className="p-3.5 text-slate-600 font-sans text-xs">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: System Settings */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-blue-600" />
                Global Platform Settings
              </h3>
              <p className="text-xs text-slate-500">Configure global billing dates, grace periods, and electricity tariffs.</p>
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all"
            >
              <Save className="w-4 h-4" />
              Save Configuration
            </button>
          </div>

          {settingsSaved && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Platform settings updated and logged to audit ledger.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Currency Symbol
              </label>
              <input
                type="text"
                value={tempSettings.currency}
                onChange={(e) => setTempSettings({ ...tempSettings, currency: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Rent Due Day of Month
              </label>
              <input
                type="number"
                min={1}
                max={28}
                value={tempSettings.rentDueDay}
                onChange={(e) => setTempSettings({ ...tempSettings, rentDueDay: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Payment Grace Period (Days)
              </label>
              <input
                type="number"
                min={0}
                max={15}
                value={tempSettings.gracePeriodDays}
                onChange={(e) => setTempSettings({ ...tempSettings, gracePeriodDays: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Default Rate per Unit (₹)
              </label>
              <input
                type="number"
                step="0.1"
                value={tempSettings.defaultElectricityRatePerUnit}
                onChange={(e) =>
                  setTempSettings({
                    ...tempSettings,
                    defaultElectricityRatePerUnit: Number(e.target.value),
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Electricity Calculation Model
              </label>
              <select
                value={tempSettings.electricityCalculationModel}
                onChange={(e) =>
                  setTempSettings({
                    ...tempSettings,
                    electricityCalculationModel: e.target.value as any,
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              >
                <option value="per_unit_submeter">Per Unit Submeter (Actuals)</option>
                <option value="fixed_surcharge">Fixed Monthly Surcharge</option>
                <option value="included_in_rent">Included in Base Rent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Maintenance SLA Target (Hours)
              </label>
              <input
                type="number"
                min={1}
                max={72}
                value={tempSettings.maintenanceSLATargetHours}
                onChange={(e) =>
                  setTempSettings({
                    ...tempSettings,
                    maintenanceSLATargetHours: Number(e.target.value),
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
