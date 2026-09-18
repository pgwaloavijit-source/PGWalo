export type UserRole =
  | 'public'
  | 'owner'
  | 'resident'
  | 'staff'
  | 'admin'
  | 'superadmin'
  | 'manager'
  | 'warden'
  | 'accountant';

export interface RolePermissions {
  property: { view: boolean; create: boolean; edit: boolean; delete: boolean; publish: boolean; approve: boolean };
  rooms: { view: boolean; create: boolean; edit: boolean; delete: boolean; allocateBed: boolean };
  tenants: { view: boolean; create: boolean; edit: boolean; move: boolean; vacate: boolean; viewDocs: boolean };
  rent: { view: boolean; generate: boolean; collect: boolean; verify: boolean; refund: boolean };
  electricity: { view: boolean; enterReadings: boolean; editReadings: boolean; generateBills: boolean; approveBills: boolean };
  agreements: { create: boolean; view: boolean; verify: boolean; generate: boolean; download: boolean };
  maintenance: { create: boolean; assign: boolean; update: boolean; resolve: boolean };
  reports: { view: boolean; export: boolean };
}

export type PermissionKey =
  | 'resident.view'
  | 'resident.create'
  | 'resident.edit'
  | 'resident.move'
  | 'resident.checkout'
  | 'room.view'
  | 'room.assign'
  | 'room.transfer'
  | 'invoice.view'
  | 'invoice.create'
  | 'invoice.adjust'
  | 'payment.view'
  | 'payment.record'
  | 'payment.verify'
  | 'payment.refund'
  | 'deposit.view'
  | 'deposit.deduct'
  | 'deposit.refund'
  | 'complaint.view'
  | 'complaint.assign'
  | 'complaint.resolve'
  | 'report.view'
  | 'report.export'
  | 'staff.view'
  | 'staff.create'
  | 'staff.edit'
  | 'staff.permission_manage'
  | 'audit.view';

export type OwnerAccountState = 'Trial / Pending Setup' | 'Active' | 'Grace Period' | 'Restricted';

export interface Organization {
  id: string;
  name: string;
  ownerUserId: string;
  accountState: OwnerAccountState;
  subscriptionPlan: 'Trial' | 'Starter' | 'Growth' | 'Restricted';
  createdAt: string;
}

export type PropertyStatus =
  | 'Setup In Progress'
  /** Created by the wizard, waiting for the owner's publishing payment. */
  | 'Payment Pending'
  | 'Active'
  | 'Restricted'
  | 'Archived';

export interface PropertyModuleSettings {
  foodManagement: boolean;
  attendance: boolean;
  visitorManagement: boolean;
  onlinePayments: boolean;
  chat: boolean;
}

export interface Floor {
  id: string;
  organizationId: string;
  propertyId: string;
  label: string;
  level: number;
}

export interface Room {
  id: string;
  organizationId: string;
  propertyId: string;
  floorId: string;
  roomNumber: string;
  sharingType: RoomSharingType;
  status: RoomStatus;
}

export type RoomStatus =
  | 'Available'
  | 'Partially Occupied'
  | 'Fully Occupied'
  | 'Maintenance'
  | 'Disabled';

export type DepositState = 'Unknown' | 'Pending' | 'Held' | 'Settlement Pending' | 'Partially Refunded' | 'Refunded';

export type AgreementState = 'Unknown' | 'Pending' | 'Verified' | 'Signed' | 'Active' | 'Exception Approved';

export interface UserAccount {
  id: string;
  organizationId?: string;
  name: string;
  email: string;
  phone: string;
  age?: number;
  gender?: 'Male' | 'Female' | 'Other';
  occupation?: string;
  organization?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  city?: string;
  permanentAddress?: string;
  alternatePhone?: string;
  aadhaarLast4?: string;
  foodPreference?: string;
  bloodGroup?: string;
  vehicleType?: string;
  maritalStatus?: string;
  preferredLanguage?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  isProfileCompleted?: boolean;
  isDemo?: boolean; // Mark demo accounts separately
  role: UserRole;
  avatar: string;
  propertyId?: string;
  propertyName?: string;
  roomNumber?: string;
  staffRole?: string;
  createdAt: string;
  status?: 'Active' | 'Suspended' | 'Pending Verification' | 'Disabled';
  assignedProperties?: string[];
  permissions?: Partial<RolePermissions>;
}

