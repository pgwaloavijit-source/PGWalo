import { BookingRequest, UserAccount } from '../types';

export function requestsForUser(requests: BookingRequest[], user?: UserAccount | null): BookingRequest[] {
  if (!user) return [];
  const email = user.email?.toLowerCase();
  const phone = user.phone?.replace(/\D/g, '');
  return requests.filter((r) => {
    const rEmail = r.email?.toLowerCase();
    const rPhone = r.phone?.replace(/\D/g, '');
    return (
      (rEmail && email && rEmail === email) ||
      (rPhone && phone && rPhone.slice(-10) === phone.slice(-10))
    );
  });
}

export function visitedPropertyIds(requests: BookingRequest[], user?: UserAccount | null): Set<string> {
  return new Set(
    requestsForUser(requests, user)
      .filter((r) => (r.type === 'visit' || Boolean(r.visitDate)) && r.status !== 'Cancelled' && r.type !== 'booking')
      .map((r) => r.propertyId)
      .filter(Boolean)
  );
}

export function isActiveStayBooking(request: BookingRequest): boolean {
  if (request.type === 'visit') return false;
  return request.status === 'Pending' || request.status === 'Approved';
}

export function bookedPropertyIds(requests: BookingRequest[], user?: UserAccount | null): Set<string> {
  return new Set(
    requestsForUser(requests, user)
      .filter(isActiveStayBooking)
      .map((r) => r.propertyId)
      .filter(Boolean)
  );
}

export function activeBookingForProperty(
  requests: BookingRequest[],
  user: UserAccount | null | undefined,
  propertyId: string
): BookingRequest | undefined {
  return requestsForUser(requests, user).find(
    (r) => r.propertyId === propertyId && isActiveStayBooking(r)
  );
}
