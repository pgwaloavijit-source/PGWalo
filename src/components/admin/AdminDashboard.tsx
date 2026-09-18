import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SuperAdminShell, AdminSection } from './SuperAdminShell';
import { AuthAnalyticsCard } from '../auth/AuthAnalyticsCard';
import {
  DateRangeKey,
  exportCsv,
  inDateRange,
  isPlatformAdmin,
  listingApprovalLabel,
  rangeBounds,
} from '../../utils/platformAdmin';
import { getAuthToken, isProductionApiEnabled } from '../../services/productionApi';
import {
  fetchAdminBookings,
  fetchAdminPayments,
  fetchAdminSupportTickets,
  fetchAdminUsers,
} from '../../services/adminApi';
import { canonicalBedStatus, canBedBeAssigned } from '../../domain/productionWorkflow';
import { BookingRequest, Payment, RolePermissions, SupportTicket, SupportTicketStatus, UserAccount } from '../../types';

type AdminPaymentRow = Payment & { resident_id?: string; transaction_reference?: string; submitted_at?: string };
const payRef = (p: AdminPaymentRow) => p.transactionReference || p.transaction_reference || p.id;
const payWhen = (p: AdminPaymentRow) => p.submittedAt || p.submitted_at || '';
const payResident = (p: AdminPaymentRow) => p.residentId || p.resident_id || '';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Save,
} from 'lucide-react';

const RANGE_OPTS: { id: DateRangeKey; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '3 Months' },
  { id: 'custom', label: 'Custom' },
];