export type SupportTicketStatus = 'Raised' | 'Open' | 'Resolved' | 'Closed';

export interface SupportTicketMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterRole: UserRole;
  type: string;
  title: string;
  description: string;
  imageUrl?: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  adminNote?: string;
  assignedTo?: string;
  propertyId?: string;
  bookingId?: string;
  messages?: SupportTicketMessage[];
}

export type GenderPreference = 'Boys' | 'Girls' | 'Unisex';

export type RoomSharingType = 'Single' | 'Double' | 'Triple' | 'Four';

export interface PublicSearchCriteria {
  location?: string;
  city?: string;
  moveInDate?: string;
  type?: GenderPreference | 'All';
  lat?: number;
  lng?: number;
  nearby?: boolean;
}

export interface RoomOption {
  id: string;
  type: RoomSharingType;
  rentPerMonth: number;
  deposit: number;
  availableBeds: number;
  totalBeds: number;
  hasAttachedBath: boolean;
  hasAC: boolean;
  hasBalcony: boolean;
}

export interface Amenity {
  id: string;
  name: string;
  icon: string;
  category: 'essential' | 'comfort' | 'security' | 'food';
}

export interface Review {
  id: string;
  userName: string;
  userPhoto?: string;
  rating: number;
  date: string;
  comment: string;
  roomType: string;
}

export interface MealPlanDay {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  breakfast: string;
  lunch: string;
  snacks: string;
  dinner: string;
  specialNote?: string;
}

export interface Property {
  id: string;
  organizationId?: string;
  status?: PropertyStatus;
  modules?: PropertyModuleSettings;
  floors?: number;
  defaultRentDueDay?: number;
  name: string;
  tagline: string;
  gender: GenderPreference;
  city: string;
  locality: string;
  state?: string;
  country?: string;
  pincode?: string;
  address: string;
  lat: number;
  lng: number;
  placeLabel?: string;
  coverImage: string;
  galleryImages: string[];
  startingPrice: number;
  rating: number;
  reviewCount: number;
  rooms: RoomOption[];
  amenities: string[]; // amenity IDs
  rules: string[];
  noticePeriodDays: number;
  gateClosingTime: string;
  foodIncluded: boolean;
  verified: boolean;
  featured?: boolean;
  contactPhone: string;
  contactEmail: string;
  ownerName: string;
  ownerUserId?: string;
  ownerProfileSlug?: string;
  /** Durable PGWalo number shown as `PGwalo<number>- <name>` (assigned once). */
  pgNumber?: number;
  /** Paid publishing plan: lite | air | ocean. Absent on legacy listings. */
  planTier?: 'lite' | 'air' | 'ocean';
  planExpiresAt?: string;
  listingPaymentStatus?: 'Pending' | 'Paid' | 'Failed';
  listingFeeAmount?: number;
  publishedAt?: string;
  description?: string;
  foodIncludedInRate?: boolean;
  electricityRatePerUnit?: number;
  taxPercent?: number;
  optionalCharges?: { id: string; label: string; amount?: number; note?: string }[];
  // Configurable optional modules per spec Section 29, 30
  foodManagementEnabled?: boolean;
  attendanceEnabled?: boolean;
  visitorManagementEnabled?: boolean;
  onlinePaymentsEnabled?: boolean;
  listingStatus?: 'Active' | 'Setup In Progress' | 'Payment Pending' | 'Archived' | 'Under Maintenance';
  listingDefaultRentDueDay?: number;
  totalFloors?: number;
}

export type ResidentStatus =
  | 'Lead'
  | 'Visit Scheduled'
  | 'Reserved'
  | 'Pending Move-In'
  | 'Active'
  | 'Notice Period'
  | 'Checkout Pending'
  | 'Checked Out'
  | 'Archived'
  | 'Lost'
  | 'Cancelled';

