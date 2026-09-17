export function isPlatformAdmin(role?: string | null): boolean {
  return role === 'admin' || role === 'superadmin';
}

export function normalizeLoginId(value?: string): string {
  return (value || '').trim();
}

export function lastTenDigits(value?: string): string {
  return (value || '').replace(/\D/g, '').slice(-10);
}

export function credentialsMatch(left?: string, right?: string): boolean {
  if (!left || !right) return false;
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}
