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

const configuredBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const apiBaseUrl = configuredBase;

export const isProductionApiEnabled = () => import.meta.env.PROD || Boolean(configuredBase);

const apiUrl = (path: string) => `${apiBaseUrl}${path}`;

const headers = (role: UserRole, organizationId = DEFAULT_ORGANIZATION_ID) => {
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-organization-id': organizationId,
  };

  const token = localStorage.getItem('pgwalo_jwt_token');
  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  } else if (!import.meta.env.PROD) {
    requestHeaders['x-user-role'] = role;
    requestHeaders['x-user-id'] = `user-${role}`;
  }

  return requestHeaders;
};

export const loadProductionSnapshot = async (
  role: UserRole,
  organizationId = DEFAULT_ORGANIZATION_ID
): Promise<Partial<ProductionSnapshot> | null> => {
  if (!isProductionApiEnabled()) return null;
  const response = await fetch(apiUrl('/api/bootstrap'), {
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
  if (!isProductionApiEnabled() || !['owner', 'admin'].includes(role)) return;
  const response = await fetch(apiUrl('/api/bootstrap'), {
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
  if (!isProductionApiEnabled()) return [];

  const params = new URLSearchParams();
  if (criteria.location) params.set('location', criteria.location);
  if (criteria.city && criteria.city !== 'All') params.set('city', criteria.city);
  if (criteria.type && criteria.type !== 'All') params.set('type', criteria.type);
  if (criteria.moveInDate) params.set('moveInDate', criteria.moveInDate);
  if (criteria.roomType && criteria.roomType !== 'All') params.set('roomType', criteria.roomType);
  if (criteria.maxPrice) params.set('maxPrice', String(criteria.maxPrice));
  criteria.amenities?.forEach((amenity) => params.append('amenity', amenity));

  const response = await fetch(apiUrl(`/api/properties?${params.toString()}`), {
    headers: headers(role, organizationId),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

export const uploadMedia = async (
  file: File,
  category: string = 'general',
  role: UserRole = 'public',
  organizationId = DEFAULT_ORGANIZATION_ID
) => {
  if (!isProductionApiEnabled()) throw new Error('API not available in demo mode');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);

  const requestHeaders: Record<string, string> = {
    'x-organization-id': organizationId,
  };
  const token = getAuthToken();
  if (token) requestHeaders.Authorization = `Bearer ${token}`;

  const response = await fetch(apiUrl('/api/media/upload'), {
    method: 'POST',
    headers: requestHeaders,
    body: formData,
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

export const getMediaUrl = (filename: string) => {
  if (!filename.startsWith('/')) return apiUrl(`/api/media/${filename}`);
  return apiUrl(filename);
};

export const setAuthToken = (token: string) => {
  localStorage.setItem('pgwalo_jwt_token', token);
};

export const getAuthToken = () => localStorage.getItem('pgwalo_jwt_token');

export const clearAuthToken = () => {
  localStorage.removeItem('pgwalo_jwt_token');
};
