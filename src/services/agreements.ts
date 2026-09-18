import { apiUrl as sharedApiUrl } from './apiBase';
import { RentAgreement } from '../types';
import { getAuthToken, isProductionApiEnabled } from './productionApi';

const apiUrl = (path: string) => sharedApiUrl(path);

function authHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * The resident's own agreements, straight from the server. Used for the
 * dashboard poll so a signature sent by the owner appears without a reload
 * even if the debounced snapshot sync has not fired.
 */
export async function fetchMyAgreements(): Promise<RentAgreement[]> {
  if (!isProductionApiEnabled()) return [];
  const token = getAuthToken();
  if (!token) return [];
  try {
    const response = await fetch(apiUrl('/api/agreements/mine'), { headers: authHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.agreements) ? data.agreements : [];
  } catch {
    return [];
  }
}

/**
 * Sign the caller's own agreement server-side. The endpoint enforces
 * ownership from the JWT, so this returns ok only when the signature is
 * genuinely durable — the caller can flip state confidently.
 */
export async function signMyAgreement(agreementId: string): Promise<{ ok: boolean; status?: string }> {
  if (!isProductionApiEnabled()) return { ok: false };
  const token = getAuthToken();
  if (!token) return { ok: false };
  try {
    const response = await fetch(apiUrl('/api/agreements/mine/sign'), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ id: agreementId }),
    });
    if (!response.ok) return { ok: false };
    const data = await response.json();
    return { ok: Boolean(data?.success), status: data?.status };
  } catch {
    return { ok: false };
  }
}
