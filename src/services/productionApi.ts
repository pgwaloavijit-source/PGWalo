import {
  AuditLogEntry,
  Bed,
  Checkout,
  DepositTransaction,
  Invoice,
  Notice,
  Organization,
  Payment,
  PaymentAllocation,
  Property,
  PublicSearchCriteria,
  RentPlan,
  Resident,
  Stay,
  UserRole,
} from '../types';
import { DEFAULT_ORGANIZATION_ID } from '../domain/productionWorkflow';

export interface ProductionSnapshot {
  organizations: Organization[];
  properties: Property[];
  residents: Resident[];
  beds: Bed[];
  stays: Stay[];
  rentPlans: RentPlan[];
  invoices: Invoice[];
  payments: Payment[];
  paymentAllocations: PaymentAllocation[];
  depositTransactions: DepositTransaction[];
  notices: Notice[];
  checkouts: Checkout[];
  auditLogs: AuditLogEntry[];
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

const headers = (role: UserRole, organizationId = DEFAULT_ORGANIZATION_ID) => {
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-role': role,
    'x-organization-id': organizationId,
    'x-user-id': `user-${role}`, // Simple user ID generation
  };

  // Add JWT token if available (for enhanced security)
  const token = localStorage.getItem('pgwalo_jwt_token');
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  return requestHeaders;
};

export const isProductionApiEnabled = () => Boolean(apiBaseUrl);

export const loadProductionSnapshot = async (
  role: UserRole,
  organizationId = DEFAULT_ORGANIZATION_ID
): Promise<Partial<ProductionSnapshot> | null> => {
  if (!apiBaseUrl) return null;
  const response = await fetch(`${apiBaseUrl}/api/bootstrap`, {
    headers: headers(role, organizationId),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

export const saveProductionSnapshot = async (
  role: UserRole,
  snapshot: Partial<ProductionSnapshot>,
  organizationId = DEFAULT_ORGANIZATION_ID
) => {
  if (!apiBaseUrl || !['owner', 'admin'].includes(role)) return;
  const response = await fetch(`${apiBaseUrl}/api/bootstrap`, {
    method: 'POST',
    headers: headers(role, organizationId),
    body: JSON.stringify(snapshot),
  });
  if (!response.ok) throw new Error(await response.text());
};

export const searchProperties = async (
  criteria: PublicSearchCriteria & {
    roomType?: string;
    maxPrice?: number;
    amenities?: string[];
  },
  role: UserRole = 'public',
  organizationId = DEFAULT_ORGANIZATION_ID
): Promise<Property[]> => {
  if (!apiBaseUrl) return [];

  const params = new URLSearchParams();
  if (criteria.location) params.set('location', criteria.location);
  if (criteria.city && criteria.city !== 'All') params.set('city', criteria.city);
  if (criteria.type && criteria.type !== 'All') params.set('type', criteria.type);
  if (criteria.moveInDate) params.set('moveInDate', criteria.moveInDate);
  if (criteria.roomType && criteria.roomType !== 'All') params.set('roomType', criteria.roomType);
  if (criteria.maxPrice) params.set('maxPrice', String(criteria.maxPrice));
  criteria.amenities?.forEach((amenity) => params.append('amenity', amenity));

  const response = await fetch(`${apiBaseUrl}/api/properties?${params.toString()}`, {
    headers: headers(role, organizationId),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

// Media upload to R2
export const uploadMedia = async (
  file: File,
  category: string = 'general',
  role: UserRole = 'public',
  organizationId = DEFAULT_ORGANIZATION_ID
) => {
  if (!apiBaseUrl) throw new Error('API base URL not configured');
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);

  const response = await fetch(`${apiBaseUrl}/api/media/upload`, {
    method: 'POST',
    headers: {
      'x-user-role': role,
      'x-organization-id': organizationId,
      'x-user-id': `user-${role}`,
    },
    body: formData,
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

// Get media URL (constructs the URL for accessing media)
export const getMediaUrl = (filename: string) => {
  if (!apiBaseUrl) return filename; // Return as-is if no API URL
  return `${apiBaseUrl}/api/media/${filename}`;
};

// JWT token management for enhanced authentication
export const setAuthToken = (token: string) => {
  localStorage.setItem('pgwalo_jwt_token', token);
};

export const getAuthToken = () => {
  return localStorage.getItem('pgwalo_jwt_token');
};

export const clearAuthToken = () => {
  localStorage.removeItem('pgwalo_jwt_token');
};
