import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Bed, BedStatus } from '../../types';
import {
  Bed as BedIcon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Users,
  Filter,
  Search,
  UserPlus,
  RotateCcw,
  Check,
  Building,
} from 'lucide-react';

const STATUS_CONFIG: Record<
  BedStatus,
  { label: string; bg: string; text: string; border: string; badge: string }
> = {
  Vacant: {
    label: 'Vacant',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  Available: {
    label: 'Available',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  Reserved: {
    label: 'Reserved',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-300',
    badge: 'bg-blue-100 text-blue-800',
  },
  'Booking Pending': {
    label: 'Booking Pending',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-300',
    badge: 'bg-indigo-100 text-indigo-800',
  },
  Occupied: {
    label: 'Occupied',
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-300',
    badge: 'bg-slate-200 text-slate-800',
  },
  'Notice Period': {
    label: 'Notice Period',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
    badge: 'bg-amber-100 text-amber-900',
  },
  Vacating: {
    label: 'Vacating Soon',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-300',
    badge: 'bg-rose-100 text-rose-800',
  },
  Cleaning: {
    label: 'Cleaning in Progress',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-300',
    badge: 'bg-purple-100 text-purple-800',
  },
  Maintenance: {
    label: 'Maintenance',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-300',
    badge: 'bg-purple-100 text-purple-800',
  },
  Disabled: {
    label: 'Disabled',
    bg: 'bg-slate-50',
    text: 'text-slate-500',
    border: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-600',
  },
  Ready: {
    label: 'Move-in Ready',
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-300',
    badge: 'bg-teal-100 text-teal-800',
  },
};

export const BedMatrixTab: React.FC = () => {
  const { beds, updateBedStatus, residents, logAuditEvent } = useApp();

  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingBed, setEditingBed] = useState<Bed | null>(null);
  const [newStatus, setNewStatus] = useState<BedStatus>('Available');
  const [newTenantName, setNewTenantName] = useState('');

  // Counters
  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b) => b.status === 'Occupied').length;
  const availableBeds = beds.filter((b) => b.status === 'Available' || b.status === 'Ready').length;
  const noticeBeds = beds.filter((b) => b.status === 'Notice Period' || b.status === 'Vacating').length;
  const cleaningBeds = beds.filter((b) => b.status === 'Cleaning').length;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Filter beds
  const filteredBeds = beds.filter((bed) => {
    const matchesStatus =
      selectedStatusFilter === 'all' || bed.status === selectedStatusFilter;
    const matchesFloor =
      selectedFloorFilter === 'all' || bed.floor.toLowerCase().includes(selectedFloorFilter.toLowerCase());
    const matchesSearch =
      bed.bedNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bed.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bed.currentTenantName && bed.currentTenantName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesFloor && matchesSearch;
  });

  // Group beds by Room Number
  const roomsMap = filteredBeds.reduce<Record<string, Bed[]>>((acc, bed) => {
    if (!acc[bed.roomNumber]) acc[bed.roomNumber] = [];
    acc[bed.roomNumber].push(bed);
    return acc;
  }, {});

  const handleOpenEdit = (bed: Bed) => {
    setEditingBed(bed);
    setNewStatus(bed.status);
    setNewTenantName(bed.currentTenantName || '');
  };

  const handleSaveBedStatus = () => {
    if (!editingBed) return;
    updateBedStatus(
      editingBed.id,
      newStatus,
      newStatus === 'Available' ? undefined : editingBed.currentTenantId || `t-${Date.now()}`,
      newStatus === 'Available' ? undefined : newTenantName.trim() || undefined
    );
    setEditingBed(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Counters Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Bed Inventory</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{totalBeds}</span>
            <span className="text-xs text-blue-600 font-bold">{occupancyRate}% Occupancy</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-600 uppercase block">Available / Ready</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-700">{availableBeds}</span>
            <span className="text-[11px] text-slate-500 font-medium">Beds Instant Move-in</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-600 uppercase block">Occupied Active</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-800">{occupiedBeds}</span>
            <span className="text-[11px] text-slate-500 font-medium">Revenue generating</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-amber-600 uppercase block">Notice / Vacating</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-amber-700">{noticeBeds}</span>
            <span className="text-[11px] text-slate-500 font-medium">Re-marketing pipeline</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-purple-600 uppercase block">Cleaning & Sanitization</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-purple-700">{cleaningBeds}</span>
            <span className="text-[11px] text-slate-500 font-medium">Housekeeping SLA</span>
          </div>
        </div>
      </div>

      {/* Control Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search bed, room, tenant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden w-52"
            />
          </div>

          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 outline-hidden"
          >
            <option value="all">All Bed Statuses</option>
            <option value="Available">Available</option>
            <option value="Occupied">Occupied</option>
            <option value="Notice Period">Notice Period</option>
            <option value="Cleaning">Cleaning</option>
            <option value="Ready">Ready</option>
            <option value="Reserved">Reserved</option>
          </select>

          <select
            value={selectedFloorFilter}
            onChange={(e) => setSelectedFloorFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 outline-hidden"
          >
            <option value="all">All Floors</option>
            <option value="1st">1st Floor</option>
            <option value="2nd">2nd Floor</option>
            <option value="3rd">3rd Floor</option>
          </select>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Available
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span> Occupied
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Notice
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Cleaning
          </span>
        </div>
      </div>

      {/* Interactive Bed Matrix Grid grouped by Rooms */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Object.entries(roomsMap).map(([roomNumber, bedsList]) => {
          const roomBeds = bedsList as Bed[];
          const firstBed = roomBeds[0];
          return (
            <div
              key={roomNumber}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:shadow-md"
            >
              {/* Room Header */}
              <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">Room {roomNumber}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {firstBed?.sharingType} Sharing
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Floor {firstBed?.floor}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-700">
                  ₹{(firstBed?.monthlyTariff || firstBed?.monthlyRent || 0).toLocaleString('en-IN')}/mo
                </span>
              </div>

              {/* Beds in this Room */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {roomBeds.map((bed: Bed) => {
                  const conf = STATUS_CONFIG[bed.status] || STATUS_CONFIG.Available;
                  return (
                    <div
                      key={bed.id}
                      onClick={() => handleOpenEdit(bed)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all hover:scale-102 ${conf.bg} ${conf.border} flex flex-col justify-between`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <BedIcon className={`w-4 h-4 ${conf.text}`} />
                          <span className="font-black text-xs text-slate-900">Bed {bed.bedNumber}</span>
                        </div>
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md ${conf.badge}`}>
                          {conf.label}
                        </span>
                      </div>

                      <div className="text-left mt-1">
                        {bed.currentTenantName ? (
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-900 block truncate">
                              {bed.currentTenantName}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Rent: ₹{bed.monthlyTariff}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No tenant assigned</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Edit Bed Status Modal */}
      {editingBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Manage Bed {editingBed.bedNumber} (Room {editingBed.roomNumber})
                </h3>
                <span className="text-xs text-slate-500">
                  {editingBed.sharingType} • Tariff: ₹{editingBed.monthlyTariff}/mo
                </span>
              </div>
              <button
                onClick={() => setEditingBed(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Bed Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as BedStatus)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-blue-600 outline-hidden"
                >
                  <option value="Available">Available (Vacant & Ready)</option>
                  <option value="Occupied">Occupied (Active Resident)</option>
                  <option value="Notice Period">Notice Period (Vacating Soon)</option>
                  <option value="Cleaning">Cleaning / Housekeeping in progress</option>
                  <option value="Ready">Ready for Move-in</option>
                  <option value="Reserved">Reserved (Advance Token Paid)</option>
                  <option value="Booking Pending">Booking Request Pending</option>
                </select>
              </div>

              {newStatus !== 'Available' && newStatus !== 'Cleaning' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Resident / Tenant Name
                  </label>
                  <input
                    type="text"
                    value={newTenantName}
                    onChange={(e) => setNewTenantName(e.target.value)}
                    placeholder="Enter tenant name"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingBed(null)}
                className="w-1/2 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBedStatus}
                className="w-1/2 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20"
              >
                Update Bed State
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
