import {
  Adjustment,
  AuditLogEntry,
  Bed,
  BedStatus,
  Checkout,
  DepositTransaction,
  Invoice,
  InvoiceLine,
  InvoiceStatus,
  Notice,
  Payment,
  PaymentAllocation,
  PaymentStatus,
  PermissionKey,
  Property,
  RentPlan,
  Resident,
  ResidentStatus,
  RolePermissions,
  Stay,
  UserAccount,
  UserRole,
} from '../types';

export const DEFAULT_ORGANIZATION_ID = 'org-demo-pgwalo';

const BED_STATUS_ALIASES: Record<string, BedStatus> = {
  Available: 'Vacant',
  Ready: 'Vacant',
  Cleaning: 'Maintenance',
  Vacating: 'Notice Period',
  'Booking Pending': 'Reserved',
};

export const canonicalBedStatus = (status: BedStatus): BedStatus =>
  BED_STATUS_ALIASES[status] || status;

export const canBedBeAssigned = (bed: Bed, residentId?: string): boolean => {
  const status = canonicalBedStatus(bed.status);
  return (
    status === 'Vacant' ||
    (status === 'Reserved' &&
      Boolean(residentId) &&
      (bed.reservedForResidentId === residentId || bed.currentTenantId === residentId))
  );
};

export const assertOrganizationAccess = (
  user: UserAccount | null,
  organizationId: string,
  action: string
) => {
  const userOrgId = user?.organizationId || DEFAULT_ORGANIZATION_ID;
  if (user && user.role !== 'admin' && userOrgId !== organizationId) {
    throw new Error(`Access denied for ${action}: organization mismatch.`);
  }
};

const LEGACY_PERMISSION_MAP: Record<PermissionKey, (legacy: RolePermissions) => boolean> = {
  'resident.view': (p) => p.tenants.view,
  'resident.create': (p) => p.tenants.create,
  'resident.edit': (p) => p.tenants.edit,
  'resident.move': (p) => p.tenants.move,
  'resident.checkout': (p) => p.tenants.vacate,
  'room.view': (p) => p.rooms.view,
  'room.assign': (p) => p.rooms.allocateBed,
  'room.transfer': (p) => p.rooms.allocateBed && p.tenants.move,
  'invoice.view': (p) => p.rent.view,
  'invoice.create': (p) => p.rent.generate,
  'invoice.adjust': (p) => p.rent.generate,
  'payment.view': (p) => p.rent.view,
  'payment.record': (p) => p.rent.collect,
  'payment.verify': (p) => p.rent.verify,
  'payment.refund': (p) => p.rent.refund,
  'deposit.view': (p) => p.rent.view,
  'deposit.deduct': (p) => p.rent.refund,
  'deposit.refund': (p) => p.rent.refund,
  'complaint.view': (p) => p.maintenance.create || p.maintenance.update || p.maintenance.resolve,
  'complaint.assign': (p) => p.maintenance.assign,
  'complaint.resolve': (p) => p.maintenance.resolve,
  'report.view': (p) => p.reports.view,
  'report.export': (p) => p.reports.export,
  'staff.view': (p) => p.property.view,
  'staff.create': (p) => p.property.edit,
  'staff.edit': (p) => p.property.edit,
  'staff.permission_manage': (p) => p.property.delete,
  'audit.view': (p) => p.reports.view,
};

export const hasPermission = (
  role: UserRole,
  permissions: Record<string, RolePermissions>,
  permission: PermissionKey
) => {
  if (role === 'admin') return true;
  const legacy = permissions[role];
  return legacy ? LEGACY_PERMISSION_MAP[permission](legacy) : false;
};

export const buildAuditEntry = (
  params: {
    user: UserAccount | null;
    role: UserRole;
    action: string;
    entityType: string;
    entityId?: string;
    previousValue?: unknown;
    newValue?: unknown;
    propertyId?: string;
    reason?: string;
  }
): AuditLogEntry => ({
  id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  userId: params.user?.id || 'system',
  userName: params.user?.name || 'System',
  userRole: params.user?.role || params.role,
  action: params.action,
  entity: params.entityType,
  entityId: params.entityId,
  timestamp: new Date().toISOString(),
  details: JSON.stringify({
    previousValue: params.previousValue ?? null,
    newValue: params.newValue ?? null,
    propertyId: params.propertyId ?? null,
    reason: params.reason ?? null,
  }),
});