export interface Resident {
  id: string;
  organizationId?: string;
  status?: ResidentStatus;
  currentStayId?: string;
  advanceBalance?: number;
  outstandingBalance?: number;
  previousDues?: number;
  depositState?: DepositState;
  agreementState?: AgreementState;
  noticePeriodDays?: number;
  checkoutId?: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  propertyId: string;
  propertyName: string;
  roomNumber: string;
  roomType: RoomSharingType;
  bedNumber: string;
  monthlyRent: number;
  depositAmount: number;
  moveInDate: string;
  rentStatus: 'Paid' | 'Pending' | 'Overdue';
  rentDueDate: string;
  lastPaymentDate?: string;
  emergencyContact: string;
  kycVerified: boolean;
  notes?: string;
  // Production lifecycle fields
  noticeDate?: string;
  expectedCheckoutDate?: string;
  actualCheckoutDate?: string;
  checkoutReason?: string;
  agreementExpiryDate?: string;
  onboardingChecklist?: {
    identityProof: boolean;
    addressProof: boolean;
    emergencyContactVerified: boolean;
    agreementSigned: boolean;
    depositPaid: boolean;
    houseRulesAcknowledged: boolean;
  };
}

export interface BookingRequest {
  id: string;
  organizationId?: string;
  reservedBedId?: string;
  reservationExpiry?: string;
  tokenAmount?: number;
  applicantName: string;
  email: string;
  phone: string;
  propertyId: string;
  propertyName: string;
  roomType: RoomSharingType;
  preferredMoveInDate: string;
  occupancyType: 'Working Professional' | 'Student';
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  requestDate: string;
  message?: string;
  type?: 'visit' | 'booking';
  visitDate?: string;
  visitTimeSlot?: string;
  referenceId?: string;
  allocatedRoomNumber?: string;
  allocatedBedNumber?: string;
}

export interface PendingCustomerAction {
  type: 'visit' | 'booking';
  property: Property;
  roomType?: RoomSharingType;
  preferredMoveInDate?: string;
  visitDate?: string;
  date?: string;
  visitTimeSlot?: string;
  timeSlot?: string;
  occupancyType?: 'Working Professional' | 'Student';
  message?: string;
  applicantName?: string;
  phone?: string;
  email?: string;
}

export interface AttendanceRecord {
  id: string;
  personId: string;
  personName: string;
  personType: 'Resident' | 'Staff';
  roomNumber?: string;
  role?: string;
  date: string;
  timestamp: string;
  type: 'Check-In' | 'Check-Out' | 'Present' | 'Absent';
  status: 'On-Time' | 'Late' | 'Permission';
  notes?: string;
}

export interface StaffMember {
  id: string;
  ownerUserId?: string;
  organizationId?: string;
  name: string;
  role: 'Housekeeping' | 'Mess Cook' | 'Security Guard' | 'Manager' | 'Electrician';
  /** Additional operational roles — a staff member can hold several. */
  roles?: string[];
  phone: string;
  avatar: string;
  propertyId: string;
  shift: 'Morning (6 AM - 2 PM)' | 'Evening (2 PM - 10 PM)' | 'Night (10 PM - 6 AM)';
  todayStatus: 'Checked-In' | 'Checked-Out' | 'On Leave';
  lastClockIn?: string;
}

export interface StaffTask {
  id: string;
  title: string;
  description: string;
  category: 'Cleaning' | 'Maintenance' | 'Kitchen' | 'Security';
  assignedToName: string;
  timeSlot: string;
  priority: 'Low' | 'Medium' | 'High';
  completed: boolean;
}

export interface BroadcastNotification {
  id: string;
  title: string;
  message: string;
  category: 'Urgent' | 'Maintenance' | 'Rent' | 'Event' | 'Food';
  target: 'All Residents' | 'Floor 1 & 2' | 'Staff Only';
  propertyId?: string;
  propertyName?: string;
  timestamp: string;
  sender: string;
  read?: boolean;
  /** Set = a personal notice for this one account (e.g. a rent reminder). */
  recipientId?: string;
  recipientName?: string;
}

