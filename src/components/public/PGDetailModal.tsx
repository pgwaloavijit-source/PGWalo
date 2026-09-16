import React, { useState, useEffect } from 'react';
import { Property, RoomSharingType, PendingCustomerAction } from '../../types';
import { useApp } from '../../context/AppContext';
import { INITIAL_AMENITIES } from '../../mockData';
import {
  X,
  MapPin,
  Star,
  ShieldCheck,
  Utensils,
  Wifi,
  Phone,
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  Share2,
  ChevronRight,
  Info,
  CalendarCheck2,
  BedDouble,
  User,
  LogIn,
  UserPlus,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const PGDetailModal: React.FC<{
  property: Property;
  onClose: () => void;
  onGoToDashboard?: () => void;
}> = ({ property, onClose, onGoToDashboard }) => {
  const {
    currentUser,
    mealPlan,
    confirmDirectAction,
    setPendingAction,
    openAuthModal,
    confirmedAction,
    setConfirmedAction,
    setRole,
  } = useApp();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'rooms' | 'amenities' | 'menu' | 'rules'>('rooms');
  
  // Action state: null | 'visit' | 'booking'
  const [actionType, setActionType] = useState<'visit' | 'booking' | null>(null);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{
    referenceId: string;
    action: PendingCustomerAction;
  } | null>(null);

  // Form State
  const [applicantName, setApplicantName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [selectedRoom, setSelectedRoom] = useState<RoomSharingType>(property.rooms[0]?.type || 'Double');
  const [moveInDate, setMoveInDate] = useState('2026-09-15');
  const [visitDate, setVisitDate] = useState('2026-09-08');
  const [visitTimeSlot, setVisitTimeSlot] = useState<'Morning (10:00 AM - 12:00 PM)' | 'Afternoon (2:00 PM - 4:00 PM)' | 'Evening (5:00 PM - 7:00 PM)'>('Morning (10:00 AM - 12:00 PM)');
  const [occupancyType, setOccupancyType] = useState<'Working Professional' | 'Student'>('Working Professional');
  const [message, setMessage] = useState('');

  // Update applicant info when currentUser changes
  useEffect(() => {
    if (currentUser) {
      if (!applicantName) setApplicantName(currentUser.name);
      if (!email) setEmail(currentUser.email);
      if (!phone && currentUser.phone) setPhone(currentUser.phone);
    }
  }, [currentUser]);

  // If confirmedAction matches this property from AppContext post-auth, show confirmation
  useEffect(() => {
    if (confirmedAction && confirmedAction.action.property.id === property.id) {
      setConfirmationData(confirmedAction);
      setActionType(confirmedAction.action.type);
    }
  }, [confirmedAction, property.id]);

  const images = property.galleryImages.length > 0 ? property.galleryImages : [property.coverImage];

  const handleOpenAction = (type: 'visit' | 'booking') => {
    setActionType(type);
    if (!currentUser) {
      // Prompt authentication, saving intent
      setAuthPromptOpen(true);
      setPendingAction({
        type,
        property,
        roomType: selectedRoom,
        date: type === 'visit' ? visitDate : moveInDate,
        timeSlot: type === 'visit' ? visitTimeSlot : undefined,
        occupancyType,
        message,
      });
    }
  };

  const handleActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName || !phone) {
      alert('Please provide your name and contact phone number.');
      return;
    }

    const action: PendingCustomerAction = {
      type: actionType || 'booking',
      property,
      roomType: selectedRoom,
      date: actionType === 'visit' ? visitDate : moveInDate,
      timeSlot: actionType === 'visit' ? visitTimeSlot : undefined,
      occupancyType,
      message,
    };

    const result = confirmDirectAction(action);
    setConfirmationData({
      referenceId: result.referenceId,
      action,
    });
  };

  const handleNavigateToDashboard = () => {
    setConfirmationData(null);
    setConfirmedAction(null);
    onClose();
    if (onGoToDashboard) {
      onGoToDashboard();
    } else {
      setRole('resident');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold text-white ${
                property.gender === 'Girls'
                  ? 'bg-rose-600'
                  : property.gender === 'Boys'
                  ? 'bg-blue-600'
                  : 'bg-emerald-600'
              }`}
            >
              {property.gender} PG
            </span>
            {property.verified && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                Verified Campus
              </span>
            )}
            <span className="text-xs font-medium text-slate-500 hidden sm:inline">
              • {property.locality}, {property.city}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: property.name, url: window.location.href });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  alert('PG details link copied to clipboard!');
                }
              }}
              className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-white border border-slate-200 transition"
              title="Share PG Link"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              id="pg-detail-close-btn"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white border border-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Gallery Carousel */}
          <div>
            <div className="relative h-64 sm:h-80 rounded-2xl overflow-hidden bg-slate-100">
              <img
                src={images[activeImageIndex]}
                alt={property.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 right-3 px-3 py-1 rounded-xl bg-slate-900/80 backdrop-blur-xs text-white text-xs font-bold flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{property.rating}</span>
                <span className="text-slate-300">({property.reviewCount} reviews)</span>
              </div>
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImageIndex(i)}
                    className={`relative w-20 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition ${
                      activeImageIndex === i ? 'border-blue-600 ring-2 ring-blue-100' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="Thumbnail" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title and Locality Information */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                {property.name}
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{property.address}</span>
              </div>
              <p className="text-xs text-slate-600 mt-2 font-normal leading-relaxed">
                {property.tagline}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 text-right sm:text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider block">
                Starting Monthly Rent
              </span>
              <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                ₹{(property.startingPrice ?? 0).toLocaleString()}
                <span className="text-xs font-normal text-slate-500"> / mo</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Includes 3 Meals & Wi-Fi</span>
            </div>
          </div>

          {/* Neighborhood & Location Highlights */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-800 mb-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>Area Highlights & Connectivity</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <p className="font-semibold text-slate-900">Tech Park Proximity</p>
                <p className="text-[11px] text-slate-500 mt-0.5">0.8 km from major IT hubs</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <p className="font-semibold text-slate-900">Metro / Bus Transit</p>
                <p className="text-[11px] text-slate-500 mt-0.5">5 mins walk to main bus stop</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <p className="font-semibold text-slate-900">Warden Desk & Gate</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Gate closes at {property.gateClosingTime}</p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-slate-200 flex items-center gap-6 text-xs font-bold">
            <button
              onClick={() => setActiveTab('rooms')}
              className={`pb-3 border-b-2 transition ${
                activeTab === 'rooms' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Room Pricing & Sharing
            </button>
            <button
              onClick={() => setActiveTab('amenities')}
              className={`pb-3 border-b-2 transition ${
                activeTab === 'amenities' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Amenities ({property.amenities.length})
            </button>
            <button
              onClick={() => setActiveTab('menu')}
              className={`pb-3 border-b-2 transition ${
                activeTab === 'menu' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Mess Food Menu
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`pb-3 border-b-2 transition ${
                activeTab === 'rules' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              House Rules
            </button>
          </div>

          {/* Tab 1: Room Details & Pricing */}
          {activeTab === 'rooms' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {property.rooms.map((room) => (
                <div
                  key={room.id}
                  className={`p-4 rounded-2xl border transition relative ${
                    selectedRoom === room.type
                      ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-slate-900 text-sm">{room.type} Sharing</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        room.availableBeds > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {room.availableBeds > 0 ? `${room.availableBeds} beds left` : 'Sold out'}
                    </span>
                  </div>
                  <div className="text-lg font-black text-slate-900 mb-2">
                    ₹{(room.rentPerMonth ?? 0).toLocaleString()}
                    <span className="text-xs font-normal text-slate-500"> / mo</span>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-2 mb-3">
                    <p>Security Deposit: ₹{(room.deposit ?? (room as any).securityDeposit ?? 0).toLocaleString()}</p>
                    <p>Notice Period: {property.noticePeriodDays || 30} days</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRoom(room.type);
                      handleOpenAction('booking');
                    }}
                    className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-xs"
                  >
                    Select & Book
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Tab 2: Amenities */}
          {activeTab === 'amenities' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {INITIAL_AMENITIES.map((amenity) => {
                const included = property.amenities.includes(amenity.id);
                return (
                  <div
                    key={amenity.id}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-medium transition ${
                      included ? 'bg-white border-slate-200 text-slate-800' : 'opacity-40 border-dashed border-slate-200 text-slate-400'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 ${included ? 'text-blue-600' : 'text-slate-300'}`}
                    />
                    <span>{amenity.name}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab 3: Food Menu */}
          {activeTab === 'menu' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-amber-700 shrink-0" />
                <span>3 Fresh Homely Meals included in monthly rent. Vegetarian & Non-Veg options available.</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mealPlan.map((day) => (
                  <div key={day.id} className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs">
                    <p className="font-bold text-slate-900 mb-1 border-b pb-1 text-xs">{day.day}</p>
                    <div className="space-y-1 text-[11px] text-slate-600">
                      <p><strong>Breakfast:</strong> {day.breakfast}</p>
                      <p><strong>Lunch:</strong> {day.lunch}</p>
                      <p><strong>Dinner:</strong> {day.dinner}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Rules */}
          {activeTab === 'rules' && (
            <div className="space-y-2">
              {property.rules.map((rule, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5"
                >
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ================= STEP 4: PRIMARY ACTIONS BAR ================= */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="hidden sm:flex items-center gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-blue-600" />
              <span>{property.contactPhone}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-blue-600" />
              <span>{property.contactEmail}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Primary Action 1: Schedule a Visit */}
            <button
              id="schedule-visit-btn"
              onClick={() => handleOpenAction('visit')}
              className="flex-1 sm:flex-none px-5 py-3 rounded-xl border border-blue-600 text-blue-700 hover:bg-blue-50 active:scale-98 font-bold text-xs transition shadow-2xs flex items-center justify-center gap-2 min-h-[44px]"
            >
              <CalendarCheck2 className="w-4 h-4 text-blue-600" />
              <span>Schedule a Visit</span>
            </button>

            {/* Primary Action 2: Book / Request to Join */}
            <button
              id="request-to-join-btn"
              onClick={() => handleOpenAction('booking')}
              className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold text-xs transition shadow-md flex items-center justify-center gap-2 min-h-[44px]"
            >
              <BedDouble className="w-4 h-4" />
              <span>Book / Request to Join</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= ACTION / BOOKING / VISIT MODAL ================= */}
      {actionType && !authPromptOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            {/* Confirmation Screen (Step 5) */}
            {confirmationData ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 mb-2">
                    Ref: {confirmationData.referenceId}
                  </span>
                  <h3 className="text-xl font-black text-slate-900">
                    {confirmationData.action.type === 'visit'
                      ? 'Visit Scheduled Successfully!'
                      : 'Booking Application Submitted!'}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                    {confirmationData.action.type === 'visit'
                      ? `Your physical tour of ${property.name} has been confirmed. The campus warden has been notified.`
                      : `Your booking request for ${property.name} has been sent to the property owner with zero brokerage.`}
                  </p>
                </div>

                {/* Visit / Booking Summary Details */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Property:</span>
                    <span className="font-bold text-slate-900">{property.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Address:</span>
                    <span className="font-medium text-slate-800 truncate max-w-[200px]">{property.address}</span>
                  </div>
                  {confirmationData.action.type === 'visit' ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Scheduled Date:</span>
                        <span className="font-bold text-blue-700">{confirmationData.action.date}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Time Slot:</span>
                        <span className="font-bold text-slate-900">{confirmationData.action.timeSlot}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Selected Room:</span>
                        <span className="font-bold text-blue-700">{confirmationData.action.roomType} Sharing</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Target Move-In:</span>
                        <span className="font-bold text-slate-900">{confirmationData.action.date}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="text-slate-500">Caretaker Contact:</span>
                    <span className="font-bold text-slate-900">{property.contactPhone}</span>
                  </div>
                </div>

                {/* Relevant Instructions */}
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-left text-[11px] text-blue-900 flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Important Next Steps</p>
                    <p className="text-blue-800 mt-0.5 leading-relaxed">
                      {confirmationData.action.type === 'visit'
                        ? 'Please arrive at the reception at your scheduled time. Show this reference code to the caretaker. A visitor pass is saved in your resident portal.'
                        : 'The property manager will review and confirm bed allocation. You can monitor the approval status and pay rent directly through your dashboard.'}
                    </p>
                  </div>
                </div>

                {/* Action Directives */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    id="confirm-go-dashboard-btn"
                    onClick={handleNavigateToDashboard}
                    className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-1.5"
                  >
                    <span>Go to My Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setConfirmationData(null);
                      setActionType(null);
                      onClose();
                    }}
                    className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* Input Form for Visit / Booking */
              <form onSubmit={handleActionSubmit} className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      {actionType === 'visit' ? 'Schedule a Free Physical Visit' : 'Book / Request to Join'}
                    </h3>
                    <p className="text-[11px] text-slate-500">{property.name} ({property.locality})</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionType(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Personal Information */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Sharma"
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="vikram@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Action-Specific Inputs */}
                {actionType === 'visit' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                          Visit Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={visitDate}
                          onChange={(e) => setVisitDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                          Preferred Time Slot
                        </label>
                        <select
                          value={visitTimeSlot}
                          onChange={(e) => setVisitTimeSlot(e.target.value as any)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden bg-white"
                        >
                          <option value="Morning (10:00 AM - 12:00 PM)">Morning (10 AM - 12 PM)</option>
                          <option value="Afternoon (2:00 PM - 4:00 PM)">Afternoon (2 PM - 4 PM)</option>
                          <option value="Evening (5:00 PM - 7:00 PM)">Evening (5 PM - 7 PM)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                          Room Sharing
                        </label>
                        <select
                          value={selectedRoom}
                          onChange={(e) => setSelectedRoom(e.target.value as RoomSharingType)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden bg-white"
                        >
                          {property.rooms.map((r) => (
                            <option key={r.id} value={r.type}>
                              {r.type} (₹{(r.rentPerMonth ?? 0).toLocaleString()})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                          Move-In Date
                        </label>
                        <input
                          type="date"
                          value={moveInDate}
                          onChange={(e) => setMoveInDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                        Occupancy Profile
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['Working Professional', 'Student'] as const).map((type) => (
                          <button
                            type="button"
                            key={type}
                            onClick={() => setOccupancyType(type)}
                            className={`py-1.5 px-3 rounded-xl text-xs font-semibold border ${
                              occupancyType === type ? 'bg-blue-50 border-blue-600 text-blue-700' : 'border-slate-200 text-slate-700'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Special Note or Question
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Inquiring about two-wheeler parking or meal preferences"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
                >
                  {actionType === 'visit' ? 'Confirm Scheduled Visit' : 'Submit Booking Request (Zero Brokerage)'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================= SEAMLESS CONTEXTUAL AUTH PROMPT ================= */}
      {authPromptOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/70 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-xs">
              <Sparkles className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">
                Sign in to {actionType === 'visit' ? 'Schedule Your Visit' : 'Book Your Bed'}
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto leading-relaxed">
                You are scheduling an action at <strong>{property.name}</strong>. Create an account or sign in to instantly confirm and manage your pass.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 text-left">
              <div className="flex items-center gap-2 font-semibold text-slate-800 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Zero Brokerage Guaranteed</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Your selected property and dates will be preserved and automatically submitted upon login.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                id="auth-prompt-login-btn"
                onClick={() => {
                  setAuthPromptOpen(false);
                  openAuthModal('login');
                }}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In to Confirm</span>
              </button>

              <button
                id="auth-prompt-register-btn"
                onClick={() => {
                  setAuthPromptOpen(false);
                  openAuthModal('register');
                }}
                className="w-full py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create New Account</span>
              </button>

              <button
                onClick={() => {
                  setAuthPromptOpen(false);
                  setActionType(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-xs font-medium pt-2"
              >
                Cancel and return to PG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