export const deriveInitialStays = (residents: Resident[], beds: Bed[]): Stay[] =>
  residents
    .filter((resident) => resident.roomNumber && resident.bedNumber)
    .map((resident) => {
      const bed = beds.find(
        (item) =>
          item.propertyId === resident.propertyId &&
          (item.id === resident.bedNumber ||
            item.bedNumber === resident.bedNumber ||
            item.bedNumber.endsWith(resident.bedNumber.replace(/^Bed\s*/i, '')))
      );
      return {
        id: `stay-${resident.id}`,
        organizationId: resident.organizationId || DEFAULT_ORGANIZATION_ID,
        residentId: resident.id,
        propertyId: resident.propertyId,
        roomId: bed?.roomId,
        roomNumber: resident.roomNumber,
        bedId: bed?.id || `${resident.propertyId}-${resident.roomNumber}-${resident.bedNumber}`,
        bedNumber: bed?.bedNumber || resident.bedNumber,
        startDate: resident.moveInDate,
        monthlyRentAtStart: resident.monthlyRent,
        status: (resident.status === 'Checked Out' || resident.status === 'Archived' ? 'Closed' : 'Current') as Stay['status'],
      };
    });

export const deriveInitialRentPlans = (residents: Resident[], properties: Property[]): RentPlan[] =>
  residents.map((resident) => {
    const property = properties.find((item) => item.id === resident.propertyId);
    return {
      id: `rent-plan-${resident.id}`,
      organizationId: resident.organizationId || DEFAULT_ORGANIZATION_ID,
      residentId: resident.id,
      propertyId: resident.propertyId,
      monthlyRent: resident.monthlyRent,
      dueDay: property?.defaultRentDueDay || 7,
      effectiveFrom: resident.moveInDate,
      status: 'Active',
    };
  });

export const buildMonthlyInvoice = (
  resident: Resident,
  rentPlan: RentPlan,
  monthDate: Date,
  existingInvoices: Invoice[]
): Invoice | null => {
  const month = monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const duplicate = existingInvoices.some(
    (invoice) =>
      invoice.residentId === resident.id &&
      invoice.month === month &&
      invoice.status !== 'Cancelled'
  );
  if (duplicate) return null;

  const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), rentPlan.dueDay);
  const lines: InvoiceLine[] = [
    {
      id: `line-rent-${Date.now()}`,
      description: `${month} Rent`,
      amount: rentPlan.monthlyRent,
      type: 'Rent',
    },
  ];

  if ((resident.previousDues || 0) > 0) {
    lines.push({
      id: `line-prev-${Date.now()}`,
      description: 'Previous Dues',
      amount: resident.previousDues || 0,
      type: 'Previous Due',
    });
  }

  const amount = lines.reduce((sum, line) => sum + line.amount, 0);
  const today = new Date();
  const status: InvoiceStatus = today > dueDate ? 'Overdue' : 'Due';

  return {
    id: `inv-${resident.id}-${monthDate.getFullYear()}-${monthDate.getMonth() + 1}`,
    organizationId: resident.organizationId || DEFAULT_ORGANIZATION_ID,
    residentId: resident.id,
    propertyId: resident.propertyId,
    month,
    dueDate: dueDate.toISOString().split('T')[0],
    lines,
    amount,
    verifiedPaidAmount: 0,
    status,
    createdAt: new Date().toISOString(),
  };
};

export const outstandingForInvoice = (invoice: Invoice) =>
  Math.max(0, invoice.amount - invoice.verifiedPaidAmount);

export const summarizeResidentLedger = (
  residentId: string,
  invoices: Invoice[],
  allocations: PaymentAllocation[]
) => {
  const residentInvoices = invoices.filter(
    (invoice) => invoice.residentId === residentId && invoice.status !== 'Cancelled' && invoice.status !== 'Waived'
  );
  const outstanding = residentInvoices.reduce((sum, invoice) => sum + outstandingForInvoice(invoice), 0);
  const advance = allocations
    .filter((allocation) => allocation.residentId === residentId && allocation.allocatedTo === 'Advance')
    .reduce((sum, allocation) => sum + allocation.amount, 0);
  return { outstanding, advance };
};

export const allocateVerifiedPayment = (
  payment: Payment,
  invoices: Invoice[],
  existingAllocations: PaymentAllocation[]
) => {
  if (payment.status !== 'Verified') {
    return { invoices, allocations: existingAllocations };
  }

  let remaining = payment.amount;
  const allocations: PaymentAllocation[] = [];
  const nextInvoices = invoices.map((invoice) => {
    if (invoice.residentId !== payment.residentId || remaining <= 0 || invoice.status === 'Paid') {
      return invoice;
    }
    const applyAmount = Math.min(outstandingForInvoice(invoice), remaining);
    if (applyAmount <= 0) return invoice;
    remaining -= applyAmount;
    allocations.push({
      id: `alloc-${payment.id}-${invoice.id}`,
      organizationId: payment.organizationId,
      paymentId: payment.id,
      invoiceId: invoice.id,
      residentId: payment.residentId,
      amount: applyAmount,
      allocatedTo: 'Invoice',
      createdAt: new Date().toISOString(),
    });
    const verifiedPaidAmount = invoice.verifiedPaidAmount + applyAmount;
    const status: InvoiceStatus =
      verifiedPaidAmount >= invoice.amount ? 'Paid' : verifiedPaidAmount > 0 ? 'Partially Paid' : invoice.status;
    return { ...invoice, verifiedPaidAmount, status };
  });

  if (remaining > 0) {
    allocations.push({
      id: `alloc-${payment.id}-advance`,
      organizationId: payment.organizationId,
      paymentId: payment.id,
      residentId: payment.residentId,
      amount: remaining,
      allocatedTo: 'Advance',
      createdAt: new Date().toISOString(),
    });
  }

  return { invoices: nextInvoices, allocations: [...existingAllocations, ...allocations] };
};