export interface ChatMessage {
  id: string;
  senderRole: 'owner' | 'resident';
  senderName: string;
  recipientName: string;
  text: string;
  timestamp: string;
  isOwner: boolean;
}

export type TicketCategory =
  | 'Plumbing'
  | 'Electrical'
  | 'WiFi'
  | 'Carpentry'
  | 'Appliance'
  | 'Cleaning'
  | 'Furniture'
  | 'AC'
  | 'Bathroom'
  | 'Food'
  | 'Security'
  | 'Room'
  | 'Other';

export type TicketPriority = 'Emergency' | 'High' | 'Normal' | 'Low' | 'Urgent';

export interface MaintenanceTicket {
  id: string;
  title: string;
  category: TicketCategory;
  roomNumber: string;
  residentName: string;
  description: string;
  priority: TicketPriority;
  status: 'Reported' | 'In-Progress' | 'Resolved' | 'Closed';
  createdAt: string;
  assignedStaffName?: string;
  slaDeadline?: string;
  photoUrl?: string;
  cost?: number;
  resolutionNotes?: string;
  propertyId?: string;
  propertyName?: string;
  updatedAt?: string;
  requesterId?: string;
  escalatedAt?: string;
}

/** Owner maintenance rollup: SLA health per priority + per-staff throughput. */
export interface MaintenanceSlaRow {
  priority: string;
  total: number;
  open: number;
  resolved: number;
  breachedOpen: number;
  avgResolutionHours: number | null;
  withinSlaPct: number | null;
}

export interface MaintenanceStaffStat {
  name: string;
  assigned: number;
  open: number;
  resolved: number;
  avgResolutionHours: number | null;
  lateResolutions: number;
  escalations: number;
}

export interface MaintenanceBreachRow {
  id: string;
  title: string;
  priority: string;
  status: string;
  roomNumber?: string;
  propertyName?: string;
  assignedStaffName?: string;
  createdAt: string;
  slaDeadline?: string;
  escalatedAt?: string;
}

export interface MaintenanceOverview {
  totals: {
    total: number;
    open: number;
    resolved: number;
    closed: number;
    unassigned: number;
    escalated: number;
  };
  sla: {
    breachedOpen: number;
    resolvedInSla: number;
    resolvedLate: number;
    withinSlaPct: number | null;
    avgResolutionHours: number | null;
    medianResolutionHours: number | null;
    byPriority: MaintenanceSlaRow[];
  };
  staff: MaintenanceStaffStat[];
  breached: MaintenanceBreachRow[];
  generatedAt: string;
}

export interface PaymentReceipt {
  transactionId: string;
  residentName: string;
  propertyName: string;
  roomNumber: string;
  amount: number;
  month: string;
  paymentMethod: string;
  paidAt: string;
  status: 'Success' | 'Pending';
  rentAmount?: number;
  electricityAmount?: number;
  otherAmount?: number;
}

export type BedStatus =
  | 'Vacant'
  | 'Available'
  | 'Reserved'
  | 'Booking Pending'
  | 'Occupied'
  | 'Notice Period'
  | 'Maintenance'
  | 'Disabled'
  | 'Vacating'
  | 'Cleaning'
  | 'Ready';

export interface Bed {
  id: string;
  organizationId?: string;
  bedNumber: string;
  roomId?: string;
  roomNumber: string;
  propertyId: string;
  floor: number | string;
  tower?: string;
  building?: string;
  sharingType: RoomSharingType;
  status: BedStatus;
  currentTenantId?: string;
  currentTenantName?: string;
  monthlyRent: number;
  monthlyTariff?: number;
  deposit: number;
  nextAvailableDate?: string;
  reservedForResidentId?: string;
  reservationExpiry?: string;
}

export type StayStatus = 'Reserved' | 'Current' | 'Closed' | 'Cancelled';

export interface Stay {
  id: string;
  organizationId: string;
  residentId: string;
  propertyId: string;
  roomId?: string;
  roomNumber: string;
  bedId: string;
  bedNumber: string;
  startDate: string;
  endDate?: string;
  monthlyRentAtStart: number;
  transferReason?: string;
  status: StayStatus;
}

