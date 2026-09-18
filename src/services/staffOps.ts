import { apiUrl as sharedApiUrl } from './apiBase';
import { getAuthToken, isProductionApiEnabled } from './productionApi';

const apiUrl = (path: string) => sharedApiUrl(path);

function authHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export interface OpsRunItem {
  id: string;
  label: string;
  section: string;
  mandatory: boolean;
  state: 'Done' | 'Not Done' | 'Not Applicable' | '';
  comment?: string;
  photoUrl?: string;
  updatedAt?: string;
}

export interface OpsRun {
  id: string;
  staffUserId: string;
  staffName: string;
  staffRoles: string[];
  role: string;
  propertyId?: string;
  organizationId?: string;
  runDate: string;
  templateTitle: string;
  frequency: string;
  items: OpsRunItem[];
  status: string;
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OpsIssue {
  id: string;
  runId?: string;
  staffName?: string;
  role?: string;
  itemLabel?: string | null;
  note?: string;
  status?: string;
  createdAt?: string;
}

export const opsApiEnabled = () => isProductionApiEnabled() && Boolean(getAuthToken());

/** Today's runs for the signed-in staff member (auto-seeds per role). */
export async function fetchMyRuns(date?: string): Promise<{ runs: OpsRun[]; issues: OpsIssue[]; roles: string[] }> {
  if (!opsApiEnabled()) return { runs: [], issues: [], roles: [] };
  try {
    const q = date ? `?date=${date}` : '';
    const response = await fetch(apiUrl(`/api/staff-ops/my${q}`), { headers: authHeaders() });
    if (!response.ok) return { runs: [], issues: [], roles: [] };
    const data = await response.json();
    return { runs: data?.runs || [], issues: data?.issues || [], roles: data?.roles || [] };
  } catch {
    return { runs: [], issues: [], roles: [] };
  }
}

export async function updateChecklistItem(payload: {
  runId: string;
  itemId?: string;
  state?: 'Done' | 'Not Done' | 'Not Applicable';
  comment?: string;
  note?: string;
}): Promise<{ ok: boolean; status?: string; items?: OpsRunItem[] }> {
  if (!opsApiEnabled()) return { ok: false };
  try {
    const response = await fetch(apiUrl('/api/staff-ops/my'), {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) return { ok: false };
    const data = await response.json();
    return { ok: Boolean(data?.success), status: data?.status, items: data?.items };
  } catch {
    return { ok: false };
  }
}

export async function reportOpsIssue(payload: { runId?: string; itemId?: string; note: string }): Promise<boolean> {
  if (!opsApiEnabled()) return false;
  try {
    const response = await fetch(apiUrl('/api/staff-ops/my/issue'), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Owner monitoring: today's runs + reported issues for the organisation. */
export async function fetchOpsOverview(date?: string): Promise<{ runs: OpsRun[]; issues: OpsIssue[]; date: string }> {
  if (!opsApiEnabled()) return { runs: [], issues: [], date: date || '' };
  try {
    const q = date ? `?date=${date}` : '';
    const response = await fetch(apiUrl(`/api/staff-ops/overview${q}`), { headers: authHeaders() });
    if (!response.ok) return { runs: [], issues: [], date: date || '' };
    const data = await response.json();
    return { runs: data?.runs || [], issues: data?.issues || [], date: data?.date || date || '' };
  } catch {
    return { runs: [], issues: [], date: date || '' };
  }
}

/** Owner: fetch org template overrides. */
export async function fetchOpsTemplates(): Promise<{ role: string; title: string; frequency: string; items: { id: string; label: string; section: string; mandatory: boolean }[] }[]> {
  if (!opsApiEnabled()) return [];
  try {
    const response = await fetch(apiUrl('/api/staff-ops/templates'), { headers: authHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return data?.templates || [];
  } catch {
    return [];
  }
}

/** Owner: save a checklist template override for a role. */
export async function saveOpsTemplate(payload: {
  role: string;
  title?: string;
  frequency?: string;
  items: { label: string; mandatory: boolean; section?: string }[];
}): Promise<boolean> {
  if (!opsApiEnabled()) return false;
  try {
    const response = await fetch(apiUrl('/api/staff-ops/templates'), {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Owner: resolve a reported issue. */
export async function resolveOpsIssue(id: string, status: string): Promise<boolean> {
  if (!opsApiEnabled()) return false;
  try {
    const response = await fetch(apiUrl('/api/staff-ops/issues'), {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ id, status }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