export const calculateNoticeDates = (
  submittedAt: Date,
  requestedCheckoutDate: string,
  noticePeriodDays: number
) => {
  const earliest = new Date(submittedAt);
  earliest.setDate(earliest.getDate() + noticePeriodDays);
  const requested = new Date(requestedCheckoutDate);
  return {
    contractualEarliestCheckoutDate: earliest.toISOString().split('T')[0],
    approvedCheckoutDate:
      requested >= earliest ? requestedCheckoutDate : earliest.toISOString().split('T')[0],
  };
};

export const calculateCheckoutSettlement = (params: {
  resident: Resident;
  invoices: Invoice[];
  depositTransactions: DepositTransaction[];
  electricityCharges?: number;
  foodCharges?: number;
  damageCharges?: number;
  otherDeductions?: number;
}) => {
  const rentPending = summarizeResidentLedger(params.resident.id, params.invoices, []).outstanding;
  const depositHeld = params.depositTransactions
    .filter(
      (txn) =>
        txn.residentId === params.resident.id &&
        (txn.type === 'Deposit Received' || txn.type === 'Additional Deposit' || txn.type === 'Deposit Adjustment')
    )
    .reduce((sum, txn) => sum + txn.amount, 0);
  const deductions =
    rentPending +
    (params.electricityCharges || 0) +
    (params.foodCharges || 0) +
    (params.damageCharges || 0) +
    (params.otherDeductions || 0);
  return {
    rentPending,
    depositHeld,
    refundAmount: Math.max(0, depositHeld - deductions),
  };
};

export const makePayment = (params: {
  resident: Resident;
  amount: number;
  method: string;
  status?: PaymentStatus;
  transactionReference?: string;
}): Payment => ({
  id: `pay-${Date.now()}`,
  organizationId: params.resident.organizationId || DEFAULT_ORGANIZATION_ID,
  residentId: params.resident.id,
  propertyId: params.resident.propertyId,
  amount: params.amount,
  method: params.method,
  status: params.status || 'Pending Verification',
  submittedAt: new Date().toISOString(),
  transactionReference: params.transactionReference || `PGN-${Date.now().toString().slice(-8)}`,
});

export const makeNotice = (params: {
  resident: Resident;
  requestedCheckoutDate: string;
  reason: string;
  comments?: string;
}): Notice => {
  const submittedAt = new Date();
  const dates = calculateNoticeDates(
    submittedAt,
    params.requestedCheckoutDate,
    params.resident.noticePeriodDays || 30
  );
  return {
    id: `notice-${Date.now()}`,
    organizationId: params.resident.organizationId || DEFAULT_ORGANIZATION_ID,
    residentId: params.resident.id,
    propertyId: params.resident.propertyId,
    submittedAt: submittedAt.toISOString(),
    requestedCheckoutDate: params.requestedCheckoutDate,
    contractualEarliestCheckoutDate: dates.contractualEarliestCheckoutDate,
    approvedCheckoutDate: dates.approvedCheckoutDate,
    reason: params.reason,
    comments: params.comments,
    status: 'Submitted',
  };
};

export const makeCheckout = (params: {
  resident: Resident;
  bedId: string;
  invoices: Invoice[];
  depositTransactions: DepositTransaction[];
  electricityCharges?: number;
  foodCharges?: number;
  damageCharges?: number;
  otherDeductions?: number;
}): Checkout => {
  const settlement = calculateCheckoutSettlement(params);
  return {
    id: `checkout-${Date.now()}`,
    organizationId: params.resident.organizationId || DEFAULT_ORGANIZATION_ID,
    residentId: params.resident.id,
    propertyId: params.resident.propertyId,
    bedId: params.bedId,
    status: 'Pending',
    startedAt: new Date().toISOString(),
    rentPending: settlement.rentPending,
    electricityCharges: params.electricityCharges || 0,
    foodCharges: params.foodCharges || 0,
    damageCharges: params.damageCharges || 0,
    otherDeductions: params.otherDeductions || 0,
    depositHeld: settlement.depositHeld,
    refundAmount: settlement.refundAmount,
    checklist: {
      keysReturned: false,
      bedInspected: false,
      furnitureInspected: false,
      accessCardReturned: false,
      roomCleared: false,
    },
  };
};

export const applyResidentStatus = (resident: Resident, status: ResidentStatus): Resident => ({
  ...resident,
  status,
});

export const adjustmentRequiresReason = (adjustment: Pick<Adjustment, 'reason'>) =>
  adjustment.reason.trim().length > 0;
