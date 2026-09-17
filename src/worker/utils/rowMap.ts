// D1 rows are snake_case; the client store is camelCase. The bootstrap
// endpoint previously shipped raw rows, so every dashboard that read
// `resident.monthlyRent`, `bed.roomNumber`, `payment.submittedAt` etc. got
// `undefined` — this is the root cause of "data not flowing" reports.

type Row = Record<string, unknown>;

// Credential material must never be serialized to a client — not even to a
// platform admin. Bootstrap reads whole rows (`SELECT *`), so strip it here.
const SENSITIVE_COLUMNS = ['password_hash', 'aadhaar_hash'];

export function sanitizeRow<T extends Row>(row: T): T {
  let copy: Row | null = null;
  for (const column of SENSITIVE_COLUMNS) {
    if (column in row) {
      copy = copy || { ...row };
      delete copy[column];
    }
  }
  return (copy as T) || row;
}

const num = (v: unknown, fallback = 0) => (v === null || v === undefined ? fallback : Number(v) || fallback);
const str = (v: unknown, fallback = '') => (v === null || v === undefined ? fallback : String(v));

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function rowToResident(row: Row) {
  return {
    id: str(row.id),
    organizationId: str(row.organization_id, ''),
    status: row.status || 'Active',
    currentStayId: row.current_stay_id ? str(row.current_stay_id) : undefined,
    name: str(row.name),
    email: str(row.email),
    phone: str(row.phone),
    avatar: str(row.avatar),
    propertyId: str(row.property_id),
    propertyName: str(row.property_name),
    roomNumber: str(row.room_number),
    roomType: str(row.room_type, 'Double'),
    bedNumber: str(row.bed_number),
    monthlyRent: num(row.monthly_rent),
    depositAmount: num(row.deposit_amount),
    moveInDate: str(row.move_in_date),
    rentStatus: str(row.rent_status, 'Pending'),
    rentDueDate: str(row.rent_due_date),
    lastPaymentDate: row.last_payment_date ? str(row.last_payment_date) : undefined,
    emergencyContact: str(row.emergency_contact),
    kycVerified: Boolean(row.kyc_verified),
    depositState: str(row.deposit_state, 'Held'),
    agreementState: str(row.agreement_state, 'Pending'),
    previousDues: num(row.previous_dues),
    advanceBalance: num(row.advance_balance),
    outstandingBalance: num(row.outstanding_balance),
    notes: row.notes ? str(row.notes) : undefined,
    noticePeriodDays: num(row.notice_period_days, 30),
  };
}

export function rowToBed(row: Row) {
  return {
    id: str(row.id),
    organizationId: str(row.organization_id, ''),
    bedNumber: str(row.bed_number),
    roomId: row.room_id ? str(row.room_id) : undefined,
    roomNumber: str(row.room_number),
    propertyId: str(row.property_id),
    floor: row.floor !== null && row.floor !== undefined ? String(row.floor) : undefined,
    tower: row.tower ? str(row.tower) : undefined,
    building: row.building ? str(row.building) : undefined,
    sharingType: str(row.sharing_type, 'Single'),
    status: row.status || 'Vacant',
    currentTenantId: row.current_tenant_id ? str(row.current_tenant_id) : undefined,
    currentTenantName: row.current_tenant_name ? str(row.current_tenant_name) : undefined,
    reservedForResidentId: row.reserved_for_resident_id ? str(row.reserved_for_resident_id) : undefined,
    reservationExpiry: row.reservation_expiry ? str(row.reservation_expiry) : undefined,
    monthlyRent: num(row.monthly_rent),
    deposit: num(row.deposit),
    nextAvailableDate: row.next_available_date ? str(row.next_available_date) : undefined,
  };
}

export function rowToStay(row: Row) {
  return {
    id: str(row.id),
    organizationId: str(row.organization_id, ''),
    residentId: str(row.resident_id),
    propertyId: str(row.property_id),
    roomId: row.room_id ? str(row.room_id) : undefined,
    roomNumber: row.room_number ? str(row.room_number) : undefined,
    bedId: row.bed_id ? str(row.bed_id) : undefined,
    bedNumber: row.bed_number ? str(row.bed_number) : undefined,
    startDate: str(row.start_date),
    endDate: row.end_date ? str(row.end_date) : undefined,
    monthlyRentAtStart: row.monthly_rent_at_start != null ? num(row.monthly_rent_at_start) : undefined,
    status: row.status || 'Current',
  };
}
export function rowToCheck(row: Row) { return row; }

