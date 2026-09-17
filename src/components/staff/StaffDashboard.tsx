import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserAvatar } from '../common/UserAvatar';
import { MaintenanceTicket } from '../../types';
import {
  ShieldCheck,
  Clock,
  Wrench,
  Utensils,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Plus,
  Search,
  Bell,
  Check,
  Sparkles,
  Users,
  Phone,
  ArrowRight,
  User,
} from 'lucide-react';

export const StaffDashboard: React.FC = () => {
  const {
    currentUser,
    staff,
    currentStaff,
    setCurrentStaffId,
    toggleStaffClockIn,
    attendance,
    recordAttendance,
    tickets,
    updateTicketStatus,
    residents,
    mealPlan,
    properties,
    addBroadcast,
  } = useApp();

  const workplace = properties.find((p) => p.id === currentStaff?.propertyId);
  const team = staff.filter((s) => currentStaff && s.propertyId === currentStaff.propertyId);
  const siteResidents = residents.filter((r) => currentStaff && r.propertyId === currentStaff.propertyId);

  const [activeTab, setActiveTab] = useState<'tasks' | 'attendance' | 'checklist' | 'visitors' | 'team'>('tasks');
  const [isCheckedIn, setIsCheckedIn] = useState(currentStaff?.todayStatus === 'Checked-In');

  // Manual Gate Log Entry state
  const [showLogModal, setShowLogModal] = useState(false);
  const [logResidentName, setLogResidentName] = useState('');
  const [logType, setLogType] = useState<'Check-In' | 'Check-Out'>('Check-In');
  const [logNotes, setLogNotes] = useState('');
  const [residentNotice, setResidentNotice] = useState('');

  // Visitor Log state
  const [visitors, setVisitors] = useState<{
    id: string;
    visitorName: string;
    residentVisited: string;
    room: string;
    purpose: string;
    entryTime: string;
    exitTime: string;
    status: string;
  }[]>([]);
  const [newVisitorName, setNewVisitorName] = useState('');
  const [newVisitorRes, setNewVisitorRes] = useState('');
  const [newVisitorPurpose, setNewVisitorPurpose] = useState('');

  // Daily Tasks Checklist
  const [checklist, setChecklist] = useState([
    { id: 1, task: 'Morning Breakfast mess served (Poha & boiled eggs)', done: true },
    { id: 2, task: 'RO drinking water TDS and chlorine inspection', done: true },
    { id: 3, task: 'Floor 1 & Floor 2 corridor mop and dusting', done: true },
    { id: 4, task: 'Solar heater temperature check', done: false },
    { id: 5, task: 'Washing machine lint trap sanitization', done: false },
    { id: 6, task: 'Evening gate register inspection & biometric sync', done: false },
  ]);

  const toggleChecklistItem = (id: number) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  const handleManualGateLog = (e: React.FormEvent) => {
    e.preventDefault();
    const res = siteResidents.find((r) => r.name === logResidentName);
    recordAttendance({
      personId: res?.id || 'manual',
      personName: logResidentName,
      personType: 'Resident',
      roomNumber: res?.roomNumber || '204',
      type: logType,
      status: 'On-Time',
      notes: logNotes || `Logged by ${currentStaff.name}`,
    });
    setShowLogModal(false);
    setLogNotes('');
  };

  const handleAddVisitor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVisitorName) return;
    setVisitors([
      {
        id: `v-${Date.now()}`,
        visitorName: newVisitorName,
        residentVisited: newVisitorRes || siteResidents[0]?.name || 'Resident',
        room: '204',
        purpose: newVisitorPurpose || 'Social',
        entryTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        exitTime: '-',
        status: 'Inside',
      },
      ...visitors,
    ]);
    setNewVisitorName('');
    setNewVisitorRes('');
    setNewVisitorPurpose('');
  };

  const handleSendResidentNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!residentNotice.trim() || !workplace) return;
    addBroadcast({
      title: `Notice from ${currentStaff.name}`,
      message: residentNotice.trim(),
      category: 'Event',
      target: 'All Residents',
      propertyId: workplace.id,
      propertyName: workplace.name,
      sender: `${currentStaff.name} (${currentStaff.role})`,
    });
    setResidentNotice('');
  };

  if (!currentStaff) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-2">
          <h1 className="text-lg font-black text-slate-900">No PG assignment yet</h1>
          <p className="text-xs text-slate-500">
            Ask the property owner to add you as staff and assign a listed PG. Then sign in with the mobile and PIN they shared.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Staff Header */}
      <div className="bg-white border-b border-blue-100 py-6 px-4 sm:px-6 lg:px-8 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <UserAvatar name={currentStaff.name} src={currentStaff.avatar} sizeClass="w-14 h-14 text-base" className="border-2 border-blue-600" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900">{currentStaff.name}</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  {currentStaff.role}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                <span>{workplace?.name || 'Assigned PG'} · Shift: {currentStaff.shift}</span>
              </div>
              {currentUser?.isDemo && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[11px] text-slate-500 font-semibold">Switch Staff Persona:</span>
                <div className="flex items-center gap-1">
                  {team.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setCurrentStaffId(s.id);
                        setIsCheckedIn(s.todayStatus === 'Checked-In');
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                        currentStaff.id === s.id
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title={`${s.name} (${s.role})`}
                    >
                      {s.name.split(' ')[0]} ({s.role.split(' ')[0]})
                    </button>
                  ))}
                </div>
              </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const nextState = !isCheckedIn;
                setIsCheckedIn(nextState);
                toggleStaffClockIn(currentStaff.id);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 ${
                isCheckedIn
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${isCheckedIn ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span>{isCheckedIn ? 'Staff Shift Active (Clocked In)' : 'Clock In for Shift'}</span>
            </button>

            <button
              id="staff-log-gate-movement-btn"
              onClick={() => setShowLogModal(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Resident Movement</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <form onSubmit={handleSendResidentNotice} className="mb-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row gap-2">
          <input
            value={residentNotice}
            onChange={(e) => setResidentNotice(e.target.value)}
            placeholder={`Send notice to ${workplace?.name || 'assigned PG'} residents`}
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
          />
          <button
            type="submit"
            disabled={!residentNotice.trim()}
            className="px-4 py-2 rounded-xl bg-blue-600 disabled:bg-slate-300 text-white text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Bell className="w-3.5 h-3.5" />
            Send to residents
          </button>
        </form>
        <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-2xs grid grid-cols-2 sm:grid-cols-5 gap-1 mb-6 text-xs font-bold">
          {[
            { key: 'tasks', label: `Maintenance Tasks (${tickets.length})`, icon: Wrench },
            { key: 'attendance', label: 'Gate Movements & Attendance', icon: Clock },
            { key: 'checklist', label: 'Daily Cleaning & Ops Checklist', icon: CheckCircle2 },
            { key: 'visitors', label: 'Visitor Pass Register', icon: UserCheck },
            { key: 'team', label: `Staff Team & Roster (${team.length})`, icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition ${
                  activeTab === tab.key
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: MAINTENANCE TASKS */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Assigned Work Orders & Tickets</h2>
                <p className="text-xs text-slate-500">
                  Update tickets as you inspect rooms and complete repairs
                </p>
              </div>
            </div>

            {/* Active first, then resolved — newest on top within each group. */}
            {(() => {
              const rank = (s: MaintenanceTicket['status']) =>
                s === 'Reported' ? 0 : s === 'In-Progress' ? 1 : s === 'Resolved' ? 2 : 3;
              const priorityRank = (p: string) =>
                p === 'Emergency' ? 0 : p === 'Urgent' ? 1 : p === 'High' ? 2 : 3;
              const sorted = [...tickets].sort(
                (a, b) =>
                  rank(a.status) - rank(b.status) ||
                  priorityRank(a.priority) - priorityRank(b.priority) ||
                  String(b.createdAt).localeCompare(String(a.createdAt))
              );

              const slaInfo = (t: MaintenanceTicket): { label: string; cls: string } | null => {
                if (t.status === 'Resolved' || t.status === 'Closed' || !t.slaDeadline) return null;
                const ms = new Date(t.slaDeadline).getTime() - Date.now();
                if (ms <= 0) return { label: `Overdue ${Math.floor(-ms / 3_600_000)}h`, cls: 'bg-red-600 text-white' };
                const h = Math.floor(ms / 3_600_000);
                const m = Math.floor((ms % 3_600_000) / 60_000);
                const label = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h left` : h >= 1 ? `${h}h ${m}m left` : `${m}m left`;
                return h < 2
                  ? { label: `Due in ${label}`, cls: 'bg-amber-500 text-white' }
                  : { label: `Fix by ${new Date(t.slaDeadline).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, cls: 'bg-slate-100 text-slate-600' };
              };

              if (sorted.length === 0) {
                return (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
                    <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-500">No maintenance tickets yet</p>
                    <p className="text-xs text-slate-400 mt-1">
                      When a resident raises a complaint, it appears here instantly and you get a notification.
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sorted.map((t) => (
                <div
                  key={t.id}
                  className={`bg-white rounded-2xl border p-5 shadow-2xs space-y-3 ${
                    t.priority === 'Emergency' ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          Room {t.roomNumber} • {t.category}
                        </span>
                        {(t.priority === 'Emergency' || t.priority === 'Urgent') && (
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              t.priority === 'Emergency'
                                ? 'bg-red-600 text-white'
                                : 'bg-amber-600 text-white'
                            }`}
                          >
                            {t.priority}
                          </span>
                        )}
                        {(() => {
                          const sla = slaInfo(t);
                          if (!sla) return null;
                          return (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${sla.cls}`}>
                              {t.escalatedAt ? '⚠ Escalated · ' : ''}{sla.label}
                            </span>
                          );
                        })()}
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-sm mt-1">{t.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
                      {t.photoUrl && (
                        <a href={t.photoUrl} target="_blank" rel="noreferrer" className="block mt-2">
                          <img src={t.photoUrl} alt="Complaint photo" className="h-24 rounded-lg border border-slate-200 object-cover" />
                        </a>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 ${
                        t.status === 'Resolved' || t.status === 'Closed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : t.status === 'In-Progress'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>

                  {(t.assignedStaffName || t.resolutionNotes) && (
                    <div className="text-[11px] space-y-0.5">
                      {t.assignedStaffName && (
                        <p className="text-slate-500">
                          <span className="font-bold">Assigned:</span> {t.assignedStaffName}
                        </p>
                      )}
                      {t.resolutionNotes && (
                        <p className="text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1">
                          <span className="font-bold">Notes:</span> {t.resolutionNotes}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                    <span className="text-slate-400 text-[11px]">By: {t.residentName} ({new Date(t.createdAt).toLocaleDateString()})</span>
                    <div className="flex items-center gap-2">
                      {t.status === 'Reported' && (
                        <button
                          onClick={() => updateTicketStatus(t.id, 'In-Progress', { assignedStaffName: currentStaff?.name || currentUser?.name })}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold text-[11px]"
                        >
                          Start Work
                        </button>
                      )}
                      {t.status === 'In-Progress' && (
                        <button
                          onClick={() => {
                            const notes = window.prompt('Resolution notes (visible to the resident):', t.resolutionNotes || '');
                            if (notes === null) return;
                            updateTicketStatus(t.id, 'Resolved', { resolutionNotes: notes.trim() });
                          }}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-2xs"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 2: ATTENDANCE & MOVEMENTS */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Security Gate Log & Biometric Sync</h2>
                <p className="text-xs text-slate-500">Live feed from the main entrance gate</p>
              </div>
              <button
                onClick={() => setShowLogModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold"
              >
                + Log Entry/Exit
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Person</th>
                    <th className="py-3 px-4">Role / Room</th>
                    <th className="py-3 px-4">Movement</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendance.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-900">{a.personName}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {a.roomNumber ? `Room ${a.roomNumber}` : a.role}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            a.type === 'Check-In' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {a.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-600 text-[11px]">{a.status}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{a.timestamp}</td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">{a.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: DAILY CHECKLIST */}
        {activeTab === 'checklist' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Daily Operations Checklist</h3>
                  <p className="text-xs text-slate-500">
                    Required health, safety, and food service duties
                  </p>
                </div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-xl">
                  {checklist.filter((c) => c.done).length} of {checklist.length} Completed
                </span>
              </div>

              <div className="space-y-2">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleChecklistItem(item.id)}
                    className={`p-3.5 rounded-2xl border transition flex items-center gap-3 cursor-pointer select-none ${
                      item.done
                        ? 'bg-blue-50/40 border-blue-200 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center border transition ${
                        item.done ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                      }`}
                    >
                      {item.done && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <span className={`text-xs font-semibold ${item.done ? 'line-through text-slate-400' : ''}`}>
                      {item.task}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: VISITORS REGISTER */}
        {activeTab === 'visitors' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <h3 className="font-extrabold text-sm text-slate-900">Issue Visitor Gate Pass</h3>
              <form onSubmit={handleAddVisitor} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Visitor Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Verma"
                    value={newVisitorName}
                    onChange={(e) => setNewVisitorName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Meeting Resident
                  </label>
                  <select
                    value={newVisitorRes}
                    onChange={(e) => setNewVisitorRes(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-white"
                  >
                    {siteResidents.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name} (Room {r.roomNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Purpose</label>
                  <input
                    type="text"
                    placeholder="e.g. Family visit / Project work"
                    value={newVisitorPurpose}
                    onChange={(e) => setNewVisitorPurpose(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs"
                >
                  Generate Gate Pass
                </button>
              </form>
            </div>

            {/* List */}
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <h3 className="font-extrabold text-sm text-slate-900">Today’s Visitor Registry</h3>
              <div className="space-y-2">
                {visitors.map((v) => (
                  <div key={v.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{v.visitorName}</span>
                      <p className="text-[11px] text-slate-500">
                        Visiting {v.residentVisited} (Room {v.room}) • {v.purpose}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-slate-800">{v.entryTime}</span>
                      <span className="text-[10px] text-slate-400 block">{v.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: STAFF TEAM & ROSTER */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Staff Members & Duty Roster</h2>
                <p className="text-xs text-slate-500">
                  Manage housekeeping, kitchen chefs, wardens, and gate security personnel
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {team.filter((s) => s.todayStatus === 'Checked-In').length} of {team.length} On Duty Now
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {team.map((member) => {
                const isActive = currentStaff.id === member.id;
                const isMemberCheckedIn = member.todayStatus === 'Checked-In';

                return (
                  <div
                    key={member.id}
                    className={`bg-white rounded-2xl border p-5 transition shadow-2xs space-y-4 ${
                      isActive
                        ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={member.avatar}
                          alt={member.name}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-2xs"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-extrabold text-sm text-slate-900">{member.name}</h3>
                            {isActive && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-600 text-white uppercase">
                                You
                              </span>
                            )}
                          </div>
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 mt-1">
                            {member.role}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                          isMemberCheckedIn
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isMemberCheckedIn ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        {member.todayStatus}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Shift Timing:</span>
                        <span className="font-semibold text-slate-800">{member.shift}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Last Clock-in:</span>
                        <span className="font-semibold text-slate-800">{member.lastClockIn || 'Not logged today'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Contact:</span>
                        <span className="font-semibold text-blue-700">{member.phone}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => toggleStaffClockIn(member.id)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1 ${
                          isMemberCheckedIn
                            ? 'border-rose-200 text-rose-700 bg-rose-50/50 hover:bg-rose-50'
                            : 'border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{isMemberCheckedIn ? 'Clock Out' : 'Clock In'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setCurrentStaffId(member.id);
                          setIsCheckedIn(member.todayStatus === 'Checked-In');
                        }}
                        disabled={isActive}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 border border-blue-200 cursor-default'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs'
                        }`}
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>{isActive ? 'Current View' : 'Act as Staff'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Manual Movement Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-blue-100">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="font-extrabold text-sm text-slate-900">Log Resident Gate Movement</h3>
              <button onClick={() => setShowLogModal(false)} className="text-slate-400">
                ✕
              </button>
            </div>

            <form onSubmit={handleManualGateLog} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Select Resident
                </label>
                <select
                  value={logResidentName}
                  onChange={(e) => setLogResidentName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white"
                >
                  {siteResidents.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} (Room {r.roomNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Direction</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLogType('Check-In')}
                    className={`py-2 rounded-xl font-bold border ${
                      logType === 'Check-In' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'border-slate-200'
                    }`}
                  >
                    Entry (In)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogType('Check-Out')}
                    className={`py-2 rounded-xl font-bold border ${
                      logType === 'Check-Out' ? 'bg-amber-50 border-amber-500 text-amber-800' : 'border-slate-200'
                    }`}
                  >
                    Exit (Out)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Returned from office / Late permission"
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md"
              >
                Save to Register
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
