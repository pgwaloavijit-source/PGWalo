import { Property, UserAccount, Resident, BookingRequest, StaffMember, Bed, Lead, Agreement, Invoice, AttendanceRecord, MaintenanceTicket } from '../types';
import { useApp } from '../context/AppContext';

export const CATALOG_OWNER_ID = 'catalog-seed';

export function ownsProperty(property: Property, user?: UserAccount | null): boolean {
  if (!user) return false;
  if (user.isDemo) {
    return property.ownerUserId === CATALOG_OWNER_ID || property.id.startsWith('demo-') || property.ownerUserId === user.id;
  }
  if (property.ownerUserId && property.ownerUserId === user.id) return true;
  const email = user.email?.trim().toLowerCase();
  if (email && property.contactEmail?.trim().toLowerCase() === email) return true;
  return false;
}

export function useOwnerScope() {
  const {
    currentUser,
    properties,
    residents,
    bookingRequests,
    staff,
    beds,
    leads,
    agreements,
    invoices,
    attendance,
    tickets,
  } = useApp();

  const ownerProperties = properties.filter((p) => ownsProperty(p, currentUser));
  const ids = new Set(ownerProperties.map((p) => p.id));
  const inScope = (propertyId?: string) => Boolean(propertyId && ids.has(propertyId));
  const ownerResidents = residents.filter((r: Resident) => inScope(r.propertyId));
  const residentNames = new Set(ownerResidents.map((r) => r.name));
  const ownerStaff = staff.filter((s: StaffMember) => {
    if (currentUser?.id && s.ownerUserId === currentUser.id) return true;
    return inScope(s.propertyId);
  });
  const staffNames = new Set(ownerStaff.map((s) => s.name));

  return {
    currentUser,
    hasListings: ownerProperties.length > 0,
    properties: ownerProperties,
    residents: ownerResidents,
    bookingRequests: bookingRequests.filter((b: BookingRequest) => inScope(b.propertyId)),
    staff: ownerStaff,
    beds: beds.filter((b: Bed) => inScope(b.propertyId)),
    leads: leads.filter((l: Lead) => inScope(l.propertyId)),
    agreements: agreements.filter((a: Agreement) => inScope(a.propertyId)),
    invoices: invoices.filter((i: Invoice) => inScope(i.propertyId)),
    attendance: attendance.filter(
      (a: AttendanceRecord) => residentNames.has(a.personName) || staffNames.has(a.personName)
    ),
    tickets: tickets.filter((t: MaintenanceTicket) => residentNames.has(t.residentName)),
    propertyIds: ids,
  };
}