export function rowToRentPlan(row: Row) {
  return {
    id: str(row.id),
    organizationId: str(row.organization_id, ''),
    residentId: str(row.resident_id),
    propertyId: str(row.property_id),
    monthlyRent: num(row.monthly_rent),
    dueDay: num(row.due_day, 7),
    effectiveFrom: str(row.effective_from),
    status: row.status || 'Active',
  };
}

export function rowToInvoice(row: Row) {
  const lines = parseJson<unknown[]>(row.lines, []);
  return {
    id: str(row.id),
    organizationId: str(row.organization_id, ''),
    residentId: str(row.resident_id),
    propertyId: str(row.property_id),
    month: str(row.month),
    dueDate: str(row.due_date),
    lines: Array.isArray(lines) ? lines : [],
    amount: num(row.amount),
    verifiedPaidAmount: num(row.verified_paid_amount),
    status: row.status || 'Due',
    createdAt: str(row.created_at),
    cancelledAt: row.cancelled_at ? str(row.cancelled_at) : undefined,
  };
}

export function rowToPayment(row: Row) {
  return {
    id: str(row.id),
    organizationId: str(row.organization_id, ''),
    residentId: str(row.resident_id),
    propertyId: str(row.property_id),
    amount: num(row.amount),
    method: str(row.method),
    status: row.status || 'Pending',
    submittedAt: str(row.submitted_at),
    verifiedAt: row.verified_at ? str(row.verified_at) : undefined,
    transactionReference: str(row.transaction_reference),
    notes: row.notes ? str(row.notes) : undefined,
  };
}

export function rowToAllocation(row: Row) {
  return {
    id: str(row.id),
    organizationId: str(row.organization_id, ''),
    paymentId: str(row.payment_id),
    invoiceId: row.invoice_id ? str(row.invoice_id) : undefined,
    residentId: str(row.resident_id),
    amount: num(row.amount),
    allocatedTo: row.allocated_to || 'Invoice',
    createdAt: str(row.created_at),
  };
}

export function rowToDepositTxn(row: Row) {
  return {
    id: str(row.id),
    organizationId: str(row.organization_id, ''),
    residentId: str(row.resident_id),
    propertyId: str(row.property_id),
    type: str(row.type, 'Deposit Received'),
    amount: num(row.amount),
    reason: str(row.reason),
    createdBy: str(row.created_by),
    createdAt: str(row.created_at),
    evidenceUrl: row.evidence_url ? str(row.evidence_url) : undefined,
    transactionReference: row.transaction_reference ? str(row.transaction_reference) : undefined,
  };
}

export function rowToNotice(row: Row) {
  return {
    id: str(row.id),
    organizationId: str(row.organization_id, ''),
    residentId: str(row.resident_id),
    propertyId: str(row.property_id),
    submittedAt: str(row.submitted_at),
    requestedCheckoutDate: str(row.requested_checkout_date),
    contractualEarliestCheckoutDate: str(row.contractual_earliest_checkout_date),
    approvedCheckoutDate: str(row.approved_checkout_date),
    reason: str(row.reason),
    comments: row.comments ? str(row.comments) : undefined,
    status: row.status || 'Submitted',
  };
}

export function rowToCheckout(row: Row) {
  return {
    id: str(row.id),
    organizationId: str(row.organization_id, ''),
    residentId: str(row.resident_id),
    propertyId: str(row.property_id),
    bedId: str(row.bed_id),
    status: row.status || 'Pending',
    startedAt: str(row.started_at),
    rentPending: num(row.rent_pending),
    electricityCharges: num(row.electricity_charges),
    foodCharges: num(row.food_charges),
    damageCharges: num(row.damage_charges),
    otherDeductions: num(row.other_deductions),
    depositHeld: num(row.deposit_held),
    refundAmount: num(row.refund_amount),
    checklist: parseJson(row.checklist, {
      keysReturned: false,
      bedInspected: false,
      furnitureInspected: false,
      accessCardReturned: false,
      roomCleared: false,
    }),
  };
}