export interface RentPlan {
  id: string;
  organizationId: string;
  residentId: string;
  propertyId: string;
  monthlyRent: number;
  dueDay: number;
  effectiveFrom: string;
  effectiveTo?: string;
  status: 'Scheduled' | 'Active' | 'Ended';
  revisionReason?: string;
}

export type InvoiceStatus =
  | 'Upcoming'
  | 'Due'
  | 'Overdue'
  | 'Partially Paid'
  | 'Paid'
  | 'Adjusted'
  | 'Waived'
  | 'Cancelled';

export interface InvoiceLine {
  id: string;
  description: string;
  amount: number;
  type: 'Rent' | 'Previous Due' | 'Electricity' | 'Food' | 'Damage' | 'Other';
}

export interface Invoice {
  id: string;
  organizationId: string;
  residentId: string;
  propertyId: string;
  month: string;
  dueDate: string;
  lines: InvoiceLine[];
  amount: number;
  verifiedPaidAmount: number;
  status: InvoiceStatus;
  createdAt: string;
  cancelledAt?: string;
}

export type PaymentStatus =
  | 'Pending'
  | 'Pending Verification'
  | 'Verified'
  | 'Failed'
  | 'Refunded'
  | 'Cancelled';

export interface Payment {
  id: string;
  organizationId: string;
  residentId: string;
  propertyId: string;
  amount: number;
  method: string;
  status: PaymentStatus;
  submittedAt: string;
  verifiedAt?: string;
  transactionReference: string;
  notes?: string;
}

export interface PaymentAllocation {
  id: string;
  organizationId: string;
  paymentId: string;
  invoiceId?: string;
  residentId: string;
  amount: number;
  allocatedTo: 'Invoice' | 'Advance';
  createdAt: string;
}

export interface Adjustment {
  id: string;
  organizationId: string;
  invoiceId: string;
  residentId: string;
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface DepositTransaction {
  id: string;
  organizationId: string;
  residentId: string;
  propertyId: string;
  type: 'Deposit Received' | 'Additional Deposit' | 'Deposit Adjustment' | 'Deposit Deduction' | 'Deposit Refund';
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: string;
  evidenceUrl?: string;
  transactionReference?: string;
}

export interface Notice {
  id: string;
  organizationId: string;
  residentId: string;
  propertyId: string;
  submittedAt: string;
  requestedCheckoutDate: string;
  contractualEarliestCheckoutDate: string;
  approvedCheckoutDate?: string;
  reason: string;
  comments?: string;
  status: 'Submitted' | 'Approved' | 'Rejected' | 'Modified';
  ownerReason?: string;
}

export interface Checkout {
  id: string;
  organizationId: string;
  residentId: string;
  propertyId: string;
  bedId: string;
  status: 'Pending' | 'Completed';
  startedAt: string;
  completedAt?: string;
  rentPending: number;
  electricityCharges: number;
  foodCharges: number;
  damageCharges: number;
  otherDeductions: number;
  depositHeld: number;
  refundAmount: number;
  checklist: {
    keysReturned: boolean;
    bedInspected: boolean;
    furnitureInspected: boolean;
    accessCardReturned: boolean;
    roomCleared: boolean;
    finalMeterReading?: string;
  };
}

export type LeadStage =
  | 'New Lead'
  | 'Contacted'
  | 'Visit Scheduled'
  | 'Visited'
  | 'Interested'
  | 'Booking Pending'
  | 'Booked'
  | 'Moved In'
  | 'Lost';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  propertyId?: string;
  propertyName?: string;
  roomTypePreference: RoomSharingType;
  budgetMax: number;
  budget: number;
  preferredMoveIn?: string;
  expectedMoveInDate: string;
  stage: LeadStage;
  source: string;
  assignedTo?: string;
  notes: string;
  createdAt: string;
  lastFollowUp: string;
}

