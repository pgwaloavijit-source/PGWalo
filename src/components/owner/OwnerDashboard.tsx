import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Property, Resident, GenderPreference, RoomSharingType, OwnerListingData, RoomOption, StaffMember } from '../../types';
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
  Pencil,
} from 'lucide-react';
import { BedMatrixTab } from './BedMatrixTab';
import { LeadFunnelTab } from './LeadFunnelTab';
import { AgreementsTab } from './AgreementsTab';
import { ProfitabilityTab } from './ProfitabilityTab';
import { AIPropertyOnboardingModal } from '../features/AIPropertyOnboardingModal';
import { VirtualTourModal } from '../features/VirtualTourModal';
import { createStaffWithWorkers } from '../../services/auth';
import { getAuthToken, isProductionApiEnabled } from '../../services/productionApi';
import { UserAvatar } from '../common/UserAvatar';
import { ListingImage } from '../common/ListingImage';
import { OwnerListingWizard } from './OwnerListingWizard';
import { useOwnerScope } from '../../utils/ownership';
import { AMENITIES, amenityLabel, normalizeAmenities } from '../../utils/amenities';

export const OwnerDashboard: React.FC = () => {
  const {
    addProperty,
    updateProperty,
    approveBookingRequest,
    rejectBookingRequest,
    addStaffMember,
    deleteStaffMember,
    toggleStaffClockIn,
    broadcasts,
    addBroadcast,
    mealPlan,
    updateMealPlanDay,
    updateRentStatus,
    generateMonthlyInvoices,
    processRoomTransfer,
    initiateNoticePeriod,
    executeCheckoutSettlement,
  } = useApp();
  const {
    currentUser,
    hasListings,
    properties,
    residents,
    bookingRequests,
    attendance,
    staff,
    tickets,
    beds,
    leads,
    agreements,
    invoices,
  } = useOwnerScope();

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
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

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
    const rooms: RoomOption[] = (step2?.rooms || []).map((room) => {
      let roomType: RoomSharingType = 'Double';
      if (room.sharingCapacity === 'Single') roomType = 'Single';
      else if (room.sharingCapacity === 'Triple') roomType = 'Triple';
      else if (room.sharingCapacity === '4 Sharing') roomType = 'Four';
      else roomType = 'Double';

      const firstBed = room.beds?.[0];
      return {
        id: room.roomNumber || `room-${Math.random().toString(36).slice(2, 8)}`,
        type: roomType,
        rentPerMonth: firstBed?.monthlyRent || 8000,
        deposit: firstBed?.securityDeposit || 8000,
        availableBeds: (room.beds || []).filter((b) => b.status === 'Available' || b.status === 'Vacant').length,
        totalBeds: (room.beds || []).length,
        hasAttachedBath: (step3?.roomAmenities || []).some((a) => a.id === 'attached-bathroom' && a.selected),
        hasAC: (step3?.roomAmenities || []).some((a) => a.id === 'ac' && a.selected),
        hasBalcony: (step3?.roomAmenities || []).some((a) => a.id === 'Balcony' && a.selected),
      };
    });

    // Calculate starting price from lowest room
    const startingPrice = rooms.length > 0 ? Math.min(...rooms.map(r => r.rentPerMonth)) : 8000;

    const amenityIds = normalizeAmenities([
      ...(step3?.roomAmenities || []).filter((a) => a.selected).map((a) => a.id),
      ...(step3?.propertyAmenities || []).filter((a) => a.selected).map((a) => a.id),
      ...(step3?.foodAvailable ? ['three_time_food'] : []),
      ...(step3?.otherServices || []),
    ]);

    // Convert rules to string array
    const rules = [
      `Check-in: ${step5?.checkInTime || 'Flexible'}`,
      `Curfew: ${step5?.curfewTime || '11:00 PM'}`,
      `Smoking: ${step5?.smokingAllowed ? 'Allowed' : 'Not Allowed'}`,
      `Alcohol: ${step5?.alcoholAllowed ? 'Allowed' : 'Not Allowed'}`,
      `Visitors: ${step5?.visitorsAllowed || 'Restricted'}`,
      `Pets: ${step5?.petsAllowed ? 'Allowed' : 'Not Allowed'}`,
      `Cooking: ${step5?.cookingAllowed ? 'Allowed' : 'Not Allowed'}`,
    ];

    if (step5?.additionalRules && step5.additionalRules.trim()) {
      rules.push(step5.additionalRules.trim());
    }

    // Use uploaded photos or default
    const coverImage = (step4?.photos || []).find((p) => p.category === 'Exterior')?.url ||
                      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80';

    const galleryImages = (step4?.photos || []).map((p) => p.url).filter(Boolean);

    return {
      organizationId: currentUser?.organizationId || `org-${currentUser?.id || 'owner'}`,
      ownerUserId: currentUser?.id,
      status: 'Active',
      name: step1?.propertyName || 'New PG',
      tagline: step1?.propertyDescription || '',
      gender: step1?.genderOccupancy === 'Boys' ? 'Boys' :
             step1?.genderOccupancy === 'Girls' ? 'Girls' :
             step1?.genderOccupancy === 'Unisex / Co-ed' ? 'Unisex' : 'Unisex',
      city: step1?.city || '',
      locality: step1?.pincode || step1?.locality || '',
      state: step1?.state || '',
      country: step1?.country || 'India',
      pincode: step1?.pincode || step1?.locality || '',
      address: step1?.fullAddress || '',
      lat: step1?.mapLocation?.lat || 12.9716,
      lng: step1?.mapLocation?.lng || 77.5946,
      placeLabel: step1?.nearbyLandmark,
      coverImage,
      galleryImages,
      startingPrice,
      rating: 4.5,
      reviewCount: 0,
      rooms,
      amenities: amenityIds,
      rules,
      noticePeriodDays: step5?.noticePeriod === '15 Days' ? 15 :
                       step5?.noticePeriod === '30 Days' ? 30 :
                       step5?.noticePeriod === '60 Days' ? 60 : 30,
      gateClosingTime: step5?.curfewTime || '11:00 PM',
      foodIncluded: Boolean(step3?.foodAvailable),
      foodIncludedInRate: Boolean(step3?.foodIncludedInRate),
      electricityRatePerUnit: step3?.electricityRatePerUnit || 0,
      taxPercent: step3?.taxPercent || 0,
      optionalCharges: step3?.optionalCharges || [],
      verified: step7?.verificationStatus === 'Verified',
      featured: false,
      contactPhone: step6?.mobileNumber || currentUser?.phone || '',
      contactEmail: step6?.emailAddress || currentUser?.email || '',
      ownerName: step6?.fullName || currentUser?.name || 'Owner',
      ownerProfileSlug: (step6?.fullName || currentUser?.name || 'owner').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      listingPaymentStatus: listingData.listingStatus === 'Published' ? 'Paid' : 'Pending',
      listingFeeAmount: 999,
      publishedAt: listingData.listingStatus === 'Published' ? new Date().toISOString() : undefined,
      listingStatus: listingData.listingStatus === 'Published' ? 'Active' : 'Payment Pending',
      floors: (step2?.rooms || []).length,
    };
  };

  const propertyToListingData = (property: Property): Partial<OwnerListingData> => ({
    step1: {
      propertyName: property.name,
      city: property.city,
      state: property.state || '',
      country: property.country || 'India',
      genderOccupancy:
        property.gender === 'Boys' ? 'Boys' : property.gender === 'Girls' ? 'Girls' : 'Unisex / Co-ed',
      locality: property.pincode || property.locality || '',
      propertyType: 'PG',
      propertyDescription: property.tagline || '',
      fullAddress: property.address || '',
      pincode: property.pincode || property.locality || '',
      nearbyLandmark: property.placeLabel || '',
      mapLocation: property.lat && property.lng ? { lat: property.lat, lng: property.lng } : undefined,
    },
    step2: {
      rooms: (property.rooms || []).map((room) => ({
        roomNumber: room.id,
        floor: '1st Floor',
        roomType: room.type === 'Single' ? 'Private' : 'Shared',
        sharingCapacity: room.type === 'Four' ? '4 Sharing' : room.type,
        numberOfBeds: room.totalBeds || 1,
        beds: Array.from({ length: room.totalBeds || 1 }, (_, index) => ({
          bedId: `${room.id}-${index}`,
          bedName: `Bed ${String.fromCharCode(65 + index)}`,
          status: index < (room.availableBeds || 0) ? 'Available' : 'Occupied',
          monthlyRent: room.rentPerMonth,
          securityDeposit: room.deposit,
        })),
      })),
    },
    step3: {
      roomAmenities: [
        { id: 'AC', name: 'AC', selected: property.rooms?.some((r) => r.hasAC) || false },
        { id: 'Attached Bathroom', name: 'Attached Bathroom', selected: property.rooms?.some((r) => r.hasAttachedBath) || false },
        { id: 'Balcony', name: 'Balcony', selected: property.rooms?.some((r) => r.hasBalcony) || false },
      ],
      propertyAmenities: AMENITIES.map((amenity) => ({
        id: amenity.id,
        name: amenity.name,
        selected: normalizeAmenities(property.amenities || []).includes(amenity.id),
      })),
      foodAvailable: normalizeAmenities(property.amenities || []).includes('three_time_food') || property.foodIncluded,
      foodIncludedInRate: Boolean(property.foodIncludedInRate ?? property.foodIncluded),
      foodOptions: [
        { id: 'breakfast', name: 'Breakfast', selected: property.foodIncluded },
        { id: 'lunch', name: 'Lunch', selected: property.foodIncluded },
        { id: 'dinner', name: 'Dinner', selected: property.foodIncluded },
      ],
      foodCharges: property.foodIncludedInRate ? 0 : undefined,
      electricityRatePerUnit: property.electricityRatePerUnit || 8.5,
      taxPercent: property.taxPercent || 0,
      optionalCharges: property.optionalCharges || [],
      otherServices: [],
    },
    step4: {
      photos: (property.galleryImages?.length ? property.galleryImages : [property.coverImage]).filter(Boolean).map((url, index) => ({
        id: `existing-${property.id}-${index}`,
        url,
        category: index === 0 ? 'Exterior' : 'Bedroom',
        qualityScore: 90,
        uploadDate: property.publishedAt || new Date().toISOString(),
      })),
    },
    step6: {
      fullName: property.ownerName,
      mobileNumber: property.contactPhone,
      whatsappNumber: property.contactPhone,
      emailAddress: property.contactEmail,
      role: 'Property Owner',
      preferredContact: 'Phone',
    },
    createdAt: property.publishedAt || new Date().toISOString(),
    listingStatus: property.listingStatus === 'Active' ? 'Published' : 'Payment Pending',
  });

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
  const [newStaffRole, setNewStaffRole] = useState<'Housekeeping' | 'Mess Cook' | 'Security Guard' | 'Manager' | 'Electrician'>('Housekeeping');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffPropertyId, setNewStaffPropertyId] = useState('');
  const [staffCredentials, setStaffCredentials] = useState<{ name: string; phone: string; pin: string; staffRole: string } | null>(null);
  const [staffFormError, setStaffFormError] = useState('');
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
  const occupancyRate =
    beds.length > 0 ? Math.round((beds.filter((b) => b.status === 'Occupied').length / beds.length) * 100) : 0;
  const activeTicketsCount = tickets.filter((t) => t.status !== 'Resolved').length;
  const visitRequests = bookingRequests.filter((r) => r.type === 'visit').length;
  const bedApplications = bookingRequests.filter((r) => r.type !== 'visit').length;
  const occupiedBeds = beds.filter((b) => b.status === 'Occupied').length;
  const visibleBroadcasts = currentUser?.isDemo
    ? broadcasts
    : broadcasts.filter((b) => properties.some((property) => property.id === b.propertyId));

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
      contactPhone: currentUser?.phone || '',
      contactEmail: currentUser?.email || '',
      ownerName: currentUser?.name || 'Owner',
      ownerUserId: currentUser?.id,
      organizationId: currentUser?.organizationId || `org-${currentUser?.id || 'owner'}`,
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
      propertyId: properties[0]?.id,
      propertyName: properties[0]?.name,
      sender: currentUser?.name || 'Property Owner',
    });

    setBroadcastTitle('');
    setBroadcastMsg('');
    setReminderToast('Broadcast published to this PG residents only!');
    setTimeout(() => setReminderToast(null), 3500);
  };

  const handlePushRentReminders = () => {
    const overdueResidents = residents.filter((r) => r.rentStatus !== 'Paid');
    addBroadcast({
      title: 'Monthly Rent Reminder (Urgent)',
      message: `Dear residents with pending dues, kindly clear your room dues today. Instant online UPI payment is available in your Resident Portal.`,
      category: 'Rent',
      target: 'All Residents',
      propertyId: properties[0]?.id,
      propertyName: properties[0]?.name,
      sender: `${currentUser?.name || 'Owner'} (Owner)`,
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
              Welcome{hasListings ? ' back' : ''}, {currentUser?.name || 'Owner'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {hasListings
                ? `Managing ${properties[0].name}${
                    properties.length > 1
                      ? ` & ${properties.length - 1} other ${properties.length === 2 ? 'property' : 'properties'}`
                      : ''
                  }`
                : 'Your console is empty until you list a PG. Data stays on this account only.'}
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

      {/* Owner workspace: vertical rail (same pattern as resident dashboard) */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 flex gap-3 lg:gap-6 items-start">
        <nav
          aria-label="Owner sections"
          className="sticky top-20 z-10 shrink-0 w-[4.85rem] sm:w-56 lg:w-64 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-3xl bg-white border border-slate-200 shadow-2xs p-1.5 sm:p-2"
        >
          {[
            { key: 'overview', label: 'Overview', icon: TrendingUp, count: 0 },
            { key: 'beds', label: 'Bed Matrix', icon: BedIcon, count: beds.length },
            { key: 'leads', label: 'Leads Funnel', icon: Users, count: leads.length },
            { key: 'agreements', label: 'Agreements', icon: FileText, count: agreements.length },
            { key: 'profitability', label: 'Profitability & NOI', icon: PieChart, count: 0 },
            { key: 'properties', label: 'Properties', icon: Building2, count: properties.length },
            { key: 'residents', label: 'Residents & Bookings', icon: Users, count: residents.length },
            { key: 'staff', label: 'Staff & Team', icon: ShieldCheck, count: staff.length },
            { key: 'attendance', label: 'Attendance & Gate Log', icon: Clock, count: 0 },
            { key: 'menu', label: 'Mess & Food Menu', icon: Utensils, count: 0 },
            { key: 'broadcasts', label: 'Broadcasts & Alerts', icon: Bell, count: 0 },
            { key: 'reports', label: 'Financial Reports', icon: BarChart3, count: 0 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`w-full mb-1 last:mb-0 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 px-1.5 py-2.5 sm:px-3 sm:py-2.5 text-center sm:text-left transition min-h-[52px] sm:min-h-[44px] ${
                  active ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-700'
                }`}
              >
                <Icon className="w-4 h-4 mx-auto sm:mx-0 shrink-0" />
                <span className="text-[10px] sm:text-xs font-bold leading-tight">{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`sm:ml-auto px-1.5 rounded-full text-[10px] font-black ${
                      active ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="flex-1 min-w-0 mb-6">

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
                  <span>{hasListings ? 'From paid residents this month' : 'No billed residents yet'}</span>
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
                  {occupancyRate}% Bed Occupancy Rate
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

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
              <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Your listings, this account</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-lg font-black text-slate-900">{properties.length}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Listed PGs</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-lg font-black text-slate-900">{occupiedBeds}/{beds.length || 0}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Beds occupied</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-lg font-black text-slate-900">{visitRequests}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Visit requests</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-lg font-black text-slate-900">{bedApplications}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Bed applications</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">
                {hasListings
                  ? `${staff.length} staff on this account · ${occupancyRate}% occupancy`
                  : 'Counts stay at zero until you list a PG and people enquire on it.'}
              </p>
            </div>

            {/* Inquiries & Quick Actions Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Pending Booking Requests */}
              <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <h3 className="font-extrabold text-slate-900 text-sm">
                      Visits & stay requests ({bookingRequests.filter((r) => r.status === 'Pending').length})
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
                              {req.phone} • {req.propertyName} • {req.type === 'visit' ? `Tour: ${req.visitDate || req.preferredMoveInDate} (${req.visitTimeSlot || '10 AM - 12 PM'})` : `Move-in: ${req.preferredMoveInDate}`} • {req.occupancyType}
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
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{req.type === 'visit' ? 'Confirm visit' : 'Approve & allocate bed'}</span>
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
              {properties.length === 0 && (
                <div className="md:col-span-2 bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                  <p className="text-sm font-bold text-slate-800">No properties on this account yet</p>
                  <p className="text-xs text-slate-500">Catalog PGs on the public site belong to other operators. List yours to manage beds and residents here.</p>
                  <button
                    type="button"
                    onClick={() => setShowListingWizard(true)}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                  >
                    List New Property
                  </button>
                </div>
              )}
              {properties.map((prop) => (
                <div
                  key={prop.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3 min-w-0">
                      <ListingImage src={prop.coverImage} alt={prop.name} className="w-16 h-12 rounded-xl shrink-0" />
                      <div className="min-w-0">
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
                      {(prop.listingPaymentStatus === 'Pending' || prop.listingStatus === 'Payment Pending') && (
                        <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Payment pending
                        </span>
                      )}
                      <h3 className="font-extrabold text-slate-900 text-base mt-1">{prop.name}</h3>
                      <p className="text-xs text-slate-500 truncate">PIN {prop.pincode || prop.locality}, {prop.city}</p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                      From ₹{prop.startingPrice.toLocaleString()} /mo
                    </span>
                  </div>

                  {/* Rooms breakdown */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                    {prop.rooms?.map((r) => (
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
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-[11px] text-emerald-900">
                    PGWalo is 0% commission. Rent, tax, security deposit and utilities remain between tenant and owner.
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    {(prop.listingPaymentStatus === 'Pending' || prop.listingStatus === 'Payment Pending') && (
                      <button
                        type="button"
                        onClick={() => {
                          updateProperty(prop.id, {
                            listingPaymentStatus: 'Paid',
                            listingStatus: 'Active',
                            listingFeeAmount: prop.listingFeeAmount || 999,
                            publishedAt: new Date().toISOString(),
                          });
                          setReminderToast(`${prop.name} is paid and published.`);
                          setTimeout(() => setReminderToast(null), 3500);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Pay & publish
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProperty(prop);
                        setShowListingWizard(true);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
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
              <div className="grid grid-cols-1 md:grid-cols-1">
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Total staff</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">{staff.length}</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {staff.length ? `${new Set(staff.map((s) => s.role)).size} roles assigned` : 'None added yet'}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">On duty now</span>
                <span className="text-xl font-black text-emerald-600 mt-1 block">
                  {staff.filter((s) => s.todayStatus === 'Checked-In').length}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Clocked in today</span>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Managers / wardens</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {staff.filter((s) => s.role === 'Manager').length}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Duty role: Manager</span>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Security</span>
                <span className="text-xl font-black text-indigo-600 mt-1 block">
                  {staff.filter((s) => s.role === 'Security Guard').length}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Gate coverage</span>
              </div>
            </div>

            {/* Staff Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staff.length === 0 && (
                <div className="md:col-span-2 lg:col-span-3 bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-2">
                  <p className="text-sm font-bold text-slate-800">No staff on this account</p>
                  <p className="text-xs text-slate-500">Add a person, pick a duty role, and assign them to a PG you listed. They sign in as Staff with the PIN you share.</p>
                </div>
              )}
              {staff.map((s) => {
                const isCheckedIn = s.todayStatus === 'Checked-In';
                return (
                  <div
                    key={s.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 hover:border-slate-300 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={s.name} src={s.avatar} sizeClass="w-12 h-12 text-sm" />
                        <div>
                          <h3 className="font-extrabold text-sm text-slate-900">{s.name}</h3>
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 mt-0.5">
                            {s.role}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {properties.find((p) => p.id === s.propertyId)?.name || 'Unassigned PG'}
                          </p>
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
              {!hasListings && (
                <p className="md:col-span-2 text-xs text-slate-500 bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                  Mess menu is empty until you list a property. You can edit it after your first listing.
                </p>
              )}
              {hasListings && mealPlan.map((day) => (
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
                  <span>Send to This PG Residents</span>
                </button>
              </form>
            </div>

            {/* Broadcast History */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <h3 className="font-extrabold text-sm text-slate-900">Broadcast History ({visibleBroadcasts.length})</h3>
              <div className="space-y-2.5">
                {visibleBroadcasts.length === 0 && (
                  <p className="text-xs text-slate-500 py-6 text-center">No notices yet. Broadcasts stay on this account after you list a PG.</p>
                )}
                {visibleBroadcasts.map((b) => (
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
                <p className="text-[11px] text-slate-400 mt-1">Paid + pending rent on this account</p>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-[100] animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92dvh] overflow-y-auto p-6 shadow-2xl border border-blue-100">
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
              onSubmit={async (e) => {
                e.preventDefault();
                setStaffFormError('');
                if (!newStaffName.trim() || newStaffPhone.replace(/\D/g, '').length < 10 || newStaffPin.length < 6) {
                  setStaffFormError('Name, 10-digit mobile and 6-digit PIN are required.');
                  return;
                }
                const propertyId = newStaffPropertyId || properties[0]?.id;
                if (!propertyId) {
                  setStaffFormError('List a PG first, then assign staff to it.');
                  return;
                }
                const rosterEntry = {
                  name: newStaffName.trim(),
                  role: newStaffRole,
                  phone: newStaffPhone.replace(/\D/g, '').slice(-10),
                  shift: newStaffShift as StaffMember['shift'],
                  avatar: '',
                  propertyId,
                  todayStatus: 'Checked-Out' as const,
                };
                const credentials = {
                  name: newStaffName.trim(),
                  phone: newStaffPhone.replace(/\D/g, '').slice(-10),
                  pin: newStaffPin,
                  staffRole: newStaffRole,
                };
                if (isProductionApiEnabled() && getAuthToken()) {
                  const res = await createStaffWithWorkers({
                    name: newStaffName.trim(),
                    phone: newStaffPhone,
                    email: newStaffEmail || undefined,
                    staffRole: newStaffRole,
                    pin: newStaffPin,
                    propertyId,
                    shift: newStaffShift,
                  });
                  if (!res.success) {
                    setStaffFormError(res.error || 'Could not create staff login.');
                    return;
                  }
                  setStaffCredentials(res.credentials || credentials);
                  addStaffMember({ ...rosterEntry, id: res.staffId });
                } else {
                  addStaffMember(rosterEntry);
                  setStaffCredentials(credentials);
                }
                setNewStaffName('');
                setNewStaffPhone('');
                setNewStaffEmail('');
                setNewStaffPin('');
              }}
              className="mt-4 space-y-3"
            >
              {staffFormError && (
                <p className="p-3 rounded-xl bg-rose-50 text-xs text-rose-700">{staffFormError}</p>
              )}
              {staffCredentials && (
                <div className="p-3 rounded-xl bg-emerald-50 text-xs text-emerald-800 space-y-1">
                  <p className="font-bold">Share these once — they sign in as Staff with this mobile + PIN.</p>
                  <p>Name: {staffCredentials.name}</p>
                  <p>Mobile: {staffCredentials.phone}</p>
                  <p>PIN: {staffCredentials.pin}</p>
                  <p>Duty role: {staffCredentials.staffRole}</p>
                  {isProductionApiEnabled() && !getAuthToken() && (
                    <p className="text-amber-800 pt-1">Roster is saved here. Sign in again as owner if this PIN must work from another device.</p>
                  )}
                </div>
              )}
              {properties.length === 0 && (
                <p className="text-xs text-amber-700">List a PG first, then add staff for that property.</p>
              )}
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
                <label className="text-xs font-bold text-slate-700 block mb-1">Duty role</label>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ['Housekeeping', 'Housekeeping'],
                    ['Mess Cook', 'Kitchen'],
                    ['Electrician', 'Maintenance'],
                    ['Security Guard', 'Security'],
                    ['Manager', 'Warden'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setNewStaffRole(value)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                        newStaffRole === value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Email (optional)</label>
                <input
                  type="email"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Login PIN (6 digits)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    minLength={6}
                    maxLength={6}
                    value={newStaffPin}
                    onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setNewStaffPin(String(Math.floor(100000 + Math.random() * 900000)))}
                    className="shrink-0 px-3 rounded-xl border border-slate-200 text-[11px] font-bold text-blue-700"
                  >
                    Generate
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Staff sign in with this mobile + PIN. Duty role is {newStaffRole}.</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Assigned PG</label>
                <select
                  value={newStaffPropertyId || properties[0]?.id || ''}
                  onChange={(e) => setNewStaffPropertyId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
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
          propertyName={properties[0]?.name || 'Your PG'}
          onClose={() => setShowTourModal(false)}
        />
      )}

      {/* Owner Listing Wizard */}
      {showListingWizard && (
        <OwnerListingWizard
          initialData={editingProperty ? propertyToListingData(editingProperty) : undefined}
          onCancel={() => {
            setShowListingWizard(false);
            setEditingProperty(null);
          }}
            onComplete={(listingData) => {
            try {
              const newProperty = convertListingToProperty(listingData);
              if (editingProperty) {
                updateProperty(editingProperty.id, newProperty);
              } else {
                addProperty(newProperty);
              }
              setShowListingWizard(false);
              setEditingProperty(null);
              setActiveTab('properties');
              setReminderToast(
                newProperty.listingPaymentStatus === 'Paid'
                  ? `${newProperty.name} is live on your account.`
                  : `${newProperty.name} is saved. Pay & publish when ready.`
              );
              setTimeout(() => setReminderToast(null), 4000);
            } catch (error) {
              console.error('Failed to save listing', error);
              setShowListingWizard(false);
              setEditingProperty(null);
            }
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