export function rowToAuditLog(row: Row) {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    userName: str(row.user_name),
    userRole: row.user_role || 'system',
    action: str(row.action),
    entity: str(row.entity),
    entityId: row.entity_id ? str(row.entity_id) : undefined,
    timestamp: str(row.timestamp),
    details: str(row.details),
  };
}

export function rowToBookingRequest(row: Row) {
  return {
    id: str(row.id),
    organizationId: str(row.organization_id, ''),
    residentStatus: row.resident_status ? str(row.resident_status) : undefined,
    reservedBedId: row.reserved_bed_id ? str(row.reserved_bed_id) : undefined,
    reservationExpiry: row.reservation_expiry ? str(row.reservation_expiry) : undefined,
    tokenAmount: row.token_amount != null ? num(row.token_amount) : undefined,
    applicantName: str(row.applicant_name),
    email: str(row.email),
    phone: str(row.phone),
    propertyId: str(row.property_id),
    propertyName: str(row.property_name),
    roomType: str(row.room_type, 'Double'),
    preferredMoveInDate: str(row.preferred_move_in_date),
    occupancyType: str(row.occupancy_type, 'Working Professional'),
    status: row.status || 'Pending',
    requestDate: str(row.request_date),
    message: str(row.message),
    type: row.type || 'booking',
    visitDate: str(row.visit_date),
    visitTimeSlot: str(row.visit_time_slot),
    referenceId: str(row.reference_id),
    allocatedRoomNumber: str(row.allocated_room_number),
    allocatedBedNumber: str(row.allocated_bed_number),
  };
}

