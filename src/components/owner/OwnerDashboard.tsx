import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Property, Resident, GenderPreference, RoomSharingType, OwnerListingData, RoomOption } from '../../types';
import { INITIAL_AMENITIES } from '../../mockData';
import {
  Building2,
  Users,
  CreditCard,
  Bell,
  Utensils,
  BarChart3,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Send,
  Calendar,
  Check,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Phone,
  MessageSquare,
  Sparkles,
  Bed as BedIcon,
  Compass,
  FileText,
  PieChart,
  ArrowRightLeft,
  LogOut,
} from 'lucide-react';
import { BedMatrixTab } from './BedMatrixTab';
import { LeadFunnelTab } from './LeadFunnelTab';
import { AgreementsTab } from './AgreementsTab';
import { ProfitabilityTab } from './ProfitabilityTab';
import { AIPropertyOnboardingModal } from '../features/AIPropertyOnboardingModal';
import { VirtualTourModal } from '../features/VirtualTourModal';
import OwnerListingWizard from './OwnerListingWizard';

export const OwnerDashboard: React.FC = () => {
  const {
    properties,
    addProperty,
    residents,
    bookingRequests,
    approveBookingRequest,
    rejectBookingRequest,
    attendance,
    staff,
    addStaffMember,
    deleteStaffMember,
    toggleStaffClockIn,
    broadcasts,
    addBroadcast,
    mealPlan,
    updateMealPlanDay,
    tickets,
    updateRentStatus,
    beds,
    leads,
    agreements,
    invoices,
    generateMonthlyInvoices,
    processRoomTransfer,
    initiateNoticePeriod,
    executeCheckoutSettlement,
    currentUser,
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'beds'
    | 'leads'
    | 'agreements'
    | 'profitability'
    | 'properties'
    | 'residents'
    | 'staff'
    | 'attendance'
    | 'menu'
    | 'broadcasts'
    | 'reports'
  >('overview');

  // AI Onboarding & Virtual Tour Modals
  const [showAIOnboarding, setShowAIOnboarding] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);
  const [showListingWizard, setShowListingWizard] = useState(false);

  // Convert listing data to Property object
  const convertListingToProperty = (listingData: OwnerListingData): Omit<Property, 'id'> => {
    const step1 = listingData.step1;
    const step2 = listingData.step2;
    const step3 = listingData.step3;
    const step4 = listingData.step4;
    const step5 = listingData.step5;
    const step6 = listingData.step6;
    const step7 = listingData.step7;

    // Convert rooms to RoomOption format
    const rooms: RoomOption[] = step2.rooms.map(room => {
      let roomType: RoomSharingType = 'Double';
      if (room.sharingCapacity === 'Single') roomType = 'Single';
      else if (room.sharingCapacity === 'Triple') roomType = 'Triple';
      else if (room.sharingCapacity === '4 Sharing') roomType = 'Four';
      else roomType = 'Double';

      const firstBed = room.beds[0];
      return {
        id: room.roomNumber,
        type: roomType,
        rentPerMonth: firstBed?.monthlyRent || 8000,
        deposit: firstBed?.securityDeposit || 8000,
        availableBeds: room.beds.filter(b => b.status === 'Available' || b.status === 'Vacant').length,
        totalBeds: room.beds.length,
        hasAttachedBath: step3.roomAmenities.some(a => a.id === 'Attached Bathroom' && a.selected),
        hasAC: step3.roomAmenities.some(a => a.id === 'AC' && a.selected),
        hasBalcony: step3.roomAmenities.some(a => a.id === 'Balcony' && a.selected),
      };
    });

    // Calculate starting price from lowest room
    const startingPrice = rooms.length > 0 ? Math.min(...rooms.map(r => r.rentPerMonth)) : 8000;

    // Convert amenities to amenity IDs (strings)
    const amenityIds: string[] = [
      ...step3.roomAmenities.filter(a => a.selected).map(a => a.id),
      ...step3.propertyAmenities.filter(a => a.selected).map(a => a.id),
      ...(step3.foodAvailable ? ['food'] : []),
      ...step3.otherServices,
    ];

    // Convert rules to string array
    const rules = [
      `Check-in: ${step5.checkInTime}`,
      `Curfew: ${step5.curfewTime}`,
      `Smoking: ${step5.smokingAllowed ? 'Allowed' : 'Not Allowed'}`,
      `Alcohol: ${step5.alcoholAllowed ? 'Allowed' : 'Not Allowed'}`,
      `Visitors: ${step5.visitorsAllowed}`,
      `Pets: ${step5.petsAllowed ? 'Allowed' : 'Not Allowed'}`,
      `Cooking: ${step5.cookingAllowed ? 'Allowed' : 'Not Allowed'}`,
    ];

    // Add additional rules if provided
    if (step5.additionalRules && step5.additionalRules.trim()) {
      rules.push(step5.additionalRules.trim());
    }

    // Use uploaded photos or default
    const coverImage = step4.photos.find(p => p.category === 'Exterior')?.url ||
                      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80';

    const galleryImages = step4.photos.map(p => p.url).filter(Boolean);

    return {
      organizationId: 'org-default',
      status: 'Active',
      name: step1.propertyName,
      tagline: step1.propertyDescription,
      gender: step1.genderOccupancy === 'Boys' ? 'Boys' :
             step1.genderOccupancy === 'Girls' ? 'Girls' :
             step1.genderOccupancy === 'Unisex / Co-ed' ? 'Unisex' : 'Unisex',
      city: step1.city,
      locality: step1.locality,
      address: step1.fullAddress,
      lat: step1.mapLocation?.lat || 12.9716,
      lng: step1.mapLocation?.lng || 77.5946,
      coverImage,
      galleryImages,
      startingPrice,
      rating: 4.5,
      reviewCount: 0,
      rooms,
      amenities: amenityIds,
      rules,
      noticePeriodDays: step5.noticePeriod === '15 Days' ? 15 :
                       step5.noticePeriod === '30 Days' ? 30 :
                       step5.noticePeriod === '60 Days' ? 60 : 30,
      gateClosingTime: step5.curfewTime,
      foodIncluded: step3.foodAvailable,
      verified: step7.verificationStatus === 'Verified',
      featured: false,
      contactPhone: step6.mobileNumber,
      contactEmail: step6.emailAddress,
      ownerName: step6.fullName,
      listingStatus: listingData.listingStatus === 'Published' ? 'Active' : 'Setup In Progress',
      floors: step2.rooms.length,
    };
  };

  // New Property Form Modal State
  const [showAddPropModal, setShowAddPropModal] = useState(false);
  const [propFormStep, setPropFormStep] = useState(1);
  const [newPropName, setNewPropName] = useState('');
  const [newPropCity, setNewPropCity] = useState('Bengaluru');
  const [newPropLocality, setNewPropLocality] = useState('');
  const [newPropAddress, setNewPropAddress] = useState('');
  const [newPropGender, setNewPropGender] = useState<GenderPreference>('Boys');
  const [newPropSingleRent, setNewPropSingleRent] = useState(14000);
  const [newPropDoubleRent, setNewPropDoubleRent] = useState(9500);
  const [newPropTripleRent, setNewPropTripleRent] = useState(8000);
  const [newPropGateTime, setNewPropGateTime] = useState('11:00 PM');
  const [newPropSelectedAmenities, setNewPropSelectedAmenities] = useState<string[]>(['wifi', 'food', 'cctv', 'power_backup']);

  // New Staff Modal State
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'Housekeeping' | 'Mess Cook' | 'Security Guard' | 'Manager'>('Housekeeping');
  const [newStaffPhone, setNewStaffPhone] = useState('+91 ');
  const [newStaffShift, setNewStaffShift] = useState('Morning (6 AM - 2 PM)');

  // Broadcast Form State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastCategory, setBroadcastCategory] = useState<'Urgent' | 'Maintenance' | 'Rent' | 'Event' | 'Food'>('General' as any);
  const [reminderToast, setReminderToast] = useState<string | null>(null);

  // Stats calculation
  const totalResidentsCount = residents.length;
  const pendingRequestsCount = bookingRequests.filter((r) => r.status === 'Pending').length;
  const pendingRentCount = residents.filter((r) => r.rentStatus === 'Pending' || r.rentStatus === 'Overdue').length;
  const totalRevenue = residents.reduce((sum, r) => (r.rentStatus === 'Paid' ? sum + r.monthlyRent : sum), 0);
  const pendingDuesTotal = residents.reduce((sum, r) => (r.rentStatus !== 'Paid' ? sum + r.monthlyRent : sum), 0);
  const activeTicketsCount = tickets.filter((t) => t.status !== 'Resolved').length;

  const handleCreateProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPropName || !newPropLocality) {
      alert('Please fill out property name and locality.');
      return;
    }

    addProperty({
      name: newPropName,
      tagline: `Premium ${newPropGender} PG in ${newPropLocality} with food & 24/7 power backup`,
      gender: newPropGender,
      city: newPropCity,
      locality: newPropLocality,
      address: newPropAddress || `${newPropLocality}, ${newPropCity}`,
      lat: 12.92,
      lng: 77.65,
      coverImage: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1000&q=80',
      galleryImages: ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1000&q=80'],
      startingPrice: newPropTripleRent || 8000,
      rating: 4.8,
      reviewCount: 1,
      rooms: [
        {
          id: `r-${Date.now()}-1`,
          type: 'Single',
          rentPerMonth: newPropSingleRent,
          deposit: newPropSingleRent * 1.5,
          availableBeds: 2,
          totalBeds: 4,
          hasAttachedBath: true,
          hasAC: true,
          hasBalcony: true,
        },
        {
          id: `r-${Date.now()}-2`,
          type: 'Double',
          rentPerMonth: newPropDoubleRent,
          deposit: newPropDoubleRent * 1.5,
          availableBeds: 4,
          totalBeds: 12,
          hasAttachedBath: true,
          hasAC: true,
          hasBalcony: false,
        },
        {
          id: `r-${Date.now()}-3`,
          type: 'Triple',
          rentPerMonth: newPropTripleRent,
          deposit: newPropTripleRent * 1.5,
          availableBeds: 6,
          totalBeds: 12,
          hasAttachedBath: false,
          hasAC: false,
          hasBalcony: false,
        },
      ],
      amenities: newPropSelectedAmenities,
      rules: ['Gate closes at ' + newPropGateTime, 'No loud music after 11 PM', '30 days notice period'],
      noticePeriodDays: 30,
      gateClosingTime: newPropGateTime,
      foodIncluded: true,
      verified: true,
      contactPhone: '+91 98450 12345',
      contactEmail: 'owner@pag.com',
      ownerName: 'Rajesh Sharma',
    });

    setShowAddPropModal(false);
    setPropFormStep(1);
    setNewPropName('');
    setNewPropLocality('');
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastMsg) return;

    addBroadcast({
      title: broadcastTitle,
      message: broadcastMsg,
      category: broadcastCategory as any,
      target: 'All Residents',
      sender: 'Property Owner (Rajesh Sharma)',
    });

    setBroadcastTitle('');
    setBroadcastMsg('');
    setReminderToast('Broadcast published to all resident dashboards!');
    setTimeout(() => setReminderToast(null), 3500);
  };

  const handlePushRentReminders = () => {
    const overdueResidents = residents.filter((r) => r.rentStatus !== 'Paid');
    addBroadcast({
      title: 'Monthly Rent Reminder (Urgent)',
      message: `Dear residents with pending dues, kindly clear your room dues today. Instant online UPI payment is available in your Resident Portal.`,
      category: 'Rent',
      target: 'All Residents',
      sender: 'Rajesh Sharma (Owner)',
    });

    setReminderToast(`Pushed instant rent reminders to ${overdueResidents.length} residents!`);
    setTimeout(() => setReminderToast(null), 3500);
  };

  // Phase 1 & 2: Room Transfer & Notice Period State
  const [showTransferModal, setShowTransferModal] = useState<Resident | null>(null);
  const [transferTargetBedId, setTransferTargetBedId] = useState('');
  const [transferDiffAmount, setTransferDiffAmount] = useState<number>(0);
  const [showNoticeModal, setShowNoticeModal] = useState<Resident | null>(null);
  const [noticeDepartureDate, setNoticeDepartureDate] = useState('');
  const [noticeReason, setNoticeReason] = useState('Job relocation');

  const availableBedsForTransfer = beds.filter((b) => b.status === 'Available');

  const handleConfirmTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showTransferModal || !transferTargetBedId) return;
    const targetBed = beds.find((b) => b.id === transferTargetBedId);
    if (!targetBed) return;

    processRoomTransfer({
      residentId: showTransferModal.id,
      fromBedId: showTransferModal.id, // Fallback bed mapping
      toBedId: targetBed.id,
      toRoomNumber: targetBed.roomNumber,
      toBedNumber: targetBed.bedNumber,
      effectiveDate: new Date().toISOString().split('T')[0],
      rentDifferenceAdjustment: transferDiffAmount,
    });

    setReminderToast(`Successfully transferred ${showTransferModal.name} to Room ${targetBed.roomNumber} (${targetBed.bedNumber})!`);
    setTimeout(() => setReminderToast(null), 3500);
    setShowTransferModal(null);
    setTransferTargetBedId('');
    setTransferDiffAmount(0);
  };

  const handleConfirmNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showNoticeModal) return;
    const defaultDate = noticeDepartureDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    initiateNoticePeriod({
      residentId: showNoticeModal.id,
      requestedDepartureDate: defaultDate,
      reason: noticeReason,
    });

    setReminderToast(`Notice period initiated for ${showNoticeModal.name}. Planned departure: ${defaultDate}.`);
    setTimeout(() => setReminderToast(null), 3500);
    setShowNoticeModal(null);
    setNoticeDepartureDate('');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Toast banner */}
      {reminderToast && (
        <div className="fixed top-20 right-6 z-50 bg-blue-600 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-blue-200" />
          <span>{reminderToast}</span>
        </div>
      )}

      {/* Top Banner with Owner Context */}
      <div className="bg-white border-b border-blue-100 py-6 px-4 sm:px-6 lg:px-8 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              <Building2 className="w-3.5 h-3.5" />
              <span>Owner & PG Management Console</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900">
              Welcome back, Rajesh Sharma
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Managing Blue Haven Luxury Living PG & 3 other properties
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowAIOnboarding(true)}
              className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>AI Property Onboarding</span>
            </button>
            <button
              onClick={() => setShowTourModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            >
              <Compass className="w-3.5 h-3.5 text-slate-600" />
              <span>360° Virtual Tour</span>
            </button>
            <button
              id="owner-push-rent-reminder-btn"
              onClick={handlePushRentReminders}
              className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-600" />
              <span>Push Rent Reminders ({pendingRentCount})</span>
            </button>
            <button
              id="owner-add-property-btn"
              onClick={() => setShowListingWizard(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>List New Property</span>
            </button>
          </div>
        </div>
      </div>

      {/* Owner Workspace Tabs with smooth mobile horizontal swipe */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-2xs flex items-center gap-1.5 overflow-x-auto mb-6 text-xs font-bold scroll-smooth">
          {[
            { key: 'overview', label: 'Overview', icon: TrendingUp },
            { key: 'beds', label: `Bed Matrix (${beds.length})`, icon: BedIcon },
            { key: 'leads', label: `Leads Funnel (${leads.length})`, icon: Users },
            { key: 'agreements', label: `Agreements (${agreements.length})`, icon: FileText },
            { key: 'profitability', label: 'Profitability & NOI', icon: PieChart },
            { key: 'properties', label: `Properties (${properties.length})`, icon: Building2 },
            { key: 'residents', label: `Residents & Bookings (${residents.length})`, icon: Users },
            { key: 'staff', label: `Staff & Team (${staff.length})`, icon: ShieldCheck },
            { key: 'attendance', label: 'Attendance & Gate Log', icon: Clock },
            { key: 'menu', label: 'Mess & Food Menu', icon: Utensils },
            { key: 'broadcasts', label: 'Broadcasts & Alerts', icon: Bell },
            { key: 'reports', label: 'Financial Reports', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 whitespace-nowrap shrink-0 transition min-h-[44px] ${
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

        {/* ENTERPRISE EXTENSIONS TABS */}
        {activeTab === 'beds' && <BedMatrixTab />}
        {activeTab === 'leads' && <LeadFunnelTab />}
        {activeTab === 'agreements' && <AgreementsTab />}
        {activeTab === 'profitability' && <ProfitabilityTab />}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Monthly Revenue</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    ₹
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 mt-2">
                  ₹{totalRevenue.toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                  <span>+8.4% from last month</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Pending Rent Dues</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    !
                  </div>
                </div>
                <div className="text-2xl font-black text-amber-600 mt-2">
                  ₹{pendingDuesTotal.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {pendingRentCount} resident{pendingRentCount === 1 ? '' : 's'} pending
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Active Residents</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 mt-2">
                  {totalResidentsCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  92% Bed Occupancy Rate
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">New Inquiries</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    {pendingRequestsCount}
                  </div>
                </div>
                <div className="text-2xl font-black text-indigo-600 mt-2">
                  {pendingRequestsCount} Pending
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Awaiting room assignment
                </div>
              </div>
            </div>

            {/* Inquiries & Quick Actions Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Pending Booking Requests */}
              <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <h3 className="font-extrabold text-slate-900 text-sm">
                      New Booking Requests ({bookingRequests.filter((r) => r.status === 'Pending').length})
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('residents')}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-3">
                  {bookingRequests.filter((r) => r.status === 'Pending').length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">
                      No pending inquiries right now.
                    </p>
                  ) : (
                    bookingRequests
                      .filter((r) => r.status === 'Pending')
                      .map((req) => (
                        <div
                          key={req.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900">{req.applicantName}</span>
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                                {req.type === 'visit' ? 'Physical Tour' : `${req.roomType} Sharing`}
                              </span>
                              {req.referenceId && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {req.referenceId}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {req.phone} • {req.type === 'visit' ? `Tour: ${req.visitDate || req.preferredMoveInDate} (${req.visitTimeSlot || '10 AM - 12 PM'})` : `Move-in: ${req.preferredMoveInDate}`} • {req.occupancyType}
                            </p>
                            {req.message && (
                              <p className="text-[11px] text-slate-600 italic mt-1">"{req.message}"</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              id={`approve-booking-${req.id}`}
                              onClick={() => approveBookingRequest(req.id, '204', 'Bed A')}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                              title="Approve and allocate Room 204 (Bed A)"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve & Allocate Room 204</span>
                            </button>
                            <button
                              id={`reject-booking-${req.id}`}
                              onClick={() => rejectBookingRequest(req.id)}
                              className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Right: Today's Live Attendance Snapshot */}
              <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <h3 className="font-extrabold text-slate-900 text-sm">Today’s Gate Movements</h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    Full Log
                  </button>
                </div>

                <div className="space-y-2.5">
                  {attendance.slice(0, 4).map((att) => (
                    <div
                      key={att.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            att.type === 'Check-In' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                        <div>
                          <span className="font-bold text-slate-900">{att.personName}</span>
                          <span className="text-[10px] text-slate-400 block">
                            {att.personType} {att.roomNumber ? `• Rm ${att.roomNumber}` : ''}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            att.type === 'Check-In'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {att.type}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">{att.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PROPERTIES */}
        {activeTab === 'properties' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-900">
                Your Properties & Co-Living Spaces ({properties.length})
              </h2>
              <button
                onClick={() => setShowListingWizard(true)}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>List New Property</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {properties.map((prop) => (
                <div
                  key={prop.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${
                          prop.gender === 'Girls'
                            ? 'bg-rose-600'
                            : prop.gender === 'Boys'
                            ? 'bg-blue-600'
                            : 'bg-emerald-600'
                        }`}
                      >
                        {prop.gender} PG
                      </span>
                      <h3 className="font-extrabold text-slate-900 text-base mt-1">{prop.name}</h3>
                      <p className="text-xs text-slate-500">{prop.locality}, {prop.city}</p>
                    </div>
                    <span className="text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                      From ₹{prop.startingPrice.toLocaleString()} /mo
                    </span>
                  </div>

                  {/* Rooms breakdown */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                    {prop.rooms.map((r) => (
                      <div key={r.id} className="p-2 bg-slate-50 rounded-xl text-center">
                        <span className="text-[10px] text-slate-400 font-bold block">{r.type}</span>
                        <span className="text-xs font-extrabold text-slate-900">
                          ₹{(r.rentPerMonth / 1000).toFixed(1)}k
                        </span>
                        <span className="text-[10px] text-emerald-600 block">
                          {r.availableBeds} beds free
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <span>Gate curfew: {prop.gateClosingTime}</span>
                    <span>Notice: {prop.noticePeriodDays} days</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: RESIDENTS & BOOKING PIPELINE */}
        {activeTab === 'residents' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Current Residents Roster ({residents.length})
                </h2>
                <p className="text-xs text-slate-500">Track payment status, KYC verification, room transfers, and checkout notice</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="owner-generate-monthly-invoices-btn"
                  onClick={() => {
                    const count = generateMonthlyInvoices('October 2026');
                    setReminderToast(`Generated ${count} monthly billing invoices for current residents.`);
                    setTimeout(() => setReminderToast(null), 3500);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Generate Invoices ({invoices.length} active)</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Resident</th>
                      <th className="py-3 px-4">Room & Bed</th>
                      <th className="py-3 px-4">Monthly Rent</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">KYC</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {residents.map((res) => (
                      <tr key={res.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={res.avatar}
                              alt={res.name}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover border"
                            />
                            <div>
                              <span className="font-bold text-slate-900 block">{res.name}</span>
                              <span className="text-[11px] text-slate-400">{res.phone}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900">Room {res.roomNumber}</span>
                          <span className="text-[11px] text-slate-500 block">
                            {res.bedNumber} ({res.roomType})
                          </span>
                        </td>
                        <td className="py-3 px-4 font-extrabold text-slate-900">
                          ₹{res.monthlyRent.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              res.rentStatus === 'Paid'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : res.rentStatus === 'Overdue'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {res.rentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {res.kycVerified ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                              <ShieldCheck className="w-3.5 h-3.5" /> Verified
                            </span>
                          ) : (
                            <span className="text-amber-600 text-[11px]">Pending</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{res.rentDueDate}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {res.rentStatus !== 'Paid' ? (
                              <button
                                id={`mark-paid-btn-${res.id}`}
                                onClick={() => updateRentStatus(res.id, 'Paid')}
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-2xs"
                              >
                                Mark Paid
                              </button>
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-bold px-1.5 py-0.5 bg-emerald-50 rounded-md">Paid</span>
                            )}
                            <button
                              id={`transfer-room-btn-${res.id}`}
                              onClick={() => {
                                setShowTransferModal(res);
                                setTransferTargetBedId(availableBedsForTransfer[0]?.id || '');
                                setTransferDiffAmount(0);
                              }}
                              className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center gap-1"
                              title="Transfer to another room/bed"
                            >
                              <ArrowRightLeft className="w-3 h-3 text-slate-500" />
                              <span>Transfer</span>
                            </button>
                            <button
                              id={`notice-departure-btn-${res.id}`}
                              onClick={() => {
                                setShowNoticeModal(res);
                                const d = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
                                setNoticeDepartureDate(d);
                              }}
                              className="px-2 py-1 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold text-[10px] flex items-center gap-1"
                              title="Initiate 30-day notice period"
                            >
                              <LogOut className="w-3 h-3 text-rose-500" />
                              <span>Notice</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: STAFF & OPERATIONS */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Staff Members & Duty Roster
                </h2>
                <p className="text-xs text-slate-500">
                  Manage housekeeping, kitchen mess team, wardens, and gate security personnel
                </p>
              </div>
              <button
                id="owner-add-staff-btn"
                onClick={() => setShowAddStaffModal(true)}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/20 flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Add Staff Member</span>
              </button>
            </div>

            {/* Staff Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Staff</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">{staff.length} Members</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Across 4 departments</span>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">On Duty Now</span>
                <span className="text-xl font-black text-emerald-600 mt-1 block">
                  {staff.filter((s) => s.todayStatus === 'Checked-In').length} Active
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">Biometrically verified</span>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Monthly Payroll</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">₹68,500</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Next disbursement Oct 1</span>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Gate Security</span>
                <span className="text-xl font-black text-indigo-600 mt-1 block">24/7 Coverage</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Visitor logs synced</span>
              </div>
            </div>

            {/* Staff Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staff.map((s) => {
                const isCheckedIn = s.todayStatus === 'Checked-In';
                return (
                  <div
                    key={s.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 hover:border-slate-300 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={s.avatar}
                          alt={s.name}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-2xs"
                        />
                        <div>
                          <h3 className="font-extrabold text-sm text-slate-900">{s.name}</h3>
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 mt-0.5">
                            {s.role}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                          isCheckedIn
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isCheckedIn ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {s.todayStatus}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Shift Timing:</span>
                        <span className="font-semibold text-slate-800">{s.shift}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Last Check-in:</span>
                        <span className="font-semibold text-slate-800">{s.lastClockIn || 'Not logged today'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Mobile:</span>
                        <span className="font-semibold text-blue-700">{s.phone}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => toggleStaffClockIn(s.id)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1 ${
                          isCheckedIn
                            ? 'border-rose-200 text-rose-700 bg-rose-50/50 hover:bg-rose-50'
                            : 'border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{isCheckedIn ? 'Log Clock Out' : 'Log Clock In'}</span>
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Remove staff member ${s.name}?`)) {
                            deleteStaffMember(s.id);
                          }
                        }}
                        className="py-2 px-3 rounded-xl text-xs font-bold transition border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Gate & Staff Attendance Register
                </h2>
                <p className="text-xs text-slate-500">Live biometric and in-app check-ins</p>
              </div>
            </div>

            {/* Staff status row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {staff.map((s) => (
                <div key={s.id} className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="flex items-center gap-2 mb-2">
                    <img src={s.avatar} alt={s.name} referrerPolicy="no-referrer" className="w-7 h-7 rounded-full object-cover" />
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">{s.name}</span>
                      <span className="text-[10px] text-slate-500">{s.role}</span>
                    </div>
                  </div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.todayStatus === 'Checked-In'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {s.todayStatus}
                  </span>
                </div>
              ))}
            </div>

            {/* Attendance Records Table */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <h3 className="font-bold text-xs text-slate-900 mb-3">Recent Movement Logs</h3>
              <div className="space-y-2">
                {attendance.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                          rec.type === 'Check-In' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {rec.type === 'Check-In' ? 'IN' : 'OUT'}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">{rec.personName}</span>
                        <span className="text-[11px] text-slate-500 block">
                          {rec.personType} {rec.roomNumber ? `• Room ${rec.roomNumber}` : `• ${rec.role}`}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-slate-900">{rec.timestamp}</span>
                      <span className="text-[10px] text-slate-400 block">{rec.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: MESS MENU */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Weekly Mess Menu Planner
                </h2>
                <p className="text-xs text-slate-500">Edit dishes for each day. Visible to all residents in real-time.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mealPlan.map((day) => (
                <div key={day.day} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-extrabold text-sm text-blue-600">{day.day}</span>
                    {day.specialNote && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                        {day.specialNote}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block">Breakfast</label>
                      <input
                        type="text"
                        value={day.breakfast}
                        onChange={(e) => updateMealPlanDay(day.day, 'breakfast', e.target.value)}
                        className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block">Lunch</label>
                      <input
                        type="text"
                        value={day.lunch}
                        onChange={(e) => updateMealPlanDay(day.day, 'lunch', e.target.value)}
                        className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block">Dinner</label>
                      <input
                        type="text"
                        value={day.dinner}
                        onChange={(e) => updateMealPlanDay(day.day, 'dinner', e.target.value)}
                        className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: BROADCASTS */}
        {activeTab === 'broadcasts' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Create Broadcast Form */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <h3 className="font-extrabold text-sm text-slate-900">Send New Notice / Announcement</h3>
              <form onSubmit={handleSendBroadcast} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Notice Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lift maintenance scheduled for Friday"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Category
                  </label>
                  <select
                    value={broadcastCategory}
                    onChange={(e) => setBroadcastCategory(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden bg-white"
                  >
                    <option value="Urgent">Urgent Alert</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Rent">Rent Clearance</option>
                    <option value="Food">Food / Feast</option>
                    <option value="Event">Event / Festival</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Message Details *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Write detailed instructions or notes for residents..."
                    value={broadcastMsg}
                    onChange={(e) => setBroadcastMsg(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Broadcast to All Residents</span>
                </button>
              </form>
            </div>

            {/* Broadcast History */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <h3 className="font-extrabold text-sm text-slate-900">Broadcast History ({broadcasts.length})</h3>
              <div className="space-y-2.5">
                {broadcasts.map((b) => (
                  <div key={b.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                        {b.category}
                      </span>
                      <span className="text-[10px] text-slate-400">{b.timestamp}</span>
                    </div>
                    <h4 className="font-bold text-slate-900 mt-1">{b.title}</h4>
                    <p className="text-slate-600 mt-1 leading-relaxed text-[11px]">{b.message}</p>
                    <div className="text-[10px] text-slate-400 mt-2 font-medium">By: {b.sender}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-500">Total Projected Revenue</span>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  ₹{(totalRevenue + pendingDuesTotal).toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Based on full room occupancy</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-500">Collected Rent (September)</span>
                <p className="text-2xl font-black text-emerald-600 mt-1">
                  ₹{totalRevenue.toLocaleString()}
                </p>
                <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                  {Math.round((totalRevenue / (totalRevenue + pendingDuesTotal || 1)) * 100)}% Collected
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-500">Open Maintenance Issues</span>
                <p className="text-2xl font-black text-amber-600 mt-1">{activeTicketsCount}</p>
                <p className="text-[11px] text-slate-400 mt-1">Assigned to staff</p>
              </div>
            </div>

            {/* Collection Progress Bar */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>Monthly Rent Collection Progress</span>
                <span className="text-blue-600">
                  ₹{totalRevenue.toLocaleString()} / ₹{(totalRevenue + pendingDuesTotal).toLocaleString()}
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round((totalRevenue / (totalRevenue + pendingDuesTotal || 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add New Property Modal */}
      {showAddPropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-blue-100">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">List a New Property</h3>
                <p className="text-[11px] text-slate-500">Step {propFormStep} of 2</p>
              </div>
              <button onClick={() => setShowAddPropModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProperty} className="space-y-4 text-xs">
              {propFormStep === 1 && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Property Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Royal Palms Co-Living"
                      value={newPropName}
                      onChange={(e) => setNewPropName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">City</label>
                      <select
                        value={newPropCity}
                        onChange={(e) => setNewPropCity(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl bg-white"
                      >
                        <option value="Bengaluru">Bengaluru</option>
                        <option value="Pune">Pune</option>
                        <option value="Hyderabad">Hyderabad</option>
                        <option value="Delhi NCR">Delhi NCR</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Gender</label>
                      <select
                        value={newPropGender}
                        onChange={(e) => setNewPropGender(e.target.value as any)}
                        className="w-full px-3 py-2 border rounded-xl bg-white"
                      >
                        <option value="Boys">Boys PG</option>
                        <option value="Girls">Girls PG</option>
                        <option value="Unisex">Unisex / Co-ed</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Locality *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Koramangala 4th Block"
                      value={newPropLocality}
                      onChange={(e) => setNewPropLocality(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!newPropName || !newPropLocality) {
                        alert('Please fill out property name and locality.');
                        return;
                      }
                      setPropFormStep(2);
                    }}
                    className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-xl"
                  >
                    Next: Rooms & Pricing →
                  </button>
                </>
              )}

              {propFormStep === 2 && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold block mb-1">Single Sharing</label>
                      <input
                        type="number"
                        value={newPropSingleRent}
                        onChange={(e) => setNewPropSingleRent(Number(e.target.value))}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold block mb-1">Double Sharing</label>
                      <input
                        type="number"
                        value={newPropDoubleRent}
                        onChange={(e) => setNewPropDoubleRent(Number(e.target.value))}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold block mb-1">Triple Sharing</label>
                      <input
                        type="number"
                        value={newPropTripleRent}
                        onChange={(e) => setNewPropTripleRent(Number(e.target.value))}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">Gate Closing Time</label>
                    <input
                      type="text"
                      value={newPropGateTime}
                      onChange={(e) => setNewPropGateTime(e.target.value)}
                      className="w-full p-2 border rounded-xl"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPropFormStep(1)}
                      className="w-1/3 py-2.5 border rounded-xl font-bold"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="w-2/3 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md"
                    >
                      Publish Property Listing
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Add Staff Member Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-blue-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Add New Staff Member</h3>
                  <p className="text-[11px] text-slate-500">Assign role and duty timings</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newStaffName.trim()) return;
                addStaffMember({
                  name: newStaffName,
                  role: newStaffRole,
                  phone: newStaffPhone || '+91 98765 43210',
                  shift: newStaffShift,
                  avatar: `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 1000)}?auto=format&fit=crop&w=200&q=80`,
                  propertyId: properties[0]?.id || 'prop-1',
                });
                setShowAddStaffModal(false);
                setNewStaffName('');
                setNewStaffPhone('+91 ');
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Suresh Gowda"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Operational Role</label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                >
                  <option value="Housekeeping">Housekeeping & Cleaning</option>
                  <option value="Mess Cook">Mess Cook & Kitchen</option>
                  <option value="Security Guard">Security Guard & Gate</option>
                  <option value="Manager">Hostel Warden / Manager</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Shift Schedule</label>
                <select
                  value={newStaffShift}
                  onChange={(e) => setNewStaffShift(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                >
                  <option value="Morning (6 AM - 2 PM)">Morning (6:00 AM - 2:00 PM)</option>
                  <option value="Evening (2 PM - 10 PM)">Evening (2:00 PM - 10:00 PM)</option>
                  <option value="Night (10 PM - 6 AM)">Night (10:00 PM - 6:00 AM)</option>
                  <option value="General (8 AM - 6 PM)">General Day (8:00 AM - 6:00 PM)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
                >
                  Add to Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* AI Onboarding Modal */}
      {showAIOnboarding && (
        <AIPropertyOnboardingModal onClose={() => setShowAIOnboarding(false)} />
      )}

      {/* 360 Virtual Tour Modal */}
      {showTourModal && (
        <VirtualTourModal
          propertyName="Blue Haven Luxury Living PG"
          onClose={() => setShowTourModal(false)}
        />
      )}

      {/* Owner Listing Wizard */}
      {showListingWizard && (
        <OwnerListingWizard
          onCancel={() => setShowListingWizard(false)}
          onComplete={(listingData) => {
            console.log('Listing completed:', listingData);
            // Convert listing data to Property and add to properties
            const newProperty = convertListingToProperty(listingData);
            addProperty(newProperty);
            setShowListingWizard(false);
            // Switch to properties tab to show the new property
            setActiveTab('properties');
          }}
        />
      )}

      {/* Room Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Room & Bed Transfer</h3>
                  <p className="text-xs text-slate-500">Reallocate {showTransferModal.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowTransferModal(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmTransfer} className="space-y-4 pt-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Allocation</span>
                <p className="font-bold text-slate-800 mt-0.5">
                  Room {showTransferModal.roomNumber} • Bed {showTransferModal.bedNumber} ({showTransferModal.roomType} Sharing)
                </p>
                <p className="text-slate-500 mt-0.5">Current Monthly Rent: ₹{showTransferModal.monthlyRent.toLocaleString('en-IN')}</p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Target Available Bed</label>
                {availableBedsForTransfer.length === 0 ? (
                  <p className="p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-200">
                    No vacant beds available for transfer right now.
                  </p>
                ) : (
                  <select
                    value={transferTargetBedId}
                    onChange={(e) => setTransferTargetBedId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-medium"
                  >
                    {availableBedsForTransfer.map((b) => (
                      <option key={b.id} value={b.id}>
                        Room {b.roomNumber} — {b.bedNumber} ({b.roomType} Sharing) • ₹{b.rentPerMonth.toLocaleString('en-IN')}/mo
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Rent Difference / Proration Adjustment (₹)</label>
                <input
                  type="number"
                  value={transferDiffAmount}
                  onChange={(e) => setTransferDiffAmount(Number(e.target.value))}
                  placeholder="0 (or positive for upgrade, negative for discount)"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-medium"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Positive adjustments will be invoiced or prorated deterministically.
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(null)}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={availableBedsForTransfer.length === 0}
                  className="w-2/3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs"
                >
                  Confirm Reallocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notice Period Modal */}
      {showNoticeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <LogOut className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Initiate Move-Out Notice</h3>
                  <p className="text-xs text-slate-500">{showNoticeModal.name} • Room {showNoticeModal.roomNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setShowNoticeModal(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmNotice} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Expected Departure Date</label>
                <input
                  type="date"
                  value={noticeDepartureDate}
                  onChange={(e) => setNoticeDepartureDate(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-medium"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Mandatory 30-day notice window per standard PG agreement policy.
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason for Move-Out</label>
                <select
                  value={noticeReason}
                  onChange={(e) => setNoticeReason(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-medium"
                >
                  <option value="Job relocation">Job relocation / Company transfer</option>
                  <option value="Course completion">Course / Internship completed</option>
                  <option value="Personal / Family reason">Personal / Family reason</option>
                  <option value="Switching to independent flat">Moving to flat / other accommodation</option>
                </select>
              </div>

              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 text-[11px] space-y-1">
                <p className="font-bold">Next steps upon checkout:</p>
                <p>Stay record moves to 'Notice Period'. Bed reservation opens for future bookings after departure.</p>
                <p>Security deposit settlement workflow will trigger in the Accountant ledger.</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNoticeModal(null)}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs"
                >
                  Confirm Notice Period
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