export interface ElectricityMeterReading {
  id: string;
  propertyId: string;
  propertyName: string;
  roomNumber: string;
  meterNumber: string;
  previousReading: number;
  currentReading: number;
  unitsConsumed: number;
  ratePerUnit: number;
  fixedCharges: number;
  totalAmount: number;
  readingDate: string;
  staffName: string;
  meterPhotoUrl: string;
  status: 'Verified' | 'Pending Review' | 'Flagged';
  isAnomaly?: boolean;
  anomalyReason?: string;
}

export interface PropertyElectricityReconciliation {
  id: string;
  month: string;
  propertyId: string;
  propertyName: string;
  actualProviderBill: number;
  totalUnitsProvider: number;
  tenantChargesGenerated: number;
  tenantCollected: number;
  tenantOutstanding: number;
  variance: number;
}

export interface SecurityDepositRecord {
  id: string;
  residentId: string;
  residentName: string;
  roomNumber: string;
  propertyId: string;
  depositReceived: number;
  receivedDate: string;
  status: 'Held' | 'Settlement Pending' | 'Partially Refunded' | 'Refunded';
  deductions: {
    id: string;
    category: 'Damage' | 'Unpaid Rent' | 'Electricity' | 'Other';
    amount: number;
    reason: string;
    approvedByOwner: boolean;
    evidencePhoto?: string;
  }[];
  totalDeductions: number;
  finalRefundAmount: number;
  refundDate?: string;
  refundTransactionId?: string;
  notes?: string;
}

export interface MoveInInspectionItem {
  id: string;
  area: string;
  item: string;
  condition: 'Good' | 'Fair' | 'Damaged' | 'Not Applicable';
  remarks: string;
  photoUrl?: string;
}

export interface MoveInInspection {
  id: string;
  residentId: string;
  residentName: string;
  roomNumber: string;
  propertyId: string;
  inspectionDate: string;
  wardenName: string;
  items: MoveInInspectionItem[];
  tenantSigned: boolean;
  tenantSignedAt?: string;
  overallNotes: string;
}

export interface RentAgreement {
  id: string;
  agreementNumber: string;
  residentId: string;
  residentName: string;
  parentGuardianName?: string;
  tenantDOB: string;
  tenantPermanentAddress: string;
  tenantCurrentAddress: string;
  tenantCollegeOrOffice: string;
  tenantIdDocumentType: 'Aadhaar' | 'Passport' | 'Voter ID' | 'Driving License';
  tenantIdDocumentMasked: string;
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  ownerName: string;
  ownerPhone: string;
  ownerAddress?: string;
  tenantName?: string;
  tenantAadhaarMasked?: string;
  roomNumber: string;
  bedNumber: string;
  bedId?: string;
  monthlyRent: number;
  securityDeposit: number;
  stampPaperState?: string;
  stampDutyValue?: number;
  electricityTerms: string;
  noticePeriodDays: number;
  startDate: string;
  endDate: string;
  rulesSummary: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  status: 'Draft' | 'Sent' | 'Under Verification' | 'Verified' | 'Tenant Signed' | 'Signed' | 'Active';
  lockInPeriodMonths?: number;
  terms?: string[];
  termsAndConditions?: {
    noticePeriodDays: number;
    lockInPeriodMonths: number;
    rentDueDay: number;
    foodIncludedInRate: boolean;
    taxPercent: number;
  };
  ownerSigned: boolean;
  tenantSigned: boolean;
  signedDate?: string;
  sentByOwnerAt?: string;
  ownerSignatureDate?: string;
  tenantSignatureDate?: string;
}

export interface VisitorPass {
  id: string;
  residentId: string;
  residentName: string;
  roomNumber: string;
  visitorName: string;
  visitorPhone: string;
  purpose: string;
  expectedArrival: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: 'Pre-Approved' | 'Checked-In' | 'Checked-Out' | 'Denied';
  approvedBy: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityId?: string;
  timestamp: string;
  details: string;
}

