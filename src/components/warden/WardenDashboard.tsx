import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  Zap,
  UserCheck,
  ClipboardList,
  CheckCircle2,
  Clock,
  Camera,
  AlertTriangle,
  Search,
  Plus,
  ArrowRight,
  LogOut,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { MoveInInspectionModal } from '../features/MoveInInspectionModal';

export const WardenDashboard: React.FC = () => {
  const {
    currentStaff,
    beds,
    residents,
    meterReadings,
    addMeterReading,
    visitorPasses,
    addVisitorPass,
    updateVisitorStatus,
    tasks,
    toggleTaskCompleted,
    logAuditEvent,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'daily' | 'meter' | 'visitors' | 'movein'>('daily');

  // Meter Reading Input Form State
  const [meterRoom, setMeterRoom] = useState('204');
  const [currentUnits, setCurrentUnits] = useState(1480);
  const [previousUnits, setPreviousUnits] = useState(1320);
  const [meterRate, setMeterRate] = useState(8.5);
  const [meterPhoto, setMeterPhoto] = useState('https://images.unsplash.com/photo-1558441719-20a8929e71e4?auto=format&fit=crop&w=400&q=80');
  const [readingAddedSuccess, setReadingAddedSuccess] = useState(false);

  // Visitor Pass State
  const [newVisitorName, setNewVisitorName] = useState('');
  const [newVisitorPhone, setNewVisitorPhone] = useState('');
  const [newVisitorResidentId, setNewVisitorResidentId] = useState(residents[0]?.id || 'res-1');
  const [newVisitorPurpose, setNewVisitorPurpose] = useState('Study / Project Work');
  const [newVisitorDate, setNewVisitorDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddVisitor, setShowAddVisitor] = useState(false);

  // Move-in Modal State
  const [inspectionModalResident, setInspectionModalResident] = useState<{ room: string; name: string } | null>(null);

  const unitsConsumed = Math.max(0, currentUnits - previousUnits);
  const totalAmount = Math.round(unitsConsumed * meterRate);
  const isAnomaly = unitsConsumed > 250; // flagged if excessive consumption

  const handleLogMeterReading = (e: React.FormEvent) => {
    e.preventDefault();
    const readingMonth = new Date().toLocaleString('default', { month: 'short', year: 'numeric' });
    const targetResident = residents.find((r) => r.roomNumber === meterRoom);

    addMeterReading({
      propertyId: 'prop-1',
      roomNumber: meterRoom,
      meterNumber: `MTR-${meterRoom}`,
      previousReading: previousUnits,
      currentReading: currentUnits,
      unitsConsumed,
      ratePerUnit: meterRate,
      totalAmount,
      readingDate: new Date().toISOString().split('T')[0],
      billingMonth: readingMonth,
      meterPhotoUrl: meterPhoto,
      status: isAnomaly ? 'Flagged' : 'Verified',
      anomalyFlag: isAnomaly,
      anomalyReason: isAnomaly ? `High consumption spike: ${unitsConsumed} units exceeds typical 150 unit baseline` : undefined,
      verifiedBy: currentStaff?.name || 'Sunil Kumar (Warden)',
    });

    setReadingAddedSuccess(true);
    setTimeout(() => setReadingAddedSuccess(false), 2500);
  };

  const handleCreateVisitorPass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVisitorName) return;
    const targetResident = residents.find((r) => r.id === newVisitorResidentId) || residents[0];

    addVisitorPass({
      propertyId: 'prop-1',
      residentId: targetResident.id,
      residentName: targetResident.name,
      roomNumber: targetResident.roomNumber,
      visitorName: newVisitorName,
      visitorPhone: newVisitorPhone || '+91 98980 12345',
      purpose: newVisitorPurpose,
      expectedDate: newVisitorDate,
      passCode: `VP-${Math.floor(1000 + Math.random() * 9000)}`,
      preApprovedByResident: true,
    });

    setNewVisitorName('');
    setNewVisitorPhone('');
    setShowAddVisitor(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Warden Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-400/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Chief Warden & Property Operations Desk
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              On-Premises Security & Utility Controller
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Logged in as <strong>{currentStaff?.name || 'Sunil Kumar'}</strong>. Overseeing room inspections, sub-meter readings, biometric visitor gate access, and daily chores.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('meter')}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all"
            >
              <Zap className="w-4 h-4" />
              Log Meter Reading
            </button>
            <button
              onClick={() => {
                setActiveTab('visitors');
                setShowAddVisitor(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 flex items-center gap-1.5 transition-all"
            >
              <UserCheck className="w-4 h-4" />
              Issue Gate Pass
            </button>
          </div>
        </div>

        {/* Quick Operational Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800">
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Total In-House Tenants</span>
            <span className="text-2xl font-black text-white">{residents.length}</span>
            <span className="text-[11px] text-emerald-400 block mt-0.5">All IDs Verified</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Visitor Passes Active</span>
            <span className="text-2xl font-black text-white">
              {visitorPasses.filter((v) => v.status === 'Checked-In').length}
            </span>
            <span className="text-[11px] text-indigo-300 block mt-0.5">Inside Campus</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Sub-Meters Logged</span>
            <span className="text-2xl font-black text-white">{meterReadings.length}</span>
            <span className="text-[11px] text-emerald-400 block mt-0.5">100% Captured</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Pending Chores</span>
            <span className="text-2xl font-black text-white">
              {tasks.filter((t) => !t.completed).length}
            </span>
            <span className="text-[11px] text-amber-300 block mt-0.5">For Today</span>
          </div>
        </div>
      </div>

      {/* Sub Navigation with smooth mobile horizontal scroll */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 text-xs sm:text-sm font-bold scroll-smooth">
        <button
          onClick={() => setActiveTab('daily')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
            activeTab === 'daily' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Daily Warden Checklist
        </button>
        <button
          onClick={() => setActiveTab('meter')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
            activeTab === 'meter' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4" />
          Electricity Sub-Meter Logger
        </button>
        <button
          onClick={() => setActiveTab('visitors')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
            activeTab === 'visitors' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Visitor Gate Register ({visitorPasses.length})
        </button>
        <button
          onClick={() => setActiveTab('movein')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
            activeTab === 'movein' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Room Condition Handover
        </button>
      </div>

      {/* Tab 1: Daily Warden Checklist */}
      {activeTab === 'daily' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-indigo-600" />
              Campus Chores & Housekeeping Log
            </h3>
            <div className="divide-y divide-slate-100">
              {tasks.map((task) => (
                <div key={task.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleTaskCompleted(task.id)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        task.completed
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {task.completed && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                    <div>
                      <p
                        className={`text-xs font-bold ${
                          task.completed ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </p>
                      <span className="text-[10px] text-slate-500">
                        {task.category} • Priority: {task.priority}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">{task.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Security Checkpoints & Gate Curfew
            </h3>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Main Gate Closure:</span>
                <span className="font-bold text-slate-900">11:30 PM (Biometric Turnstiles Armed)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Morning Unlocking:</span>
                <span className="font-bold text-slate-900">05:30 AM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Late Night Permissions:</span>
                <span className="font-bold text-emerald-600">2 Requests Approved in System</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 space-y-2">
              <span className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Emergency Contact Roster
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Local Police Station (Bellandur): 080-22942544 • Manipal Hospital Emergency: 080-25024444 • Chief Fire Officer: 101.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Electricity Sub-Meter Logger */}
      {activeTab === 'meter' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form */}
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Capture Sub-Meter Reading with Photo Proof
              </h3>
              <p className="text-xs text-slate-500">
                Record current meter counter with photo verification and automatic anomaly spike detection.
              </p>
            </div>

            {readingAddedSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Reading verified and appended to tenant's transparent utility invoice!
              </div>
            )}

            <form onSubmit={handleLogMeterReading} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Room Number
                  </label>
                  <select
                    value={meterRoom}
                    onChange={(e) => setMeterRoom(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="101">Room 101 (Double)</option>
                    <option value="102">Room 102 (Single)</option>
                    <option value="201">Room 201 (Double)</option>
                    <option value="204">Room 204 (Triple)</option>
                    <option value="301">Room 301 (Single)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tariff (₹ / Unit)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={meterRate}
                    onChange={(e) => setMeterRate(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Previous Reading (kWh)
                  </label>
                  <input
                    type="number"
                    value={previousUnits}
                    onChange={(e) => setPreviousUnits(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Current Reading (kWh)
                  </label>
                  <input
                    type="number"
                    value={currentUnits}
                    onChange={(e) => setCurrentUnits(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Calculated Preview Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Net Units Consumed:</span>
                  <span className="font-mono font-bold text-slate-900">{unitsConsumed} kWh</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Electricity Bill Amount:</span>
                  <span className="font-bold text-blue-700 text-sm">₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>

                {isAnomaly && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold flex items-start gap-2 mt-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      High Consumption Flag: Consumption ({unitsConsumed} units) is over 65% above peer average. Check for AC continuous running or wiring leakage.
                    </span>
                  </div>
                )}
              </div>

              {/* Photo Proof Upload Simulation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Meter Photo Proof URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={meterPhoto}
                    onChange={(e) => setMeterPhoto(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-300 shrink-0">
                    <img src={meterPhoto} alt="Meter" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm & Log Electricity Reading
              </button>
            </form>
          </div>

          {/* Historical Logged Readings List */}
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Historical Meter Records</h3>
            <div className="divide-y divide-slate-100">
              {meterReadings.map((reading) => (
                <div key={reading.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={reading.meterPhotoUrl}
                      alt="Proof"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Room {reading.roomNumber}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({reading.meterNumber})</span>
                        {reading.anomalyFlag && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                            Spike
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {reading.unitsConsumed} units @ ₹{reading.ratePerUnit}/unit • {reading.billingMonth}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-900 block">
                      ₹{reading.totalAmount.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600">
                      {reading.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Visitor Gate Register */}
      {activeTab === 'visitors' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                Biometric & Pre-Approved Visitor Register
              </h3>
              <p className="text-xs text-slate-500">
                Track visitor entries, check-in timestamps, and departure clearances in real-time.
              </p>
            </div>

            <button
              onClick={() => setShowAddVisitor(!showAddVisitor)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 self-start"
            >
              <Plus className="w-4 h-4" />
              {showAddVisitor ? 'Close Form' : 'New Gate Entry Pass'}
            </button>
          </div>

          {showAddVisitor && (
            <form onSubmit={handleCreateVisitorPass} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Issue Pre-Approved Visitor Pass
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Visitor Full Name"
                  value={newVisitorName}
                  onChange={(e) => setNewVisitorName(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-hidden"
                  required
                />
                <input
                  type="text"
                  placeholder="Phone Number"
                  value={newVisitorPhone}
                  onChange={(e) => setNewVisitorPhone(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-hidden"
                />
                <select
                  value={newVisitorResidentId}
                  onChange={(e) => setNewVisitorResidentId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-hidden"
                >
                  {residents.map((r) => (
                    <option key={r.id} value={r.id}>
                      Host: {r.name} (Room {r.roomNumber})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700"
              >
                Generate Pass Code
              </button>
            </form>
          )}

          {/* Visitor Passes Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-extrabold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Visitor</th>
                  <th className="p-3.5">Host Resident</th>
                  <th className="p-3.5">Pass Code</th>
                  <th className="p-3.5">Date & Purpose</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Gate Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visitorPasses.map((pass) => (
                  <tr key={pass.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-bold text-slate-900">
                      {pass.visitorName}
                      <span className="text-[10px] text-slate-500 block font-normal">{pass.visitorPhone}</span>
                    </td>
                    <td className="p-3.5 text-slate-700">
                      {pass.residentName} (Room {pass.roomNumber})
                    </td>
                    <td className="p-3.5 font-mono text-indigo-700 font-bold">{pass.passCode}</td>
                    <td className="p-3.5 text-slate-600">
                      {pass.expectedDate}
                      <span className="text-[10px] text-slate-400 block">{pass.purpose}</span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          pass.status === 'Checked-In'
                            ? 'bg-emerald-100 text-emerald-800'
                            : pass.status === 'Checked-Out'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {pass.status} {pass.checkInTime ? `(${pass.checkInTime})` : ''}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {pass.status === 'Pre-Approved' && (
                        <button
                          onClick={() => updateVisitorStatus(pass.id, 'Checked-In')}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                        >
                          Check-In
                        </button>
                      )}
                      {pass.status === 'Checked-In' && (
                        <button
                          onClick={() => updateVisitorStatus(pass.id, 'Checked-Out')}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold"
                        >
                          Check-Out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Room Condition Handover */}
      {activeTab === 'movein' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-base">Move-in Condition Audit & Room Handover</h3>
          <p className="text-xs text-slate-500">
            Launch formal fixture inspection condition checklists for any resident upon move-in or vacating.
          </p>
          <div className="divide-y divide-slate-100">
            {residents.map((r) => (
              <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-900">{r.name}</span>
                  <p className="text-[11px] text-slate-500">
                    Room {r.roomNumber} (Bed {r.roomNumber}-A) • Moved in: {r.joinDate}
                  </p>
                </div>
                <button
                  onClick={() => setInspectionModalResident({ room: r.roomNumber, name: r.name })}
                  className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-colors"
                >
                  Launch Condition Checklist
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Condition Inspection Modal */}
      {inspectionModalResident && (
        <MoveInInspectionModal
          roomNumber={inspectionModalResident.room}
          tenantName={inspectionModalResident.name}
          onClose={() => setInspectionModalResident(null)}
        />
      )}
    </div>
  );
};
