import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useOwnerScope } from '../../utils/ownership';
import { Lead, LeadStage, RoomSharingType } from '../../types';
import {
  Users,
  Plus,
  ArrowRight,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ChevronRight,
  MessageSquare,
  Search,
} from 'lucide-react';

const STAGES: { key: LeadStage; label: string; color: string }[] = [
  { key: 'New Lead', label: 'New Inquiries', color: 'border-blue-400 bg-blue-50/40 text-blue-900' },
  { key: 'Contacted', label: 'Contacted', color: 'border-indigo-400 bg-indigo-50/40 text-indigo-900' },
  { key: 'Visit Scheduled', label: 'Visit Scheduled', color: 'border-amber-400 bg-amber-50/40 text-amber-900' },
  { key: 'Visited', label: 'Visited Campus', color: 'border-purple-400 bg-purple-50/40 text-purple-900' },
  { key: 'Interested', label: 'High Intent', color: 'border-teal-400 bg-teal-50/40 text-teal-900' },
  { key: 'Booking Pending', label: 'Token Due', color: 'border-orange-400 bg-orange-50/40 text-orange-900' },
  { key: 'Booked', label: 'Booked Bed', color: 'border-emerald-500 bg-emerald-50/40 text-emerald-900' },
  { key: 'Moved In', label: 'Moved In', color: 'border-green-600 bg-green-50/60 text-green-950' },
];