export interface SystemSettings {
  currency: string;
  rentDueDay: number;
  lateFeeGraceDays: number;
  lateFeeAmount: number;
  defaultElectricityRate: number;
  electricityBillingModel: 'Included' | 'Fixed' | 'Per-Unit' | 'Room-Level' | 'Property-Distributed';
  depositRefundNoticeDays: number;
  emergencyMaintenanceSlaHours: number;
  highMaintenanceSlaHours: number;
  normalMaintenanceSlaHours: number;
  lowMaintenanceSlaHours: number;
}

export type Agreement = RentAgreement;

// ==========================================
// PRODUCTION LIFECYCLE & FINANCIAL DATA MODEL
// ==========================================

export interface StayRecord {
  id: string;
  residentId: string;
  residentName: string;
  propertyId: string;
  propertyName: string;
  roomNumber: string;
  bedNumber: string;
  roomType: RoomSharingType;
  startDate: string;
  endDate?: string;
  monthlyRent: number;
  transferReason?: string;
  status: 'Active' | 'Transferred' | 'Completed';
  createdAt: string;
}

// InvoiceStatus is declared once above (RentPlan section).

export interface InvoiceLineItem {
  id: string;
  description: string;
  amount: number;
  type: 'Rent' | 'Electricity' | 'Maintenance' | 'Food' | 'Damage' | 'LateFee' | 'Discount';
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  residentId: string;
  residentName: string;
  propertyId: string;
  propertyName: string;
  roomNumber: string;
  month: string; // e.g., 'September 2026'
  billingCycleStart: string;
  billingCycleEnd: string;
  dueDate: string;
  baseRent: number;
  electricityCharges: number;
  otherCharges: number;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  previousDuesApplied: number;
  advanceDeducted: number;
  totalDue: number;
  amountPaid: number;
  outstandingBalance: number;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
  receiptIds: string[];
}

export type PaymentVerificationStatus =
  | 'Pending'
  | 'Pending Verification'
  | 'Verified'
  | 'Failed'
  | 'Refunded'
  | 'Cancelled';

export interface PaymentRecord {
  id: string;
  transactionId: string;
  invoiceId: string;
  residentId: string;
  residentName: string;
  propertyId: string;
  propertyName: string;
  roomNumber: string;
  amount: number;
  allocatedToRent: number;
  allocatedToAdvance: number;
  paymentMethod: 'UPI' | 'Credit/Debit Card' | 'Net Banking' | 'Cash' | 'Bank Transfer';
  paymentProofUrl?: string;
  status: PaymentVerificationStatus;
  paidAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  notes?: string;
}

export interface CheckoutSettlement {
  id: string;
  residentId: string;
  residentName: string;
  propertyId: string;
  propertyName: string;
  roomNumber: string;
  bedNumber: string;
  checkoutDate: string;
  depositHeld: number;
  pendingRent: number;
  electricityCharges: number;
  foodCharges: number;
  damageDeductions: number;
  otherDeductions: number;
  deductionNotes?: string;
  totalDeductions: number;
  finalRefundAmount: number;
  refundStatus: 'Pending Settlement' | 'Processed' | 'Refunded';
  refundTransactionId?: string;
  settledAt?: string;
  propertyChecklist: {
    keysReturned: boolean;
    bedInspected: boolean;
    furnitureChecked: boolean;
    accessCardReturned: boolean;
    roomCleaned: boolean;
  };
  notes?: string;
}

// ============================
// OWNER LISTING FLOW TYPES
// ============================

export type PropertyType = 'PG' | 'Hostel' | 'Co-Living' | 'Rental Rooms' | 'Apartment';
export type GenderOccupancy = 'Boys' | 'Girls' | 'Unisex / Co-ed';
export type RoomType = 'Private' | 'Shared' | 'Dormitory';
export type SharingCapacity = 'Single' | 'Double' | 'Triple' | '4 Sharing' | '5+ Sharing';
export type PhotoCategory = 'Exterior' | 'Bedroom' | 'Bathroom' | 'Kitchen' | 'Dining' | 'Common Area' | 'Amenities';
export type VerificationStatus = 'Pending' | 'Under Review' | 'Verified' | 'Rejected';
export type ListingStatus = 'Draft' | 'Pending Review' | 'Payment Pending' | 'Published' | 'Archived';