export function rowToSupportTicket(row: Row) {
  const messages = parseJson<unknown[]>(row.messages, []);
  return {
    id: str(row.id),
    organizationId: row.organization_id ? str(row.organization_id) : undefined,
    requesterId: str(row.requester_id),
    requesterName: str(row.requester_name),
    requesterRole: row.requester_role || 'public',
    type: str(row.type, 'General'),
    title: str(row.title),
    description: str(row.description),
    imageUrl: row.image_url ? str(row.image_url) : undefined,
    status: row.status || 'Raised',
    adminNote: row.admin_note ? str(row.admin_note) : undefined,
    assignedTo: row.assigned_to ? str(row.assigned_to) : undefined,
    propertyId: row.property_id ? str(row.property_id) : undefined,
    bookingId: row.booking_id ? str(row.booking_id) : undefined,
    messages: Array.isArray(messages) ? messages : [],
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

export function rowToAgreement(row: Row) {
  const rulesSummary = parseJson<unknown[]>(row.rules_summary, []);
  return {
    id: str(row.id),
    agreementNumber: str(row.agreement_number),
    residentId: str(row.resident_id),
    residentName: str(row.resident_name),
    parentGuardianName: row.parent_guardian_name ? str(row.parent_guardian_name) : undefined,
    tenantDOB: str(row.tenant_dob),
    tenantPermanentAddress: str(row.tenant_permanent_address),
    tenantCurrentAddress: str(row.tenant_current_address),
    tenantCollegeOrOffice: str(row.tenant_college_or_office),
    tenantIdDocumentType: str(row.tenant_id_document_type, 'Aadhaar'),
    tenantIdDocumentMasked: str(row.tenant_id_document_masked),
    propertyId: str(row.property_id),
    propertyName: str(row.property_name),
    propertyAddress: str(row.property_address),
    ownerName: str(row.owner_name),
    ownerPhone: str(row.owner_phone),
    roomNumber: str(row.room_number),
    bedNumber: str(row.bed_number),
    monthlyRent: num(row.monthly_rent),
    securityDeposit: num(row.security_deposit),
    electricityTerms: str(row.electricity_terms),
    noticePeriodDays: num(row.notice_period_days, 30),
    startDate: str(row.start_date),
    endDate: str(row.end_date),
    rulesSummary: Array.isArray(rulesSummary) ? rulesSummary.map(String) : [],
    emergencyContactName: str(row.emergency_contact_name),
    emergencyContactPhone: str(row.emergency_contact_phone),
    status: row.status || 'Draft',
    ownerSigned: Boolean(row.owner_signed),
    tenantSigned: Boolean(row.tenant_signed),
    signedDate: row.signed_date ? str(row.signed_date) : undefined,
    createdAt: str(row.created_at),
  };
}

export function rowToMaintenanceTicket(row: Row) {
  return {
    id: str(row.id),
    title: str(row.title),
    category: str(row.category, 'Other'),
    roomNumber: str(row.room_number),
    residentName: str(row.resident_name),
    description: str(row.description),
    priority: str(row.priority, 'Normal'),
    status: row.status || 'Reported',
    createdAt: str(row.created_at),
    updatedAt: row.updated_at ? str(row.updated_at) : undefined,
    assignedStaffName: row.assigned_staff_name ? str(row.assigned_staff_name) : undefined,
    slaDeadline: row.sla_deadline ? str(row.sla_deadline) : undefined,
    photoUrl: row.photo_url ? str(row.photo_url) : undefined,
    cost: row.cost === null || row.cost === undefined ? undefined : num(row.cost),
    resolutionNotes: row.resolution_notes ? str(row.resolution_notes) : undefined,
    propertyId: row.property_id ? str(row.property_id) : undefined,
    propertyName: row.property_name ? str(row.property_name) : undefined,
    requesterId: row.requester_id ? str(row.requester_id) : undefined,
    escalatedAt: row.escalated_at ? str(row.escalated_at) : undefined,
  };
}

export function rowToBroadcastNotification(row: Row) {
  return {
    id: str(row.id),
    title: str(row.title),
    message: str(row.message),
    category: str(row.category, 'Event'),
    target: str(row.target, 'All Residents'),
    propertyId: row.property_id ? str(row.property_id) : undefined,
    propertyName: row.property_name ? str(row.property_name) : undefined,
    timestamp: str(row.timestamp),
    sender: str(row.sender),
    read: Boolean(row.read),
    recipientId: row.recipient_id ? str(row.recipient_id) : undefined,
  };
}

export function rowToStaffMember(row: Row) {
  return {
    id: str(row.id),
    ownerUserId: row.owner_user_id ? str(row.owner_user_id) : undefined,
    organizationId: row.organization_id ? str(row.organization_id) : undefined,
    name: str(row.name),
    role: str(row.role, 'Housekeeping'),
    phone: str(row.phone),
    avatar: row.avatar ? str(row.avatar) : '',
    propertyId: str(row.property_id),
    shift: str(row.shift, 'Morning (6 AM - 2 PM)'),
    todayStatus: str(row.today_status, 'Checked-Out'),
    lastClockIn: row.last_clock_in ? str(row.last_clock_in) : undefined,
  };
}

export function rowToAttendanceRecord(row: Row) {
  return {
    id: str(row.id),
    personId: str(row.person_id),
    personName: str(row.person_name),
    personType: str(row.person_type, 'Resident'),
    roomNumber: row.room_number ? str(row.room_number) : undefined,
    role: row.role ? str(row.role) : undefined,
    date: str(row.date),
    timestamp: str(row.timestamp),
    type: str(row.type, 'Present'),
    status: str(row.status, 'On-Time'),
    notes: row.notes ? str(row.notes) : undefined,
  };
}

export function rowToUserAccount(row: Row) {
  return {
    id: str(row.id),
    organizationId: row.organization_id ? str(row.organization_id) : undefined,
    name: str(row.name),
    email: str(row.email),
    phone: str(row.phone),
    role: (row.role || 'public') as import('../../types').UserRole,
    avatar: str(row.avatar),
    city: row.city ? str(row.city) : undefined,
    propertyId: row.property_id ? str(row.property_id) : undefined,
    propertyName: row.property_name ? str(row.property_name) : undefined,
    roomNumber: row.room_number ? str(row.room_number) : undefined,
    staffRole: row.staff_role ? str(row.staff_role) : undefined,
    createdAt: str(row.created_at),
    status: (row.status || 'Active') as 'Active' | 'Suspended' | 'Pending Verification' | 'Disabled',
    isProfileCompleted: Boolean(row.is_profile_completed),
  };
}
