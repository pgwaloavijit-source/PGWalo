import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  UserRole,
  Property,
  Resident,
  BookingRequest,
  AttendanceRecord,
  StaffMember,
  StaffTask,
  BroadcastNotification,
  MealPlanDay,
  ChatMessage,
  MaintenanceTicket,
  SupportTicket,
  SupportTicketStatus,
  PaymentReceipt,
  UserAccount,
  Bed,
  BedStatus,
  Lead,
  LeadStage,
  ElectricityMeterReading,
  PropertyElectricityReconciliation,
  SecurityDepositRecord,
  RentAgreement,
  VisitorPass,
  AuditLogEntry,
  SystemSettings,
  RolePermissions,
  PendingCustomerAction,
  Organization,
  Stay,
  RentPlan,
  Invoice,
  Payment,
  PaymentAllocation,
  DepositTransaction,
  Notice,
  Checkout,
  CheckoutSettlement,
  PermissionKey,
  ResidentStatus,
  StayRecord,
} from '../types';
import {
  DEFAULT_ORGANIZATION_ID,
  allocateVerifiedPayment,
  buildAuditEntry,
  buildMonthlyInvoice,
  canBedBeAssigned,
  canonicalBedStatus,
  deriveInitialRentPlans,
  deriveInitialStays,
  hasPermission as hasWorkflowPermission,
  makeCheckout,
  makeNotice,
  makePayment,
  summarizeResidentLedger,
} from '../domain/productionWorkflow';
import {
  isProductionApiEnabled,
  loadProductionSnapshot,
  saveProductionSnapshot,
  clearAuthToken,
  getAuthToken,
} from '../services/productionApi';
import { notifyVisitWithWorkers, fetchMeWithWorkers } from '../services/auth';
import { fetchMySupportTickets, postSupportTicket, fetchMyNotifications } from '../services/supportTickets';
import { connectEventStream } from '../services/eventStream';
import {
  fetchMaintenanceTickets,
  postMaintenanceTicket,
  patchMaintenanceTicketStatus,
} from '../services/maintenanceTickets';
import {
  patchAdminProperty,
  patchAdminTicket,
  patchAdminUserStatus,
  postAdminLogout,
  postAdminTicketReply,
} from '../services/adminApi';
import { fetchPublicListings, publishListing } from '../services/listings';
import { fetchInquiries, publishInquiry, patchInquiry, mergeBookings } from '../services/inquiries';
import { mergeProperties } from '../utils/locationMatch';
import { isPlatformAdmin } from '../utils/platformAdmin';
import { uploadListingPhoto } from '../services/media';
import { localIsoDate } from '../utils/datetime';
import { CATALOG_OWNER_ID, ownsProperty } from '../utils/ownership';
import { normalizeAmenities } from '../utils/amenities';
import { fireEmailEvent } from '../services/emailEvents';
import { fetchMyAgreements, signMyAgreement } from '../services/agreements';
import { clearLastAuthUser } from '../services/authAnalytics';
import { capturePayTargetFromUrl } from '../utils/payLink';
import { dashboardTabForRole } from '../utils/roles';
import {
  INITIAL_PROPERTIES,
  INITIAL_RESIDENTS,
  INITIAL_BOOKING_REQUESTS,
  INITIAL_ATTENDANCE,
  INITIAL_STAFF,
  INITIAL_TASKS,
  INITIAL_BROADCASTS,
  INITIAL_MEAL_PLAN,
  INITIAL_CHAT,
  INITIAL_TICKETS,
  INITIAL_SUPPORT_TICKETS,
  INITIAL_USERS,
  INITIAL_BEDS,
  INITIAL_LEADS,
  INITIAL_METER_READINGS,
  INITIAL_RECONCILIATION,
  INITIAL_DEPOSITS,
  INITIAL_AGREEMENTS,
  INITIAL_VISITORS,
  INITIAL_AUDIT_LOGS,
  INITIAL_SETTINGS,
  DEFAULT_ROLE_PERMISSIONS,
  INITIAL_STAYS,
  INITIAL_INVOICES,
  INITIAL_CHECKOUT_SETTLEMENTS,
} from '../mockData';

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  setRoleState: (role: UserRole) => void;
  currentUser: UserAccount | null;
  /** Non-null when the Super Admin disabled/suspended this account. */
  accountBlocked: null | { reason: string };
  organizations: Organization[];
  users: UserAccount[];
  properties: Property[];
  residents: Resident[];
  bookingRequests: BookingRequest[];
  attendance: AttendanceRecord[];
  staff: StaffMember[];
  currentStaff: StaffMember | null;
  setCurrentStaffId: (staffId: string) => void;
  tasks: StaffTask[];
  broadcasts: BroadcastNotification[];
  mealPlan: MealPlanDay[];
  chatMessages: ChatMessage[];
  tickets: MaintenanceTicket[];
  supportTickets: SupportTicket[];
  currentResident: Resident | null;
  activeProperty: Property | null;
  selectedPGForDetail: Property | null;
  setSelectedPGForDetail: (property: Property | null) => void;
  propertyModalIntent: 'view' | 'book';
  openPropertyModal: (property: Property | null, intent?: 'view' | 'book') => void;
  
  // Auth Modal State & Controls
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  authModalMode: 'login' | 'register';
  setAuthModalMode: (mode: 'login' | 'register') => void;
  authInitialRole?: UserRole;
  setAuthInitialRole?: (role: UserRole) => void;
  authMeta: { intent?: string; path?: string; propertyId?: string; source?: string };
  openAuthModal: (
    mode?: 'login' | 'register',
    targetRole?: UserRole,
    meta?: { intent?: string; path?: string; propertyId?: string; source?: string }
  ) => void;
  requireAuth: (action: () => void, meta?: { mode?: 'login' | 'register'; role?: UserRole; intent?: string; path?: string; propertyId?: string; source?: string }) => void;
  runPendingAuthAction: () => void;
  login: (email: string, password?: string, requestedRole?: UserRole) => { success: boolean; message?: string };
    applyApiSession: (user: Partial<UserAccount> & { id: string; role: UserRole }) => void;
  openPublicCatalog: () => void;
  shellIntent: string | null;
  clearShellIntent: () => void;
  /**
   * Send the signed-in account to its own dashboard. Used right after sign-in
   * and sign-up so an owner never lands on the public page wondering whether
   * the login worked.
   */
  openRoleDashboard: (role?: UserRole) => void;
  register: (accountData: {
    name: string;
    email: string;
    phone: string;
    role: UserRole;
    password?: string;
    roomNumber?: string;
    staffRole?: string;
  }) => { success: boolean; message?: string };
  logout: () => void;
  profileModalOpen: boolean;
  setProfileModalOpen: (open: boolean) => void;
  updateUserProfile: (updates: Partial<UserAccount>) => { success: boolean; message?: string };

  // Customer Pending Action & Confirmation
  pendingAction: PendingCustomerAction | null;
  setPendingAction: (action: PendingCustomerAction | null) => void;
  confirmedAction: { referenceId: string; action: PendingCustomerAction } | null;
  setConfirmedAction: (item: { referenceId: string; action: PendingCustomerAction } | null) => void;
      confirmDirectAction: (action: PendingCustomerAction) => { referenceId: string; error?: string };

  // Enterprise State & Management
  beds: Bed[];
  updateBedStatus: (bedId: string, status: BedStatus, tenantId?: string, tenantName?: string) => void;
  rentPlans: RentPlan[];
  payments: Payment[];
  paymentAllocations: PaymentAllocation[];
  depositTransactions: DepositTransaction[];
  notices: Notice[];
  checkouts: Checkout[];
  checkoutSettlements: CheckoutSettlement[];
  hasPermission: (permission: PermissionKey) => boolean;
  generateMonthlyInvoice: (residentId: string, monthDate?: Date) => Invoice | null;
  recordPayment: (residentId: string, amount: number, method: string, status?: Payment['status']) => Payment;
  verifyPayment: (paymentId: string) => void;
  getResidentLedgerSummary: (residentId: string) => { outstanding: number; advance: number };
  reserveBedForResident: (bedId: string, residentId: string, expiryDate: string) => void;
  confirmMoveIn: (residentId: string, bedId: string, moveInDate?: string, allowExceptionReason?: string) => void;
  transferResidentBed: (residentId: string, newBedId: string, transferDate: string, reason: string, rentChange?: number) => void;
  submitNotice: (residentId: string, requestedCheckoutDate: string, reason: string, comments?: string) => Notice;
  approveNotice: (noticeId: string, approvedCheckoutDate?: string, reason?: string) => void;
  startCheckout: (residentId: string, charges?: Partial<Pick<Checkout, 'electricityCharges' | 'foodCharges' | 'damageCharges' | 'otherDeductions'>>) => Checkout;
  completeCheckout: (checkoutId: string) => void;
  leads: Lead[];
  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'lastFollowUp'>) => void;
  updateLeadStage: (leadId: string, stage: LeadStage, notes?: string) => void;
  meterReadings: ElectricityMeterReading[];
  addMeterReading: (reading: Omit<ElectricityMeterReading, 'id'>) => void;
  reconciliations: PropertyElectricityReconciliation[];
  depositRecords: SecurityDepositRecord[];
  addDepositDeduction: (depositId: string, deduction: { category: 'Damage' | 'Unpaid Rent' | 'Electricity' | 'Other'; amount: number; reason: string }) => void;
  settleDepositRefund: (depositId: string, transactionId: string) => void;
  agreements: RentAgreement[];
  mergeAgreements: (incoming: RentAgreement[]) => void;
  signAgreement: (agreementId: string, asRole: 'owner' | 'tenant') => void;
  visitorPasses: VisitorPass[];
  addVisitorPass: (pass: Omit<VisitorPass, 'id' | 'status'>) => void;
  updateVisitorStatus: (passId: string, status: VisitorPass['status']) => void;
  auditLogs: AuditLogEntry[];
  logAuditEvent: (action: string, entity: string, details: string) => void;
  settings: SystemSettings;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  rolePermissions: Record<string, RolePermissions>;
  updateRolePermissions: (roleName: string, permissions: RolePermissions) => void;
  
  // Phase 1 & 2: Production Ledger, Invoicing, Stay & Checkout
  generateMonthlyInvoices: (monthYear?: string) => number;
  recordPaymentForInvoice: (invoiceId: string, amount: number, paymentMethod: string, notes?: string) => PaymentReceipt;
  recordAdvancePayment: (residentId: string, amount: number, paymentMethod: string) => void;
  processRoomTransfer: (residentId: string, newRoomNumber: string, newBedNumber: string, newMonthlyRent: number, reason: string) => void;
  initiateNoticePeriod: (residentId: string, noticeDate?: string, checkoutDate?: string, reason?: string) => void;
  executeCheckoutSettlement: (settlement: Omit<CheckoutSettlement, 'id'>) => CheckoutSettlement;
  updateResidentStatus: (residentId: string, status: any) => void;
  updatePropertyModules: (propertyId: string, modules: Partial<Property>) => void;

  // Navigation & Interactive Walkthrough
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;
  showVirtualTourModal: boolean;
  setShowVirtualTourModal: (show: boolean) => void;
  virtualTourRoom: string;
  setVirtualTourRoom: (room: string) => void;

  // Actions
  /** Returns the created property (with its generated id) to the caller. */
  addProperty: (property: Omit<Property, 'id'>) => Property;
  updateProperty: (propertyId: string, updates: Partial<Property>) => void;
  addBookingRequest: (request: Omit<BookingRequest, 'id' | 'status' | 'requestDate'>) => void;
  approveBookingRequest: (requestId: string, roomNumber?: string, bedNumber?: string) => void;
  rejectBookingRequest: (requestId: string) => void;
  cancelBookingRequest: (requestId: string) => void;
  rescheduleVisit: (requestId: string, newDate: string, newTimeSlot: string) => void;
  addResident: (resident: Omit<Resident, 'id'>) => void;
  updateRentStatus: (residentId: string, status: 'Paid' | 'Pending' | 'Overdue') => void;
  payRentSimulation: (residentId: string, method: string) => PaymentReceipt;
  recordAttendance: (record: Omit<AttendanceRecord, 'id' | 'date' | 'timestamp'>) => void;
  toggleStaffClockIn: (staffId: string) => void;
  addStaffMember: (newStaff: Omit<StaffMember, 'id'> & { id?: string }) => void;
  updateStaffMember: (staffId: string, updates: Partial<StaffMember>) => void;
  deleteStaffMember: (staffId: string) => void;
  toggleTaskCompleted: (taskId: string) => void;
  addTask: (task: Omit<StaffTask, 'id' | 'completed'>) => void;
  addBroadcast: (broadcast: Omit<BroadcastNotification, 'id' | 'timestamp'>) => void;
  markNotificationsRead: (ids?: string[]) => void;
  updateMealPlanDay: (day: MealPlanDay['day'], field: keyof MealPlanDay, value: string) => void;
  sendChatMessage: (text: string, isOwner: boolean) => void;
  addMaintenanceTicket: (ticket: Omit<MaintenanceTicket, 'id' | 'createdAt' | 'status'>) => void;
  updateTicketStatus: (
    ticketId: string,
    status: MaintenanceTicket['status'],
    extra?: { assignedStaffName?: string; resolutionNotes?: string; cost?: number }
  ) => void;
  createSupportTicket: (ticket: Omit<SupportTicket, 'id' | 'requesterId' | 'requesterName' | 'requesterRole' | 'status' | 'createdAt' | 'updatedAt'>) => void;
  updateSupportTicket: (ticketId: string, status: SupportTicketStatus, adminNote?: string, assignedTo?: string) => void;
  addSupportTicketReply: (ticketId: string, body: string) => void;
  updateUserAccountStatus: (userId: string, status: NonNullable<UserAccount['status']>) => void;
  setListingDecision: (propertyId: string, action: 'approve' | 'reject' | 'disable') => void;
  /** False while the API snapshot is still in flight, so the shell can show the boot loader. */
  productionHydrated: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ORGANIZATIONS: 'pgwalo_organizations',
  ROLE: 'pgwalo_role',
  CURRENT_USER: 'pgwalo_current_user',
  USERS: 'pgwalo_users',
  CURRENT_STAFF_ID: 'pgwalo_current_staff_id',
  PROPERTIES: 'pgwalo_properties',
  RESIDENTS: 'pgwalo_residents',
  BOOKINGS: 'pgwalo_bookings',
  ATTENDANCE: 'pgwalo_attendance',
  STAFF: 'pgwalo_staff',
  TASKS: 'pgwalo_tasks',
  BROADCASTS: 'pgwalo_broadcasts',
  MEALS: 'pgwalo_meals',
  CHAT: 'pgwalo_chat',
  TICKETS: 'pgwalo_tickets',
  SUPPORT_TICKETS: 'pgwalo_support_tickets',
  BEDS: 'pgwalo_beds',
  LEADS: 'pgwalo_leads',
  METER_READINGS: 'pgwalo_meter_readings',
  RECONCILIATION: 'pgwalo_reconciliation',
  DEPOSITS: 'pgwalo_deposits',
  AGREEMENTS: 'pgwalo_agreements',
  VISITORS: 'pgwalo_visitors',
  AUDIT_LOGS: 'pgwalo_audit_logs',
  SETTINGS: 'pgwalo_settings',
  PERMISSIONS: 'pgwalo_permissions',
  CHECKOUT_SETTLEMENTS: 'pgwalo_checkout_settlements',
  STAYS: 'pgwalo_stays',
  RENT_PLANS: 'pgwalo_rent_plans',
  INVOICES: 'pgwalo_invoices',
  PAYMENTS: 'pgwalo_payments',
  PAYMENT_ALLOCATIONS: 'pgwalo_payment_allocations',
  DEPOSIT_TRANSACTIONS: 'pgwalo_deposit_transactions',
  NOTICES: 'pgwalo_notices',
  CHECKOUTS: 'pgwalo_checkouts',
};

/**
 * Sign-out hygiene.
 *
 * `logout()` drops this flag and reloads the page. The purge below runs at
 * module load — before any state initializer reads localStorage — so the page
 * that comes back after a sign-out has no memory of the previous account: no
 * cached dashboard rows, no half-filled form, no "welcome back, <someone>".
 */
const SIGNED_OUT_FLAG = 'pgwalo_signed_out';

function purgeSessionCachesOnBoot(): void {
  try {
    if (localStorage.getItem(SIGNED_OUT_FLAG) !== '1') return;
    Object.keys(localStorage)
      .filter((key) => key.startsWith('pgwalo_'))
      .forEach((key) => localStorage.removeItem(key));
    sessionStorage.clear();
  } catch {
    /* storage can be unavailable (private mode) — nothing to purge then */
  }
}

purgeSessionCachesOnBoot();