export interface OwnerListingStep1 {
  propertyName: string;
  city: string;
  state: string;
  country: string;
  genderOccupancy: GenderOccupancy;
  locality: string;
  propertyType: PropertyType;
  propertyDescription: string;
  fullAddress: string;
  pincode: string;
  nearbyLandmark: string;
  mapLocation?: { lat: number; lng: number };
}

export interface BedDetail {
  bedId: string;
  bedName: string;
  status: BedStatus; // Using existing BedStatus type
  monthlyRent: number;
  securityDeposit: number;
  oneTimeCharges?: number;
}

export interface RoomDetail {
  roomNumber: string;
  floor: string;
  roomType: RoomType;
  sharingCapacity: SharingCapacity;
  numberOfBeds: number;
  beds: BedDetail[];
}

export interface OwnerListingStep2 {
  rooms: RoomDetail[];
}

export interface RoomAmenity {
  id: string;
  name: string;
  selected: boolean;
}

export interface PropertyAmenity {
  id: string;
  name: string;
  selected: boolean;
}

export interface FoodOption {
  id: string;
  name: string;
  selected: boolean;
}

export interface OwnerListingStep3 {
  roomAmenities: RoomAmenity[];
  propertyAmenities: PropertyAmenity[];
  foodAvailable: boolean;
  foodIncludedInRate: boolean;
  foodOptions: FoodOption[];
  foodCharges?: number;
  electricityRatePerUnit?: number;
  taxPercent?: number;
  optionalCharges: { id: string; label: string; amount?: number; note?: string }[];
  otherServices: string[];
}

export interface PropertyPhoto {
  id: string;
  url: string;
  originalUrl?: string;
  enhanced?: boolean;
  category: PhotoCategory;
  qualityScore: number;
  aiAnalysis?: {
    sharpness: boolean;
    lighting: boolean;
    visibility: boolean;
    composition: boolean;
    recommendation?: string;
  };
  uploadDate: string;
}

export interface OwnerListingStep4 {
  photos: PropertyPhoto[];
}

export interface OwnerListingStep5 {
  checkInTime: string;
  curfewTime: string;
  smokingAllowed: boolean;
  alcoholAllowed: boolean;
  visitorsAllowed: 'Allowed' | 'Restricted' | 'Not Allowed';
  petsAllowed: boolean;
  cookingAllowed: boolean;
  additionalRules: string;
  minimumStay: string;
  noticePeriod: string;
}

export interface OwnerListingStep6 {
  fullName: string;
  mobileNumber: string;
  whatsappNumber?: string;
  emailAddress: string;
  role: 'Property Owner' | 'Authorized Manager' | 'Property Operator';
  preferredContact: 'Phone' | 'WhatsApp' | 'Email';
}

export interface VerificationDocument {
  id: string;
  documentType: 'Aadhaar' | 'PAN' | 'Passport' | 'Other' | 'Ownership Proof' | 'Property Document';
  documentUrl: string;
  uploadDate: string;
  status: VerificationStatus;
}

export interface OwnerListingStep7 {
  governmentId: VerificationDocument;
  ownershipProof: VerificationDocument;
  propertyDocuments: VerificationDocument[];
  verificationStatus: VerificationStatus;
}

export interface ListingQualityScore {
  overall: number;
  details: {
    propertyDetails: number;
    photos: number;
    amenities: number;
    pricing: number;
    location: number;
  };
  missingItems: string[];
}

export interface OwnerListingStep8 {
  qualityScore: ListingQualityScore;
  previewData: any; // This will be the complete listing data
}

export interface OwnerListingData {
  step1: OwnerListingStep1;
  step2: OwnerListingStep2;
  step3: OwnerListingStep3;
  step4: OwnerListingStep4;
  step5: OwnerListingStep5;
  step6: OwnerListingStep6;
  step7: OwnerListingStep7;
  step8: OwnerListingStep8;
  currentStep: number;
  listingStatus: ListingStatus;
  listingId?: string;
  createdAt: string;
  updatedAt: string;
}
