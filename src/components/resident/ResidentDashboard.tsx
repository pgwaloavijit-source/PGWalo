import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { localIsoDate } from '../../utils/datetime';
import { PaymentReceipt, BookingRequest, Agreement } from '../../types';
import {
  Home,
  CreditCard,
  Clock,
  Utensils,
  MessageSquare,
  Wrench,
  Bell,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Send,
  Download,
  Calendar,
  ShieldCheck,
  Phone,
  Sparkles,
  ArrowRight,
  Printer,
  Lock,
  MapPin,
  Eye,
  X,
  ChevronRight,
  Bed,
  RefreshCw,
  ExternalLink,
  FileText,
  PenTool,
  LogOut,
  ImagePlus,
} from 'lucide-react';
import { downloadInvoicePdf, downloadReceiptPdf } from '../../utils/pdfDocuments';
import { DigitalAgreementModal } from '../features/DigitalAgreementModal';
import { uploadComplaintPhoto } from '../../services/media';
import { fetchMyAgreements } from '../../services/agreements';
import { ModalFocusScope } from '../common/ModalFocusScope';

export const ResidentDashboard: React.FC = () => {
  const {
    currentUser,
    currentResident,
    activeProperty,
    payRentSimulation,
    recordAttendance,
    attendance,
    broadcasts,
    mealPlan,
    chatMessages,
    sendChatMessage,
    tickets,
    addMaintenanceTicket,
    updateTicketStatus,
    bookingRequests,
    approveBookingRequest,
    cancelBookingRequest,
    rescheduleVisit,
    setSelectedPGForDetail,
    properties,
    setRoleState,
    openPublicCatalog,
    openPropertyModal,
    invoices,
    recordPaymentForInvoice,
    initiateNoticePeriod,
    checkoutSettlements,
    agreements,
    mergeAgreements,
  } = useApp();

  const isAllocated = Boolean(currentResident && currentResident.roomNumber);
  // Filter requests belonging to this user
  const today = localIsoDate();
  const userEmail = currentUser?.email?.toLowerCase();
  const userPhone = currentUser?.phone?.replace(/\D/g, '');
  const userName = currentUser?.name?.toLowerCase();
  // Track by id and derive the object from the live collection, so the open
  // modal re-renders the moment the signature lands (local or polled).
  const [activeAgreementId, setActiveAgreementId] = useState<string | null>(null);
  const activeAgreement = activeAgreementId ? agreements.find((a) => a.id === activeAgreementId) || null : null;

  // The tenant's agreement, targeted precisely: their own resident-scoped or
  // email-matched agreement — never just agreements[0], which could be
  // another resident's document.
  const myAgreement = React.useMemo<Agreement | null>(() => {
    const mine = agreements.filter(
      (a) =>
        (currentResident && a.residentId === currentResident.id) ||
        (userEmail && a.tenantEmail?.toLowerCase() === userEmail) ||
        (currentResident?.email && a.tenantEmail?.toLowerCase() === currentResident.email.toLowerCase())
    );
    if (mine.length === 0) return null;
    return (
      mine.find((a) => !a.tenantSigned && a.status !== 'Active') ||
      mine.find((a) => a.tenantSigned) ||
      mine[0]
    );
  }, [agreements, currentResident, userEmail]);

  // Poll the server for the tenant's own agreements so a newly sent or newly
  // countersigned document lands without a full reload.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const poll = async () => {
      const fresh = await fetchMyAgreements();
      if (!cancelled && fresh.length > 0) mergeAgreements(fresh);
    };
    void poll();
    const timer = window.setInterval(poll, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [currentUser?.id]);

  const myRequests = bookingRequests.filter((r) => {
    if (!currentUser) return false;
    const rEmail = r.email?.toLowerCase();
    const rPhone = r.phone?.replace(/\D/g, '');
    const rName = r.applicantName?.toLowerCase();
    return (
      (rEmail && userEmail && rEmail === userEmail) ||
      (rPhone && userPhone && rPhone === userPhone) ||
      (rName && userName && rName === userName)
    );
  });

  // Scheduled Visits (Upcoming vs Past)
  const myVisits = myRequests.filter((r) => r.type === 'visit' || Boolean(r.visitDate));
  const upcomingVisits = myVisits.filter(
    (v) =>
      v.status !== 'Cancelled' &&
      (v.status === 'Pending' || v.status === 'Approved') &&
      (!v.visitDate || v.visitDate >= today)
  );
  const pastVisits = myVisits.filter(
    (v) => v.status === 'Cancelled' || (v.visitDate && v.visitDate < today)
  );

  // Bed / Room Bookings
  const myBookings = myRequests.filter((r) => r.type === 'booking' || (!r.type && !r.visitDate));
  const pendingBookings = myBookings.filter((b) => b.status === 'Pending');
  const approvedBookings = myBookings.filter((b) => b.status === 'Approved');
  const myBroadcasts = broadcasts.filter(
    (broadcast) =>
      // Personal notices (per-resident rent reminders) are addressed to one
      // account — never show another resident's reminder. The stamped id may
      // be the account id or the resident-row id; both resolve to self here.
      (!broadcast.recipientId ||
        broadcast.recipientId === currentUser?.id ||
        broadcast.recipientId === currentResident?.id) &&
      (!broadcast.propertyId || (currentResident?.propertyId && broadcast.propertyId === currentResident.propertyId))
  );

  // Active tab: a pending agreement takes priority so the tenant sees the
  // sign request immediately; otherwise the original defaults apply.
  const [activeTab, setActiveTab] = useState<
    'agreement' | 'visits' | 'bookings' | 'stay' | 'rent' | 'attendance' | 'menu' | 'chat' | 'tickets'
  >(() => {
    if (myAgreement && !myAgreement.tenantSigned) return 'agreement';
    if (isAllocated) return 'stay';
    if (myVisits.length > 0) return 'visits';
    if (myBookings.length > 0) return 'bookings';
    return 'visits';
  });

  // Sub-filter for visits (upcoming vs past)
  const [visitTab, setVisitTab] = useState<'upcoming' | 'past'>('upcoming');

  // Reschedule visit modal state
  const [reschedulingVisit, setReschedulingVisit] = useState<BookingRequest | null>(null);
  const [newVisitDate, setNewVisitDate] = useState('');
  const [newVisitSlot, setNewVisitSlot] = useState('10:00 AM - 12:00 PM');

  // Quick feedback toast
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const [chatInput, setChatInput] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState<'UPI' | 'Card' | 'NetBanking'>('UPI');
  const [upiId, setUpiId] = useState(currentUser?.email || 'ananya@okhdfcbank');
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceipt | null>(null);
  const [isCurrentlyInside, setIsCurrentlyInside] = useState(true);

  // Maintenance form state
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketCategory, setTicketCategory] = useState<'Plumbing' | 'Electrical' | 'WiFi' | 'Cleaning' | 'Other'>('Plumbing');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketPriority, setTicketPriority] = useState<'Normal' | 'Urgent' | 'Emergency'>('Normal');
  const [ticketSuccess, setTicketSuccess] = useState(false);
  const [ticketPhotoUrl, setTicketPhotoUrl] = useState('');
  const [ticketPhotoUploading, setTicketPhotoUploading] = useState(false);
  const [ticketPhotoError, setTicketPhotoError] = useState('');

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketTitle || !currentResident) return;
    addMaintenanceTicket({
      title: ticketTitle,
      category: ticketCategory,
      roomNumber: currentResident.roomNumber,
      residentName: currentResident.name,
      description: ticketDesc.trim() || ticketTitle,
      priority: ticketPriority,
      photoUrl: ticketPhotoUrl || undefined,
    });
    setTicketTitle('');
    setTicketDesc('');
    setTicketPriority('Normal');
    setTicketPhotoUrl('');
    setTicketPhotoError('');
    setTicketSuccess(true);
    setTimeout(() => setTicketSuccess(false), 4000);
  };

  const handlePickTicketPhoto = async (file?: File) => {
    if (!file) return;
    setTicketPhotoError('');
    setTicketPhotoUploading(true);
    try {
      const result = await uploadComplaintPhoto(file);
      if (result.url) {
        setTicketPhotoUrl(result.url);
      } else {
        setTicketPhotoError('Photo upload failed. The complaint will still be saved without it.');
      }
    } catch {
      setTicketPhotoError('Photo upload failed. The complaint will still be saved without it.');
    } finally {
      setTicketPhotoUploading(false);
    }
  };

  // Only this resident's complaints — the store can hold org-level tickets for
  // other roles, so a bare `tickets.map` would leak other tenants' rows here.
  const myTickets = tickets.filter(
    (t) =>
      (currentUser && t.requesterId === currentUser.id) ||
      (currentResident && t.residentName === currentResident.name) ||
      (currentUser?.email && t.residentName === currentUser.name)
  );
  const openTickets = myTickets.filter((t) => t.status === 'Reported' || t.status === 'In-Progress');

  // Resident Notice Period State
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [residentNoticeDate, setResidentNoticeDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [residentCheckoutDate, setResidentCheckoutDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [residentNoticeReason, setResidentNoticeReason] = useState('Relocating to another city for work');

  // Today's Meal Plan (determine current day of week)
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = daysOfWeek[new Date().getDay()] as any;
  const todaysMeal = mealPlan.find((m) => m.day === todayName) || mealPlan[0];

  // Attendance toggle
  const handleToggleAttendance = () => {
    if (!currentResident) return;
    const nextInside = !isCurrentlyInside;
    setIsCurrentlyInside(nextInside);
    recordAttendance({
      personId: currentResident.id,
      personName: currentResident.name,
      personType: 'Resident',
      roomNumber: currentResident.roomNumber,
      type: nextInside ? 'Check-In' : 'Check-Out',
      status: 'On-Time',
      notes: nextInside ? 'Returned to room' : 'Stepped out from PG',
    });
  };

  const handlePayRentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentResident) return;
    const receipt = payRentSimulation(currentResident.id, `${payMethod} (${upiId})`);
    setPaymentReceipt(receipt);

    // Also reconcile corresponding monthly invoice if present
    const myUnpaidInvoice = invoices.find(
      (inv) => inv.residentId === currentResident.id && inv.status !== 'Paid'
    );
    if (myUnpaidInvoice) {
      recordPaymentForInvoice({
        invoiceId: myUnpaidInvoice.id,
        amount: myUnpaidInvoice.outstandingBalance,
        paymentMethod: payMethod === 'Card' ? 'Credit/Debit Card' : payMethod === 'NetBanking' ? 'Net Banking' : 'UPI',
        transactionId: receipt.transactionId,
      });
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput.trim(), false);
    setChatInput('');
  };
  const handleConfirmReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingVisit || !newVisitDate) return;
    rescheduleVisit(reschedulingVisit.id, newVisitDate, newVisitSlot);
    setReschedulingVisit(null);
    showToast(`Visit rescheduled to ${newVisitDate} (${newVisitSlot})`);
  };

  const handleQuickApprove = (reqId: string, propertyName: string) => {
    approveBookingRequest(reqId);
    showToast(`Approved! Room 204 (Bed A) allocated at ${propertyName}. All services are now active.`);
    setActiveTab('stay');
  };

  const openPropertyDetail = (propertyId: string, intent: 'view' | 'book' = 'view') => {
    const prop = properties.find((p) => p.id === propertyId);
    if (prop) {
      openPropertyModal(prop, intent);
      return;
    }
    openPublicCatalog();
  };

  const browseListings = () => {
    setSelectedPGForDetail(null);
    openPublicCatalog();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Toast Notification */}
      {actionNotice && (
        <div
          role="status"
          className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold border border-slate-700 animate-in fade-in"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Top Profile & Header Bar */}
      <div className="bg-white border-b border-slate-200 py-6 px-4 sm:px-6 lg:px-8 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <img
                src={
                  currentResident?.avatar ||
                  currentUser?.avatar ||
                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
                }
                alt={currentResident?.name || currentUser?.name || 'User'}
                referrerPolicy="no-referrer"
                className="w-13 h-13 rounded-2xl object-cover border-2 border-slate-100 shadow-2xs"
              />
              <span
                aria-hidden={true}
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                  isAllocated ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                title={isAllocated ? 'Active Resident' : 'Pending Allocation'}
              />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {myAgreement && (
                  <button
                    onClick={() => setActiveAgreementId(myAgreement.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                      myAgreement.tenantSigned
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 animate-pulse'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {myAgreement.tenantSigned ? 'Agreement Signed' : 'Agreement — Sign Now'}
                  </button>
                )}
                <h1 className="text-xl font-black text-slate-900">
                  {currentResident?.name || currentUser?.name || 'Prospective Resident'}
                </h1>

                {isAllocated ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Active Resident</span>
                  </span>
                ) : pendingBookings.length > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Booking Pending Approval</span>
                  </span>
                ) : upcomingVisits.length > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Visit Scheduled</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                    New Applicant
                  </span>
                )}
              </div>
              {activeAgreement && (
                <DigitalAgreementModal agreement={activeAgreement} onClose={() => setActiveAgreementId(null)} />
              )}

              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                {isAllocated ? (
                  <span>
                    {currentResident!.propertyName} • Room {currentResident!.roomNumber} (
                    {currentResident!.bedNumber}) • {currentResident!.roomType} Sharing
                  </span>
                ) : (
                  <span>
                    {currentUser?.email || 'Applicant'} • No active room allocated yet
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isAllocated && (
              <button
                onClick={browseListings}
                className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center gap-1.5 border border-blue-200"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Explore Properties</span>
              </button>
            )}

            {isAllocated && currentResident && (
              <>
                {currentResident.rentStatus !== 'Paid' ? (
                  <button
                    onClick={() => setShowPayModal(true)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pay Rent (₹{currentResident.monthlyRent.toLocaleString()})</span>
                  </button>
                ) : (
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Rent Paid</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main section rail */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 flex gap-3 lg:gap-6 items-start">
        <nav
          aria-label="Resident sections"
          className="sticky top-20 z-10 shrink-0 w-[4.85rem] sm:w-56 lg:w-64 rounded-3xl bg-white border border-slate-200 shadow-2xs p-1.5 sm:p-2"
        >
          {(
            [
              { id: 'agreement' as const, label: 'Agreement', Icon: FileText, count: 0, locked: false, pending: Boolean(myAgreement && !myAgreement.tenantSigned) },
              { id: 'visits' as const, label: 'Scheduled visits', Icon: Calendar, count: upcomingVisits.length, locked: false },
              { id: 'bookings' as const, label: 'Room applications', Icon: Bed, count: pendingBookings.length, locked: false },
              { id: 'stay' as const, label: 'My stay & room', Icon: Home, count: 0, locked: !isAllocated },
              { id: 'rent' as const, label: 'Rent & receipts', Icon: CreditCard, count: 0, locked: !isAllocated },
              { id: 'attendance' as const, label: 'Gate attendance', Icon: Clock, count: 0, locked: !isAllocated },
              { id: 'menu' as const, label: 'Mess menu', Icon: Utensils, count: 0, locked: !isAllocated },
              { id: 'chat' as const, label: 'Manager chat', Icon: MessageSquare, count: 0, locked: !isAllocated },
              { id: 'tickets' as const, label: 'Maintenance', Icon: Wrench, count: 0, locked: !isAllocated },
            ]
          ).map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`tab-btn-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                aria-current={active}
                className={`w-full mb-1 last:mb-0 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 px-1.5 py-2.5 sm:px-3 sm:py-2.5 text-center sm:text-left transition min-h-[52px] sm:min-h-[44px] ${
                  active ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-700'
                }`}
              >
                <item.Icon className="w-4 h-4 mx-auto sm:mx-0 shrink-0" />
                <span className="text-[10px] sm:text-xs font-bold leading-tight">{item.label}</span>
                <span className="sm:ml-auto flex items-center justify-center gap-1">
                  {item.pending && (
                    <span className="px-1.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 animate-pulse">
                      Sign
                    </span>
                  )}
                  {item.count > 0 && (
                    <span className={`px-1.5 rounded-full text-[10px] font-black ${active ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-700'}`}>
                      {item.count}
                    </span>
                  )}
                  {item.locked && <Lock className={`w-3 h-3 ${active ? 'text-blue-100' : 'text-slate-400'}`} />}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="flex-1 min-w-0 mb-6">

        {/* ============================================================ */}
        {/* TAB: DIGITAL AGREEMENT (review & sign)                       */}
        {/* ============================================================ */}
        {activeTab === 'agreement' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {!myAgreement ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-2xs">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h2 className="text-lg font-black text-slate-900">No agreement yet</h2>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Once your booking is approved, your digital tenancy agreement appears here for review and signature.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Digital Tenancy Agreement</span>
                    </div>
                    <h2 className="text-xl font-black text-slate-900">{myAgreement.agreementNumber}</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      {myAgreement.propertyName} • Room {myAgreement.roomNumber} ({myAgreement.bedNumber}) • ₹{myAgreement.monthlyRent.toLocaleString()}/mo
                    </p>
                  </div>
                  {myAgreement.tenantSigned ? (
                    <span className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" /> Signed
                      {myAgreement.status === 'Active' ? ' & Active' : ' — awaiting owner countersign'}
                    </span>
                  ) : (
                    <button
                      onClick={() => setActiveAgreementId(myAgreement.id)}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md animate-pulse"
                    >
                      <PenTool className="w-4 h-4" /> Review & Sign Now
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100 text-xs">
                  <div><p className="text-slate-400 font-bold uppercase text-[10px]">Start date</p><p className="font-bold text-slate-900 mt-0.5">{myAgreement.startDate}</p></div>
                  <div><p className="text-slate-400 font-bold uppercase text-[10px]">End date</p><p className="font-bold text-slate-900 mt-0.5">{myAgreement.endDate}</p></div>
                  <div><p className="text-slate-400 font-bold uppercase text-[10px]">Security deposit</p><p className="font-bold text-slate-900 mt-0.5">₹{myAgreement.securityDeposit.toLocaleString()}</p></div>
                  <div><p className="text-slate-400 font-bold uppercase text-[10px]">Notice period</p><p className="font-bold text-slate-900 mt-0.5">{myAgreement.noticePeriodDays} days</p></div>
                </div>
                {myAgreement.tenantSigned && (
                  <button
                    onClick={() => setActiveAgreementId(myAgreement.id)}
                    className="mt-5 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> View full signed document
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: MY SCHEDULED VISITS (Upcoming & Past)                   */}
        {/* ============================================================ */}
        {activeTab === 'visits' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header banner */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Physical Tours & Appointments</span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900">
                    My Scheduled PG Visits
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage your upcoming in-person property walkthroughs and past visit records.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={browseListings}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Book Another Visit</span>
                  </button>
                </div>
              </div>

              {/* Toggle Upcoming vs Past */}
              <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-100">
                <button
                  onClick={() => setVisitTab('upcoming')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    visitTab === 'upcoming'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>Upcoming Visits</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      visitTab === 'upcoming' ? 'bg-white text-blue-600' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {upcomingVisits.length}
                  </span>
                </button>

                <button
                  onClick={() => setVisitTab('past')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    visitTab === 'past'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>Past Visits</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      visitTab === 'past' ? 'bg-white text-blue-600' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {pastVisits.length}
                  </span>
                </button>
              </div>
            </div>

            {/* UPCOMING VISITS LIST */}
            {visitTab === 'upcoming' && (
              <div className="space-y-4">
                {upcomingVisits.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-3 shadow-2xs">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                      <Calendar className="w-7 h-7" />
                    </div>
                    <h3 className="font-extrabold text-sm text-slate-900">
                      No Upcoming Visits Scheduled
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Explore verified PGs across your preferred city, pick a convenient time slot, and tour the property for free.
                    </p>
                    <button
                      onClick={browseListings}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Browse PGs & Schedule a Tour</span>
                    </button>
                  </div>
                ) : (
                  upcomingVisits.map((visit) => (
                    <div
                      key={visit.id}
                      className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs hover:border-slate-300 transition space-y-5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                              Upcoming • Confirmed
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Ref: {visit.referenceId || `PGN-VIS-${visit.id.slice(-5)}`}
                            </span>
                          </div>

                          <h3 className="text-lg font-black text-slate-900 mt-1.5">
                            {visit.propertyName}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>Room Tour: {visit.roomType} Sharing Suite</span>
                          </p>
                        </div>

                        <div className="text-left sm:text-right bg-blue-50/60 p-3 rounded-2xl sm:bg-transparent sm:p-0">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">
                            Scheduled Time Slot
                          </span>
                          <span className="text-sm font-black text-blue-700 block mt-0.5">
                            {visit.visitDate || visit.preferredMoveInDate || 'Tomorrow'}
                          </span>
                          <span className="text-xs font-bold text-slate-600 block">
                            {visit.visitTimeSlot || '10:00 AM - 12:00 PM'}
                          </span>
                        </div>
                      </div>

                      {/* Caretaker & Pass details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">
                            Property Contact & Host
                          </span>
                          <span className="font-bold text-slate-900 block">Rajesh Sharma (Owner)</span>
                          <p className="text-slate-500">+91 98450 12345 • Caretaker on campus</p>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">
                            Security Gate Entry Pass
                          </span>
                          <div className="flex items-center gap-2">
                            <QrCode className="w-4 h-4 text-blue-600" />
                            <span className="font-mono font-bold text-slate-900">
                              {visit.referenceId || `PGN-VIS-${visit.id.slice(-5)}`}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">Show this code at gate upon arrival</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setReschedulingVisit(visit);
                              setNewVisitDate(visit.visitDate || visit.preferredMoveInDate || today);
                              setNewVisitSlot(visit.visitTimeSlot || '10:00 AM - 12:00 PM');
                            }}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Reschedule</span>
                          </button>

                          <button
                            onClick={() => {
                              if (window.confirm('Are you sure you want to cancel this scheduled tour?')) {
                                cancelBookingRequest(visit.id);
                                showToast('Visit cancelled.');
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-semibold transition"
                          >
                            Cancel Visit
                          </button>
                        </div>

                        <button
                          onClick={() => openPropertyDetail(visit.propertyId, 'book')}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                        >
                          <span>View Property & Book Bed</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* PAST VISITS LIST */}
            {visitTab === 'past' && (
              <div className="space-y-4">
                {pastVisits.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-2 shadow-2xs">
                    <h3 className="font-extrabold text-sm text-slate-900">No Past Visits</h3>
                    <p className="text-xs text-slate-500">
                      You have no concluded or cancelled physical visits on record.
                    </p>
                  </div>
                ) : (
                  pastVisits.map((visit) => (
                    <div
                      key={visit.id}
                      className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-3 opacity-80 hover:opacity-100 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                visit.status === 'Cancelled'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {visit.status === 'Cancelled' ? 'Cancelled' : 'Concluded Tour'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {visit.visitDate || visit.preferredMoveInDate}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-sm text-slate-900 mt-1">
                            {visit.propertyName}
                          </h4>
                        </div>

                        <button
                          onClick={() => openPropertyDetail(visit.propertyId)}
                          className="px-3 py-1.5 rounded-xl border text-xs font-bold hover:bg-slate-50"
                        >
                          View PG
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: ROOM BOOKING APPLICATIONS                               */}
        {/* ============================================================ */}
        {activeTab === 'bookings' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
                    <Bed className="w-3.5 h-3.5" />
                    <span>Bed & Room Admissions</span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900">
                    Room Booking Applications
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Track the status of your stay booking. Once approved by the caretaker, your room and full resident portal will be activated.
                  </p>
                </div>

                <button
                  onClick={browseListings}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Apply for Another PG</span>
                </button>
              </div>
            </div>

            {myBookings.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-3 shadow-2xs">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                  <Bed className="w-7 h-7" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  No Room Booking Applications Yet
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Found a PG you like? Submit a stay application for your desired sharing type and move-in date.
                </p>
                <button
                  onClick={browseListings}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Browse Available PGs</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myBookings.map((bkg) => (
                  <div
                    key={bkg.id}
                    className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 ${
                              bkg.status === 'Approved'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : bkg.status === 'Rejected'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {bkg.status === 'Pending' && (
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            )}
                            <span>
                              {bkg.status === 'Approved'
                                ? 'Approved & Room Allocated'
                                : bkg.status === 'Rejected'
                                ? 'Application Rejected'
                                : 'Pending Owner / Caretaker Approval'}
                            </span>
                          </span>

                          <span className="text-[11px] text-slate-400">
                            Ref: {bkg.referenceId || `PGN-BKG-${bkg.id.slice(-5)}`}
                          </span>
                        </div>

                        <h3 className="text-lg font-black text-slate-900 mt-2">
                          {bkg.propertyName}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {bkg.roomType} Sharing • Preferred Move-In:{' '}
                          <span className="font-bold text-slate-800">{bkg.preferredMoveInDate}</span>
                        </p>
                      </div>

                      {bkg.status === 'Approved' && (
                        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-left sm:text-right">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                            Allocated Room
                          </span>
                          <span className="text-base font-black text-emerald-900 block mt-0.5">
                            Room {bkg.allocatedRoomNumber || '204'} ({bkg.allocatedBedNumber || 'Bed A'})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Progress Steps for Pending */}
                    {bkg.status === 'Pending' && (
                      <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100/70 space-y-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="text-xs font-bold text-amber-900">
                            Application Under Review by Property Caretaker
                          </span>
                        </div>
                        <p className="text-xs text-amber-800/80 leading-relaxed">
                          Your stay booking has been sent to the property manager. Once the caretaker confirms bed availability and approves the allocation, your room will be assigned and the full Resident Portal (Rent, Gate Attendance, Mess Menu, Maintenance Tickets, and Chat) will be activated.
                        </p>

                        {/* Test Mode Quick Approval for manual testing */}
                        {import.meta.env.DEV && (
                        <div className="pt-2 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[11px] text-amber-800 font-semibold">
                            💡 Want to test the active resident flow like production?
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              id={`quick-approve-test-${bkg.id}`}
                              onClick={() => handleQuickApprove(bkg.id, bkg.propertyName)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>⚡ [Test Mode] Approve & Assign Room 204</span>
                            </button>

                            <button
                              onClick={() => setRoleState('owner')}
                              className="px-2.5 py-1.5 rounded-xl border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold transition"
                            >
                              Open Owner Console
                            </button>
                          </div>
                        </div>
                        )}
                      </div>
                    )}

                    {/* If Approved, direct button to stay */}
                    {bkg.status === 'Approved' && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-emerald-800 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Bed allocation is live. You can now access your full resident dashboard.</span>
                        </span>
                        <button
                          onClick={() => setActiveTab('stay')}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
                        >
                          <span>Open My Stay Dashboard</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* UNALLOCATED GUARD FOR REMAINING TABS                         */}
        {/* If user clicks on stay, rent, attendance, menu, chat, tickets*/}
        {/* before room allocation, render a clear, helpful activation   */}
        {/* screen instead of fake mock data.                            */}
        {/* ============================================================ */}
        {!isAllocated &&
          (activeTab === 'stay' ||
            activeTab === 'rent' ||
            activeTab === 'attendance' ||
            activeTab === 'menu' ||
            activeTab === 'chat' ||
            activeTab === 'tickets') && (
            <div className="max-w-2xl mx-auto my-6 bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 text-center shadow-2xs space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto border border-slate-200">
                <Lock className="w-8 h-8 text-slate-500" />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                  Feature Unlocks After Room Allocation
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">
                  No Active Bed Allocation Found
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                  {pendingBookings.length > 0
                    ? `Your booking application for ${pendingBookings[0].propertyName} is under review by the caretaker. Once approved and assigned a room number, this service will be fully live.`
                    : upcomingVisits.length > 0
                    ? `You currently have a scheduled physical tour at ${upcomingVisits[0].propertyName}. Once you visit and book your stay, the caretaker will allocate your bed.`
                    : `You are currently registered as an applicant. To activate your Resident Portal (Room allocation, Rent dues, Gate attendance, Daily meals, Maintenance, and Chat), schedule a visit or apply for a room booking.`}
                </p>
              </div>

              {/* Action options */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-3">
                {pendingBookings.length > 0 ? (
                  <>
                    {import.meta.env.DEV && (
                    <button
                      id="approve-pending-test-btn"
                      onClick={() =>
                        handleQuickApprove(pendingBookings[0].id, pendingBookings[0].propertyName)
                      }
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>⚡ [Test Mode] Approve & Assign Room 204</span>
                    </button>
                    )}

                    <button
                      onClick={() => setActiveTab('bookings')}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
                    >
                      View Booking Status
                    </button>
                  </>
                ) : upcomingVisits.length > 0 ? (
                  <>
                    <button
                      onClick={() => setActiveTab('visits')}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
                    >
                      View My Scheduled Tour
                    </button>
                    <button
                      onClick={() => openPropertyDetail(upcomingVisits[0].propertyId, 'book')}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
                    >
                      Apply for Bed Now
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={browseListings}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Browse Available PGs</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('visits')}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
                    >
                      Check Visits
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

        {/* ============================================================ */}
        {/* ALLOCATED RESIDENT EXPERIENCE                                */}
        {/* Only rendered when currentResident has an active room!       */}
        {/* ============================================================ */}
        {isAllocated && currentResident && (
          <>
            {/* TAB: MY STAY & ROOM */}
            {activeTab === 'stay' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Room & Bed Details */}
                <div className="lg:col-span-8 space-y-6">
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-2xs space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                      <div>
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                          Allocated Room & Suite
                        </span>
                        <h2 className="text-2xl font-black text-slate-900 mt-1">
                          Room {currentResident.roomNumber} — {currentResident.bedNumber}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {currentResident.roomType} Sharing Suite • Attached Washroom & AC
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-xs text-slate-400 block font-semibold">Monthly Rent</span>
                        <span className="text-2xl font-black text-slate-900">
                          ₹{currentResident.monthlyRent.toLocaleString()} /mo
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Move-in Date</span>
                        <span className="text-xs font-bold text-slate-800">{currentResident.moveInDate}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Security Deposit</span>
                        <span className="text-xs font-bold text-slate-800">
                          ₹{currentResident.depositAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">KYC Verification</span>
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Gate Curfew</span>
                        <span className="text-xs font-bold text-slate-800">11:00 PM Daily</span>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                        Included Suite Amenities
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs text-slate-700">
                        <div className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                          <span>Attached Washroom</span>
                        </div>
                        <div className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                          <span>Air Conditioning (AC)</span>
                        </div>
                        <div className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                          <span>High-speed 100 Mbps WiFi</span>
                        </div>
                        <div className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                          <span>24x7 Power Backup</span>
                        </div>
                        <div className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                          <span>Washing Machine</span>
                        </div>
                        <div className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                          <span>RO Purified Water</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Quick Notice & Contacts */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <LogOut className="w-4 h-4 text-amber-600" />
                        <h3 className="font-extrabold text-xs text-slate-900">Stay & Notice Status</h3>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          currentResident.status === 'Notice Period'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : currentResident.status === 'Checked Out'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {currentResident.status || 'Active Stay'}
                      </span>
                    </div>

                    {currentResident.status === 'Notice Period' ? (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1.5 text-amber-950">
                        <p className="font-bold">Notice Period Active</p>
                        <p className="text-[11px] text-slate-600">
                          Notice Given: <strong>{currentResident.noticeDate || 'Recorded'}</strong>
                        </p>
                        <p className="text-[11px] text-slate-600">
                          Scheduled Move-Out: <strong>{currentResident.expectedCheckoutDate || 'In 30 days'}</strong>
                        </p>
                        {currentResident.checkoutReason && (
                          <p className="text-[11px] text-slate-500 italic">
                            "{currentResident.checkoutReason}"
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 pt-1 border-t border-amber-200">
                          Security deposit refund settlement will be verified during checkout.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-600">
                          Planning to relocate or vacate? Submit your 30-day notice period here to initiate checkout settlement.
                        </p>
                        <button
                          id="resident-initiate-notice-btn"
                          onClick={() => setShowNoticeModal(true)}
                          className="w-full py-2 px-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                        >
                          <LogOut className="w-3.5 h-3.5 text-amber-700" />
                          <span>Submit Vacating Notice</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
                    <h3 className="font-extrabold text-xs text-slate-900">Manager & Warden Contacts</h3>
                    <div className="p-3 bg-blue-50/60 rounded-xl text-xs space-y-1">
                      <span className="font-bold text-blue-900 block">Rajesh Sharma (Owner)</span>
                      <p className="text-slate-600">+91 98450 12345</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                      <span className="font-bold text-slate-800 block">Sunil Kumar (Warden / Supervisor)</span>
                      <p className="text-slate-600">+91 98711 54321</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-blue-600" />
                      <h3 className="font-extrabold text-xs text-slate-900">Campus Notices</h3>
                    </div>
                    <div className="space-y-2 text-xs">
                      {myBroadcasts.slice(0, 2).map((b) => (
                        <div key={b.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                          <span className="text-[10px] font-bold text-blue-600 uppercase">{b.category}</span>
                          <p className="font-bold text-slate-900 text-xs mt-0.5">{b.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{b.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: RENT DUES & RECEIPTS */}
            {activeTab === 'rent' && (
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xs space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase">
                        Current Rent Invoice (Room {currentResident.roomNumber})
                      </span>
                      <div className="text-3xl font-black text-slate-900 mt-1">
                        ₹{currentResident.monthlyRent.toLocaleString()}
                      </div>
                      <span className="text-xs text-slate-500 mt-0.5 block">Due by 7th of Every Month</span>
                    </div>

                    <div>
                      <span
                        className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold ${
                          currentResident.rentStatus === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {currentResident.rentStatus === 'Paid' ? 'Paid & Verified' : 'Payment Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Room {currentResident.roomNumber} Base Rent</span>
                      <span className="font-bold text-slate-800">
                        ₹{currentResident.monthlyRent.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>3-Time Daily Mess Meals</span>
                      <span className="font-bold text-emerald-600">₹0 (Included)</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>High-speed Wi-Fi & Maintenance</span>
                      <span className="font-bold text-emerald-600">₹0 (Included)</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Electricity & Water</span>
                      <span className="font-bold text-emerald-600">₹0 (Included)</span>
                    </div>
                    <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-3 border-t">
                      <span>Net Payable Amount</span>
                      <span className="text-blue-600">₹{currentResident.monthlyRent.toLocaleString()}</span>
                    </div>
                  </div>

                  {currentResident.rentStatus !== 'Paid' ? (
                    <button
                      id="open-pay-rent-modal-btn"
                      onClick={() => setShowPayModal(true)}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Pay Now via UPI / Net Banking</span>
                    </button>
                  ) : (
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <div>
                          <span className="font-bold text-emerald-900 block">Payment Cleared</span>
                          <span className="text-[11px] text-emerald-700">Digital receipt is available below</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const receipt = paymentReceipt || {
                            transactionId: 'PGN-88219402',
                            residentName: currentResident.name,
                            propertyName: activeProperty?.name || 'PGWalo Residence',
                            roomNumber: currentResident.roomNumber,
                            amount: currentResident.monthlyRent,
                            month: todayName,
                            paymentMethod: 'Recorded payment',
                            paidAt: today,
                            status: 'Success' as const,
                          };
                          downloadReceiptPdf(receipt);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white text-emerald-800 font-bold border border-emerald-200 shadow-2xs flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Receipt</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Generated Receipt Preview if paid */}
                {(paymentReceipt || currentResident.rentStatus === 'Paid') && (
                  <div className="bg-white rounded-3xl border border-blue-200 p-6 shadow-md space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src="/logo.png"
                          alt="PGWalo Logo"
                          className="w-8 h-8 rounded-xl object-contain border border-blue-100 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h4 className="font-extrabold text-xs text-slate-900">
                            PGWalo Official Payment Receipt
                          </h4>
                          <p className="text-[10px] text-slate-400">
                            Txn ID: {paymentReceipt?.transactionId || 'PGN-88219402'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Verified
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Tenant Name</span>
                        <span className="font-bold">{currentResident.name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Room</span>
                        <span className="font-bold">
                          Room {currentResident.roomNumber} ({currentResident.bedNumber})
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Paid Amount</span>
                        <span className="font-bold text-emerald-600">
                          ₹{currentResident.monthlyRent.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Payment Date</span>
                        <span className="font-bold">{paymentReceipt?.paidAt || today}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Enterprise Itemized Invoices & Billing History */}
                {invoices.filter((inv) => inv.residentId === currentResident.id).length > 0 && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900">
                          Monthly Billing Invoices & Statements
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Deterministic itemized breakdowns (Room base rent, electricity sub-meter readings, discounts)
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {invoices
                        .filter((inv) => inv.residentId === currentResident.id)
                        .map((inv) => (
                          <div
                            key={inv.id}
                            className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3 text-xs"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2">
                              <div>
                                <span className="font-bold text-slate-900 text-xs mr-2">{inv.month}</span>
                                <span className="font-mono text-slate-500 text-[11px]">({inv.invoiceNumber})</span>
                              </div>
                              <div className="flex items-center gap-2 self-start sm:self-auto">
                                <button
                                  onClick={() => downloadInvoicePdf(inv)}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-bold text-blue-700 shadow-2xs hover:bg-blue-50"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  PDF
                                </button>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  inv.status === 'Paid'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : inv.status === 'Overdue'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {inv.status}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div>
                                <span className="text-[10px] text-slate-400 block uppercase font-bold">Base Rent</span>
                                <span className="font-bold text-slate-800">₹{inv.baseRent.toLocaleString('en-IN')}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block uppercase font-bold">Power Tariff</span>
                                <span className="font-bold text-slate-800">₹{inv.electricityCharges.toLocaleString('en-IN')}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Due</span>
                                <span className="font-black text-slate-900">₹{inv.totalDue.toLocaleString('en-IN')}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block uppercase font-bold">Outstanding</span>
                                <span className="font-black text-rose-600">
                                  ₹{inv.outstandingBalance.toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>

                            {inv.lineItems && inv.lineItems.length > 0 && (
                              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600 space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Itemized Details:</span>
                                {inv.lineItems.map((li) => (
                                  <div key={li.id} className="flex justify-between">
                                    <span>• {li.description}</span>
                                    <span className="font-medium text-slate-800">₹{li.amount.toLocaleString('en-IN')}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: ATTENDANCE */}
            {activeTab === 'attendance' && (
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900">Daily In/Out Gate Log</h3>
                      <p className="text-xs text-slate-500">
                        Your attendance is synced with the security gate biometric scanner
                      </p>
                    </div>
                    <button
                      onClick={handleToggleAttendance}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                        isCurrentlyInside
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {isCurrentlyInside ? 'Clock Out (Leaving PG)' : 'Clock In (Back to PG)'}
                    </button>
                  </div>

                  <div className="space-y-2 pt-3 border-t">
                    {attendance
                      .filter((a) => a.personName === currentResident.name)
                      .map((rec) => (
                        <div
                          key={rec.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                rec.type === 'Check-In' ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                            />
                            <div>
                              <span className="font-bold text-slate-900">{rec.type}</span>
                              <span className="text-[11px] text-slate-500 block">
                                {rec.notes || 'Normal routine movement'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-slate-800">{rec.timestamp}</span>
                            <span className="text-[10px] text-slate-400 block">{rec.date}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: TODAY'S MESS MENU */}
            {activeTab === 'menu' && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-3xl p-6 text-white shadow-md">
                  <span className="text-xs font-bold text-blue-200 uppercase tracking-wider">Mess Today</span>
                  <h2 className="text-2xl font-black mt-1">{todaysMeal.day}’s Meal Schedule</h2>
                  <p className="text-xs text-blue-100 mt-1">
                    Breakfast (7:30 - 10:00 AM) • Lunch (12:30 - 2:30 PM) • Dinner (8:00 - 10:30 PM)
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-2">
                    <span className="text-[11px] font-bold uppercase text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg">
                      Morning Breakfast
                    </span>
                    <p className="text-sm font-bold text-slate-900 mt-2">{todaysMeal.breakfast}</p>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-2">
                    <span className="text-[11px] font-bold uppercase text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                      Homely Lunch
                    </span>
                    <p className="text-sm font-bold text-slate-900 mt-2">{todaysMeal.lunch}</p>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-2">
                    <span className="text-[11px] font-bold uppercase text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                      Evening Snacks & Chai
                    </span>
                    <p className="text-sm font-bold text-slate-900 mt-2">{todaysMeal.snacks}</p>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-2">
                    <span className="text-[11px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      Warm Dinner
                    </span>
                    <p className="text-sm font-bold text-slate-900 mt-2">{todaysMeal.dinner}</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: CHAT WITH OWNER */}
            {activeTab === 'chat' && (
              <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col h-[520px]">
                <div className="p-4 border-b bg-slate-50/70 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                      RS
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-900">Rajesh Sharma (PG Owner)</h4>
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Online & Active
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="flex-1 overflow-y-auto p-4 space-y-3"
                  role="log"
                  aria-label="Chat with property manager"
                  aria-live="polite"
                >
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${!msg.isOwner ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-xs sm:max-w-md p-3 rounded-2xl text-xs leading-relaxed ${
                          !msg.isOwner
                            ? 'bg-blue-600 text-white rounded-tr-xs shadow-xs'
                            : 'bg-slate-100 text-slate-900 rounded-tl-xs'
                        }`}
                      >
                        <p>{msg.text}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-2 border-t border-slate-100 grid grid-cols-3 gap-1.5 text-[11px]">
                  <button
                    onClick={() => setChatInput('Hi Rajesh ji, when is dinner served today?')}
                    className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap"
                  >
                    Dinner timing?
                  </button>
                  <button
                    onClick={() => setChatInput('Can someone clean room 204 tomorrow morning?')}
                    className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap"
                  >
                    Room cleaning
                  </button>
                  <button
                    onClick={() => setChatInput('Cleared this month rent through UPI!')}
                    className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap"
                  >
                    Rent cleared
                  </button>
                </div>

                <form onSubmit={handleSendChat} className="p-3 border-t bg-slate-50 flex items-center gap-2">
                  <input
                    type="text"
                    aria-label="Type your message to owner or warden"
                    placeholder="Type your message to owner / warden..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border rounded-xl bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    aria-label="Send chat message"
                    className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* TAB: MAINTENANCE TICKETS */}
            {activeTab === 'tickets' && (
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-4">
                  <h3 className="font-extrabold text-base text-slate-900">Raise a Maintenance Issue</h3>
                  {ticketSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Complaint lodged. Your PG staff has been notified — you'll get an update here.</span>
                    </div>
                  )}

                  <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
                    <div>
                      <label htmlFor="ticket-title" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                        Issue Title *
                      </label>
                      <input
                        id="ticket-title"
                        type="text"
                        required
                        placeholder="e.g. Geyser not heating properly"
                        value={ticketTitle}
                        onChange={(e) => setTicketTitle(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label htmlFor="ticket-desc" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                        Describe the problem
                      </label>
                      <textarea
                        id="ticket-desc"
                        rows={3}
                        placeholder="Since when? What exactly is happening? (optional — helps staff come prepared)"
                        value={ticketDesc}
                        onChange={(e) => setTicketDesc(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-600 resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="ticket-category" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                          Category
                        </label>
                        <select
                          id="ticket-category"
                          value={ticketCategory}
                          onChange={(e) => setTicketCategory(e.target.value as any)}
                          className="w-full px-3 py-2 border rounded-xl bg-white"
                        >
                          <option value="Plumbing">Plumbing / Washroom</option>
                          <option value="Electrical">Electrical / Geyser / AC</option>
                          <option value="WiFi">Wi-Fi / Internet</option>
                          <option value="Cleaning">Cleaning / Housekeeping</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="ticket-priority" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                          Priority
                        </label>
                        <select
                          id="ticket-priority"
                          value={ticketPriority}
                          onChange={(e) => setTicketPriority(e.target.value as any)}
                          className="w-full px-3 py-2 border rounded-xl bg-white"
                        >
                          <option value="Normal">Normal — fix when possible</option>
                          <option value="Urgent">Urgent — same day</option>
                          <option value="Emergency">Emergency — water/power out</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600 cursor-pointer hover:bg-slate-50">
                          <ImagePlus className="w-3.5 h-3.5" />
                          {ticketPhotoUploading ? 'Uploading…' : ticketPhotoUrl ? 'Replace photo' : 'Attach photo'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={ticketPhotoUploading}
                            onChange={(e) => { void handlePickTicketPhoto(e.target.files?.[0]); e.target.value = ''; }}
                          />
                        </label>
                        {ticketPhotoUrl && (
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                            <img src={ticketPhotoUrl} alt="Attachment preview" className="h-9 w-9 rounded-lg object-cover border border-slate-200" />
                            <button type="button" onClick={() => setTicketPhotoUrl('')} className="font-bold hover:text-slate-900">Remove</button>
                          </span>
                        )}
                      </div>
                      {ticketPhotoError && <p className="text-[10px] font-bold text-amber-700">{ticketPhotoError}</p>}
                    </div>

                    <button
                      type="submit"
                      disabled={ticketPhotoUploading}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-60"
                    >
                      Submit Complaint
                    </button>
                  </form>
                </div>

                {/* My Complaints */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-slate-900">My Complaints</h4>
                    {openTickets.length > 0 && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                        {openTickets.length} open
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {myTickets.length === 0 && (
                      <p className="text-[11px] text-slate-400 py-3 text-center">
                        No complaints yet. Raise one above and track its progress here.
                      </p>
                    )}
                    {myTickets.map((t) => (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900">{t.title}</span>
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-semibold">
                                {t.category}
                              </span>
                              {t.priority === 'Emergency' && (
                                <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">
                                  Emergency
                                </span>
                              )}
                            </div>
                            {t.description !== t.title && (
                              <span className="text-[11px] text-slate-500 block mt-0.5">{t.description}</span>
                            )}
                            {t.photoUrl && (
                              <a href={t.photoUrl} target="_blank" rel="noreferrer" className="block mt-1.5">
                                <img src={t.photoUrl} alt="Complaint attachment" className="h-20 rounded-lg border border-slate-200 object-cover" />
                              </a>
                            )}
                            {t.status !== 'Resolved' && t.status !== 'Closed' && t.slaDeadline && (
                              <span
                                className={`text-[10px] block mt-0.5 font-semibold ${
                                  new Date(t.slaDeadline).getTime() < Date.now()
                                    ? 'text-red-600'
                                    : 'text-slate-400'
                                }`}
                              >
                                {new Date(t.slaDeadline).getTime() < Date.now()
                                  ? `⚠ Past expected fix time — escalated to the PG owner`
                                  : `Expected fix by ${new Date(t.slaDeadline).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`}
                              </span>
                            )}
                            {t.assignedStaffName && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                Assigned to {t.assignedStaffName}
                              </span>
                            )}
                            {t.resolutionNotes && t.status !== 'Reported' && (
                              <span className="text-[10px] text-emerald-700 block mt-1 bg-emerald-50 rounded-lg px-2 py-1">
                                ✓ {t.resolutionNotes}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                t.status === 'Resolved' || t.status === 'Closed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : t.status === 'In-Progress'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {t.status}
                            </span>
                            {(t.status === 'Resolved' || t.status === 'In-Progress') && (
                              <button
                                onClick={() => updateTicketStatus(t.id, 'Closed')}
                                className="text-[10px] text-slate-400 hover:text-slate-700 underline"
                              >
                                Close
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </div>

      {/* Online Rent Payment Modal */}
      {showPayModal && currentResident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <ModalFocusScope labelledBy="pay-modal-title">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-blue-100">
            {paymentReceipt ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 id="pay-modal-title" className="text-lg font-black text-slate-900">Payment Successful!</h3>
                <p className="text-xs text-slate-600">
                  ₹{paymentReceipt.amount.toLocaleString()} paid via {paymentReceipt.paymentMethod}
                </p>
                <div className="p-3 bg-slate-50 rounded-xl text-left text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Txn ID:</span>
                    <span className="font-bold text-slate-900">{paymentReceipt.transactionId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date:</span>
                    <span className="font-bold text-slate-900">{paymentReceipt.paidAt}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowPayModal(false);
                    setPaymentReceipt(null);
                  }}
                  className="w-full py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl"
                >
                  Close Receipt
                </button>
              </div>
            ) : (
              <form onSubmit={handlePayRentSubmit} className="space-y-4 text-xs">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 id="pay-modal-title" className="text-base font-extrabold text-slate-900">Pay Room Rent</h3>
                    <p className="text-[11px] text-slate-500">
                      Room {currentResident.roomNumber} • September 2026
                    </p>
                  </div>
                  <span className="text-base font-black text-blue-600">
                    ₹{currentResident.monthlyRent.toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(['UPI', 'Card', 'NetBanking'] as const).map((m) => (
                    <button
                      type="button"
                      key={m}
                      aria-pressed={payMethod === m}
                      onClick={() => setPayMethod(m)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        payMethod === m
                          ? 'bg-blue-50 border-blue-600 text-blue-700'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {payMethod === 'UPI' && (
                  <div className="space-y-2">
                    <label htmlFor="upi-id" className="block text-[11px] font-bold text-slate-500 uppercase">
                      Enter UPI ID / VPA
                    </label>
                    <input
                      id="upi-id"
                      type="text"
                      required
                      placeholder="e.g. yourname@okhdfcbank"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-600"
                    />
                    <p className="text-[10px] text-slate-400">
                      Supports Google Pay, PhonePe, Paytm, CRED & BHIM
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPayModal(false)}
                    className="w-1/3 py-2.5 border rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md"
                  >
                    Confirm & Pay ₹{currentResident.monthlyRent.toLocaleString()}
                  </button>
                </div>
              </form>
            )}
          </div>
          </ModalFocusScope>
        </div>
      )}

      {/* Reschedule Visit Modal */}
      {reschedulingVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <ModalFocusScope labelledBy="reschedule-modal-title">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-blue-100 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 id="reschedule-modal-title" className="text-base font-extrabold text-slate-900">Reschedule Tour</h3>
                <p className="text-xs text-slate-500">{reschedulingVisit.propertyName}</p>
              </div>
              <button
                onClick={() => setReschedulingVisit(null)}
                aria-label="Close reschedule dialog"
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleConfirmReschedule} className="space-y-4 text-xs">
              <div>
                <label htmlFor="visit-date" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Choose New Visit Date
                </label>
                <input
                  id="visit-date"
                  type="date"
                  required
                  min={today}
                  value={newVisitDate}
                  onChange={(e) => setNewVisitDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label htmlFor="visit-slot" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Select Time Slot
                </label>
                <select
                  id="visit-slot"
                  value={newVisitSlot}
                  onChange={(e) => setNewVisitSlot(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white"
                >
                  <option value="10:00 AM - 12:00 PM">Morning: 10:00 AM - 12:00 PM</option>
                  <option value="02:00 PM - 04:00 PM">Afternoon: 02:00 PM - 04:00 PM</option>
                  <option value="04:00 PM - 06:00 PM">Evening: 04:00 PM - 06:00 PM</option>
                  <option value="06:00 PM - 08:00 PM">Night: 06:00 PM - 08:00 PM</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReschedulingVisit(null)}
                  className="w-1/3 py-2.5 border rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md"
                >
                  Confirm Reschedule
                </button>
              </div>
            </form>
          </div>
          </ModalFocusScope>
        </div>
      )}

      {/* Resident Notice Period Modal */}
      {showNoticeModal && currentResident && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <ModalFocusScope labelledBy="notice-modal-title">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <LogOut className="w-4 h-4 text-amber-600" />
                <h4 id="notice-modal-title" className="font-black text-sm text-slate-900">Submit Vacating Notice</h4>
              </div>
              <button
                onClick={() => setShowNoticeModal(false)}
                aria-label="Close vacating notice dialog"
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Per PG policy, a <strong>30-day notice period</strong> is required. Your bed will be flagged for checkout inspection, and deposit deduction reconciliation will be processed upon checkout.
            </p>

            <div className="space-y-3">
              <div>
                <label htmlFor="notice-date" className="font-bold text-slate-700 block mb-1">Notice Date</label>
                <input
                  id="notice-date"
                  type="date"
                  value={residentNoticeDate}
                  onChange={(e) => setResidentNoticeDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label htmlFor="checkout-date" className="font-bold text-slate-700 block mb-1">Expected Vacating / Move-Out Date</label>
                <input
                  id="checkout-date"
                  type="date"
                  value={residentCheckoutDate}
                  onChange={(e) => setResidentCheckoutDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                />
              </div>

              <div>
                <label htmlFor="notice-reason" className="font-bold text-slate-700 block mb-1">Reason for Vacating</label>
                <textarea
                  id="notice-reason"
                  rows={2}
                  value={residentNoticeReason}
                  onChange={(e) => setResidentNoticeReason(e.target.value)}
                  placeholder="e.g. Relocating, course completed, job change..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNoticeModal(false)}
                className="w-1/3 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-vacating-notice-btn"
                onClick={() => {
                  initiateNoticePeriod(currentResident.id, residentNoticeDate, residentCheckoutDate, residentNoticeReason);
                  setShowNoticeModal(false);
                  showToast('Vacating notice submitted successfully to management.');
                }}
                className="w-2/3 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs transition"
              >
                Confirm & Submit Notice
              </button>
            </div>
          </div>
          </ModalFocusScope>
        </div>
      )}
    </div>
  );
};