// An emailed payment link arrives as `/pay/<orderId>`: stash the order and
// normalise the URL before React mounts, so the SPA route stays clean.
capturePayTargetFromUrl();

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!savedUser) return 'public';
    try {
      const parsed: UserAccount = JSON.parse(savedUser);
      if (
        !parsed ||
        parsed.id.startsWith('user-owner') ||
        parsed.id.startsWith('user-resident') ||
        parsed.id.startsWith('user-staff') ||
        parsed.id.startsWith('user-admin') ||
        parsed.id.startsWith('user-manager') ||
        parsed.id.startsWith('user-warden') ||
        parsed.id.startsWith('user-accountant')
      ) {
        return 'public';
      }
      return parsed.role || 'public';
    } catch {
      return 'public';
    }
  });

  const [organizations, setOrganizations] = useState<Organization[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.ORGANIZATIONS);
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: DEFAULT_ORGANIZATION_ID,
            name: 'PGWalo Operations',
            ownerUserId: 'user-owner',
            accountState: 'Trial / Pending Setup',
            subscriptionPlan: 'Trial',
            createdAt: new Date().toISOString(),
          },
        ];
  });

  const [properties, setProperties] = useState<Property[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PROPERTIES);
    const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    let isDemoUser = false;

    if (savedUser) {
      try {
        const user: UserAccount = JSON.parse(savedUser);
        isDemoUser = user.isDemo || false;
      } catch {
        isDemoUser = false;
      }
    }

    const source: Property[] = isProductionApiEnabled() ? [] : saved ? JSON.parse(saved) : INITIAL_PROPERTIES;

    // Filter out demo data for non-demo users
    const filteredSource = isDemoUser ? source : source.filter(p => !p.id.startsWith('demo-'));

    return filteredSource.map((property) => {
      const seedIds = new Set(['prop-1', 'prop-2', 'prop-3', 'prop-4']);
      return {
      ...property,
      amenities: normalizeAmenities(property.amenities || []),
      organizationId: property.organizationId || DEFAULT_ORGANIZATION_ID,
      ownerUserId: property.ownerUserId || (seedIds.has(property.id) ? CATALOG_OWNER_ID : property.ownerUserId),
      status: property.status || 'Active',
      defaultRentDueDay: property.defaultRentDueDay || 7,
      modules: property.modules || {
        foodManagement: property.foodIncluded,
        attendance: true,
        visitorManagement: true,
        onlinePayments: true,
        chat: true,
      },
    };
    });
  });

  const [residents, setResidents] = useState<Resident[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RESIDENTS);
    const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    let isDemoUser = false;

    if (savedUser) {
      try {
        const user: UserAccount = JSON.parse(savedUser);
        isDemoUser = user.isDemo || false;
      } catch {
        isDemoUser = false;
      }
    }

    const source: Resident[] = isProductionApiEnabled() ? [] : saved ? JSON.parse(saved) : INITIAL_RESIDENTS;
    const filteredSource = isDemoUser ? source : source.filter(r => !r.id.startsWith('demo-'));

    return filteredSource.map((resident) => ({
      ...resident,
      organizationId: resident.organizationId || DEFAULT_ORGANIZATION_ID,
      status: resident.status || 'Active',
      depositState: resident.depositState || 'Held',
      agreementState: resident.agreementState || (resident.kycVerified ? 'Active' : 'Pending'),
      previousDues: resident.previousDues || 0,
      advanceBalance: resident.advanceBalance || 0,
      outstandingBalance: resident.outstandingBalance || (resident.rentStatus === 'Paid' ? 0 : resident.monthlyRent),
      noticePeriodDays: resident.noticePeriodDays || 30,
    }));
  });

  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    let isDemoUser = false;

    if (savedUser) {
      try {
        const user: UserAccount = JSON.parse(savedUser);
        isDemoUser = user.isDemo || false;
      } catch {
        isDemoUser = false;
      }
    }

    const source: BookingRequest[] = isProductionApiEnabled() ? [] : saved ? JSON.parse(saved) : INITIAL_BOOKING_REQUESTS;
    return isDemoUser ? source : source.filter(b => !b.id.startsWith('demo-'));
  });

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    return saved ? JSON.parse(saved) : INITIAL_ATTENDANCE;
  });

  const [staff, setStaff] = useState<StaffMember[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STAFF);
    const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    let isDemoUser = false;
    if (savedUser) {
      try {
        isDemoUser = Boolean((JSON.parse(savedUser) as UserAccount).isDemo);
      } catch {
        isDemoUser = false;
      }
    }
    const source: StaffMember[] = isProductionApiEnabled() ? [] : saved ? JSON.parse(saved) : isDemoUser ? INITIAL_STAFF : [];
    const catalogProps = new Set(['prop-1', 'prop-2', 'prop-3', 'prop-4']);
    if (isDemoUser) return source;
    return source.filter((s) => !catalogProps.has(s.propertyId) || Boolean(s.ownerUserId));
  });

  const [tasks, setTasks] = useState<StaffTask[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [broadcasts, setBroadcasts] = useState<BroadcastNotification[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.BROADCASTS);
    return saved ? JSON.parse(saved) : INITIAL_BROADCASTS;
  });

  const [mealPlan, setMealPlan] = useState<MealPlanDay[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.MEALS);
    return saved ? JSON.parse(saved) : INITIAL_MEAL_PLAN;
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.CHAT);
    return saved ? JSON.parse(saved) : INITIAL_CHAT;
  });

  const [tickets, setTickets] = useState<MaintenanceTicket[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.TICKETS);
    return saved ? JSON.parse(saved) : INITIAL_TICKETS;
  });

  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.SUPPORT_TICKETS);
    return saved ? JSON.parse(saved) : INITIAL_SUPPORT_TICKETS;
  });

  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    if (saved) {
      try {
        const parsed: UserAccount[] = JSON.parse(saved);
        return parsed.filter(
          (u) => !u.isDemo && !u.id.startsWith('demo-') &&
          
            !u.id.startsWith('user-owner') &&
            !u.id.startsWith('user-resident') &&
            !u.id.startsWith('user-staff') &&
            !u.id.startsWith('user-admin') &&
            !u.id.startsWith('user-manager') &&
            !u.id.startsWith('user-warden') &&
            !u.id.startsWith('user-accountant')
        );
      } catch {
        return [];
      }
    }
    return [];
  });

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (saved) {
      try {
        const parsed: UserAccount = JSON.parse(saved);
        if (
          !parsed ||
          parsed.id.startsWith('user-owner') ||
          parsed.id.startsWith('user-resident') ||
          parsed.id.startsWith('user-staff') ||
          parsed.id.startsWith('user-admin') ||
          parsed.id.startsWith('user-manager') ||
          parsed.id.startsWith('user-warden') ||
          parsed.id.startsWith('user-accountant')
        ) {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
          localStorage.removeItem(STORAGE_KEYS.ROLE);
          return null;
        }
        if (parsed.isDemo || parsed.id.startsWith('demo-')) {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
          localStorage.removeItem(STORAGE_KEYS.ROLE);
          return null;
        }
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [currentStaffId, setCurrentStaffId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_STAFF_ID);
    return saved || '';
  });

  // Enterprise States
  const [beds, setBeds] = useState<Bed[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.BEDS);
    return saved ? JSON.parse(saved) : INITIAL_BEDS;
  });

  const [leads, setLeads] = useState<Lead[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.LEADS);
    return saved ? JSON.parse(saved) : INITIAL_LEADS;
  });

  const [meterReadings, setMeterReadings] = useState<ElectricityMeterReading[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.METER_READINGS);
    return saved ? JSON.parse(saved) : INITIAL_METER_READINGS;
  });

  const [reconciliations, setReconciliations] = useState<PropertyElectricityReconciliation[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.RECONCILIATION);
    return saved ? JSON.parse(saved) : INITIAL_RECONCILIATION;
  });

  const [depositRecords, setDepositRecords] = useState<SecurityDepositRecord[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.DEPOSITS);
    return saved ? JSON.parse(saved) : INITIAL_DEPOSITS;
  });

  const [agreements, setAgreements] = useState<RentAgreement[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.AGREEMENTS);
    return saved ? JSON.parse(saved) : INITIAL_AGREEMENTS;
  });

  const [visitorPasses, setVisitorPasses] = useState<VisitorPass[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.VISITORS);
    return saved ? JSON.parse(saved) : INITIAL_VISITORS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

  const [settings, setSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
  });

  const [rolePermissions, setRolePermissions] = useState<Record<string, RolePermissions>>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PERMISSIONS);
    return saved ? JSON.parse(saved) : DEFAULT_ROLE_PERMISSIONS;
  });

  const [stays, setStays] = useState<Stay[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.STAYS);
    return saved ? JSON.parse(saved) : deriveInitialStays(residents, beds);
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.INVOICES);
    if (saved) return JSON.parse(saved);
    const now = new Date();
    return residents
      .map((resident) => {
        const plan = deriveInitialRentPlans([resident], properties)[0];
        const invoice = buildMonthlyInvoice(resident, plan, now, []);
        if (!invoice) return null;
        if (resident.rentStatus === 'Paid') {
          return { ...invoice, verifiedPaidAmount: invoice.amount, status: 'Paid' as const };
        }
        return invoice;
      })
      .filter(Boolean) as Invoice[];
  });

  const [rentPlans, setRentPlans] = useState<RentPlan[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.RENT_PLANS);
    return saved ? JSON.parse(saved) : deriveInitialRentPlans(residents, properties);
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
    return saved ? JSON.parse(saved) : [];
  });

  const [paymentAllocations, setPaymentAllocations] = useState<PaymentAllocation[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.PAYMENT_ALLOCATIONS);
    return saved ? JSON.parse(saved) : [];
  });

  const [depositTransactions, setDepositTransactions] = useState<DepositTransaction[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.DEPOSIT_TRANSACTIONS);
    if (saved) return JSON.parse(saved);
    return residents.map((resident) => ({
      id: `dep-txn-${resident.id}`,
      organizationId: resident.organizationId || DEFAULT_ORGANIZATION_ID,
      residentId: resident.id,
      propertyId: resident.propertyId,
      type: 'Deposit Received' as const,
      amount: resident.depositAmount,
      reason: 'Opening security deposit balance',
      createdBy: 'system',
      createdAt: resident.moveInDate,
    }));
  });

  const [notices, setNotices] = useState<Notice[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.NOTICES);
    return saved ? JSON.parse(saved) : [];
  });

  const [checkouts, setCheckouts] = useState<Checkout[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.CHECKOUTS);
    return saved ? JSON.parse(saved) : [];
  });

  const [checkoutSettlements, setCheckoutSettlements] = useState<CheckoutSettlement[]>(() => {
    if (isProductionApiEnabled()) return [];
    const saved = localStorage.getItem('pgwalo_checkout_settlements');
    return saved ? JSON.parse(saved) : [];
  });

  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [showVirtualTourModal, setShowVirtualTourModal] = useState(false);
  const [virtualTourRoom, setVirtualTourRoom] = useState('Reception & Lobby');

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [authInitialRole, setAuthInitialRole] = useState<UserRole>('resident');
  const [authMeta, setAuthMeta] = useState<{ intent?: string; path?: string; propertyId?: string; source?: string }>({});
  const [pendingAuthAction, setPendingAuthAction] = useState<(() => void) | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingCustomerAction | null>(null);
  const [confirmedAction, setConfirmedAction] = useState<{ referenceId: string; action: PendingCustomerAction } | null>(null);
  const [selectedPGForDetail, setSelectedPGForDetailState] = useState<Property | null>(null);
  const [propertyModalIntent, setPropertyModalIntent] = useState<'view' | 'book'>('view');
  const setSelectedPGForDetail = (property: Property | null) => {
    setSelectedPGForDetailState(property);
    if (!property) setPropertyModalIntent('view');
  };
  const openPropertyModal = (property: Property | null, intent: 'view' | 'book' = 'view') => {
    setPropertyModalIntent(property ? intent : 'view');
    setSelectedPGForDetailState(property);
  };
  const [shellIntent, setShellIntent] = useState<string | null>(null);
  const openPublicCatalog = () => setShellIntent('search');
  const clearShellIntent = () => setShellIntent(null);

  const openRoleDashboard = (accountRole?: UserRole) => {
    const tab = dashboardTabForRole(accountRole || currentUser?.role);
    if (tab !== 'landing') setShellIntent(tab);
  };
  const [productionHydrated, setProductionHydrated] = useState(!isProductionApiEnabled());

  /**
   * Set the moment an authenticated call is rejected because the Super Admin
   * disabled (or suspended) this account. Every dashboard renders a hard
   * read-only screen while this is set; only logging out or a successful
   * reactivation clears it.
   */
  const [accountBlocked, setAccountBlocked] = useState<null | { reason: string }>(null);

  // Latest refresh functions, shared with the single multiplexed SSE stream.
  // Each collection effect registers its own pull here so one push connection
  // can fan out to all of them (refs, not state — updating must not re-render).
  const pullTicketsRef = useRef<(() => void) | null>(null);
  const pullInquiriesRef = useRef<(() => void) | null>(null);
  const refreshCoreRef = useRef<(() => void) | null>(null);
  const pullTicketsShared = useCallback(() => { pullTicketsRef.current?.(); }, []);
  const pullInquiriesShared = useCallback(() => { pullInquiriesRef.current?.(); }, []);
  const refreshCoreShared = useCallback(() => { refreshCoreRef.current?.(); }, []);

  // Active entities
  const activeProperty = properties[0] || null;
  const currentResident: Resident | null = currentUser?.role === 'resident'
    ? (residents.find(
        (r) =>
          (currentUser.email && r.email.toLowerCase() === currentUser.email.toLowerCase()) ||
          r.id === currentUser.id ||
          r.id === `res-${currentUser.id}`
      ) || null)
    : (currentUser ? null : (residents[0] || null));

  const matchStaffForUser = (user?: UserAccount | null) => {
    if (!user || user.role !== 'staff') return undefined;
    const digits = (user.phone || '').replace(/\D/g, '').slice(-10);
    return staff.find(
      (s) =>
        s.id === currentStaffId ||
        (digits && s.phone.replace(/\D/g, '').slice(-10) === digits) ||
        (user.propertyId && s.propertyId === user.propertyId && s.name === user.name)
    );
  };

  const currentStaff: StaffMember | null =
    staff.find((s) => s.id === currentStaffId) ||
    matchStaffForUser(currentUser) ||
    (currentUser?.isDemo ? staff[0] || INITIAL_STAFF[0] : null);

  useEffect(() => {
    let cancelled = false;
    if (!isProductionApiEnabled()) return;
    loadProductionSnapshot(currentUser?.role || role, currentUser?.organizationId || DEFAULT_ORGANIZATION_ID)
      .then((snapshot) => {
        if (cancelled || !snapshot) return;
        if (snapshot.organizations?.length) setOrganizations(snapshot.organizations);
        // Public catalog is loaded from /api/listings so owners' PGs appear in other browsers.
        if (snapshot.residents) setResidents(snapshot.residents);
        if (snapshot.beds) setBeds(snapshot.beds);
        if (snapshot.stays) setStays(snapshot.stays);
        if (snapshot.rentPlans) setRentPlans(snapshot.rentPlans);
        if (snapshot.invoices) setInvoices(snapshot.invoices);
        if (snapshot.payments) setPayments(snapshot.payments);
        if (snapshot.paymentAllocations) setPaymentAllocations(snapshot.paymentAllocations);
        if (snapshot.depositTransactions) setDepositTransactions(snapshot.depositTransactions);
        if (snapshot.notices) setNotices(snapshot.notices);
        if (snapshot.checkouts) setCheckouts(snapshot.checkouts);
        if (snapshot.checkoutSettlements?.length) setCheckoutSettlements(snapshot.checkoutSettlements);
        if (snapshot.auditLogs) setAuditLogs(snapshot.auditLogs);
        if (snapshot.rent_agreements) {
          // Keep any signatures captured on this device that the server
          // snapshot may not reflect yet, so a signature never flips back.
          setAgreements((prev) => {
            const byId = new Map(snapshot.rent_agreements.map((a: RentAgreement) => [a.id, a]));
            for (const a of prev) {
              if (byId.has(a.id)) {
                const server = byId.get(a.id)!;
                byId.set(a.id, {
                  ...server,
                  tenantSigned: server.tenantSigned || a.tenantSigned,
                  ownerSigned: server.ownerSigned || a.ownerSigned,
                  tenantSignatureDate: server.tenantSignatureDate || a.tenantSignatureDate,
                  ownerSignatureDate: server.ownerSignatureDate || a.ownerSignatureDate,
                });
              } else {
                byId.set(a.id, a);
              }
            }
            return Array.from(byId.values());
          });
        }
        if (snapshot.broadcast_notifications) {
          // Server rows have no read memory — apply this account's stored read
          // ids so the bell badge reflects what the user has already seen.
          let readSet = new Set<string>();
          try {
            if (currentUser) {
              const raw = localStorage.getItem('pgwalo_notifications_read');
              const byUser: Record<string, string[]> = raw ? JSON.parse(raw) : {};
              readSet = new Set(byUser[currentUser.id] || []);
            }
          } catch { /* best-effort */ }
          setBroadcasts(
            snapshot.broadcast_notifications.map((b: BroadcastNotification) => ({
              ...b,
              read: readSet.has(b.id) ? true : b.read,
            }))
          );
        }
        if (snapshot.support_tickets) setSupportTickets(snapshot.support_tickets);
        if (snapshot.staff_members?.length) {
          // Staff dashboards match the signed-in user by phone, so a genuine
          // staff account in a fresh browser needs these rows to recognise
          // their property and shift.
          setStaff((prev) => {
            const byId = new Map<string, StaffMember>(prev.map((s) => [s.id, s] as [string, StaffMember]));
            for (const serverStaff of snapshot.staff_members as StaffMember[]) {
              byId.set(serverStaff.id, serverStaff);
            }
            return Array.from(byId.values());
          });
        }
        if (snapshot.attendance_records?.length) setAttendance(snapshot.attendance_records as AttendanceRecord[]);
        if (snapshot.users) setUsers(snapshot.users);
        if (snapshot.booking_requests) setBookingRequests((prev) => mergeBookings(prev, snapshot.booking_requests as BookingRequest[]));
        // Demo/mock rows must never survive a production hydration.
        setProperties((prev) => prev.filter((p) => !p.id.startsWith('demo-') && !['prop-1', 'prop-2', 'prop-3', 'prop-4'].includes(p.id)));
      })
      .catch((error) => {
        console.warn('PGNest production API bootstrap failed; using local cache.', error);
      })
      .finally(() => {
        if (!cancelled) setProductionHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, role]);

  useEffect(() => {
    if (!isProductionApiEnabled()) return;
    let cancelled = false;
    const pull = () => {
      fetchPublicListings()
        .then((remote) => {
          if (cancelled || !remote.length) return;
          setProperties((prev) => mergeProperties(prev, remote));
        })
        .catch(() => undefined);
    };
    pull();
    const timer = window.setInterval(pull, 45000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!isProductionApiEnabled() || !currentUser) return;
    let cancelled = false;
    const filters = isPlatformAdmin(currentUser.role)
      ? {}
      : currentUser.role === 'owner'
        ? { ownerUserId: currentUser.id }
        : { email: currentUser.email, phone: currentUser.phone };
    const pull = () => {
      fetchInquiries(filters)
        .then((remote) => {
          if (cancelled || !remote.length) return;
          setBookingRequests((prev) => mergeBookings(prev, remote as typeof prev));
        })
        .catch(() => undefined);
    };
    pull();
    const timer = window.setInterval(pull, 20000);
    pullInquiriesRef.current = pull;

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      pullInquiriesRef.current = null;
    };
  }, [currentUser?.id, currentUser?.role]);

  // Maintenance complaints: pull the signed-in user's tickets from D1 on
  // sign-in, then keep them fresh via the SSE push channel (a resident sees
  // status changes and staff/warden see new complaints within ~1-2 s). A slow
  // interval remains as a fallback for browsers where the stream can't open.
  useEffect(() => {
    if (!isProductionApiEnabled() || !currentUser) return;
    let cancelled = false;
    const mergeTickets = (remote: MaintenanceTicket[]) => {
      setTickets((prev) => {
        const byId = new Map<string, MaintenanceTicket>(prev.map((t) => [t.id, t] as [string, MaintenanceTicket]));
        for (const remoteTicket of remote) {
          const local = byId.get(remoteTicket.id);
          // Keep any locally newer fields, but server status wins so
          // notifications match what the resident sees.
          byId.set(remoteTicket.id, local ? { ...local, ...remoteTicket } : remoteTicket);
        }
        return Array.from(byId.values()).sort((a, b) =>
          String(b.createdAt).localeCompare(String(a.createdAt))
        );
      });
    };
    const pull = () => {
      fetchMaintenanceTickets()
        .then((remote) => {
          if (cancelled || !remote) return;
          mergeTickets(remote as MaintenanceTicket[]);
        })
        .catch(() => undefined);
    };
    pull();
    // Push arrives via the multiplexed notifications stream below; this slow
    // interval is only the offline fallback.
    const fallbackTimer = window.setInterval(pull, 30000);
    pullTicketsRef.current = pull;

    return () => {
      cancelled = true;
      window.clearInterval(fallbackTimer);
      pullTicketsRef.current = null;
    };
  }, [currentUser?.id, currentUser?.role]);

  // Notifications inbox: initial fetch with the bootstrap hydration, then
  // refreshed by the SSE push channel whenever a new notice is addressed to
  // this account (complaint status changes) or announcements change.
  useEffect(() => {
    if (!isProductionApiEnabled() || !currentUser) return;
    let cancelled = false;
    const pullNotifications = () => {
      fetchMyNotifications()
        .then((remote) => {
          if (cancelled || !remote) return;
          setBroadcasts((prev) => {
            const readSet = new Set(prev.filter((b) => b.read).map((b) => b.id));
            const byId = new Map<string, BroadcastNotification>();
            for (const b of remote) byId.set(b.id, { ...b, read: readSet.has(b.id) });
            // Keep locally-created notices (not yet in D1) visible.
            for (const b of prev) if (!byId.has(b.id)) byId.set(b.id, b);
            return Array.from(byId.values()).sort((a, b) =>
              String(b.timestamp).localeCompare(String(a.timestamp))
            );
          });
        })
        .catch(() => undefined);
    };
    pullNotifications();

    const fallbackTimer = window.setInterval(pullNotifications, 45000);

    // ONE multiplexed push channel for this session: notifications, tickets,
    // booking/visit inquiries and the operational 'data' watermark all ride a
    // single SSE connection (the Worker supports kind=all). Four separate
    // streams would quadruple the D1 watermark polling for no benefit.
    const stopStream = connectEventStream(['notifications', 'tickets', 'inquiries', 'data'], {
      onNotificationsChanged: pullNotifications,
      onTicketsChanged: pullTicketsShared,
      onInquiriesChanged: pullInquiriesShared,
      onDataChanged: refreshCoreShared,
    });

    return () => {
      cancelled = true;
      stopStream();
      window.clearInterval(fallbackTimer);
    };
  }, [currentUser?.id, currentUser?.role]);

  // Instant operational sync: any approval, allocation, listing change or
  // disable/enable anywhere in the app pushes a 'data' change over SSE, and
  // every dashboard refreshes its core collections within ~2 s. The public
  // listings poll above stays as the wide-net backstop.
  useEffect(() => {
    if (!isProductionApiEnabled() || !currentUser) return;
    let cancelled = false;
    const refreshCore = () => {
      fetchPublicListings()
        .then((remote) => {
          if (cancelled || !remote.length) return;
          setProperties((prev) => mergeProperties(prev, remote));
        })
        .catch(() => undefined);
      if (currentUser.role === 'owner' || isPlatformAdmin(currentUser.role)) {
        const filters = isPlatformAdmin(currentUser.role)
          ? {}
          : { ownerUserId: currentUser.id };
        fetchInquiries(filters)
          .then((remote) => {
            if (cancelled || !remote.length) return;
            setBookingRequests((prev) => mergeBookings(prev, remote as typeof prev));
          })
          .catch(() => undefined);
      }
    };
    refreshCoreRef.current = refreshCore;
    return () => {
      cancelled = true;
      refreshCoreRef.current = null;
    };
  }, [currentUser?.id, currentUser?.role]);

  // Enforcement mirror: the Worker now rejects every call from a disabled or
  // suspended account, and this client-side check flips the UI to the
  // read-only blocked screen the moment the server first says so (any 401
  // naming the account state, confirmed against /api/auth/me).
  useEffect(() => {
    if (!isProductionApiEnabled() || !currentUser || isPlatformAdmin(currentUser.role)) return;
    let cancelled = false;
    const check = () => {
      fetchMeWithWorkers()
        .then((data: { error?: string; user?: { status?: string } }) => {
          if (cancelled) return;
          if (data?.user?.status === 'Disabled' || data?.user?.status === 'Suspended') {
            setAccountBlocked({ reason: data.user.status === 'Suspended' ? 'Account suspended' : 'Account disabled' });
          }
        })
        .catch(() => undefined);
    };
    check();
    const timer = window.setInterval(check, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'owner' || currentUser.isDemo) return;
    const mine = properties.filter(
      (p) =>
        ownsProperty(p, currentUser) &&
        p.ownerUserId !== CATALOG_OWNER_ID &&
        !/^prop-[1-4]$/.test(p.id) &&
        !p.id.startsWith('demo-')
    );
    mine.forEach((p) => {
      void publishListing(p).then((stored) => (stored ? adoptStoredProperty(stored) : undefined));
    });
  }, [currentUser?.id, properties.length]);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ROLE, role);
  }, [role]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ORGANIZATIONS, JSON.stringify(organizations));
  }, [organizations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_STAFF_ID, currentStaffId);
  }, [currentStaffId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(properties));
  }, [properties]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RESIDENTS, JSON.stringify(residents));
  }, [residents]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookingRequests));
  }, [bookingRequests]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff));
  }, [staff]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BROADCASTS, JSON.stringify(broadcasts));
  }, [broadcasts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(mealPlan));
  }, [mealPlan]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CHAT, JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
  }, [tickets]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SUPPORT_TICKETS, JSON.stringify(supportTickets));
  }, [supportTickets]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BEDS, JSON.stringify(beds));
  }, [beds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.METER_READINGS, JSON.stringify(meterReadings));
  }, [meterReadings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RECONCILIATION, JSON.stringify(reconciliations));
  }, [reconciliations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DEPOSITS, JSON.stringify(depositRecords));
  }, [depositRecords]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AGREEMENTS, JSON.stringify(agreements));
  }, [agreements]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(visitorPasses));
  }, [visitorPasses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(rolePermissions));
  }, [rolePermissions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STAYS, JSON.stringify(stays));
  }, [stays]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RENT_PLANS, JSON.stringify(rentPlans));
  }, [rentPlans]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
  }, [payments]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PAYMENT_ALLOCATIONS, JSON.stringify(paymentAllocations));
  }, [paymentAllocations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DEPOSIT_TRANSACTIONS, JSON.stringify(depositTransactions));
  }, [depositTransactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NOTICES, JSON.stringify(notices));
  }, [notices]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CHECKOUTS, JSON.stringify(checkouts));
  }, [checkouts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CHECKOUT_SETTLEMENTS, JSON.stringify(checkoutSettlements));
  }, [checkoutSettlements]);

  useEffect(() => {
    if (!productionHydrated || !isProductionApiEnabled() || !['owner', 'admin'].includes(currentUser?.role || role)) {
      return;
    }
    const timeout = window.setTimeout(() => {
      saveProductionSnapshot(
        currentUser?.role || role,
        {
          organizations,
          properties,
          residents,
          beds,
          stays,
          rentPlans,
          invoices,
          payments,
          paymentAllocations,
          depositTransactions,
          notices,
          checkouts,
          // Agreements and broadcasts were missing from this payload, so an
          // owner could "send" an agreement or a notice and no other device —
          // including the resident's — could ever receive it.
          rent_agreements: agreements,
          broadcast_notifications: broadcasts,
        },
        currentUser?.organizationId || DEFAULT_ORGANIZATION_ID
      ).catch((error) => {
        console.warn('PGNest production API sync failed; local cache retained.', error);
      });
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [
    productionHydrated,
    currentUser?.role,
    currentUser?.organizationId,
    role,
    organizations,
    properties,
    residents,
    beds,
    stays,
    rentPlans,
    invoices,
    payments,
    paymentAllocations,
    depositTransactions,
    notices,
    checkouts,
    agreements,
    broadcasts,
  ]);

  const hasPermission = (permission: PermissionKey) =>
    hasWorkflowPermission(currentUser?.role || role, rolePermissions, permission);

  const addAuditEntry = (params: Parameters<typeof buildAuditEntry>[0]) => {
    setAuditLogs((prev) => [buildAuditEntry(params), ...prev.slice(0, 199)]);
  };

  const updateResidentLedgerStatus = (residentId: string, nextInvoices = invoices, nextAllocations = paymentAllocations) => {
    const summary = summarizeResidentLedger(residentId, nextInvoices, nextAllocations);
    setResidents((prev) =>
      prev.map((resident) => {
        if (resident.id !== residentId) return resident;
        return {
          ...resident,
          outstandingBalance: summary.outstanding,
          advanceBalance: summary.advance,
          rentStatus: summary.outstanding === 0 ? 'Paid' : resident.rentStatus === 'Overdue' ? 'Overdue' : 'Pending',
          lastPaymentDate: summary.outstanding === 0 ? new Date().toISOString().split('T')[0] : resident.lastPaymentDate,
        };
      })
    );
  };

  const updateBedStatus = (bedId: string, status: BedStatus, tenantId?: string, tenantName?: string) => {
    const existingBed = beds.find((b) => b.id === bedId);
    if (!existingBed) return;
    if (!hasPermission('room.assign')) {
      logAuditEvent('Permission Denied', `Bed ${bedId}`, `Attempted bed status update to ${status}`);
      return;
    }
    if (canonicalBedStatus(status) === 'Occupied') {
      const overlapping = beds.some(
        (bed) =>
          bed.id === bedId &&
          canonicalBedStatus(bed.status) === 'Occupied' &&
          bed.currentTenantId &&
          tenantId &&
          bed.currentTenantId !== tenantId
      );
      if (overlapping) {
        logAuditEvent('Blocked Double Allocation', `Bed ${bedId}`, 'Cannot assign occupied bed to another active resident');
        return;
      }
    }

    setBeds((prev) =>
      prev.map((b) =>
        b.id === bedId
          ? {
              ...b,
              status,
              currentTenantId: tenantId ?? (canonicalBedStatus(status) === 'Vacant' ? undefined : b.currentTenantId),
              currentTenantName: tenantName ?? (canonicalBedStatus(status) === 'Vacant' ? undefined : b.currentTenantName),
              reservedForResidentId: canonicalBedStatus(status) === 'Reserved' ? tenantId : b.reservedForResidentId,
            }
          : b
      )
    );
    addAuditEntry({
      user: currentUser,
      role,
      action: 'Bed Status Changed',
      entityType: 'Bed',
      entityId: bedId,
      previousValue: existingBed,
      newValue: { status, tenantId, tenantName },
      propertyId: existingBed.propertyId,
    });
  };

  const getResidentLedgerSummary = (residentId: string) =>
    summarizeResidentLedger(residentId, invoices, paymentAllocations);

  const generateMonthlyInvoice = (residentId: string, monthDate = new Date()) => {
    if (!hasPermission('invoice.create')) return null;
    const resident = residents.find((item) => item.id === residentId);
    const rentPlan = rentPlans.find(
      (item) => item.residentId === residentId && item.status === 'Active'
    );
    if (!resident || !rentPlan) return null;
    const invoice = buildMonthlyInvoice(resident, rentPlan, monthDate, invoices);
    if (!invoice) return null;
    setInvoices((prev) => [invoice, ...prev]);
    updateResidentLedgerStatus(residentId, [invoice, ...invoices], paymentAllocations);
    addAuditEntry({
      user: currentUser,
      role,
      action: 'Invoice Created',
      entityType: 'Invoice',
      entityId: invoice.id,
      newValue: invoice,
      propertyId: invoice.propertyId,
    });
    return invoice;
  };

  const recordPayment = (
    residentId: string,
    amount: number,
    method: string,
    status: Payment['status'] = 'Pending Verification'
  ) => {
    if (!hasPermission('payment.record') && currentUser?.role !== 'resident' && role !== 'resident') {
      throw new Error('You do not have permission to record payments.');
    }
    const resident = residents.find((item) => item.id === residentId) || currentResident;
    if (!resident || resident.id !== residentId) throw new Error('Resident not found.');
    const payment = makePayment({ resident, amount, method, status });
    setPayments((prev) => [payment, ...prev]);
    addAuditEntry({
      user: currentUser,
      role,
      action: 'Payment Created',
      entityType: 'Payment',
      entityId: payment.id,
      newValue: payment,
      propertyId: payment.propertyId,
      reason: status === 'Pending Verification' ? 'Resident/manual payment submitted for verification' : undefined,
    });
    if (status === 'Verified') {
      const allocated = allocateVerifiedPayment(payment, invoices, paymentAllocations);
      setInvoices(allocated.invoices);
      setPaymentAllocations(allocated.allocations);
      updateResidentLedgerStatus(residentId, allocated.invoices, allocated.allocations);
    }
    return payment;
  };

  const verifyPayment = (paymentId: string) => {
    if (!hasPermission('payment.verify')) {
      throw new Error('You do not have permission to verify payments.');
    }
    const target = payments.find((payment) => payment.id === paymentId);
    if (!target || target.status === 'Verified') return;
    const verifiedPayment: Payment = {
      ...target,
      status: 'Verified',
      verifiedAt: new Date().toISOString(),
    };
    const nextPayments = payments.map((payment) => (payment.id === paymentId ? verifiedPayment : payment));
    const allocated = allocateVerifiedPayment(verifiedPayment, invoices, paymentAllocations);
    setPayments(nextPayments);
    setInvoices(allocated.invoices);
    setPaymentAllocations(allocated.allocations);
    updateResidentLedgerStatus(verifiedPayment.residentId, allocated.invoices, allocated.allocations);
    addAuditEntry({
      user: currentUser,
      role,
      action: 'Payment Verified',
      entityType: 'Payment',
      entityId: paymentId,
      previousValue: target,
      newValue: verifiedPayment,
      propertyId: verifiedPayment.propertyId,
    });
  };

  const reserveBedForResident = (bedId: string, residentId: string, expiryDate: string) => {
    if (!hasPermission('room.assign')) throw new Error('You do not have permission to reserve beds.');
    const bed = beds.find((item) => item.id === bedId);
    const resident = residents.find((item) => item.id === residentId);
    if (!bed || !resident) throw new Error('Bed or resident not found.');
    if (!canBedBeAssigned(bed, residentId)) throw new Error('This bed is not available for reservation.');
    setBeds((prev) =>
      prev.map((item) =>
        item.id === bedId
          ? {
              ...item,
              status: 'Reserved',
              reservedForResidentId: residentId,
              currentTenantId: residentId,
              currentTenantName: resident.name,
              reservationExpiry: expiryDate,
            }
          : item
      )
    );
    setResidents((prev) =>
      prev.map((item) => (item.id === residentId ? { ...item, status: 'Reserved' } : item))
    );
    addAuditEntry({
      user: currentUser,
      role,
      action: 'Bed Reserved',
      entityType: 'Bed',
      entityId: bedId,
      previousValue: bed,
      newValue: { residentId, expiryDate },
      propertyId: bed.propertyId,
    });
  };

  const confirmMoveIn = (
    residentId: string,
    bedId: string,
    moveInDate = new Date().toISOString().split('T')[0],
    allowExceptionReason?: string
  ) => {
    if (!hasPermission('room.assign')) throw new Error('You do not have permission to confirm move-ins.');
    const resident = residents.find((item) => item.id === residentId);
    const bed = beds.find((item) => item.id === bedId);
    if (!resident || !bed) throw new Error('Resident or bed not found.');
    const missingRequired =
      !resident.monthlyRent ||
      !moveInDate ||
      resident.depositState === 'Unknown' ||
      resident.agreementState === 'Unknown' ||
      !resident.kycVerified;
    if (missingRequired && !allowExceptionReason) {
      throw new Error('Move-in requires rent, move-in date, KYC, deposit state, and agreement state.');
    }
    if (!canBedBeAssigned(bed, residentId)) {
      throw new Error('Cannot confirm move-in because the bed is occupied or reserved for someone else.');
    }

    const stay: Stay = {
      id: `stay-${residentId}-${Date.now()}`,
      organizationId: resident.organizationId || DEFAULT_ORGANIZATION_ID,
      residentId,
      propertyId: resident.propertyId,
      roomId: bed.roomId,
      roomNumber: bed.roomNumber,
      bedId,
      bedNumber: bed.bedNumber,
      startDate: moveInDate,
      monthlyRentAtStart: resident.monthlyRent,
      status: 'Current',
    };
    setStays((prev) => [stay, ...prev]);
    setBeds((prev) =>
      prev.map((item) =>
        item.id === bedId
          ? { ...item, status: 'Occupied', currentTenantId: residentId, currentTenantName: resident.name }
          : item
      )
    );
    setResidents((prev) =>
      prev.map((item) =>
        item.id === residentId
          ? {
              ...item,
              status: 'Active',
              roomNumber: bed.roomNumber,
              bedNumber: bed.bedNumber,
              currentStayId: stay.id,
              moveInDate,
            }
          : item
      )
    );
    addAuditEntry({
      user: currentUser,
      role,
      action: 'Move-In Confirmed',
      entityType: 'Resident',
      entityId: residentId,
      previousValue: resident,
      newValue: { bedId, stay, status: 'Active' },
      propertyId: resident.propertyId,
      reason: allowExceptionReason,
    });
  };

  const transferResidentBed = (
    residentId: string,
    newBedId: string,
    transferDate: string,
    reason: string,
    rentChange?: number
  ) => {
    if (!hasPermission('room.transfer')) throw new Error('You do not have permission to transfer beds.');
    if (!reason.trim()) throw new Error('Room transfer requires a reason.');
    const resident = residents.find((item) => item.id === residentId);
    const newBed = beds.find((item) => item.id === newBedId);
    if (!resident || resident.status !== 'Active' || !newBed) throw new Error('Only active residents can be transferred.');
    if (!canBedBeAssigned(newBed, residentId)) throw new Error('Target bed is not available.');
    const currentStay = stays.find((stay) => stay.residentId === residentId && stay.status === 'Current');
    const nextRent = rentChange || resident.monthlyRent;
    const newStay: Stay = {
      id: `stay-${residentId}-${Date.now()}`,
      organizationId: resident.organizationId || DEFAULT_ORGANIZATION_ID,
      residentId,
      propertyId: resident.propertyId,
      roomId: newBed.roomId,
      roomNumber: newBed.roomNumber,
      bedId: newBed.id,
      bedNumber: newBed.bedNumber,
      startDate: transferDate,
      monthlyRentAtStart: nextRent,
      transferReason: reason,
      status: 'Current',
    };
    setStays((prev) => [
      newStay,
      ...prev.map((stay) =>
        stay.id === currentStay?.id ? { ...stay, status: 'Closed' as const, endDate: transferDate, transferReason: reason } : stay
      ),
    ]);
    setBeds((prev) =>
      prev.map((bed) => {
        if (bed.id === currentStay?.bedId) {
          return { ...bed, status: 'Vacant', currentTenantId: undefined, currentTenantName: undefined };
        }
        if (bed.id === newBedId) {
          return { ...bed, status: 'Occupied', currentTenantId: residentId, currentTenantName: resident.name };
        }
        return bed;
      })
    );
    setResidents((prev) =>
      prev.map((item) =>
        item.id === residentId
          ? {
              ...item,
              roomNumber: newBed.roomNumber,
              bedNumber: newBed.bedNumber,
              monthlyRent: nextRent,
              currentStayId: newStay.id,
            }
          : item
      )
    );
    if (rentChange && rentChange !== resident.monthlyRent) {
      setRentPlans((prev) => [
        {
          id: `rent-plan-${residentId}-${Date.now()}`,
          organizationId: resident.organizationId || DEFAULT_ORGANIZATION_ID,
          residentId,
          propertyId: resident.propertyId,
          monthlyRent: rentChange,
          dueDay: settings.rentDueDay || 7,
          effectiveFrom: transferDate,
          status: 'Active',
          revisionReason: reason,
        },
        ...prev.map((plan) =>
          plan.residentId === residentId && plan.status === 'Active'
            ? { ...plan, status: 'Ended' as const, effectiveTo: transferDate }
            : plan
        ),
      ]);
    }
    addAuditEntry({
      user: currentUser,
      role,
      action: 'Room Transfer',
      entityType: 'Resident',
      entityId: residentId,
      previousValue: { resident, currentStay },
      newValue: { newStay, rentChange },
      propertyId: resident.propertyId,
      reason,
    });
  };

  const submitNotice = (residentId: string, requestedCheckoutDate: string, reason: string, comments?: string) => {
    const resident = residents.find((item) => item.id === residentId);
    if (!resident || resident.status !== 'Active') throw new Error('Only active residents can submit notice.');
    const notice = makeNotice({ resident, requestedCheckoutDate, reason, comments });
    setNotices((prev) => [notice, ...prev]);
    setResidents((prev) => prev.map((item) => (item.id === residentId ? { ...item, status: 'Notice Period' } : item)));
    setBeds((prev) =>
      prev.map((bed) =>
        bed.currentTenantId === residentId
          ? { ...bed, status: 'Notice Period', nextAvailableDate: notice.approvedCheckoutDate }
          : bed
      )
    );
    addAuditEntry({
      user: currentUser,
      role,
      action: 'Notice Submitted',
      entityType: 'Notice',
      entityId: notice.id,
      newValue: notice,
      propertyId: resident.propertyId,
      reason,
    });
    return notice;
  };

  const approveNotice = (noticeId: string, approvedCheckoutDate?: string, reason?: string) => {
    const notice = notices.find((item) => item.id === noticeId);
    if (!notice) return;
    const nextNotice = {
      ...notice,
      status: approvedCheckoutDate && approvedCheckoutDate !== notice.approvedCheckoutDate ? 'Modified' as const : 'Approved' as const,
      approvedCheckoutDate: approvedCheckoutDate || notice.approvedCheckoutDate,
      ownerReason: reason,
    };
    setNotices((prev) => prev.map((item) => (item.id === noticeId ? nextNotice : item)));
    addAuditEntry({
      user: currentUser,
      role,
      action: 'Notice Approved',
      entityType: 'Notice',
      entityId: noticeId,
      previousValue: notice,
      newValue: nextNotice,
      propertyId: notice.propertyId,
      reason,
    });
  };

  const startCheckout = (
    residentId: string,
    charges: Partial<Pick<Checkout, 'electricityCharges' | 'foodCharges' | 'damageCharges' | 'otherDeductions'>> = {}
  ) => {
    if (!hasPermission('resident.checkout')) throw new Error('You do not have permission to start checkout.');
    const resident = residents.find((item) => item.id === residentId);
    const activeStay = stays.find((stay) => stay.residentId === residentId && stay.status === 'Current');
    if (!resident || !activeStay) throw new Error('Resident stay not found for checkout.');
    if (!['Active', 'Notice Period', 'Checkout Pending'].includes(resident.status || 'Active')) {
      throw new Error('Checkout is only available for active, notice period, or checkout pending residents.');
    }
    const checkout = makeCheckout({
      resident,
      bedId: activeStay.bedId,
      invoices,
      depositTransactions,
      electricityCharges: charges.electricityCharges,
      foodCharges: charges.foodCharges,
      damageCharges: charges.damageCharges,
      otherDeductions: charges.otherDeductions,
    });
    setCheckouts((prev) => [checkout, ...prev]);
    setResidents((prev) =>
      prev.map((item) => (item.id === residentId ? { ...item, status: 'Checkout Pending', checkoutId: checkout.id } : item))
    );
    addAuditEntry({
      user: currentUser,
      role,
      action: 'Checkout Started',
      entityType: 'Checkout',
      entityId: checkout.id,
      newValue: checkout,
      propertyId: resident.propertyId,
    });
    return checkout;
  };

  const completeCheckout = (checkoutId: string) => {
    if (!hasPermission('resident.checkout')) throw new Error('You do not have permission to complete checkout.');
    const checkout = checkouts.find((item) => item.id === checkoutId);
    if (!checkout) return;
    const resident = residents.find((item) => item.id === checkout.residentId);
    if (!resident) return;
    const completed: Checkout = { ...checkout, status: 'Completed', completedAt: new Date().toISOString() };
    setCheckouts((prev) => prev.map((item) => (item.id === checkoutId ? completed : item)));
    setResidents((prev) => prev.map((item) => (item.id === resident.id ? { ...item, status: 'Checked Out' } : item)));
    setStays((prev) =>
      prev.map((stay) =>
        stay.residentId === resident.id && stay.status === 'Current'
          ? { ...stay, status: 'Closed', endDate: new Date().toISOString().split('T')[0] }
          : stay
      )
    );
    setBeds((prev) =>
      prev.map((bed) =>
        bed.id === checkout.bedId
          ? {
              ...bed,
              status: 'Vacant',
              currentTenantId: undefined,
              currentTenantName: undefined,
              reservedForResidentId: undefined,
            }
          : bed
      )
    );
    const deductionTotal =
      checkout.rentPending +
      checkout.electricityCharges +
      checkout.foodCharges +
      checkout.damageCharges +
      checkout.otherDeductions;
    if (deductionTotal > 0) {
      setDepositTransactions((prev) => [
        {
          id: `dep-ded-${checkout.id}`,
          organizationId: checkout.organizationId,
          residentId: checkout.residentId,
          propertyId: checkout.propertyId,
          type: 'Deposit Deduction',
          amount: deductionTotal,
          reason: 'Checkout settlement deductions',
          createdBy: currentUser?.id || 'system',
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    if (checkout.refundAmount > 0) {
      setDepositTransactions((prev) => [
        {
          id: `dep-ref-${checkout.id}`,
          organizationId: checkout.organizationId,
          residentId: checkout.residentId,
          propertyId: checkout.propertyId,
          type: 'Deposit Refund',
          amount: checkout.refundAmount,
          reason: 'Checkout deposit refund',
          createdBy: currentUser?.id || 'system',
          createdAt: new Date().toISOString(),
          transactionReference: `REF-${Date.now().toString().slice(-8)}`,
        },
        ...prev,
      ]);
    }
    addAuditEntry({
      user: currentUser,
      role,
      action: 'Checkout Completed',
      entityType: 'Checkout',
      entityId: checkoutId,
      previousValue: checkout,
      newValue: completed,
      propertyId: checkout.propertyId,
    });
  };

  const addLead = (lead: Omit<Lead, 'id' | 'createdAt' | 'lastFollowUp'>) => {
    const newLead: Lead = {
      ...lead,
      id: `lead-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      lastFollowUp: new Date().toISOString().split('T')[0],
      propertyId:
        lead.propertyId ||
        properties.find((p) => ownsProperty(p, currentUser))?.id ||
        '',
      propertyName:
        lead.propertyName ||
        properties.find((p) => ownsProperty(p, currentUser))?.name ||
        '',
    };
    setLeads((prev) => [newLead, ...prev]);
    logAuditEvent('New Lead Captured', `Lead: ${lead.name}`, `Stage: ${lead.stage}, Room: ${lead.roomTypePreference}`);
  };

  const updateLeadStage = (leadId: string, stage: LeadStage, notes?: string) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              stage,
              notes: notes ? `${l.notes}\n[${new Date().toISOString().split('T')[0]}]: ${notes}` : l.notes,
              lastFollowUp: new Date().toISOString().split('T')[0],
            }
          : l
      )
    );
    logAuditEvent('Lead Pipeline Updated', `Lead ID: ${leadId}`, `Advanced to ${stage}`);
  };

  const addMeterReading = (reading: Omit<ElectricityMeterReading, 'id'>) => {
    const newReading: ElectricityMeterReading = {
      ...reading,
      id: `emr-${Date.now()}`,
    };
    setMeterReadings((prev) => [newReading, ...prev]);
    logAuditEvent('Electricity Meter Logged', `Room ${reading.roomNumber}`, `${reading.unitsConsumed} units @ ₹${reading.ratePerUnit}/unit = ₹${reading.totalAmount}`);
  };

  const addDepositDeduction = (
    depositId: string,
    deduction: { category: 'Damage' | 'Unpaid Rent' | 'Electricity' | 'Other'; amount: number; reason: string }
  ) => {
    setDepositRecords((prev) =>
      prev.map((dep) => {
        if (dep.id !== depositId) return dep;
        const newDeductions = [
          ...dep.deductions,
          {
            id: `ded-${Date.now()}`,
            ...deduction,
            approvedByOwner: true,
          },
        ];
        const totalDeductions = newDeductions.reduce((sum, d) => sum + d.amount, 0);
        const finalRefundAmount = Math.max(0, dep.depositReceived - totalDeductions);
        return {
          ...dep,
          deductions: newDeductions,
          totalDeductions,
          finalRefundAmount,
          status: 'Settlement Pending' as const,
        };
      })
    );
    logAuditEvent('Deposit Deduction Added', `Deposit ID: ${depositId}`, `${deduction.category}: ₹${deduction.amount} - ${deduction.reason}`);
  };

  const settleDepositRefund = (depositId: string, transactionId: string) => {
    setDepositRecords((prev) =>
      prev.map((dep) => {
        if (dep.id !== depositId) return dep;
        return {
          ...dep,
          status: 'Refunded' as const,
          refundDate: new Date().toISOString().split('T')[0],
          refundTransactionId: transactionId,
        };
      })
    );
    logAuditEvent('Deposit Refund Settled', `Deposit ID: ${depositId}`, `Settled via Txn: ${transactionId}`);
  };

  // Signature-preserving merge: polled/server rows update locals, but a
  // signature captured on this device is never lost to a stale server row.
  const mergeAgreements = (incoming: RentAgreement[]) => {
    if (!incoming.length) return;
    setAgreements((prev) => {
      const byId = new Map<string, RentAgreement>(prev.map((a) => [a.id, a]));
      for (const fresh of incoming) {
        const existing = byId.get(fresh.id);
        byId.set(
          fresh.id,
          existing
            ? {
                ...fresh,
                tenantSigned: fresh.tenantSigned || existing.tenantSigned,
                ownerSigned: fresh.ownerSigned || existing.ownerSigned,
                tenantSignatureDate: fresh.tenantSignatureDate || existing.tenantSignatureDate,
                ownerSignatureDate: fresh.ownerSignatureDate || existing.ownerSignatureDate,
              }
            : fresh
        );
      }
      return Array.from(byId.values());
    });
  };

  const signAgreement = (agreementId: string, asRole: 'owner' | 'tenant') => {
    const ownerSigned = asRole === 'owner' ? true : undefined;
    const tenantSigned = asRole === 'tenant' ? true : undefined;
    setAgreements((prev) =>
      prev.map((agr) => {
        if (agr.id !== agreementId) return agr;
        const nextOwner = ownerSigned ?? agr.ownerSigned;
        const nextTenant = tenantSigned ?? agr.tenantSigned;
        const isBoth = nextOwner && nextTenant;
        return {
          ...agr,
          ownerSigned: nextOwner,
          tenantSigned: nextTenant,
          status: isBoth ? 'Active' : nextTenant ? 'Tenant Signed' : agr.status,
          signedDate: isBoth ? new Date().toISOString().split('T')[0] : agr.signedDate,
          tenantSignatureDate:
            tenantSigned && !agr.tenantSignatureDate ? new Date().toISOString() : agr.tenantSignatureDate,
        };
      })
    );

    // A tenant signature must outlive whichever dashboard's debounced
    // whole-collection sync runs next, so it is written to its own endpoint
    // (owner-scoped JWT check server-side) instead of relying on the push.
    if (asRole === 'tenant') {
      void signMyAgreement(agreementId).then((result) => {
        if (!result.ok) console.warn(`[agreement] tenant signature on ${agreementId} could not be persisted server-side`);
      });
    }
    logAuditEvent('Digital Agreement Signed', `Agreement ${agreementId}`, `Signed by ${asRole}`);
  };

  const addVisitorPass = (pass: Omit<VisitorPass, 'id' | 'status'>) => {
    const newPass: VisitorPass = {
      ...pass,
      id: `vis-${Date.now()}`,
      status: 'Pre-Approved',
    };
    setVisitorPasses((prev) => [newPass, ...prev]);
    logAuditEvent('Visitor Pre-Approved', `Visitor: ${pass.visitorName}`, `Visiting Room ${pass.roomNumber}`);
  };

  const updateVisitorStatus = (passId: string, status: VisitorPass['status']) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setVisitorPasses((prev) =>
      prev.map((v) => {
        if (v.id !== passId) return v;
        return {
          ...v,
          status,
          checkInTime: status === 'Checked-In' ? nowStr : v.checkInTime,
          checkOutTime: status === 'Checked-Out' ? nowStr : v.checkOutTime,
        };
      })
    );
    logAuditEvent('Visitor Status Changed', `Pass ID: ${passId}`, `Status changed to ${status}`);
  };

  const logAuditEvent = (action: string, entity: string, details: string) => {
    const entry: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser?.id || 'sys-user',
      userName: currentUser?.name || (role === 'owner' ? 'Owner Rajesh' : 'System Admin'),
      userRole: currentUser?.role || role,
      action,
      entity,
      details,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    setAuditLogs((prev) => [entry, ...prev.slice(0, 99)]);
  };

  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    logAuditEvent('System Settings Modified', 'Global Configuration', 'Updated billing, currency, or SLA values');
  };

  const updateRolePermissions = (roleName: string, permissions: RolePermissions) => {
    setRolePermissions((prev) => ({ ...prev, [roleName]: permissions }));
    logAuditEvent('RBAC Permissions Updated', `Role: ${roleName}`, 'Adjusted module permissions');
  };

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
  };

  const addStaffMember = (newStaff: Omit<StaffMember, 'id'> & { id?: string }) => {
    const created: StaffMember = {
      ...newStaff,
      id: newStaff.id || `staff-${Date.now()}`,
      ownerUserId: newStaff.ownerUserId || currentUser?.id,
      organizationId: newStaff.organizationId || currentUser?.organizationId,
    };
    setStaff((prev) => [...prev, created]);
  };

  const updateStaffMember = (staffId: string, updates: Partial<StaffMember>) => {
    setStaff((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, ...updates } : s))
    );
  };

  const deleteStaffMember = (staffId: string) => {
    setStaff((prev) => prev.filter((s) => s.id !== staffId));
    if (currentStaffId === staffId) {
      const remaining = staff.filter((s) => s.id !== staffId);
      if (remaining[0]) setCurrentStaffId(remaining[0].id);
    }
  };

  const openAuthModal = (
    mode: 'login' | 'register' = 'login',
    targetRole?: UserRole,
    meta?: { intent?: string; path?: string; propertyId?: string; source?: string }
  ) => {
    setAuthModalMode(mode);
    if (targetRole) setAuthInitialRole(targetRole);
    if (meta) setAuthMeta(meta);
    else setAuthMeta({});
    setAuthModalOpen(true);
  };

  const runPendingAuthAction = () => {
    if (pendingAuthAction) {
      pendingAuthAction();
      setPendingAuthAction(null);
    }
  };

  const requireAuth = (
    action: () => void,
    meta?: { mode?: 'login' | 'register'; role?: UserRole; intent?: string; path?: string; propertyId?: string; source?: string }
  ) => {
    if (currentUser) {
      action();
      return;
    }
    setPendingAuthAction(() => action);
    openAuthModal(meta?.mode || 'login', meta?.role, {
      intent: meta?.intent,
      path: meta?.path,
      propertyId: meta?.propertyId,
      source: meta?.source,
    });
  };

  const confirmDirectAction = (action: PendingCustomerAction) => {
    if (currentUser?.role === 'owner') {
      return { referenceId: '', error: 'Owner accounts cannot schedule visits or book properties.' };
    }
    const isVisit = action.type === 'visit';
    const refId = `PGN-${isVisit ? 'VIS' : 'BKG'}-${Math.floor(10000 + Math.random() * 90000)}`;
    const today = new Date().toISOString().split('T')[0];

    const applicantName = action.applicantName || currentUser?.name;
    const email = action.email || currentUser?.email;
    const phone = action.phone || currentUser?.phone;
    if (!applicantName || !email || !phone) {
      return { referenceId: '', error: 'Complete your profile before scheduling.' };
    }

    if (isVisit) {
      const visitDay = action.visitDate || action.date || today;
      if (visitDay < localIsoDate()) {
        return { referenceId: '', error: 'Choose today or a future visit date.' };
      }
    }

    if (!isVisit) {
      if (currentUser?.propertyId === action.property.id) {
        return { referenceId: '', error: 'You already stay at this PG.' };
      }
      const alreadyApplied = bookingRequests.find((r) => {
        if (r.propertyId !== action.property.id || r.type === 'visit') return false;
        if (r.status !== 'Pending' && r.status !== 'Approved') return false;
        const rEmail = r.email?.toLowerCase();
        const rPhone = r.phone?.replace(/\D/g, '');
        return (
          (email && rEmail && rEmail === email.toLowerCase()) ||
          (phone && rPhone && rPhone === phone.replace(/\D/g, ''))
        );
      });
      if (alreadyApplied) {
        return {
          referenceId: '',
          error:
            alreadyApplied.status === 'Approved'
              ? 'You already have an approved stay at this PG.'
              : 'You already have a booking request for this PG. You can apply again only if it is rejected.',
        };
      }
    }

    addBookingRequest({
      applicantName,
      email,
      phone,
      propertyId: action.property.id,
      propertyName: action.property.name,
      roomType: action.roomType || action.property.rooms[0]?.type || 'Double',
      preferredMoveInDate: action.preferredMoveInDate || action.visitDate || action.date || today,
      occupancyType: action.occupancyType || 'Working Professional',
      message: action.message || (isVisit ? `Visit on ${action.visitDate || action.date || today}` : 'Stay booking application'),
      type: action.type,
      visitDate: action.visitDate || action.date || today,
      visitTimeSlot: action.visitTimeSlot || action.timeSlot || '10:00 AM - 12:00 PM',
      referenceId: refId,
    });

    addLead({
      name: applicantName,
      phone,
      email,
      propertyId: action.property.id,
      propertyName: action.property.name,
      roomTypePreference: action.roomType || action.property.rooms[0]?.type || 'Double',
      budgetMax: action.property.startingPrice || 0,
      budget: action.property.startingPrice || 0,
      preferredMoveIn: action.preferredMoveInDate || action.visitDate || today,
      expectedMoveInDate: action.preferredMoveInDate || action.visitDate || today,
      stage: isVisit ? 'Visit Scheduled' : 'Booking Pending',
      source: isVisit ? 'Scheduled visit' : 'Stay application',
      notes: action.message || refId,
    });

    addBroadcast({
      title: isVisit ? `Visit Scheduled: ${action.property.name}` : `Booking Applied: ${action.property.name}`,
      message: isVisit
        ? `Your physical tour is scheduled for ${action.visitDate || action.date}. Pass Code: ${refId}.`
        : `Your stay application for ${action.property.name} has been received. Reference ID: ${refId}.`,
      category: 'Event',
      target: 'All Residents',
      sender: currentUser?.name || 'PGWalo',
    });

    if (isVisit) {
      const visitPayload = {
        propertyId: action.property.id,
        propertyName: action.property.name,
        ownerEmail: action.property.contactEmail,
        ownerName: action.property.ownerName,
        visitorName: applicantName,
        visitorEmail: email,
        visitorPhone: phone,
        visitorProfession: currentUser?.occupation,
        visitDate: action.visitDate || action.date || today,
        visitSlot: action.visitTimeSlot || action.timeSlot,
        message: action.message,
        referenceId: refId,
      };
      if (isProductionApiEnabled()) {
        void notifyVisitWithWorkers(visitPayload);
      }
    }

    if (!isVisit && currentUser) {
      const residentRole: UserRole = 'resident';
      setRoleState(residentRole);
      setCurrentUser((prev) =>
        prev ? { ...prev, role: residentRole, propertyId: action.property.id, propertyName: action.property.name } : prev
      );
      setUsers((prev) =>
        prev.map((u) =>
          u.id === currentUser.id
            ? { ...u, role: residentRole, propertyId: action.property.id, propertyName: action.property.name }
            : u
        )
      );
    }

    const confirmed = { referenceId: refId, action };
    setConfirmedAction(confirmed);
    return { referenceId: refId };
  };

  const login = (email: string, password?: string, requestedRole?: UserRole) => {
    const ident = email.trim();
    const identLower = ident.toLowerCase();
    // Super Admin authentication is enforced by the Worker (`POST /api/auth/login`)
    // against `SUPERADMIN_*` secrets. There is deliberately no browser-side
    // credential fallback: any `VITE_`-prefixed value is inlined into the
    // shipped bundle, which previously exposed the Super Admin password to
    // every visitor. Do not reintroduce a client-side check here.
    if (requestedRole === 'superadmin') {
      return { success: false, message: 'Invalid Super Admin credentials.' };
    }
    let user = users.find((u) => u.email.toLowerCase() === identLower);

    // For genuine user login, require existing account
    if (!user) {
      return {
        success: false,
        message: 'No account found with this email. Please check your credentials or click "Create Account".',
      };
    }

    // Validate role matches requested role if specified
    if (requestedRole && user.role !== requestedRole) {
      return {
        success: false,
        message: `This account is registered as a ${user.role}. Please use the correct login option.`,
      };
    }

    // Password validation for genuine users (skip for demo mode and Google OAuth)
    if (password && password !== 'google_oauth_session' && !user.isDemo) {
      // For genuine users, require correct password
      if (password !== 'demo123') {
        return {
          success: false,
          message: 'Invalid password. Please try again.',
        };
      }
    }

    // Clear demo data when a genuine user logs in
    const hasDemoData = properties.some((p) => p.id.startsWith('demo-'));
    if (hasDemoData) {
      setProperties((prev) => prev.filter((p) => !p.id.startsWith('demo-')));
      setResidents((prev) => prev.filter((r) => !r.id.startsWith('demo-')));
      setBookingRequests((prev) => prev.filter((r) => !r.id.startsWith('demo-')));
      setStaff((prev) => prev.filter((s) => !s.id.startsWith('demo-')));
    }

    setCurrentUser(user);
    setRoleState(user.role);
    setAuthModalOpen(false);

    // If profile is not yet completed (e.g. newly registered or Google OAuth without full profile form)
    if (!user.isProfileCompleted) {
      setProfileModalOpen(true);
    }

    if (user.role === 'staff') {
      const digits = (user.phone || '').replace(/\D/g, '').slice(-10);
      const matchedStaff = staff.find((s) => digits && s.phone.replace(/\D/g, '').slice(-10) === digits);
      if (matchedStaff) setCurrentStaffId(matchedStaff.id);
    }

    // If there was a pending customer action (schedule visit or book), execute it seamlessly
    if (pendingAction) {
      confirmDirectAction({
        ...pendingAction,
        applicantName: user.name,
        email: user.email,
        phone: user.phone,
      });
      setPendingAction(null);
    }

    return { success: true, message: `Welcome back, ${user.name}!` };
  };

  const applyApiSession = (user: Partial<UserAccount> & { id: string; role: UserRole }) => {
    const incoming: Partial<UserAccount> = {};
    (Object.keys(user) as (keyof UserAccount)[]).forEach((key) => {
      const value = user[key];
      if (value !== undefined) (incoming as Record<string, unknown>)[key as string] = value;
    });
    const account: UserAccount = {
      id: user.id,
      name: user.name || user.email || 'User',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role,
      organizationId: user.organizationId || (user.role === 'owner' ? `org-${user.id}` : DEFAULT_ORGANIZATION_ID),
      avatar: user.avatar || '',
      createdAt: new Date().toISOString().split('T')[0],
      isProfileCompleted: Boolean(user.isProfileCompleted),
      ...incoming,
    };
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === account.id);
      return exists
        ? prev.map((u) => (u.id === account.id ? { ...u, ...incoming } : u))
        : [...prev, account];
    });
    setCurrentUser((prev) => (prev && prev.id === account.id ? { ...prev, ...incoming } : account));
    setRoleState(account.role);
    setAuthModalOpen(false);
    if (account.role === 'staff') {
      const digits = (account.phone || '').replace(/\D/g, '').slice(-10);
      const matchedStaff = staff.find((s) => digits && s.phone.replace(/\D/g, '').slice(-10) === digits);
      if (matchedStaff) setCurrentStaffId(matchedStaff.id);
    }
    if (!account.isProfileCompleted && account.role !== 'staff' && !isPlatformAdmin(account.role)) {
      setProfileModalOpen(true);
      return;
    }
    if (pendingAction && account.isProfileCompleted) {
      confirmDirectAction({
        ...pendingAction,
        applicantName: account.name,
        email: account.email,
        phone: account.phone,
      });
      setPendingAction(null);
    }
  };

  useEffect(() => {
    if (!isProductionApiEnabled() || !getAuthToken()) return;
    let cancelled = false;
    fetchMeWithWorkers()
      .then((res) => {
        if (cancelled || !res?.success || !res.user?.id) return;
        applyApiSession(res.user);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const register = (accountData: {
    name: string;
    email: string;
    phone: string;
    role: UserRole;
    password?: string;
    roomNumber?: string;
    staffRole?: string;
  }) => {
    const today = new Date().toISOString().split('T')[0];
    const id = `user-${Date.now()}`;
    const newUser: UserAccount = {
      id,
      organizationId: accountData.role === 'owner' ? `org-${id}` : DEFAULT_ORGANIZATION_ID,
      name: accountData.name,
      email: accountData.email,
      phone: accountData.phone,
      role: accountData.role,
      avatar: accountData.role === 'owner'
        ? 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80'
        : accountData.role === 'resident'
        ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80'
        : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
      // Remove hardcoded property associations - owners will create their own properties
      // residents will be associated when they book/visit a property
      propertyId: undefined,
      propertyName: undefined,
      roomNumber: undefined,
      staffRole: accountData.staffRole || (accountData.role === 'staff' ? 'Manager' : undefined),
      createdAt: today,
      isProfileCompleted: false,
    };

    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    setRoleState(newUser.role);

    // Clear demo data when a genuine user registers
    const hasDemoData = properties.some(p => p.id.startsWith('demo-'));
    if (hasDemoData && !newUser.isDemo) {
      setProperties((prev) => prev.filter((p) => !p.id.startsWith('demo-')));
      setResidents((prev) => prev.filter((r) => !r.id.startsWith('demo-')));
      setBookingRequests((prev) => prev.filter((r) => !r.id.startsWith('demo-')));
    }

    // Only create resident data if they have an actual property assignment (from booking/visit)
    // For new registrations, residents start without property association
    if (accountData.role === 'staff') {
      const newStaffMember: StaffMember = {
        id: `staff-${Date.now()}`,
        name: accountData.name,
        role: (accountData.staffRole as any) || 'Manager',
        phone: '+91 98765 43210',
        avatar: newUser.avatar,
        propertyId: undefined, // Staff will be assigned to properties by owners
        shift: 'Morning (6 AM - 2 PM)',
        todayStatus: 'Available',
        lastClockIn: undefined,
      };
      setStaff((prev) => [...prev, newStaffMember]);
      setCurrentStaffId(newStaffMember.id);
    }

    setAuthModalOpen(false);
    // Bring up the profile form immediately so they can review and add age, emergency contacts, etc.
    setProfileModalOpen(true);

    // If there was a pending customer action, execute it seamlessly
    if (pendingAction) {
      confirmDirectAction({
        ...pendingAction,
        applicantName: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
      });
      setPendingAction(null);
    }

    return { success: true, message: 'Account created successfully!' };
  };

  const updateUserProfile = (updates: Partial<UserAccount>) => {
    if (!currentUser) return { success: false, message: 'No active session.' };

    const updatedUser: UserAccount = {
      ...currentUser,
      ...updates,
      isProfileCompleted: true,
    };

    setCurrentUser(updatedUser);
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === updatedUser.id);
      if (exists) {
        return prev.map((u) => (u.id === updatedUser.id ? updatedUser : u));
      }
      return [...prev, updatedUser];
    });

    if (updatedUser.role) {
      setRoleState(updatedUser.role);
    }

    if (pendingAction && !currentUser.isProfileCompleted) {
      confirmDirectAction({
        ...pendingAction,
        applicantName: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
      });
      setPendingAction(null);
    }

    if (updatedUser.role === 'resident') {
      setResidents((prev) => {
        const existingIdx = prev.findIndex(
          (r) =>
            (updatedUser.email && r.email.toLowerCase() === updatedUser.email.toLowerCase()) ||
            r.id === `res-${updatedUser.id}` ||
            r.id === updatedUser.id
        );

        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = {
            ...next[existingIdx],
            name: updatedUser.name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            avatar: updatedUser.avatar || next[existingIdx].avatar,
            emergencyContact: updatedUser.emergencyContactPhone || next[existingIdx].emergencyContact,
          };
          return next;
        }
        // Do not inject fake room allocation for newly registered users
        return prev;
      });
    }

    return { success: true, message: 'Profile saved successfully!' };
  };

  const logout = () => {
    if (isPlatformAdmin(currentUser?.role)) {
      setAuditLogs((prev) => [
        {
          id: `aud-${Date.now()}-logout`,
          userId: currentUser?.id || 'superadmin',
          userName: currentUser?.name || 'Super Admin',
          userRole: currentUser?.role || 'superadmin',
          action: 'Logout',
          entity: 'Session',
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          details: 'Super Admin signed out',
        },
        ...prev.slice(0, 99),
      ]);
      if (isProductionApiEnabled() && getAuthToken()) {
        void postAdminLogout().catch(() => undefined);
      }
    }
    if (currentUser?.isDemo) {
      setUsers((prev) => prev.filter(u => !u.isDemo));
      setProperties((prev) => prev.filter(p => !p.id.startsWith('demo-')));
      setResidents((prev) => prev.filter(r => !r.id.startsWith('demo-')));
      setBookingRequests((prev) => prev.filter(b => !b.id.startsWith('demo-')));
    }
    
    setCurrentUser(null);
    setRoleState('public');
    clearAuthToken(); // Clear JWT token for Cloudflare Workers
    // Remembering the previous account across a sign-out is the stale-data bug
    // users hit as "welcome back, <someone else>" on the sign-in screen.
    clearLastAuthUser();
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem(STORAGE_KEYS.ROLE);
      // Marked before reloading: the next boot purges every cached collection,
      // so nothing the signed-out account saw can render on the fresh page.
      localStorage.setItem(SIGNED_OUT_FLAG, '1');
    } catch {
      /* storage unavailable — the reload below still clears all in-memory state */
    }
    // A full navigation, not a state reset: every module-level value, form field
    // and lazily loaded dashboard is rebuilt from scratch.
    if (typeof window !== 'undefined') window.location.replace('/');
  };

  const addProperty = (newProp: Omit<Property, 'id'>) => {
    // The platform desk reviews every new listing; tell them as soon as it lands.
    fireEmailEvent('admin.listing_review', {
      to: 'admin',
      data: {
        propertyName: newProp.name,
        ownerName: newProp.ownerName || currentUser?.name,
        city: newProp.city,
        locality: newProp.locality,
        totalBeds: newProp.rooms?.reduce((sum, room) => sum + (room.totalBeds || 0), 0),
      },
      dedupeKey: `listing-review-${newProp.name}-${newProp.locality}`,
    });
    const created: Property = {
      ...newProp,
      id: `prop-${Date.now()}`,
      amenities: normalizeAmenities(newProp.amenities || []),
      ownerUserId: newProp.ownerUserId || currentUser?.id,
      ownerName: newProp.ownerName || currentUser?.name || 'Owner',
      organizationId: newProp.organizationId || currentUser?.organizationId || (currentUser?.id ? `org-${currentUser.id}` : DEFAULT_ORGANIZATION_ID),
      contactEmail: newProp.contactEmail || currentUser?.email || '',
      contactPhone: newProp.contactPhone || currentUser?.phone || '',
    };
    const persist = async () => {
      const uploadIfNeeded = async (url?: string, category = 'Bedroom') => {
        if (!url || url.startsWith('http') || url.startsWith('/api/media')) return url || '';
        if (!url.startsWith('data:')) return url;
        try {
          const blob = await (await fetch(url)).blob();
          const uploaded = await uploadListingPhoto(blob, category);
          return uploaded.url || url;
        } catch {
          return url;
        }
      };
      const coverImage = await uploadIfNeeded(created.coverImage, 'Exterior');
      const galleryImages = await Promise.all((created.galleryImages || []).map((u) => uploadIfNeeded(u)));
      const ready = { ...created, coverImage, galleryImages: galleryImages.filter(Boolean) };
      setProperties((prev) => prev.map((p) => (p.id === created.id ? ready : p)));
      void publishListing(ready).then((stored) => (stored ? adoptStoredProperty(stored) : undefined));
    };
    setProperties((prev) => [created, ...prev]);

    // Every published listing gets one bed row per physical bed. This block
    // sat below an earlier `return` and never ran — so owner listings had no
    // beds, and approving a booking could not allocate anything. Rooms like
    // `room-<ts>-single` are not room numbers; beds are numbered floor-style
    // from an index so the matrix reads 101-A, 101-B, 201-A, …
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const generatedBeds: Bed[] = (created.rooms || []).flatMap((room, roomIndex) => {
      const count = Math.max(room.totalBeds || room.availableBeds || 1, 1);
      const roomNumber = String(100 + (roomIndex + 1));
      return Array.from({ length: count }, (_, i) => ({
        id: `bed-${created.id}-${room.id}-${i}`,
        bedNumber: `${roomNumber}-${letters[i] || i + 1}`,
        roomId: room.id,
        roomNumber,
        propertyId: created.id,
        floor: roomIndex + 1,
        sharingType: room.type,
        status: 'Available' as const,
        monthlyRent: room.rentPerMonth,
        deposit: room.deposit,
      }));
    });
    if (generatedBeds.length) {
      setBeds((prev) => [...generatedBeds, ...prev]);
    }

    void persist();
    return created;
  };

  /**
   * The server is the authority for the PGWalo number and the display name it
   * produces (`PGwalo1- Mohan Boys PG`). Adopting the stored row keeps the
   * owner's own view identical to what the public catalog shows.
   */
  const adoptStoredProperty = (stored: Property) => {
    setProperties((prev) =>
      prev.map((property) => (property.id === stored.id ? { ...property, ...stored } : property))
    );
  };

  const updateProperty = (propertyId: string, updates: Partial<Property>) => {
    let updated: Property | null = null;
    setProperties((prev) =>
      prev.map((property) => {
        if (property.id !== propertyId) return property;
        updated = {
          ...property,
          ...updates,
          amenities: updates.amenities ? normalizeAmenities(updates.amenities) : property.amenities,
          id: property.id,
          ownerUserId: property.ownerUserId,
          organizationId: property.organizationId,
        };
        return updated;
      })
    );
    if (updated) {
      // Every property reaches the server: a pending one so the owner can pay
      // for it from any device, a live one so edits are reflected publicly.
      void publishListing(updated).then((stored) => (stored ? adoptStoredProperty(stored) : undefined));
    }
    if (
      updated &&
      isPlatformAdmin(currentUser?.role) &&
      isProductionApiEnabled() &&
      getAuthToken() &&
      (updates.name || updates.tagline || updates.description)
    ) {
      void patchAdminProperty(propertyId, {
        name: updates.name,
        tagline: updates.tagline,
        description: updates.description,
      }).then((ok) => {
        if (!ok) console.warn(`[admin] property edit for ${propertyId} could not be persisted to the database`);
      });
    }
  };

  const addBookingRequest = (request: Omit<BookingRequest, 'id' | 'status' | 'requestDate'>) => {
    const today = new Date().toISOString().split('T')[0];
    const newReq: BookingRequest = {
      ...request,
      id: `req-${Date.now()}`,
      status: 'Pending',
      requestDate: today,
    };
    setBookingRequests((prev) => [newReq, ...prev]);
    void publishInquiry(newReq);
  };

  const buildOwnerSentAgreement = (resident: Resident, request: BookingRequest, property?: Property): RentAgreement => {
    const start = resident.moveInDate || new Date().toISOString().split('T')[0];
    const endDate = new Date(start);
    endDate.setFullYear(endDate.getFullYear() + 1);
    endDate.setDate(endDate.getDate() - 1);
    const rentDueDay = settings.rentDueDay || 7;
    const ownerName = property?.ownerName || currentUser?.name || 'Property Owner';
    const electricityRate = property?.electricityRatePerUnit || settings.defaultElectricityRate || 8.5;
    const taxPercent = property?.taxPercent || 0;
    const terms = [
      `Monthly rent is payable directly by the tenant to ${ownerName} on or before day ${rentDueDay} of every month. PGWalo does not collect commission or brokerage.`,
      `Refundable security deposit is held and settled between tenant and owner after move-out inspection, pending dues and damage deductions, if any.`,
      `Electricity is charged as per actual sub-meter reading at Rs ${electricityRate}/unit unless stated as included by the owner.`,
      `Applicable taxes, if any, at ${taxPercent}% are between tenant and owner and must be disclosed before payment.`,
      `Tenant shall follow house rules, gate timing, visitor restrictions, cleanliness norms, and lawful use of the premises.`,
      `${property?.noticePeriodDays || resident.noticePeriodDays || 30} days written notice is required before vacating unless both parties agree otherwise.`,
      `This draft is formatted for printing on Indian non-judicial stamp paper and signing physically by both parties.`,
    ];

    return {
      id: `agr-${Date.now()}`,
      agreementNumber: `PGWALO-${(property?.state || 'IN').replace(/\s+/g, '').slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
      residentId: resident.id,
      residentName: resident.name,
      tenantName: resident.name,
      parentGuardianName: 'To be updated by tenant',
      tenantDOB: 'To be updated',
      tenantPermanentAddress: 'To be updated by tenant',
      tenantCurrentAddress: `Room ${resident.roomNumber}, Bed ${resident.bedNumber}, ${property?.address || request.propertyName}`,
      tenantCollegeOrOffice: request.occupancyType,
      tenantIdDocumentType: 'Aadhaar',
      tenantIdDocumentMasked: 'XXXX-XXXX-To be updated',
      tenantAadhaarMasked: 'XXXX-XXXX-To be updated',
      propertyId: resident.propertyId,
      propertyName: resident.propertyName,
      propertyAddress: property?.address || resident.propertyName,
      ownerName,
      ownerPhone: property?.contactPhone || currentUser?.phone || '',
      ownerAddress: property?.address || '',
      roomNumber: resident.roomNumber,
      bedNumber: resident.bedNumber,
      bedId: resident.bedNumber,
      monthlyRent: resident.monthlyRent,
      securityDeposit: resident.depositAmount,
      stampPaperState: property?.state || 'India',
      stampDutyValue: 100,
      electricityTerms: `Sub-metered electricity at Rs ${electricityRate}/unit. Taxes at ${taxPercent}% if applicable.`,
      noticePeriodDays: property?.noticePeriodDays || resident.noticePeriodDays || 30,
      startDate: start,
      endDate: endDate.toISOString().split('T')[0],
      rulesSummary: property?.rules || terms.slice(4),
      emergencyContactName: 'To be updated by tenant',
      emergencyContactPhone: resident.phone,
      status: 'Sent',
      lockInPeriodMonths: 1,
      terms,
      termsAndConditions: {
        noticePeriodDays: property?.noticePeriodDays || resident.noticePeriodDays || 30,
        lockInPeriodMonths: 1,
        rentDueDay,
        foodIncludedInRate: Boolean(property?.foodIncludedInRate ?? property?.foodIncluded),
        taxPercent,
      },
      ownerSigned: true,
      tenantSigned: false,
      sentByOwnerAt: new Date().toISOString(),
      ownerSignatureDate: new Date().toISOString().split('T')[0],
    };
  };

  const approveBookingRequest = async (requestId: string, roomNumber?: string, bedNumber?: string) => {
    // Explicit room/bed args win (admin tooling), otherwise allocate the first
    // genuinely vacant bed matching the requested sharing type. The old
    // hardcoded '204'/'Bed A' fallback allocated beds that do not exist in the
    // owner's property, so approval looked like it worked while allocating
    // nothing.
    let assignedRoom = roomNumber || '';
    let assignedBed = bedNumber || '';

    let targetReq = bookingRequests.find((r) => r.id === requestId || r.referenceId === requestId);
    if (targetReq?.type === 'visit') {
      // Persist FIRST, then paint. The old order painted 'Approved' locally and
      // fired a void PATCH — if the write failed (403, expired token, network)
      // the next poll silently reverted the chip and the owner saw the request
      // come back as Pending. Now the owner sees exactly what the database holds.
      const persisted = await patchInquiry(targetReq.referenceId || targetReq.id, { status: 'Approved' });
      if (!persisted) {
        logAuditEvent('Visit Confirmation Failed', targetReq.propertyName, 'The server rejected the update — check your session and try again');
        alert(`Could not confirm the visit for ${targetReq.applicantName}. The server did not accept the update — please refresh and try again. If this keeps happening, your session may have expired.`);
        return;
      }
      setBookingRequests((prev) =>
        prev.map((req) =>
          req.id === targetReq!.id || req.referenceId === requestId ? { ...req, status: 'Approved' } : req
        )
      );
      // The applicant gets the decision from the server (personal notification
      // + email in the PATCH handler). The owner keeps a self-confirmation for
      // their records.
      fireEmailEvent('visit.scheduled', {
        to: 'self',
        data: {
          propertyName: targetReq.propertyName,
          visitDate: targetReq.visitDate,
          visitTimeSlot: targetReq.visitTimeSlot,
          referenceId: targetReq.referenceId || targetReq.id,
        },
        dedupeKey: `visit-approved-${targetReq.id}`,
      });
      return;
    }
    const propertyBeds = beds.filter(
      (bed) => !targetReq?.propertyId || bed.propertyId === targetReq.propertyId
    );
    const requestedBed =
      (assignedRoom && assignedBed
        ? propertyBeds.find(
            (bed) =>
              bed.roomNumber === assignedRoom &&
              (bed.bedNumber === assignedBed || bed.bedNumber.endsWith(assignedBed.replace(/^Bed\s*/i, '')))
          )
        : undefined) ||
      (assignedRoom
        ? propertyBeds.find((bed) => bed.roomNumber === assignedRoom && canBedBeAssigned(bed))
        : undefined) ||
      propertyBeds.find(
        (bed) =>
          (!targetReq?.roomType || bed.sharingType === targetReq.roomType) && canBedBeAssigned(bed)
      ) ||
      propertyBeds.find((bed) => canBedBeAssigned(bed));

    // Self-healing: listings published before bed generation ran (an early
    // `return` made it dead code) have no bed rows at all. Create the full bed
    // inventory from the property's rooms so approval has something real to
    // allocate instead of a fictional room 204.
    const targetProperty = properties.find((p) => p.id === targetReq?.propertyId);
    let allocationBed = requestedBed;
    if (!allocationBed && targetProperty) {
      const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
      const healedBeds: Bed[] = (targetProperty.rooms || []).flatMap((room, roomIndex) => {
        const count = Math.max(room.totalBeds || room.availableBeds || 1, 1);
        const rn = String(100 + (roomIndex + 1));
        return Array.from({ length: count }, (_, i) => ({
          id: `bed-${targetProperty.id}-${room.id}-${i}`,
          bedNumber: `${rn}-${letters[i] || i + 1}`,
          roomId: room.id,
          roomNumber: rn,
          propertyId: targetProperty.id,
          floor: roomIndex + 1,
          sharingType: room.type,
          status: 'Available' as const,
          monthlyRent: room.rentPerMonth,
          deposit: room.deposit,
        }));
      });
      const existingIds = new Set(beds.map((b) => b.id));
      const additions = healedBeds.filter((b) => !existingIds.has(b.id));
      if (additions.length) {
        setBeds((prev) => [...additions, ...prev]);
        logAuditEvent('Bed Inventory Generated', targetProperty.name, `Created ${additions.length} beds from room tiers (self-heal for pre-fix listing)`);
      }
      allocationBed =
        healedBeds.find(
          (bed) => (!targetReq?.roomType || bed.sharingType === targetReq.roomType) && bed.status === 'Available'
        ) || healedBeds[0];
    }

    if (!allocationBed) {
      logAuditEvent('Approval Failed — No Beds', targetReq?.propertyName || targetReq?.propertyId, 'No bed could be allocated: the property has no rooms or beds configured');
      alert(
        `Cannot allocate a bed: "${targetReq?.propertyName || 'this property'}" has no beds configured. Add rooms in the listing wizard first.`
      );
      return;
    }
    if (!canBedBeAssigned(allocationBed)) {
      logAuditEvent('Blocked Double Allocation', `Bed ${allocationBed.id}`, 'Booking approval attempted on an occupied bed');
      alert(`Bed ${allocationBed.bedNumber} in room ${allocationBed.roomNumber} is no longer available. Refresh and try another bed.`);
      return;
    }
    assignedRoom = allocationBed.roomNumber;
    assignedBed = allocationBed.bedNumber;

    setBookingRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          targetReq = req;
          return {
            ...req,
            status: 'Approved',
            allocatedRoomNumber: allocationBed.roomNumber,
            allocatedBedNumber: allocationBed.bedNumber,
            residentStatus: 'Pending Move-In',
            reservedBedId: allocationBed.id,
            reservationExpiry: req.reservationExpiry || req.preferredMoveInDate,
          };
        }
        return req;
      })
    );

    if (targetReq) {
      void patchInquiry(targetReq.referenceId || targetReq.id, {
        status: 'Approved',
        allocatedRoomNumber: allocationBed.roomNumber,
        allocatedBedNumber: allocationBed.bedNumber,
      }).then((ok) => {
        if (!ok) {
          logAuditEvent('Approval Not Persisted', targetReq?.propertyName || '', 'The server rejected the approval write — the request may revert to Pending');
        }
      });
      const existingRes = residents.find(
        (r) =>
          (targetReq!.email && r.email.toLowerCase() === targetReq!.email.toLowerCase()) ||
          r.phone === targetReq!.phone
      );

      const newRes: Resident = {
        id: existingRes?.id || `res-${Date.now()}`,
        name: targetReq.applicantName,
        email: targetReq.email,
        phone: targetReq.phone,
        avatar: existingRes?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        organizationId: targetReq.organizationId || DEFAULT_ORGANIZATION_ID,
        status: 'Pending Move-In',
        propertyId: targetReq.propertyId,
        propertyName: targetReq.propertyName,
        roomNumber: allocationBed.roomNumber,
        roomType: targetReq.roomType || allocationBed.sharingType || 'Double',
        bedNumber: allocationBed.bedNumber,
        monthlyRent: allocationBed.monthlyRent || (targetReq.roomType === 'Single' ? 14000 : targetReq.roomType === 'Double' ? 9500 : 7800),
        depositAmount: allocationBed.deposit || 15000,
        moveInDate: targetReq.preferredMoveInDate || new Date().toISOString().split('T')[0],
        rentStatus: 'Pending',
        rentDueDate: '07th Every Month',
        emergencyContact: targetReq.phone,
        kycVerified: true,
        depositState: 'Pending',
        agreementState: 'Pending',
        previousDues: 0,
        advanceBalance: 0,
        outstandingBalance: allocationBed.monthlyRent || (targetReq.roomType === 'Single' ? 14000 : targetReq.roomType === 'Double' ? 9500 : 7800),
        notes: targetReq.message || 'Approved from online application',
      };
      const property = properties.find((p) => p.id === targetReq?.propertyId);
      const newAgreement = buildOwnerSentAgreement(newRes, targetReq, property);

      // Mark the allocated bed Reserved for this resident. (The old code
      // matched by room number string against a hardcoded room here and also
      // reserved `requestedBed` below — two writes racing on one bed.)
      setBeds((prev) =>
        prev.map((b) =>
          b.id === allocationBed.id
            ? {
                ...b,
                status: 'Reserved',
                currentTenantId: newRes.id,
                currentTenantName: newRes.name,
                reservedForResidentId: newRes.id,
                reservationExpiry: targetReq.preferredMoveInDate,
              }
            : b
        )
      );

      // Record Stay
      const todayStr = new Date().toISOString().split('T')[0];
      const newStay: Stay = {
        id: `stay-${Date.now()}`,
        organizationId: newRes.organizationId || DEFAULT_ORGANIZATION_ID,
        residentId: newRes.id,
        propertyId: newRes.propertyId,
        roomId: allocationBed.roomId,
        // D1 declares room_number / bed_id / bed_number / monthly_rent_at_start
        // NOT NULL, so the stay row was rejected and never reached the DB.
        roomNumber: allocationBed.roomNumber,
        bedId: allocationBed.id,
        bedNumber: allocationBed.bedNumber,
        startDate: newRes.moveInDate || todayStr,
        monthlyRentAtStart: newRes.monthlyRent,
        status: 'Current',
        endDate: undefined,
        createdAt: todayStr,
      };
      setStays((prev) => [newStay, ...prev]);

      setResidents((prev) => {
        const filtered = prev.filter(
          (r) => r.email.toLowerCase() !== targetReq!.email.toLowerCase()
        );
        return [newRes, ...filtered];
      });
      setAgreements((prev) => [newAgreement, ...prev.filter((agreement) => agreement.residentId !== newRes.id)]);

      // The single reservation write above covers the bed; the rent plan still
      // needs creating for the new resident.
      {
        setRentPlans((prev) => [
          {
            id: `rent-plan-${newRes.id}`,
            organizationId: newRes.organizationId || DEFAULT_ORGANIZATION_ID,
            residentId: newRes.id,
            propertyId: newRes.propertyId,
            monthlyRent: newRes.monthlyRent,
            dueDay: settings.rentDueDay || 7,
            effectiveFrom: newRes.moveInDate,
            status: 'Active',
          },
          ...prev.filter((plan) => plan.residentId !== newRes.id),
        ]);
      }

      if (currentUser && currentUser.email && currentUser.email.toLowerCase() === targetReq.email.toLowerCase()) {
        const updatedUser: UserAccount = {
          ...currentUser,
          propertyId: targetReq.propertyId,
          propertyName: targetReq.propertyName,
          roomNumber: allocationBed.roomNumber,
        };
        setCurrentUser(updatedUser);
      }

      addBroadcast({
        title: `Room Allocation Approved: Room ${assignedRoom}`,
        message: `Welcome ${targetReq.applicantName}! Your booking for ${targetReq.propertyName} has been approved. Room ${assignedRoom} (${assignedBed}) is now allocated.`,
        category: 'Event',
        target: 'All Residents',
        sender: 'Property Owner (Rajesh Sharma)',
        recipientId: newRes.id,
      });

      // The agreement exists but the tenant was never TOLD — no notification,
      // no email — so it sat unread. Both go out now, personal to the tenant.
      addBroadcast({
        title: 'Your tenancy agreement is ready to sign',
        message: `Agreement ${newAgreement.agreementNumber} for ${newRes.propertyName} (Room ${newRes.roomNumber}, ${newRes.bedNumber}) is awaiting your signature. Open the Agreement button on your dashboard to review and sign.`,
        category: 'Event',
        target: 'All Residents',
        sender: `${currentUser?.name || 'Owner'} (Owner)`,
        propertyId: newRes.propertyId,
        propertyName: newRes.propertyName,
        recipientId: newRes.id,
      });
      fireEmailEvent('agreement.sent', {
        to: 'resident',
        propertyId: newRes.propertyId,
        residentId: newRes.id,
        residentEmail: newRes.email,
        data: {
          propertyName: newRes.propertyName,
          roomNumber: newRes.roomNumber,
          monthlyRent: `\u20B9${newRes.monthlyRent.toLocaleString('en-IN')}`,
          startDate: newAgreement.startDate,
          endDate: newAgreement.endDate,
        },
        dedupeKey: `agreement-sent-${newAgreement.id}`,
      });

      // Allocation confirmation to the incoming resident (verified server-side).
      fireEmailEvent('booking.approved', {
        to: 'resident',
        propertyId: targetReq.propertyId,
        residentId: newRes?.id || `res-${targetReq.applicantName}`,
        residentEmail: targetReq.email,
        data: {
          propertyName: targetReq.propertyName,
          roomNumber: assignedRoom,
          bedNumber: assignedBed,
          roomType: targetReq.roomType,
          moveInDate: targetReq.preferredMoveInDate,
        },
        dedupeKey: `allocated-${newRes?.id || requestId}-${assignedRoom}-${assignedBed}`,
      });

      addAuditEntry({
        user: currentUser,
        role,
        action: 'Reservation Approved',
        entityType: 'BookingRequest',
        entityId: requestId,
        previousValue: targetReq,
        newValue: { residentId: newRes.id, bedId: allocationBed.id, status: 'Pending Move-In' },
        propertyId: targetReq.propertyId,
      });
    }
  };

  const rejectBookingRequest = (requestId: string) => {
    setBookingRequests((prev) =>
      prev.map((req) => (req.id === requestId || req.referenceId === requestId ? { ...req, status: 'Rejected' } : req))
    );
    void patchInquiry(requestId, { status: 'Rejected' });
  };

  const cancelBookingRequest = (requestId: string) => {
    const cancelled = bookingRequests.find((req) => req.id === requestId || req.referenceId === requestId);
    setBookingRequests((prev) =>
      prev.map((req) => (req.id === requestId || req.referenceId === requestId ? { ...req, status: 'Cancelled' } : req))
    );
    void patchInquiry(requestId, { status: 'Cancelled' });
    fireEmailEvent(cancelled?.type === 'visit' ? 'visit.cancelled' : 'booking.rejected', {
      to: 'self',
      data: {
        propertyName: cancelled?.propertyName,
        visitDate: cancelled?.visitDate,
        referenceId: cancelled?.referenceId || cancelled?.id,
      },
      dedupeKey: `cancelled-${requestId}`,
    });
  };

  const rescheduleVisit = (requestId: string, newDate: string, newTimeSlot: string) => {
    const target = bookingRequests.find((req) => req.id === requestId || req.referenceId === requestId);
    fireEmailEvent('visit.rescheduled', {
      to: 'self',
      data: {
        propertyName: target?.propertyName,
        visitDate: newDate,
        visitTimeSlot: newTimeSlot,
        referenceId: target?.referenceId || requestId,
      },
      dedupeKey: `visit-resched-${requestId}-${newDate}-${newTimeSlot}`,
    });
    setBookingRequests((prev) =>
      prev.map((req) =>
        req.id === requestId
          ? {
              ...req,
              visitDate: newDate,
              preferredMoveInDate: newDate,
              visitTimeSlot: newTimeSlot,
              status: 'Pending',
            }
          : req
      )
    );
    addBroadcast({
      title: 'Visit Rescheduled',
      message: `Your physical tour has been rescheduled to ${newDate} (${newTimeSlot}).`,
      category: 'Event',
      target: 'All Residents',
      sender: 'PGNest Concierge',
    });
  };

  const addResident = (res: Omit<Resident, 'id'>) => {
    const newRes: Resident = {
      ...res,
      id: `res-${Date.now()}`,
    };
    setResidents((prev) => [newRes, ...prev]);
  };

  const updateRentStatus = (residentId: string, status: 'Paid' | 'Pending' | 'Overdue') => {
    if (status === 'Paid') {
      logAuditEvent('Blocked Silent Financial Edit', `Resident ${residentId}`, 'Use payment recording and verification instead of direct paid toggles');
      return;
    }
    setResidents((prev) =>
      prev.map((r) =>
        r.id === residentId
          ? {
              ...r,
              rentStatus: status,
              lastPaymentDate: r.lastPaymentDate,
            }
          : r
      )
    );
  };

  const updateResidentStatus = (residentId: string, newStatus: ResidentStatus) => {
    setResidents((prev) =>
      prev.map((r) => (r.id === residentId ? { ...r, status: newStatus } : r))
    );
    logAuditEvent('Resident Status Changed', `Resident ${residentId}`, `Updated lifecycle status to ${newStatus}`);
  };

  const updatePropertyModules = (propertyId: string, modules: Partial<Property>) => {
    setProperties((prev) =>
      prev.map((p) => (p.id === propertyId ? { ...p, ...modules } : p))
    );
    logAuditEvent('Property Config Updated', `Property ${propertyId}`, `Updated property operational modules.`);
  };

  const generateMonthlyInvoices = (monthYear: string = 'September 2026'): number => {
    let generatedCount = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    setInvoices((prev) => {
      const updated = [...prev];
      const scopedResidents = currentUser?.isDemo
        ? residents
        : residents.filter((res) => {
            const prop = properties.find((p) => p.id === res.propertyId);
            return prop ? ownsProperty(prop, currentUser) : false;
          });
      scopedResidents.forEach((res) => {
        // Skip if invoice already exists for this resident and month
        const exists = updated.some((inv) => inv.residentId === res.id && inv.month === monthYear);
        if (exists) return;

        // Calculate electricity charges from meter readings if available
        const roomReadings = meterReadings.filter((m) => m.roomNumber === res.roomNumber);
        const latestReading = roomReadings[0];
        const electricityCharges = latestReading ? Math.round(latestReading.calculatedAmount) : 480;

        const baseRent = res.monthlyRent;
        const lineItems = [
          {
            id: `li-${Date.now()}-1`,
            description: `${monthYear} Room Rent (${res.roomType})`,
            amount: baseRent,
            type: 'Rent' as const,
          },
          {
            id: `li-${Date.now()}-2`,
            description: 'Room Electricity Sub-meter',
            amount: electricityCharges,
            type: 'Electricity' as const,
          },
        ];

        const previousDues = res.previousDues || 0;
        const advanceBalance = res.advanceBalance || 0;
        const advanceDeducted = Math.min(advanceBalance, baseRent + electricityCharges + previousDues);
        const subtotal = baseRent + electricityCharges;
        const totalDue = Math.max(0, subtotal + previousDues - advanceDeducted);

        const newInvoice: Invoice = {
          id: `inv-${Date.now()}-${res.id.slice(-4)}`,
          organizationId: res.organizationId || DEFAULT_ORGANIZATION_ID,
          invoiceNumber: `INV-${new Date().getFullYear()}-${String(updated.length + 1).padStart(4, '0')}`,
          residentId: res.id,
          residentName: res.name,
          propertyId: res.propertyId,
          propertyName: res.propertyName,
          roomNumber: res.roomNumber,
          month: monthYear,
          billingCycleStart: `${todayStr.slice(0, 7)}-01`,
          billingCycleEnd: `${todayStr.slice(0, 7)}-30`,
          dueDate: res.rentDueDate || `${todayStr.slice(0, 7)}-07`,
          lines: lineItems.map((line) => ({
            ...line,
            type: line.type === 'Electricity' ? 'Electricity' : 'Rent',
          })),
          amount: totalDue,
          verifiedPaidAmount: 0,
          baseRent,
          electricityCharges,
          otherCharges: 0,
          lineItems,
          subtotal,
          previousDuesApplied: previousDues,
          advanceDeducted,
          totalDue,
          amountPaid: advanceDeducted > 0 && totalDue === 0 ? subtotal + previousDues : 0,
          outstandingBalance: totalDue,
          status: totalDue === 0 ? 'Paid' : 'Due',
          createdAt: todayStr,
          updatedAt: todayStr,
          receiptIds: [],
        };

        updated.unshift(newInvoice);
        generatedCount++;
      });
      return updated;
    });

    logAuditEvent('Invoices Generated', `Cycle: ${monthYear}`, `Generated ${generatedCount} itemized invoices across all active residents.`);
    return generatedCount;
  };

  const recordPaymentForInvoice = (
    invoiceId: string,
    amount: number,
    paymentMethod: string,
    notes?: string
  ): PaymentReceipt => {
    const today = new Date().toISOString().split('T')[0];
    const txnId = `PGN-${Date.now().toString().slice(-8)}`;

    let generatedReceipt: PaymentReceipt | null = null;

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;

        const newAmountPaid = inv.amountPaid + amount;
        const newBalance = Math.max(0, inv.totalDue - newAmountPaid);
        const newStatus = newBalance === 0 ? 'Paid' : 'Partially Paid';

        generatedReceipt = {
          transactionId: txnId,
          residentName: inv.residentName,
          propertyName: inv.propertyName,
          roomNumber: inv.roomNumber,
          amount,
          month: inv.month,
          paymentMethod,
          paidAt: new Date().toLocaleString(),
          status: 'Success',
          rentAmount: inv.baseRent,
          electricityAmount: inv.electricityCharges,
        };

        return {
          ...inv,
          amountPaid: newAmountPaid,
          outstandingBalance: newBalance,
          status: newStatus,
          updatedAt: today,
          receiptIds: [...inv.receiptIds, txnId],
        };
      })
    );

    // Update resident state
    const targetInvoice = invoices.find((i) => i.id === invoiceId);
    if (targetInvoice) {
      setResidents((prev) =>
        prev.map((r) => {
          if (r.id !== targetInvoice.residentId) return r;
          const isFullyPaid = targetInvoice.totalDue <= (targetInvoice.amountPaid + amount);
          return {
            ...r,
            rentStatus: isFullyPaid ? 'Paid' : 'Pending',
            lastPaymentDate: today,
          };
        })
      );

      logAuditEvent(
        'Invoice Payment Recorded',
        `Invoice ${targetInvoice.invoiceNumber}`,
        `Payment of ₹${amount.toLocaleString()} via ${paymentMethod}. Outstanding: ₹${Math.max(0, targetInvoice.totalDue - targetInvoice.amountPaid - amount)}`
      );
    }

    // Payment receipt to the payer (transactional — respects opt-out only loosely).
    fireEmailEvent('rent.paid', {
      to: 'self',
      data: {
        amount: `₹${amount.toLocaleString()}`,
        method: paymentMethod,
        transactionId: txnId,
        month: targetInvoice?.month,
        roomNumber: targetInvoice?.roomNumber,
      },
      dedupeKey: `rent-paid-${invoiceId}-${txnId}`,
    });

    return generatedReceipt || {
      transactionId: txnId,
      residentName: targetInvoice?.residentName || 'Resident',
      propertyName: targetInvoice?.propertyName || 'PGNest',
      roomNumber: targetInvoice?.roomNumber || 'Room',
      amount,
      month: targetInvoice?.month || 'Current Month',
      paymentMethod,
      paidAt: new Date().toLocaleString(),
      status: 'Success',
    };
  };

  const recordAdvancePayment = (residentId: string, amount: number, paymentMethod: string) => {
    setResidents((prev) =>
      prev.map((r) => {
        if (r.id !== residentId) return r;
        const newAdvance = (r.advanceBalance || 0) + amount;
        return {
          ...r,
          advanceBalance: newAdvance,
        };
      })
    );
    logAuditEvent('Advance Payment Credited', `Resident ${residentId}`, `Credited ₹${amount.toLocaleString()} advance balance via ${paymentMethod}.`);
  };

  const processRoomTransfer = (
    residentId: string,
    newRoomNumber: string,
    newBedNumber: string,
    newMonthlyRent: number,
    reason: string
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const targetResident = residents.find((r) => r.id === residentId);
    if (!targetResident) return;

    const oldRoom = targetResident.roomNumber;
    const oldBed = targetResident.bedNumber;

    // 1. Terminate old stay record and add new stay record
    setStays((prev) => {
      const updated = prev.map((s) =>
        s.residentId === residentId && s.status === 'Active'
          ? { ...s, status: 'Transferred' as const, endDate: today, transferReason: reason }
          : s
      );
      const newStay: StayRecord = {
        id: `stay-${Date.now()}`,
        residentId,
        residentName: targetResident.name,
        propertyId: targetResident.propertyId,
        propertyName: targetResident.propertyName,
        roomNumber: newRoomNumber,
        bedNumber: newBedNumber,
        roomType: targetResident.roomType,
        startDate: today,
        monthlyRent: newMonthlyRent,
        status: 'Active',
        createdAt: today,
      };
      return [newStay, ...updated];
    });

    // 2. Free up old bed and occupy new bed
    setBeds((prev) =>
      prev.map((b) => {
        if (b.roomNumber === oldRoom && b.bedNumber === oldBed) {
          return { ...b, status: 'Cleaning', currentTenantId: undefined, currentTenantName: undefined };
        }
        if (b.roomNumber === newRoomNumber && b.bedNumber === newBedNumber) {
          return { ...b, status: 'Occupied', currentTenantId: residentId, currentTenantName: targetResident.name };
        }
        return b;
      })
    );

    // 3. Update resident record
    setResidents((prev) =>
      prev.map((r) =>
        r.id === residentId
          ? {
              ...r,
              roomNumber: newRoomNumber,
              bedNumber: newBedNumber,
              monthlyRent: newMonthlyRent,
            }
          : r
      )
    );

    logAuditEvent(
      'Resident Room Transferred',
      `Resident: ${targetResident.name}`,
      `Transferred from Room ${oldRoom} (${oldBed}) to Room ${newRoomNumber} (${newBedNumber}). Reason: ${reason}`
    );
  };

  const initiateNoticePeriod = (
    residentId: string,
    noticeDate: string = new Date().toISOString().split('T')[0],
    checkoutDate?: string,
    reason?: string
  ) => {
    const d = new Date(noticeDate);
    d.setDate(d.getDate() + 30);
    const expectedCheckout = checkoutDate || d.toISOString().split('T')[0];

    // Owner needs the notice in writing to plan the checkout inspection.
    const noticeResident = residents.find((r) => r.id === residentId) || currentResident;
    if (noticeResident?.propertyId) {
      fireEmailEvent('notice.submitted', {
        to: 'owner',
        propertyId: noticeResident.propertyId,
        data: {
          residentName: noticeResident.name,
          propertyName: noticeResident.propertyName,
          roomNumber: noticeResident.roomNumber,
          noticeDate,
          checkoutDate: expectedCheckout,
          reason,
        },
        dedupeKey: `notice-${residentId}-${noticeDate}`,
      });
    }

    setResidents((prev) =>
      prev.map((r) => {
        if (r.id !== residentId) return r;
        return {
          ...r,
          status: 'Notice Period',
          noticeDate,
          expectedCheckoutDate: expectedCheckout,
          checkoutReason: reason || 'Notice period submitted by resident',
        };
      })
    );

    // Set Bed to 'Notice Period'
    const res = residents.find((r) => r.id === residentId);
    if (res) {
      setBeds((prev) =>
        prev.map((b) =>
          b.roomNumber === res.roomNumber && b.bedNumber === res.bedNumber
            ? { ...b, status: 'Notice Period' }
            : b
        )
      );
    }

    logAuditEvent(
      'Notice Period Initiated',
      `Resident ${res?.name || residentId}`,
      `Notice given on ${noticeDate}. Expected move-out: ${expectedCheckout}. Reason: ${reason || 'Standard 30-day notice'}`
    );
  };

  const executeCheckoutSettlement = (
    settlementData: Omit<CheckoutSettlement, 'id'>
  ): CheckoutSettlement => {
    const today = new Date().toISOString().split('T')[0];
    const newSettlement: CheckoutSettlement = {
      ...settlementData,
      id: `chk-${Date.now()}`,
      settledAt: today,
    };

    setCheckoutSettlements((prev) => [newSettlement, ...prev]);

    // Log the settlement
    logAuditEvent(
      'Checkout Settlement Executed',
      `Resident ${settlementData.residentName}`,
      `Checkout on ${settlementData.checkoutDate}. Deposit: ${settlementData.depositHeld}, Refund: ${settlementData.finalRefundAmount}`
    );

    // 1. Mark resident as Checked Out
    setResidents((prev) =>
      prev.map((r) =>
        r.id === settlementData.residentId
          ? {
              ...r,
              status: 'Checked Out',
              actualCheckoutDate: settlementData.checkoutDate,
              rentStatus: 'Paid',
            }
          : r
      )
    );

    // 2. Transition Bed to 'Cleaning'
    setBeds((prev) =>
      prev.map((b) =>
        b.roomNumber === settlementData.roomNumber && b.bedNumber === settlementData.bedNumber
          ? {
              ...b,
              status: 'Cleaning',
              currentTenantId: undefined,
              currentTenantName: undefined,
            }
          : b
      )
    );

    // 3. Mark Stay as Completed
    setStays((prev) =>
      prev.map((s) =>
        s.residentId === settlementData.residentId && s.status === 'Active'
          ? { ...s, status: 'Completed', endDate: settlementData.checkoutDate }
          : s
      )
    );

    // 4. Update SecurityDepositRecord
    setDepositRecords((prev) =>
      prev.map((d) =>
        d.residentId === settlementData.residentId
          ? {
              ...d,
              status: 'Refunded',
              refundDate: today,
              refundTransactionId: settlementData.refundTransactionId || `UPI-REF-${Date.now().toString().slice(-6)}`,
              finalRefundAmount: settlementData.finalRefundAmount,
            }
          : d
      )
    );

    logAuditEvent(
      'Checkout Settlement Executed',
      `Resident: ${settlementData.residentName}`,
      `Security deposit ₹${settlementData.depositHeld} settled with deductions ₹${settlementData.totalDeductions}. Refund amount: ₹${settlementData.finalRefundAmount}`
    );

    return newSettlement;
  };

  const payRentSimulation = (residentId: string, method: string): PaymentReceipt => {
    const resident = residents.find((r) => r.id === residentId) || currentResident;
    if (!resident) {
      throw new Error('Resident not found for payment.');
    }
    const invoice =
      invoices.find((item) => item.residentId === residentId && item.status !== 'Paid' && item.status !== 'Cancelled') ||
      generateMonthlyInvoice(residentId);
    const amount = invoice ? Math.max(0, invoice.amount - invoice.verifiedPaidAmount) : resident.monthlyRent;
    const payment = recordPayment(residentId, amount, method, 'Verified');
    const verifiedReceipt: PaymentReceipt = {
      transactionId: payment.transactionReference,
      residentName: resident.name,
      propertyName: resident.propertyName,
      roomNumber: resident.roomNumber,
      amount,
      month: invoice?.month || new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      paymentMethod: method,
      paidAt: new Date().toLocaleString(),
      status: 'Success',
    };
    setBroadcasts((prev) => [
      {
        id: `b-${Date.now()}`,
        title: `Rent Payment Received - Room ${resident.roomNumber}`,
        message: `Verified rent payment of Rs ${amount.toLocaleString()} by ${resident.name} for ${verifiedReceipt.month} via ${method}. Transaction ID: ${verifiedReceipt.transactionId}`,
        category: 'Rent',
        target: 'All Residents',
        timestamp: new Date().toLocaleString(),
        sender: 'PGNest Payment Gateway',
      },
      ...prev,
    ]);
    return verifiedReceipt;
    const today = new Date().toISOString().split('T')[0];
    
    // Check if an invoice exists for this resident
    const openInvoice = invoices.find(
      (inv) => inv.residentId === residentId && inv.status !== 'Paid'
    );

    if (openInvoice) {
      return recordPaymentForInvoice(openInvoice.id, openInvoice.outstandingBalance, method, 'Self-service rent payment');
    }

    const receipt: PaymentReceipt = {
      transactionId: `PGN-${Date.now().toString().slice(-8)}`,
      residentName: resident?.name || currentUser?.name || 'Resident',
      propertyName: resident?.propertyName || 'PGNest Property',
      roomNumber: resident?.roomNumber || '204',
      amount: resident?.monthlyRent || 8500,
      month: 'September 2026',
      paymentMethod: method,
      paidAt: new Date().toLocaleString(),
      status: 'Success',
    };

    updateRentStatus(residentId, 'Paid');

    // Add confirmation broadcast notification
    const newBroadcast: BroadcastNotification = {
      id: `b-${Date.now()}`,
      title: `Rent Payment Received — Room ${resident?.roomNumber || '204'}`,
      message: `Rent payment of ₹${(resident?.monthlyRent || 8500).toLocaleString()} by ${resident?.name || 'Resident'} was confirmed via ${method}. Transaction ID: ${receipt.transactionId}`,
      category: 'Rent',
      target: 'All Residents',
      timestamp: new Date().toLocaleString(),
      sender: 'PGNest Payment Gateway',
    };
    setBroadcasts((prev) => [newBroadcast, ...prev]);

    return receipt;
  };

  // Mark notifications as read: either specific ids (a personal
  // complaint-status notice) or every current one ("mark all" in the bell).
  // Read ids are persisted so the unread badge survives reloads and hydration.
  const readIdsKey = 'pgwalo_notifications_read';
  const persistReadIds = (ids: string[]) => {
    if (!currentUser) return;
    try {
      const raw = localStorage.getItem(readIdsKey);
      const byUser: Record<string, string[]> = raw ? JSON.parse(raw) : {};
      const mine = new Set(byUser[currentUser.id] || []);
      ids.forEach((id) => mine.add(id));
      byUser[currentUser.id] = Array.from(mine).slice(-300);
      localStorage.setItem(readIdsKey, JSON.stringify(byUser));
    } catch {
      // Storage unavailable — read state is best-effort.
    }
  };
  const markNotificationsRead = (ids?: string[]) => {
    setBroadcasts((prev) => {
      const toMark = ids ? ids : prev.map((b) => b.id);
      persistReadIds(toMark);
      return prev.map((b) => (!ids || ids.includes(b.id)) && !b.read ? { ...b, read: true } : b);
    });
  };

  const recordAttendance = (record: Omit<AttendanceRecord, 'id' | 'date' | 'timestamp'>) => {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = now.toISOString().split('T')[0];
    const newRec: AttendanceRecord = {
      ...record,
      id: `att-${Date.now()}`,
      date: dateString,
      timestamp: timeString,
    };
    setAttendance((prev) => [newRec, ...prev]);
  };

  const toggleStaffClockIn = (staffId: string) => {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = now.toISOString().split('T')[0];

    setStaff((prev) =>
      prev.map((s) => {
        if (s.id === staffId) {
          const nextStatus = s.todayStatus === 'Checked-In' ? 'Checked-Out' : 'Checked-In';
          // record attendance
          const newRec: AttendanceRecord = {
            id: `att-${Date.now()}`,
            personId: s.id,
            personName: s.name,
            personType: 'Staff',
            role: s.role,
            date: dateString,
            timestamp: timeString,
            type: nextStatus === 'Checked-In' ? 'Check-In' : 'Check-Out',
            status: 'On-Time',
            notes: `${s.role} logged duty ${nextStatus}`,
          };
          setAttendance((a) => [newRec, ...a]);
          return {
            ...s,
            todayStatus: nextStatus,
            lastClockIn: nextStatus === 'Checked-In' ? timeString : s.lastClockIn,
          };
        }
        return s;
      })
    );
  };

  const toggleTaskCompleted = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const addTask = (task: Omit<StaffTask, 'id' | 'completed'>) => {
    const newTask: StaffTask = {
      ...task,
      id: `task-${Date.now()}`,
      completed: false,
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const addBroadcast = (broadcast: Omit<BroadcastNotification, 'id' | 'timestamp'>) => {
    const newB: BroadcastNotification = {
      ...broadcast,
      // Two broadcasts inside the same millisecond (e.g. per-resident rent
      // reminders) collided on `b-${Date.now()}` — one overwrote the other.
      id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
    };
    setBroadcasts((prev) => [newB, ...prev]);
  };

  const updateMealPlanDay = (day: MealPlanDay['day'], field: keyof MealPlanDay, value: string) => {
    setMealPlan((prev) =>
      prev.map((m) => (m.day === day ? { ...m, [field]: value } : m))
    );
  };

  const sendChatMessage = (text: string, isOwner: boolean) => {
    const residentName = currentResident?.name || currentUser?.name || 'Resident';
    const senderName = isOwner ? 'Rajesh Sharma (Owner)' : residentName;
    const recipientName = isOwner ? residentName : 'Rajesh Sharma (Owner)';
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderRole: isOwner ? 'owner' : 'resident',
      senderName,
      recipientName,
      text,
      timestamp: 'Just now',
      isOwner,
    };
    setChatMessages((prev) => [...prev, msg]);
  };

  const addMaintenanceTicket = (ticket: Omit<MaintenanceTicket, 'id' | 'createdAt' | 'status'>) => {
    const newTkt: MaintenanceTicket = {
      ...ticket,
      id: `tkt-${Date.now()}`,
      status: 'Reported',
      createdAt: new Date().toISOString(),
      requesterId: currentUser?.id,
    };
    setTickets((prev) => [newTkt, ...prev]);
    if (isProductionApiEnabled() && getAuthToken()) {
      void postMaintenanceTicket(newTkt).then((result) => {
        if (result.ok && result.id && result.id !== newTkt.id) {
          // The Worker kept its own id — re-key the local copy so status
          // changes and notifications stay on the same record.
          setTickets((prev) =>
            prev.map((t) => (t.id === newTkt.id ? { ...t, id: result.id as string } : t))
          );
        }
        if (!result.ok) console.warn('[maintenance] complaint could not be persisted to the database');
      });
    }
  };

  const updateTicketStatus = (
    ticketId: string,
    status: MaintenanceTicket['status'],
    extra?: { assignedStaffName?: string; resolutionNotes?: string; cost?: number }
  ) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status, ...extra } : t))
    );
    // Persist so the resident's dashboard sees the change and gets notified.
    if (isProductionApiEnabled() && getAuthToken()) {
      void patchMaintenanceTicketStatus(ticketId, status, extra).then((ok) => {
        if (!ok) console.warn('[maintenance] status change could not be persisted');
      });
    }
  };

  const createSupportTicket = (ticket: Omit<SupportTicket, 'id' | 'requesterId' | 'requesterName' | 'requesterRole' | 'status' | 'createdAt' | 'updatedAt'>) => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    const newTicket: SupportTicket = {
      ...ticket,
      id: `support-${Date.now()}`,
      requesterId: currentUser.id,
      requesterName: currentUser.name,
      requesterRole: currentUser.role,
      status: 'Raised',
      createdAt: now,
      updatedAt: now,
    };
    setSupportTickets((prev) => [newTicket, ...prev]);
    // Support desk is emailed for every new ticket (app → PG desk routing).
    fireEmailEvent('support.ticket_raised', {
      to: 'admin',
      data: {
        requesterName: currentUser.name,
        ticketType: newTicket.type,
        title: newTicket.title,
        description: newTicket.description,
        referenceId: newTicket.id,
      },
      dedupeKey: `support-raised-${newTicket.id}`,
    });
    if (isProductionApiEnabled() && getAuthToken()) {
      void postSupportTicket(newTicket).then((result) => {
        if (result.ok && result.id && result.id !== newTicket.id) {
          // The Worker kept its own id — re-key the local copy so replies match.
          setSupportTickets((prev) =>
            prev.map((t) => (t.id === newTicket.id ? { ...t, id: result.id as string } : t))
          );
        }
        if (!result.ok) console.warn('[support] ticket could not be persisted to the database');
      });
    }
  };

  const updateSupportTicket = (ticketId: string, status: SupportTicketStatus, adminNote?: string, assignedTo?: string) => {
    setSupportTickets((prev) => prev.map((ticket) => ticket.id === ticketId
      ? {
          ...ticket,
          status,
          adminNote: adminNote ?? ticket.adminNote,
          assignedTo: assignedTo ?? ticket.assignedTo,
          updatedAt: new Date().toISOString(),
        }
      : ticket));
    logAuditEvent('Ticket status changed', `Ticket ${ticketId}`, `${status} ${assignedTo || ''}`.trim());
    if (isProductionApiEnabled() && getAuthToken()) {
      void patchAdminTicket(ticketId, { status, assignedTo }).then((ok) => {
        if (!ok) console.warn(`[admin] ticket ${ticketId} status change could not be persisted to the database`);
      });
    }
  };

  const addSupportTicketReply = (ticketId: string, body: string) => {
    if (!currentUser || !body.trim()) return;
    setSupportTickets((prev) => prev.map((ticket) => ticket.id === ticketId
      ? {
          ...ticket,
          status: ticket.status === 'Raised' ? 'Open' : ticket.status,
          updatedAt: new Date().toISOString(),
          messages: [
            ...(ticket.messages || []),
            {
              id: `msg-${Date.now()}`,
              authorId: currentUser.id,
              authorName: currentUser.name,
              authorRole: currentUser.role,
              body: body.trim(),
              createdAt: new Date().toISOString(),
            },
          ],
        }
      : ticket));
    logAuditEvent('Ticket reply added', `Ticket ${ticketId}`, body.trim().slice(0, 120));
    if (isProductionApiEnabled() && getAuthToken()) {
      void postAdminTicketReply(ticketId, body.trim(), currentUser.name).then((ok) => {
        if (!ok) console.warn(`[admin] reply on ticket ${ticketId} could not be persisted to the database`);
      });
    }
  };

  const updateUserAccountStatus = (userId: string, status: NonNullable<UserAccount['status']>) => {
    setUsers((prev) => prev.map((account) => (account.id === userId ? { ...account, status } : account)));
    logAuditEvent('Account status changed', `User ${userId}`, status);
    if (isProductionApiEnabled() && getAuthToken()) {
      void patchAdminUserStatus(userId, status).then((ok) => {
        if (!ok) console.warn(`[admin] status change for user ${userId} could not be persisted to the database`);
      });
    }
  };

  const setListingDecision = (propertyId: string, action: 'approve' | 'reject' | 'disable') => {
    const patch: Partial<Property> =
      action === 'approve'
        ? { verified: true, listingStatus: 'Active', status: 'Active' }
        : action === 'reject'
          ? { verified: false, listingStatus: 'Archived', status: 'Restricted' }
          : { verified: false, listingStatus: 'Archived', status: 'Archived' };
    updateProperty(propertyId, patch);
    logAuditEvent(`Listing ${action}`, `Property ${propertyId}`, action);
    if (isProductionApiEnabled() && getAuthToken()) {
      void patchAdminProperty(propertyId, { action }).then((ok) => {
        if (!ok) console.warn(`[admin] listing ${action} for property ${propertyId} could not be persisted to the database`);
      });
    }
  };

  const resetToDemoData = () => {
    localStorage.clear();
    setOrganizations([
      {
        id: DEFAULT_ORGANIZATION_ID,
        name: 'PGWalo Operations',
        ownerUserId: 'user-owner',
        accountState: 'Trial / Pending Setup',
        subscriptionPlan: 'Trial',
        createdAt: new Date().toISOString(),
      },
    ]);
    setProperties(INITIAL_PROPERTIES);
    setResidents(INITIAL_RESIDENTS);
    setBookingRequests(INITIAL_BOOKING_REQUESTS);
    setAttendance(INITIAL_ATTENDANCE);
    setStaff(INITIAL_STAFF);
    setTasks(INITIAL_TASKS);
    setBroadcasts(INITIAL_BROADCASTS);
    setMealPlan(INITIAL_MEAL_PLAN);
    setChatMessages(INITIAL_CHAT);
    setTickets(INITIAL_TICKETS);
    setSupportTickets(INITIAL_SUPPORT_TICKETS);
    setUsers(INITIAL_USERS);
    setBeds(INITIAL_BEDS);
    setLeads(INITIAL_LEADS);
    setMeterReadings(INITIAL_METER_READINGS);
    setReconciliations(INITIAL_RECONCILIATION);
    setDepositRecords(INITIAL_DEPOSITS);
    setAgreements(INITIAL_AGREEMENTS);
    setVisitorPasses(INITIAL_VISITORS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setSettings(INITIAL_SETTINGS);
    setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
    setStays(deriveInitialStays(INITIAL_RESIDENTS, INITIAL_BEDS));
    setRentPlans(deriveInitialRentPlans(INITIAL_RESIDENTS, INITIAL_PROPERTIES));
    setInvoices([]);
    setPayments([]);
    setPaymentAllocations([]);
    setDepositTransactions(
      INITIAL_RESIDENTS.map((resident) => ({
        id: `dep-txn-${resident.id}`,
        organizationId: resident.organizationId || DEFAULT_ORGANIZATION_ID,
        residentId: resident.id,
        propertyId: resident.propertyId,
        type: 'Deposit Received' as const,
        amount: resident.depositAmount,
        reason: 'Opening security deposit balance',
        createdBy: 'system',
        createdAt: resident.moveInDate,
      }))
    );
    setNotices([]);
    setCheckouts([]);
    setCurrentUser(null);
    setCurrentStaffId('staff-1');
    setRoleState('public');
  };

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        setRoleState,
        currentUser,
        organizations,
        users,
        properties,
        residents,
        bookingRequests,
        attendance,
        staff,
        currentStaff,
        setCurrentStaffId,
        tasks,
        broadcasts,
        mealPlan,
        chatMessages,
        tickets,
        currentResident,
        activeProperty,
        selectedPGForDetail,
        setSelectedPGForDetail,
        propertyModalIntent,
        openPropertyModal,
        showAuthModal: authModalOpen,
        setShowAuthModal: setAuthModalOpen,
        authModalOpen,
        setAuthModalOpen,
        authModalMode,
        setAuthModalMode,
        authInitialRole,
        setAuthInitialRole,
        authMeta,
        openAuthModal,
        requireAuth,
        runPendingAuthAction,
        login,
        applyApiSession,
        openPublicCatalog,
        shellIntent,
        clearShellIntent,
        openRoleDashboard,
        register,
        logout,
        profileModalOpen,
        setProfileModalOpen,
        updateUserProfile,
        pendingAction,
        setPendingAction,
        confirmedAction,
        setConfirmedAction,
        confirmDirectAction,
        beds,
        updateBedStatus,
        stays,
        rentPlans,
        invoices,
        payments,
        paymentAllocations,
        depositTransactions,
        notices,
        checkouts,
        checkoutSettlements,
        hasPermission,
        generateMonthlyInvoice,
        recordPayment,
        verifyPayment,
        getResidentLedgerSummary,
        reserveBedForResident,
        confirmMoveIn,
        transferResidentBed,
        submitNotice,
        approveNotice,
        startCheckout,
        completeCheckout,
        leads,
        addLead,
        updateLeadStage,
        meterReadings,
        addMeterReading,
        reconciliations,
        depositRecords,
        addDepositDeduction,
        settleDepositRefund,
        agreements,
        mergeAgreements,
        signAgreement,
        visitorPasses,
        addVisitorPass,
        updateVisitorStatus,
        auditLogs,
        logAuditEvent,
        settings,
        updateSettings,
        rolePermissions,
        updateRolePermissions,
        generateMonthlyInvoices,
        recordPaymentForInvoice,
        recordAdvancePayment,
        processRoomTransfer,
        initiateNoticePeriod,
        executeCheckoutSettlement,
        updateResidentStatus,
        updatePropertyModules,
        globalSearchQuery,
        setGlobalSearchQuery,
        showVirtualTourModal,
        setShowVirtualTourModal,
        virtualTourRoom,
        setVirtualTourRoom,
        addProperty,
        updateProperty,
        addBookingRequest,
        approveBookingRequest,
        rejectBookingRequest,
        cancelBookingRequest,
        rescheduleVisit,
        addResident,
        updateRentStatus,
        payRentSimulation,
        recordAttendance,
        toggleStaffClockIn,
        addStaffMember,
        updateStaffMember,
        deleteStaffMember,
        toggleTaskCompleted,
        addTask,
        addBroadcast,
        markNotificationsRead,
        updateMealPlanDay,
        sendChatMessage,
        addMaintenanceTicket,
        updateTicketStatus,
        supportTickets,
        createSupportTicket,
        updateSupportTicket,
        addSupportTicketReply,
        updateUserAccountStatus,
        setListingDecision,
        productionHydrated,
        accountBlocked,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