export const LeadFunnelTab: React.FC = () => {
  const { addLead, updateLeadStage, addResident, updateBedStatus, logAuditEvent } = useApp();
  const { leads, beds, properties } = useOwnerScope();

  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [followUpNote, setFollowUpNote] = useState('');

  // Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('+91 ');
  const [newEmail, setNewEmail] = useState('');
  const [newSource, setNewSource] = useState<'Website' | 'WhatsApp' | 'Walk-in' | 'Referral' | 'Google Search'>('Website');
  const [newRoomType, setNewRoomType] = useState<RoomSharingType>('Double');
  const [newBudget, setNewBudget] = useState(12000);
  const [newMoveInDate, setNewMoveInDate] = useState('2026-09-15');
  const [newNotes, setNewNotes] = useState('Looking for quiet room with high-speed internet');

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !properties[0]?.id) return;

    addLead({
      name: newName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim() || `${newName.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
      source: newSource,
      budget: newBudget,
      budgetMax: newBudget,
      roomTypePreference: newRoomType,
      propertyId: properties[0]?.id,
      propertyName: properties[0]?.name,
      expectedMoveInDate: newMoveInDate,
      preferredMoveIn: newMoveInDate,
      stage: 'New Lead',
      notes: newNotes,
    });

    setNewName('');
    setNewPhone('+91 ');
    setNewEmail('');
    setShowAddLeadModal(false);
  };

  const handleAdvanceStage = (leadId: string, nextStage: LeadStage) => {
    updateLeadStage(leadId, nextStage, followUpNote || undefined);
    setFollowUpNote('');
  };

  const handleConvertToResident = (lead: Lead) => {
    // Find an available bed matching room preference
    const availableBed = beds.find(
      (b) => b.sharingType === lead.roomTypePreference && (b.status === 'Available' || b.status === 'Ready')
    ) || beds.find((b) => b.status === 'Available') || beds[0];

    addResident({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      propertyId: lead.propertyId || properties[0]?.id || '',
      propertyName: lead.propertyName || properties[0]?.name || 'Your PG',
      roomNumber: availableBed ? availableBed.roomNumber : '204',
      roomType: lead.roomTypePreference,
      bedNumber: availableBed ? availableBed.bedNumber : 'Bed A',
      monthlyRent: availableBed ? (availableBed.monthlyTariff || availableBed.monthlyRent) : (lead.budgetMax || lead.budget || 12000),
      depositAmount: 15000,
      moveInDate: lead.expectedMoveInDate || lead.preferredMoveIn || new Date().toISOString().split('T')[0],
      rentStatus: 'Pending',
      rentDueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      emergencyContact: '+91 98765 00000',
      kycVerified: false,
      notes: `Converted from CRM pipeline. Source: ${lead.source}`,
    });

    if (availableBed) {
      updateBedStatus(availableBed.id, 'Occupied', `res-${Date.now()}`, lead.name);
    }

    updateLeadStage(lead.id, 'Moved In', `Converted to resident in Room ${availableBed?.roomNumber || '204'}`);
    logAuditEvent(
      'Lead Converted to Resident',
      lead.name,
      `Allocated to Room ${availableBed?.roomNumber || '204'} (Bed ${availableBed?.bedNumber || 'A'})`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Prospective Resident Pipeline & Lead CRM
          </h3>
          <p className="text-xs text-slate-500">
            Track prospective tenants from inquiry to room tour, token deposit, and move-in allocation.
          </p>
        </div>

        <button
          onClick={() => setShowAddLeadModal(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          Capture New Lead
        </button>
      </div>

      {/* Kanban Pipeline Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 pb-4 items-start">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage.key);
          return (
            <div
              key={stage.key}
              className="w-full bg-slate-100/70 rounded-2xl p-3 border border-slate-200/80 space-y-3"
            >
              {/* Stage Column Header */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  {stage.label}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                  {stageLeads.length}
                </span>
              </div>

              {/* Cards in this Stage */}
              <div className="space-y-2.5 min-h-[140px]">
                {stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-all cursor-pointer space-y-2 group"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-bold text-xs text-slate-900 leading-tight group-hover:text-blue-600">
                        {lead.name}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                        {lead.source}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{lead.phone}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 text-slate-700 font-semibold">
                        <span>{lead.roomTypePreference} Room</span>
                        <span className="text-blue-700">₹{(lead.budget || lead.budgetMax || 0).toLocaleString('en-IN')}/mo</span>
                      </div>
                    </div>

                    {/* Quick Advance Button */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[9px] text-slate-400">Move-in: {lead.expectedMoveInDate}</span>
                      {lead.stage !== 'Moved In' && lead.stage !== 'Lost' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (lead.stage === 'Booking Pending' || lead.stage === 'Booked') {
                              handleConvertToResident(lead);
                            } else {
                              const currentIndex = STAGES.findIndex((s) => s.key === lead.stage);
                              if (currentIndex >= 0 && currentIndex < STAGES.length - 1) {
                                handleAdvanceStage(lead.id, STAGES[currentIndex + 1].key);
                              }
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white text-[10px] font-bold flex items-center gap-1 transition-colors"
                        >
                          {lead.stage === 'Booked' ? 'Move In' : 'Advance'}
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Add Lead */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                Capture Prospective Resident Lead
              </h3>
              <button
                onClick={() => setShowAddLeadModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aditi Rao"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98000 00000"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Inquiry Source
                  </label>
                  <select
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                  >
                    <option value="Website">Portal / Website</option>
                    <option value="WhatsApp">WhatsApp Inquiry</option>
                    <option value="Walk-in">Walk-in Visit</option>
                    <option value="Referral">Friend Referral</option>
                    <option value="Google Search">Google Search</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Room Type
                  </label>
                  <select
                    value={newRoomType}
                    onChange={(e) => setNewRoomType(e.target.value as RoomSharingType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                  >
                    <option value="Single">Single Private</option>
                    <option value="Double">Double Sharing</option>
                    <option value="Triple">Triple Sharing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Monthly Budget (₹)
                  </label>
                  <input
                    type="number"
                    value={newBudget}
                    onChange={(e) => setNewBudget(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Move-In Date
                </label>
                <input
                  type="date"
                  value={newMoveInDate}
                  onChange={(e) => setNewMoveInDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="w-1/2 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20"
                >
                  Save Lead Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View & Convert Lead */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{selectedLead.name}</h3>
                <span className="text-xs text-blue-600 font-semibold">
                  Stage: {selectedLead.stage} • Source: {selectedLead.source}
                </span>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl">
                <div>
                  <span className="text-slate-400 block">Phone:</span>
                  <span className="font-bold text-slate-800">{selectedLead.phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Email:</span>
                  <span className="font-bold text-slate-800">{selectedLead.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Preferred Room:</span>
                  <span className="font-bold text-slate-800">{selectedLead.roomTypePreference} Room</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Max Budget:</span>
                  <span className="font-bold text-blue-700">₹{selectedLead.budget.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1">CRM Conversation Notes:</span>
                <p className="p-3 bg-slate-50 rounded-xl text-slate-600 whitespace-pre-line leading-relaxed">
                  {selectedLead.notes}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Add Follow-Up Note & Move Stage
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Visited room 204 today, agreed on token"
                    value={followUpNote}
                    onChange={(e) => setFollowUpNote(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                  />
                  <button
                    onClick={() => {
                      if (!followUpNote.trim()) return;
                      updateLeadStage(selectedLead.id, selectedLead.stage, followUpNote);
                      setFollowUpNote('');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-900"
                  >
                    Log Note
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => handleAdvanceStage(selectedLead.id, 'Lost')}
                className="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold"
              >
                Mark Lost
              </button>
              <button
                onClick={() => {
                  handleConvertToResident(selectedLead);
                  setSelectedLead(null);
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Allocate Bed & Convert to Resident
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
