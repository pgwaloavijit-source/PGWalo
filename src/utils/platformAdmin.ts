export function isPlatformAdmin(role?: string | null): boolean {
  return role === 'admin' || role === 'superadmin';
}

export function listingApprovalLabel(property: {
  verified?: boolean;
  listingStatus?: string;
  status?: string;
}): 'Pending' | 'Approved' | 'Rejected' | 'Disabled' {
  const listing = property.listingStatus || '';
  const status = property.status || '';
  if (listing === 'Archived' || status === 'Archived' || status === 'Restricted') {
    return property.verified ? 'Disabled' : 'Rejected';
  }
  if (property.verified || listing === 'Active' || status === 'Active') return 'Approved';
  return 'Pending';
}

export type DateRangeKey = 'today' | '7d' | '30d' | '90d' | 'custom';

export function rangeBounds(key: DateRangeKey, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  if (key === 'today') from.setHours(0, 0, 0, 0);
  else if (key === '7d') from.setDate(from.getDate() - 6), from.setHours(0, 0, 0, 0);
  else if (key === '30d') from.setDate(from.getDate() - 29), from.setHours(0, 0, 0, 0);
  else if (key === '90d') from.setMonth(from.getMonth() - 3), from.setHours(0, 0, 0, 0);
  else {
    const start = customFrom ? new Date(customFrom) : new Date(to);
    start.setHours(0, 0, 0, 0);
    const end = customTo ? new Date(customTo) : new Date(to);
    end.setHours(23, 59, 59, 999);
    return { from: start, to: end };
  }
  return { from, to };
}

export function inDateRange(value: string | undefined, from: Date, to: Date): boolean {
  if (!value) return false;
  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed >= from && parsed <= to;
}

export function exportCsv(filename: string, rows: Record<string, string | number>[]): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const body = [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => JSON.stringify(row[key] ?? '')).join(',')),
  ].join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