const Card: React.FC<{ label: string; value: string | number; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs">
    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
    {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
  </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 bg-white">{text}</div>
);

const Pill: React.FC<{ tone?: string; children: React.ReactNode }> = ({ tone = 'bg-slate-100 text-slate-700', children }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${tone}`}>{children}</span>
);

export const AdminDashboard: React.FC = () => {
  const app = useApp();
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [range, setRange] = useState<DateRangeKey>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [detailUser, setDetailUser] = useState<UserAccount | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const { currentUser } = app;

  if (!currentUser || !isPlatformAdmin(currentUser.role)) {
    return (
      <div className="max-w-lg mx-auto mt-24 rounded-3xl bg-white border border-slate-200 p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
        <h1 className="text-xl font-black">Admin access required</h1>
        <p className="text-sm text-slate-500 mt-2">Sign in from Footer → Super Admin Login. This route is not available to other accounts.</p>
      </div>
    );
  }

  return (
    <SuperAdminShell section={section} onSection={setSection}>
      <AdminBody
        section={section}
        range={range}
        setRange={setRange}
        customFrom={customFrom}
        customTo={customTo}
        setCustomFrom={setCustomFrom}
        setCustomTo={setCustomTo}
        detailUser={detailUser}
        setDetailUser={setDetailUser}
        ticketId={ticketId}
        setTicketId={setTicketId}
        reply={reply}
        setReply={setReply}
        propertyId={propertyId}
        setPropertyId={setPropertyId}
      />
    </SuperAdminShell>
  );
};

const AdminBody: React.FC<{
  section: AdminSection;
  range: DateRangeKey;
  setRange: (v: DateRangeKey) => void;
  customFrom: string;
  customTo: string;
  setCustomFrom: (v: string) => void;
  setCustomTo: (v: string) => void;
  detailUser: UserAccount | null;
  setDetailUser: (u: UserAccount | null) => void;
  ticketId: string | null;
  setTicketId: (id: string | null) => void;
  reply: string;
  setReply: (v: string) => void;
  propertyId: string | null;
  setPropertyId: (id: string | null) => void;
}> = (props) => {
  const {
    users, properties, residents, beds, bookingRequests, agreements, payments,
    tickets, supportTickets, auditLogs, globalSearchQuery, settings, updateSettings,
    rolePermissions, updateRolePermissions, updateUserAccountStatus, setListingDecision,
    approveBookingRequest, rejectBookingRequest, updateSupportTicket, addSupportTicketReply,
    updateTicketStatus, currentUser, broadcasts, logAuditEvent, updateProperty, transferResidentBed,
  } = useApp();
  const q = globalSearchQuery.trim().toLowerCase();
  const bounds = rangeBounds(props.range, props.customFrom, props.customTo);
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bookingStatus, setBookingStatus] = useState('all');
  const [bookingPg, setBookingPg] = useState('all');
  const [payStatus, setPayStatus] = useState('all');
  const [payPg, setPayPg] = useState('all');
  const [overview, setOverview] = useState<Record<string, number> | null>(null);
  const [editDraft, setEditDraft] = useState({ name: '', tagline: '', description: '' });
  const [assignee, setAssignee] = useState('');
  const [overviewError, setOverviewError] = useState(false);
  // Live server data (null in demo mode -> local AppContext arrays are used)
  const [serverBookings, setServerBookings] = useState<BookingRequest[] | null>(null);
  const [serverPayments, setServerPayments] = useState<Payment[] | null>(null);
  const [serverTickets, setServerTickets] = useState<SupportTicket[] | null>(null);
  const [serverUsers, setServerUsers] = useState<UserAccount[] | null>(null);
  const [serverTotalUsers, setServerTotalUsers] = useState<number | null>(null);

  const live = isProductionApiEnabled() && Boolean(getAuthToken());

  const refreshOverview = useCallback(() => {
    if (!isProductionApiEnabled() || !getAuthToken()) return;
    fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${getAuthToken()}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (data && typeof data.users === 'number') {
          setOverview(data);
          setOverviewError(false);
        }
      })
      .catch(() => setOverviewError(true));
  }, []);

  useEffect(() => {
    refreshOverview();
  }, [refreshOverview]);

  const occupiedBeds = beds.filter((b) => ['Occupied', 'Notice Period'].includes(canonicalBedStatus(b.status)));
  const availableBeds = beds.filter((b) => ['Vacant', 'Available'].includes(canonicalBedStatus(b.status)));
  const owners = users.filter((u) => u.role === 'owner');
  const tenants = users.filter((u) => u.role === 'resident').length
    ? users.filter((u) => u.role === 'resident')
    : residents.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        role: 'resident' as const,
        avatar: r.avatar || '',
        createdAt: r.moveInDate,
        status: r.status === 'Active' ? 'Active' as const : 'Suspended' as const,
      }));

  const pendingListings = properties.filter((p) => listingApprovalLabel(p) === 'Pending');
  const pendingBookings = bookingRequests.filter((b) => b.status === 'Pending');
  const openSupport = supportTickets.filter((t) => t.status === 'Raised' || t.status === 'Open');
  const openMaint = tickets.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed');
  const pendingAgreements = [
    ...agreements.filter((a) => !a.ownerSigned || !a.tenantSigned || ['Draft', 'Sent', 'Under Verification'].includes(a.status)),
    ...residents.filter((r) => r.agreementState === 'Pending' || r.agreementState === 'Unknown'),
  ];
  const revenue = payments
    .filter((p) => ['Verified', 'Success', 'Paid'].includes(p.status))
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const pendingPay = payments.filter((p) => p.status === 'Pending');
  const failedPay = payments.filter((p) => ['Failed', 'Refunded', 'Rejected'].includes(p.status));

  const isoDay = (date: Date) => date.toISOString().split('T')[0];

  // Live server queries for the Bookings and Payments sections. In demo mode
  // (no API/token) these effects no-op and local arrays are rendered.
  useEffect(() => {
    if (!live || (props.section !== 'bookings' && props.section !== 'payments')) return;
    const query = {
      q: globalSearchQuery.trim() || undefined,
      from: props.range === 'custom' ? (props.customFrom || undefined) : isoDay(bounds.from),
      to: props.range === 'custom' ? (props.customTo || undefined) : isoDay(bounds.to),
    };
    let cancelled = false;
    if (props.section === 'bookings') {
      fetchAdminBookings({ ...query, propertyId: bookingPg, status: bookingStatus })
        .then((data) => { if (!cancelled) setServerBookings(data ? data.bookings : null); })
        .catch(() => { if (!cancelled) setServerBookings(null); });
    } else {
      fetchAdminPayments({ ...query, propertyId: payPg, status: payStatus })
        .then((data) => { if (!cancelled) setServerPayments(data ? (data.payments as Payment[]) : null); })
        .catch(() => { if (!cancelled) setServerPayments(null); });
    }
    return () => { cancelled = true; };
  }, [live, props.section, props.range, props.customFrom, props.customTo, bookingPg, bookingStatus, payPg, payStatus, globalSearchQuery, bounds.from, bounds.to]);

  // Live support tickets for the Tickets section (server list merges over local).
  useEffect(() => {
    if (!live || props.section !== 'tickets') return;
    let cancelled = false;
    fetchAdminSupportTickets({ q: globalSearchQuery.trim() || undefined })
      .then((data) => { if (!cancelled) setServerTickets(data); })
      .catch(() => { if (!cancelled) setServerTickets(null); });
    return () => { cancelled = true; };
  }, [live, props.section, globalSearchQuery, supportTickets.length]);

  // Live user directory for the Users/Owners/Tenants sections.
  useEffect(() => {
    if (!live) return;
    if (props.section !== 'users' && props.section !== 'owners' && props.section !== 'tenants') return;
    let cancelled = false;
    fetchAdminUsers({
      q: globalSearchQuery.trim() || undefined,
      role: props.section === 'owners' ? 'owner' : props.section === 'tenants' ? 'resident' : roleFilter,
      status: statusFilter,
      pageSize: 200,
    })
      .then((data) => {
        if (cancelled || !data) return;
        setServerUsers(data.users);
        setServerTotalUsers(data.total);
      })
      .catch(() => { if (!cancelled) setServerUsers(null); });
    return () => { cancelled = true; };
  }, [live, props.section, globalSearchQuery, roleFilter, statusFilter]);

  const RangeBar = (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {RANGE_OPTS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => props.setRange(opt.id)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold ${props.range === opt.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
        >
          {opt.label}
        </button>
      ))}
      {props.range === 'custom' && (
        <div className="flex gap-2">
          <input type="date" value={props.customFrom} onChange={(e) => props.setCustomFrom(e.target.value)} className="rounded-xl border border-slate-200 px-2 py-1 text-xs" />
          <input type="date" value={props.customTo} onChange={(e) => props.setCustomTo(e.target.value)} className="rounded-xl border border-slate-200 px-2 py-1 text-xs" />
        </div>
      )}
      {live && (
        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 rounded-full px-2 py-1">Live DB</span>
      )}
    </div>
  );

  if (props.section === 'dashboard') {
    const recentUsers = [...users].filter((u) => inDateRange(u.createdAt, bounds.from, bounds.to)).slice(0, 6);
    const recentBookings = [...bookingRequests].filter((b) => inDateRange(b.requestDate, bounds.from, bounds.to)).slice(0, 6);
    const recentTickets = [...supportTickets, ...tickets.map((t) => ({ id: t.id, title: t.title, createdAt: t.createdAt }))].slice(0, 6);
    const recentAudit = auditLogs.filter((l) => inDateRange(l.timestamp, bounds.from, bounds.to)).slice(0, 6);
    const usersR = users.filter((u) => inDateRange(u.createdAt, bounds.from, bounds.to));
    const ownersR = owners.filter((u) => inDateRange(u.createdAt, bounds.from, bounds.to));
    const tenantsR = tenants.filter((u) => inDateRange(u.createdAt, bounds.from, bounds.to));
    const pgsR = properties.filter((p) => inDateRange(p.publishedAt, bounds.from, bounds.to));
    const bookR = bookingRequests.filter((b) => inDateRange(b.requestDate, bounds.from, bounds.to));
    const payR = payments.filter((p) => inDateRange(p.submittedAt, bounds.from, bounds.to) && ['Verified', 'Success', 'Paid'].includes(p.status));
    const tixR = supportTickets.filter((t) => inDateRange(t.createdAt, bounds.from, bounds.to));
    return (
      <div className="space-y-6">
        {RangeBar}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <Card label="Total Users" value={overview?.users ?? users.length} hint={`${usersR.length} in range`} />
          <Card label="Owners" value={overview?.owners ?? owners.length} hint={`${ownersR.length} in range`} />
          <Card label="Tenants" value={overview?.tenants ?? tenants.length} hint={`${tenantsR.length} in range`} />
          <Card label="PGs" value={overview?.pgs ?? properties.length} hint={`${pgsR.length} created in range`} />
          <Card label="Rooms / Beds" value={overview?.rooms ?? (beds.length || properties.reduce((n, p) => n + (p.rooms?.reduce((a, r) => a + r.totalBeds, 0) || 0), 0))} />
          <Card label="Occupied" value={overview?.occupied ?? occupiedBeds.length} hint={`${overview?.available ?? availableBeds.length} available`} />
          <Card label="Pending approvals" value={(overview?.pendingListings ?? pendingListings.length) + pendingBookings.length} />
          <Card label="Active bookings" value={overview?.activeBookings ?? bookingRequests.filter((b) => b.status === 'Approved' || b.status === 'Pending').length} hint={`${bookR.length} in range`} />
          <Card label="Revenue" value={payments.length || overview?.revenue ? `₹${(overview?.revenue ?? revenue).toLocaleString('en-IN')}` : 'No payment rows'} hint={`${payR.length} verified in range`} />
          <Card label="Open tickets" value={overview?.openTickets ?? (openSupport.length + openMaint.length)} hint={`${tixR.length} raised in range`} />
          <Card label="Pending agreements" value={overview?.pendingAgreements ?? pendingAgreements.length} />
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          <ListPanel title="Recent registrations" rows={recentUsers.map((u) => `${u.name} · ${u.role}`)} empty="No registrations in range" />
          <ListPanel title="Recent bookings / allocations" rows={recentBookings.map((b) => `${b.applicantName} · ${b.propertyName} · ${b.status}`)} empty="No bookings in range" />
          <ListPanel title="Recent tickets" rows={recentTickets.map((t) => `${t.title || t.id}`)} empty="No tickets" />
          <ListPanel title="Recent admin actions" rows={recentAudit.map((a) => `${a.action} · ${a.entity}`)} empty="No admin actions in range" />
        </div>
        {overviewError && (
          <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
            Live overview endpoint unavailable — cards above fall back to locally loaded data.
          </p>
        )}
      </div>
    );
  }

  if (props.section === 'users' || props.section === 'owners' || props.section === 'tenants') {
    // Strict live mode: only server rows. Demo mode: local arrays.
    const source: UserAccount[] = serverUsers
      ? (props.section === 'tenants'
          ? serverUsers.filter((u) => u.role === 'resident' || u.role === 'public')
          : props.section === 'owners'
            ? serverUsers.filter((u) => u.role === 'owner')
            : serverUsers)
      : (props.section === 'owners' ? owners : props.section === 'tenants' ? tenants : users);
    const rows = source.filter((u) => {
      const matchQ = serverUsers ? true : (!q || [u.name, u.email, u.phone, u.role, u.status].join(' ').toLowerCase().includes(q));
      const matchRole = roleFilter === 'all' || props.section !== 'users' || u.role === roleFilter;
      const matchStatus = statusFilter === 'all' || (u.status || 'Active') === statusFilter;
      return matchQ && matchRole && matchStatus;
    });
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-xl border px-3 py-1.5 text-xs font-bold">
            <option value="all">All roles</option>
            <option value="owner">Owner</option>
            <option value="resident">Tenant</option>
            <option value="staff">Staff</option>
            <option value="public">Public</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border px-3 py-1.5 text-xs font-bold">
            <option value="all">All statuses</option>
            <option>Active</option>
            <option>Disabled</option>
            <option>Suspended</option>
          </select>
          {serverUsers && <span className="text-[10px] font-bold text-blue-700 bg-blue-50 rounded-full px-2 py-1 self-center">{serverTotalUsers ?? rows.length} accounts in DB</span>}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {rows.length === 0 ? <Empty text="No matching accounts." /> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                <tr>
                  <th className="p-3 text-left">User</th>
                  <th className="p-3 text-left">Contact</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold">{u.name}</td>
                    <td className="p-3 text-slate-600">{u.email || '—'}<div className="text-xs">{u.phone}</div></td>
                    <td className="p-3 capitalize">{u.role}</td>
                    <td className="p-3"><Pill>{u.status || 'Active'}</Pill></td>
                    <td className="p-3 text-right space-x-1">
                      <button type="button" className="text-xs font-bold text-blue-600" onClick={() => props.setDetailUser(u)}>Profile</button>
                      {(['Active', 'Disabled', 'Suspended'] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-900"
                          onClick={() => { updateUserAccountStatus(u.id, status); refreshOverview(); }}
                        >
                          {status}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {props.detailUser && (
          <UserDrawer
            user={props.detailUser}
            onClose={() => props.setDetailUser(null)}
            properties={properties.filter((p) => p.ownerUserId === props.detailUser?.id || p.ownerName === props.detailUser?.name)}
            bookings={bookingRequests.filter((b) => b.email === props.detailUser?.email || b.phone === props.detailUser?.phone)}
            tickets={supportTickets.filter((t) => t.requesterId === props.detailUser?.id)}
            agreements={agreements.filter((a) => a.residentName === props.detailUser?.name || a.ownerName === props.detailUser?.name)}
          />
        )}
      </div>
    );
  }

  if (props.section === 'properties') {
    const rows = properties.filter((p) => !q || [p.name, p.city, p.ownerName, p.locality].join(' ').toLowerCase().includes(q));
    const selected = properties.find((p) => p.id === props.propertyId);
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          {rows.length === 0 ? <Empty text="No properties in the current dataset." /> : (
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                <tr>
                  <th className="p-3 text-left">Property</th>
                  <th className="p-3 text-left">Owner</th>
                  <th className="p-3 text-left">Location</th>
                  <th className="p-3 text-left">Occupancy</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => {
                  const pBeds = beds.filter((b) => b.propertyId === p.id);
                  const occ = pBeds.filter((b) => canonicalBedStatus(b.status) === 'Occupied').length;
                  const label = listingApprovalLabel(p);
                  return (
                    <tr key={p.id}>
                      <td className="p-3 font-bold">{p.name}<div className="text-xs font-normal text-slate-500">₹{p.startingPrice.toLocaleString('en-IN')}</div></td>
                      <td className="p-3">{p.ownerName}</td>
                      <td className="p-3 text-slate-600">{p.locality}, {p.city}</td>
                      <td className="p-3">{pBeds.length ? `${occ}/${pBeds.length}` : p.rooms?.map((r) => `${r.availableBeds}/${r.totalBeds}`).join(', ') || '—'}</td>
                      <td className="p-3"><Pill tone={label === 'Approved' ? 'bg-emerald-50 text-emerald-700' : label === 'Pending' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}>{label}</Pill></td>
                      <td className="p-3 text-right space-x-2 whitespace-nowrap">
                        <button type="button" className="text-xs font-bold text-blue-600" onClick={() => props.setPropertyId(p.id)}>View</button>
                        <button type="button" className="text-xs font-bold text-emerald-700" onClick={() => { setListingDecision(p.id, 'approve'); refreshOverview(); }}>Approve</button>
                        <button type="button" className="text-xs font-bold text-amber-700" onClick={() => { setListingDecision(p.id, 'reject'); refreshOverview(); }}>Reject</button>
                        <button type="button" className="text-xs font-bold text-slate-500" onClick={() => { setListingDecision(p.id, 'disable'); refreshOverview(); }}>Disable</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {selected && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <div className="flex justify-between gap-3">
              <h3 className="font-black text-lg">{selected.name}</h3>
              <button type="button" className="text-xs font-bold text-slate-500" onClick={() => props.setPropertyId(null)}>Close</button>
            </div>
            <p className="text-sm text-slate-600">{selected.address}</p>
            <p className="text-sm">{selected.tagline}</p>
            <p className="text-xs text-slate-500">Amenities: {(selected.amenities || []).join(', ') || '—'}</p>
            <p className="text-xs text-slate-500">Rooms: {(selected.rooms || []).map((r) => `${r.type} ₹${r.rentPerMonth}`).join(' · ') || '—'}</p>
            <div className="grid sm:grid-cols-3 gap-2">
              <input className="rounded-xl border px-3 py-2 text-sm" value={editDraft.name || selected.name} onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))} />
              <input className="rounded-xl border px-3 py-2 text-sm" value={editDraft.tagline || selected.tagline || ''} onChange={(e) => setEditDraft((d) => ({ ...d, tagline: e.target.value }))} />
              <input className="rounded-xl border px-3 py-2 text-sm sm:col-span-1" placeholder="Description" value={editDraft.description || selected.description || ''} onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))} />
              <button type="button" className="text-xs font-bold bg-slate-900 text-white rounded-xl px-3" onClick={() => updateProperty(selected.id, { name: editDraft.name || selected.name, tagline: editDraft.tagline || selected.tagline, description: editDraft.description || selected.description })}>Save edit</button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[selected.coverImage, ...(selected.galleryImages || [])].filter(Boolean).slice(0, 6).map((src) => (
                <img key={src} src={src} alt="" className="h-20 w-full object-cover rounded-xl" />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (props.section === 'rooms') {
    type RoomGroup = { key: string; propertyId: string; roomNumber: string; type: string; beds: typeof beds };
    const map = new Map<string, RoomGroup>();
    beds.forEach((bed) => {
      const key = `${bed.propertyId}-${bed.roomNumber}`;
      const existing = map.get(key);
      if (existing) existing.beds.push(bed);
      else map.set(key, { key, propertyId: bed.propertyId, roomNumber: bed.roomNumber, type: bed.sharingType, beds: [bed] });
    });
    const grouped = Array.from(map.values()).filter((g) => !q || g.roomNumber.toLowerCase().includes(q) || (properties.find((p) => p.id === g.propertyId)?.name || '').toLowerCase().includes(q));
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          {grouped.length === 0 ? <Empty text="No room inventory in current data." /> : (
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                <tr>
                  <th className="p-3 text-left">PG</th>
                  <th className="p-3 text-left">Room</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">Capacity</th>
                  <th className="p-3 text-left">Occupants</th>
                  <th className="p-3 text-left">Open beds</th>
                  <th className="p-3 text-left">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grouped.map((g) => {
                  const pg = properties.find((p) => p.id === g.propertyId);
                  const occ = g.beds.filter((b) => canonicalBedStatus(b.status) === 'Occupied');
                  const open = g.beds.filter((b) => canBedBeAssigned(b));
                  return (
                    <tr key={g.key}>
                      <td className="p-3 font-bold">{pg?.name || g.propertyId}</td>
                      <td className="p-3">{g.roomNumber}</td>
                      <td className="p-3">{g.type}</td>
                      <td className="p-3">{g.beds.length}</td>
                      <td className="p-3 text-xs">{occ.map((b) => b.currentTenantName || b.bedNumber).join(', ') || '—'}</td>
                      <td className="p-3">{open.length}</td>
                      <td className="p-3">₹{(g.beds[0]?.monthlyRent || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <h3 className="font-bold text-slate-900">Allocation queue</h3>
        <div className="bg-white rounded-2xl border border-slate-200 divide-y">
          {pendingBookings.length === 0 ? <Empty text="No pending allocation requests." /> : pendingBookings.map((req) => {
            const pgBeds = beds.filter((b) => b.propertyId === req.propertyId && canBedBeAssigned(b));
            const conflict = pgBeds.length === 0;
            return (
              <div key={req.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{req.applicantName} → {req.propertyName}</p>
                  <p className="text-xs text-slate-500">{req.roomType} · {req.preferredMoveInDate} · {req.status}</p>
                  {conflict && <p className="text-xs text-rose-600 font-bold mt-1">No vacant bed matches capacity rules.</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={conflict}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-40"
                    onClick={() => approveBookingRequest(req.id)}
                  >
                    Approve
                  </button>
                  <button type="button" className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold" onClick={() => rejectBookingRequest(req.id)}>Reject</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (props.section === 'bookings') {
    // Live mode: server already applied q/status/PG/date filters.
    const rows = (serverBookings ?? bookingRequests).filter((b) =>
      serverBookings ? true : (!q || [b.applicantName, b.propertyName, b.status, b.email].join(' ').toLowerCase().includes(q))
    );
    return (
      <div className="space-y-4">
        {RangeBar}
        <div className="flex flex-wrap gap-2">
          <select value={bookingStatus} onChange={(e) => setBookingStatus(e.target.value)} className="rounded-xl border px-3 py-1.5 text-xs font-bold">
            <option value="all">All statuses</option>
            <option>Pending</option>
            <option>Approved</option>
            <option>Rejected</option>
            <option>Cancelled</option>
          </select>
          <select value={bookingPg} onChange={(e) => setBookingPg(e.target.value)} className="rounded-xl border px-3 py-1.5 text-xs font-bold">
            <option value="all">All PGs</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {serverBookings && <span className="text-[10px] font-bold text-blue-700 bg-blue-50 rounded-full px-2 py-1 self-center">{rows.length} from DB</span>}
        </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        {rows.length === 0 ? <Empty text="No bookings." /> : (
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
              <tr>
                <th className="p-3 text-left">Tenant</th>
                <th className="p-3 text-left">Property / room</th>
                <th className="p-3 text-left">Dates</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Related</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((b) => (
                <tr key={b.id}>
                  <td className="p-3 font-bold">{b.applicantName}<div className="text-xs font-normal">{b.phone}</div></td>
                  <td className="p-3">{b.propertyName}<div className="text-xs">{b.allocatedRoomNumber || b.roomType}</div></td>
                  <td className="p-3 text-xs">{b.requestDate} → {b.preferredMoveInDate}</td>
                  <td className="p-3"><Pill>{b.status}</Pill></td>
                  <td className="p-3 text-xs text-slate-500">
                    Agr {agreements.filter((a) => a.propertyId === b.propertyId && a.residentName === b.applicantName).length}
                    {' · '}Pay {payments.filter((p) => p.propertyId === b.propertyId).length}
                    {' · '}Tix {supportTickets.filter((t) => t.propertyId === b.propertyId).length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>
    );
  }

  if (props.section === 'agreements') {
    const rows = agreements.filter((a) => !q || [a.residentName, a.ownerName, a.propertyName, a.status].join(' ').toLowerCase().includes(q));
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        {rows.length === 0 ? <Empty text="No agreement records." /> : (
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
              <tr>
                <th className="p-3 text-left">Agreement</th>
                <th className="p-3 text-left">Owner / Tenant</th>
                <th className="p-3 text-left">Property / room</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="p-3 font-mono text-xs">{a.agreementNumber}</td>
                  <td className="p-3">{a.ownerName} / {a.tenantName || a.residentName}</td>
                  <td className="p-3">{a.propertyName} · {a.roomNumber}</td>
                  <td className="p-3"><Pill>{a.status}</Pill></td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      className="text-xs font-bold text-blue-600"
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(a, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${a.agreementNumber}.json`;
                        link.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  if (props.section === 'payments') {
    const source = (serverPayments ?? payments) as AdminPaymentRow[];
    const rows = source.filter((p) =>
      serverPayments ? true : (!q || [p.status, p.method, payRef(p), payResident(p)].join(' ').toLowerCase().includes(q))
    );
    const revenueSource = source.filter((p) => ['Verified', 'Success', 'Paid'].includes(p.status));
    const sectionRevenue = revenueSource.reduce((sum, p) => sum + (p.amount || 0), 0);
    return (
      <div className="space-y-4">
        {RangeBar}
        <div className="flex flex-wrap gap-2">
          <select value={payStatus} onChange={(e) => setPayStatus(e.target.value)} className="rounded-xl border px-3 py-1.5 text-xs font-bold">
            <option value="all">All statuses</option>
            <option>Pending</option>
            <option>Verified</option>
            <option>Success</option>
            <option>Paid</option>
            <option>Failed</option>
            <option>Refunded</option>
            <option>Rejected</option>
          </select>
          <select value={payPg} onChange={(e) => setPayPg(e.target.value)} className="rounded-xl border px-3 py-1.5 text-xs font-bold">
            <option value="all">All PGs</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {serverPayments && <span className="text-[10px] font-bold text-blue-700 bg-blue-50 rounded-full px-2 py-1 self-center">{rows.length} from DB</span>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card label="Transactions" value={source.length} />
          <Card label="Revenue (filtered)" value={source.length ? `₹${sectionRevenue.toLocaleString('en-IN')}` : '—'} />
          <Card label="Pending" value={source.filter((p) => p.status === 'Pending').length} />
          <Card label="Failed / refunded" value={source.filter((p) => ['Failed', 'Refunded', 'Rejected'].includes(p.status)).length} />
        </div>
        {source.length === 0 ? (
          <Empty text="Payment tables exist, but there is no stored financial data yet. This screen will fill from live payment rows." />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                <tr>
                  <th className="p-3 text-left">Txn</th>
                  <th className="p-3 text-left">Amount</th>
                  <th className="p-3 text-left">Method</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3 font-mono text-xs">{payRef(p as AdminPaymentRow)}</td>
                    <td className="p-3 font-bold">₹{(p.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="p-3">{p.method}</td>
                    <td className="p-3"><Pill>{p.status}</Pill></td>
                    <td className="p-3 text-xs">{payWhen(p as AdminPaymentRow)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (props.section === 'tickets') {
    // Live mode: server list (includes tickets raised from any browser) merged
    // over the local cache by id.
    const mergedTickets = serverTickets
      ? Array.from(
          new Map([...supportTickets, ...serverTickets].map((t) => [t.id, t])).values()
        )
      : supportTickets;
    const selected = mergedTickets.find((t) => t.id === props.ticketId);
    const rows = [...mergedTickets].filter((t) => !q || [t.title, t.type, t.status, t.requesterName].join(' ').toLowerCase().includes(q));
    return (
      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {rows.length === 0 ? <Empty text="No support tickets. Users can raise them from Support." /> : rows.map((t) => (
            <button key={t.id} type="button" onClick={() => props.setTicketId(t.id)} className={`w-full text-left p-4 border-b border-slate-100 ${props.ticketId === t.id ? 'bg-blue-50' : ''}`}>
              <div className="flex justify-between gap-2">
                <p className="font-bold text-sm">{t.title}</p>
                {t.type === 'Reactivation' && t.status !== 'Resolved' && t.status !== 'Closed' ? (
                  <Pill tone="bg-amber-100 text-amber-800">Reactivation</Pill>
                ) : (
                  <Pill>{t.status}</Pill>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">{t.type} · {t.requesterName} · {new Date(t.createdAt).toLocaleString()}</p>
            </button>
          ))}
          <div className="p-3 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-500 mb-2">Maintenance tickets</p>
            {tickets.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span>{t.title} · {t.residentName}</span>
                <select value={t.status} onChange={(e) => updateTicketStatus(t.id, e.target.value as typeof t.status)} className="text-xs border rounded-lg px-2 py-1">
                  <option>Reported</option><option>In-Progress</option><option>Resolved</option><option>Closed</option>
                </select>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          {!selected ? <p className="text-sm text-slate-500">Select a support ticket.</p> : (
            <>
              <h3 className="font-black">{selected.title}</h3>
              <p className="text-sm text-slate-600">{selected.description}</p>
              {selected.imageUrl && <img src={selected.imageUrl} alt="" className="rounded-xl max-h-40 object-cover" />}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(selected.messages || []).map((m) => (
                  <div key={m.id} className="rounded-xl bg-slate-50 p-2 text-xs">
                    <p className="font-bold">{m.authorName}</p>
                    <p>{m.body}</p>
                  </div>
                ))}
              </div>
              <select
                value={selected.status}
                onChange={(e) => updateSupportTicket(selected.id, e.target.value as SupportTicketStatus, selected.adminNote, currentUser?.name)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option>Raised</option><option>Open</option><option>Resolved</option><option>Closed</option>
              </select>
              <textarea value={props.reply} onChange={(e) => props.setReply(e.target.value)} placeholder="Reply to the user" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={3} />
              <button
                type="button"
                className="w-full rounded-xl bg-blue-600 text-white py-2 text-sm font-bold"
                onClick={() => { addSupportTicketReply(selected.id, props.reply); props.setReply(''); }}
              >
                Send response
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (props.section === 'reports') {
    const occupancy = beds.length ? Math.round((occupiedBeds.length / beds.length) * 100) : 0;
    return (
      <div className="space-y-4">
        {RangeBar}
        <div className="flex justify-end">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-3 py-2 text-xs font-bold"
            onClick={() => exportCsv('pgwalo-admin-report.csv', [
              { metric: 'Users', value: users.filter((u) => inDateRange(u.createdAt, bounds.from, bounds.to)).length },
              { metric: 'Owners', value: owners.filter((u) => inDateRange(u.createdAt, bounds.from, bounds.to)).length },
              { metric: 'PGs', value: properties.length },
              { metric: 'Occupancy %', value: occupancy },
              { metric: 'Bookings', value: bookingRequests.filter((b) => inDateRange(b.requestDate, bounds.from, bounds.to)).length },
              { metric: 'Tickets', value: supportTickets.filter((t) => inDateRange(t.createdAt, bounds.from, bounds.to)).length },
              { metric: 'Disabled accounts', value: users.filter((u) => u.status === 'Disabled' || u.status === 'Suspended').length },
            ])}
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Card label="User registrations (range)" value={users.filter((u) => inDateRange(u.createdAt, bounds.from, bounds.to)).length} />
          <Card label="Owner registrations" value={owners.filter((u) => inDateRange(u.createdAt, bounds.from, bounds.to)).length} />
          <Card label="Listing count" value={properties.length} />
          <Card label="Occupancy" value={`${occupancy}%`} />
          <Card label="Available beds" value={availableBeds.length} />
          <Card label="Booking volume" value={bookingRequests.filter((b) => inDateRange(b.requestDate, bounds.from, bounds.to)).length} />
          <Card label="Agreement completion" value={`${agreements.filter((a) => a.ownerSigned && a.tenantSigned).length}/${agreements.length || 0}`} />
          <Card label="Disabled / suspended" value={users.filter((u) => u.status === 'Disabled' || u.status === 'Suspended').length} />
          <Card label="Ticket volume" value={supportTickets.filter((t) => inDateRange(t.createdAt, bounds.from, bounds.to)).length + tickets.length} />
        </div>
      </div>
    );
  }

  if (props.section === 'analytics') {
    const cityCounts: Record<string, number> = {};
    properties.forEach((p) => {
      const city = p.city || 'Unknown';
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    });
    const byCity = Object.entries(cityCounts);
    const maxCity = Math.max(1, ...byCity.map((entry) => entry[1]));
    const occupancy = beds.length ? Math.round((occupiedBeds.length / beds.length) * 100) : 0;
    const ticketSplit = ['Raised', 'Open', 'Resolved', 'Closed'].map((status) => ({
      status,
      n: supportTickets.filter((t) => t.status === status).length,
    }));
    return (
      <div className="space-y-4">
        {RangeBar}
        <div className="grid md:grid-cols-4 gap-3">
          <Card label="User growth (range)" value={users.filter((u) => inDateRange(u.createdAt, bounds.from, bounds.to)).length} />
          <Card label="Owner growth" value={owners.filter((u) => inDateRange(u.createdAt, bounds.from, bounds.to)).length} />
          <Card label="Occupancy" value={`${occupancy}%`} />
          <Card label="Bookings in range" value={bookingRequests.filter((b) => inDateRange(b.requestDate, bounds.from, bounds.to)).length} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="font-bold mb-3">Properties by city</h3>
            {byCity.length === 0 ? <p className="text-sm text-slate-500">No location data.</p> : byCity.map(([city, n]) => (
              <div key={city} className="mb-2">
                <div className="flex justify-between text-xs font-bold"><span>{city}</span><span>{n}</span></div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600" style={{ width: `${(n / maxCity) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="font-bold mb-3">Ticket status</h3>
            {ticketSplit.map((row) => (
              <div key={row.status} className="flex justify-between text-sm py-1 border-b border-slate-50"><span>{row.status}</span><span className="font-bold">{row.n}</span></div>
            ))}
            <div className="mt-4">
              <AuthAnalyticsCard compact />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (props.section === 'notifications') {
    const items = [
      ...owners.slice(-5).map((o) => ({ id: `own-${o.id}`, text: `New owner: ${o.name}`, at: o.createdAt })),
      ...pendingListings.map((p) => ({ id: `pg-${p.id}`, text: `Listing awaiting approval: ${p.name}`, at: '' })),
      ...pendingBookings.map((b) => ({ id: `bk-${b.id}`, text: `Allocation request: ${b.applicantName} · ${b.propertyName}`, at: b.requestDate })),
      ...openSupport.map((t) => ({ id: t.id, text: `Ticket: ${t.title}`, at: t.createdAt })),
      ...pendingPay.map((p) => ({ id: p.id, text: `Payment pending ₹${p.amount}`, at: p.submittedAt })),
      ...pendingAgreements.slice(0, 8).map((a, i) => ({ id: `ag-${i}`, text: 'agreementNumber' in a ? `Agreement pending: ${a.agreementNumber}` : `Resident agreement pending: ${(a as { name?: string }).name}`, at: '' })),
      ...broadcasts.slice(0, 8).map((b) => ({ id: b.id, text: b.title, at: b.timestamp })),
    ];
    return (
      <div className="space-y-2">
        {items.length === 0 ? <Empty text="No operational alerts right now." /> : items.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="font-bold text-sm">{item.text}</p>
            {item.at && <p className="text-xs text-slate-500 mt-1">{item.at}</p>}
          </div>
        ))}
      </div>
    );
  }

  if (props.section === 'audit') {
    const rows = auditLogs.filter((l) => !q || [l.action, l.entity, l.userName, l.details].join(' ').toLowerCase().includes(q));
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        {rows.length === 0 ? <Empty text="No audit events stored yet." /> : (
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
              <tr>
                <th className="p-3 text-left">When</th>
                <th className="p-3 text-left">Admin</th>
                <th className="p-3 text-left">Action</th>
                <th className="p-3 text-left">Target</th>
                <th className="p-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="p-3 text-xs whitespace-nowrap">{l.timestamp}</td>
                  <td className="p-3">{l.userName} <span className="text-xs text-slate-400">{l.userRole}</span></td>
                  <td className="p-3 font-bold">{l.action}</td>
                  <td className="p-3">{l.entity}</td>
                  <td className="p-3 text-slate-600 text-xs">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <SettingsPanel
      settings={settings}
      updateSettings={updateSettings}
      rolePermissions={rolePermissions}
      updateRolePermissions={updateRolePermissions}
      currentUser={currentUser}
      logAuditEvent={logAuditEvent}
    />
  );
};

const ListPanel: React.FC<{ title: string; rows: string[]; empty: string }> = ({ title, rows, empty }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-4">
    <h3 className="font-bold text-sm mb-3">{title}</h3>
    {rows.length === 0 ? <p className="text-xs text-slate-500">{empty}</p> : (
      <ul className="space-y-2 text-sm text-slate-700">
        {rows.map((row) => <li key={row} className="border-b border-slate-50 pb-2 last:border-0">{row}</li>)}
      </ul>
    )}
  </div>
);

const UserDrawer: React.FC<{
  user: UserAccount;
  onClose: () => void;
  properties: { id: string; name: string }[];
  bookings: { id: string; propertyName: string; status: string }[];
  tickets: { id: string; title: string; status: string }[];
  agreements: { id: string; agreementNumber: string; status: string }[];
}> = ({ user, onClose, properties, bookings, tickets, agreements }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
    <div className="flex justify-between">
      <div>
        <h3 className="font-black text-lg">{user.name}</h3>
        <p className="text-sm text-slate-500">{user.email} · {user.phone}</p>
      </div>
      <button type="button" className="text-xs font-bold text-slate-500" onClick={onClose}>Close</button>
    </div>
    <p className="text-sm">Role <b className="capitalize">{user.role}</b> · Status <b>{user.status || 'Active'}</b> · Joined {user.createdAt}</p>
    <p className="text-xs text-slate-500">Related PGs: {properties.map((p) => p.name).join(', ') || 'None'}</p>
    <p className="text-xs text-slate-500">Bookings: {bookings.map((b) => `${b.propertyName} (${b.status})`).join(', ') || 'None'}</p>
    <p className="text-xs text-slate-500">Tickets: {tickets.map((t) => `${t.title} (${t.status})`).join(', ') || 'None'}</p>
    <p className="text-xs text-slate-500">Agreements: {agreements.map((a) => `${a.agreementNumber} (${a.status})`).join(', ') || 'None'}</p>
  </div>
);

const SettingsPanel: React.FC<{
  settings: ReturnType<typeof useApp>['settings'];
  updateSettings: ReturnType<typeof useApp>['updateSettings'];
  rolePermissions: Record<string, RolePermissions>;
  updateRolePermissions: ReturnType<typeof useApp>['updateRolePermissions'];
  currentUser: UserAccount | null;
  logAuditEvent: ReturnType<typeof useApp>['logAuditEvent'];
}> = ({ settings, updateSettings, rolePermissions, updateRolePermissions, currentUser, logAuditEvent }) => {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState(settings);
  return (
    <div className="space-y-6">
      <form
        className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          updateSettings(form);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }}
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-black">Application settings</h3>
            <p className="text-xs text-slate-500">Existing billing and SLA configuration. Secrets stay on the Worker.</p>
          </div>
          <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-xs font-bold"><Save className="w-4 h-4" /> Save</button>
        </div>
        {saved && <p className="text-xs font-bold text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Saved and written to the audit log.</p>}
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-xs font-bold">Currency<input className="mt-1 w-full rounded-xl border px-3 py-2" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></label>
          <label className="text-xs font-bold">Rent due day<input type="number" className="mt-1 w-full rounded-xl border px-3 py-2" value={form.rentDueDay} onChange={(e) => setForm({ ...form, rentDueDay: Number(e.target.value) })} /></label>
          <label className="text-xs font-bold">Grace days<input type="number" className="mt-1 w-full rounded-xl border px-3 py-2" value={form.lateFeeGraceDays} onChange={(e) => setForm({ ...form, lateFeeGraceDays: Number(e.target.value) })} /></label>
          <label className="text-xs font-bold">Electricity rate<input type="number" className="mt-1 w-full rounded-xl border px-3 py-2" value={form.defaultElectricityRate} onChange={(e) => setForm({ ...form, defaultElectricityRate: Number(e.target.value) })} /></label>
          <label className="text-xs font-bold">Billing model
            <select className="mt-1 w-full rounded-xl border px-3 py-2" value={form.electricityBillingModel} onChange={(e) => setForm({ ...form, electricityBillingModel: e.target.value as typeof form.electricityBillingModel })}>
              <option>Included</option><option>Fixed</option><option>Per-Unit</option><option>Room-Level</option><option>Property-Distributed</option>
            </select>
          </label>
        </div>
      </form>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h3 className="font-black">Admin profile</h3>
        <p className="text-sm">{currentUser?.name} · {currentUser?.role}</p>
        <p className="text-xs text-slate-500">Phone/username credentials are stored as Worker secrets (`SUPERADMIN_*`), not in the client bundle.</p>
        <p className="text-xs text-slate-500">Sessions use JWT (24h). Expired tokens return you to public login.</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-black mb-3">Role permissions</h3>
        <p className="text-xs text-slate-500 mb-3">Toggle report export for staff roles. Super Admin always retains full access.</p>
        {Object.keys(rolePermissions).map((roleName) => (
          <label key={roleName} className="flex items-center justify-between py-2 border-b border-slate-50 text-sm">
            <span className="capitalize font-semibold">{roleName}</span>
            <input
              type="checkbox"
              checked={Boolean(rolePermissions[roleName]?.reports?.view)}
              onChange={() => {
                const current = rolePermissions[roleName];
                if (!current) return;
                updateRolePermissions(roleName, {
                  ...current,
                  reports: { ...current.reports, view: !current.reports.view },
                });
                logAuditEvent('RBAC toggle', roleName, 'reports.view');
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
};
