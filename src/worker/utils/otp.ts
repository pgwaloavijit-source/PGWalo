import { Env } from '../types';
import { hashPassword, verifyPassword } from './password';

export async function hashOtp(code: string): Promise<string> {
  return hashPassword(code);
}

export async function matchOtp(code: string, stored: string): Promise<boolean> {
  return verifyPassword(code, stored);
}

export function randomOtp(): string {
  const n = crypto.getRandomValues(new Uint8Array(4));
  const num = (n[0] << 24 | n[1] << 16 | n[2] << 8 | n[3]) >>> 0;
  return String(num % 1_000_000).padStart(6, '0');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch] || ch));
}

export async function deliverEmail(
  env: Env,
  toEmail: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  if (!env.EMAIL || !toEmail.includes('@')) return false;
  try {
    await env.EMAIL.send({
      to: toEmail,
      from: { email: 'noreply@pgwalo.com', name: 'PGWalo' },
      subject,
      html,
      text,
    });
    return true;
  } catch (error) {
    console.error('Email send failed', error);
    return false;
  }
}

export async function deliverOtp(env: Env, toEmail: string, code: string, purpose: string): Promise<boolean> {
  const subject = purpose === 'login' ? 'Your PGWalo login code' : 'Verify your PGWalo account';
  const html = `<p>Your verification code is <strong>${escapeHtml(code)}</strong>.</p><p>It expires in 10 minutes. Do not share it.</p>`;
  return deliverEmail(env, toEmail, subject, html, `Your PGWalo code is ${code}. It expires in 10 minutes.`);
}

/** Verhoeff checksum — used by UIDAI for Aadhaar. */
export function isValidAadhaar(raw: string): boolean {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 12 || /^0/.test(d)) return false;
  const mul = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,2,3,4,0,6,7,8,9,5],
    [2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7],
    [4,0,1,2,3,9,5,6,7,8],
    [5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2],
    [7,6,5,9,8,2,1,0,4,3],
    [8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0],
  ];
  const perm = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,5,7,6,2,8,3,0,9,4],
    [5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7],
    [9,4,5,3,1,2,6,8,7,0],
    [4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5],
    [7,0,4,6,9,1,3,2,5,8],
  ];
  let c = 0;
  const reversed = d.split('').reverse().map(Number);
  for (let i = 0; i < reversed.length; i++) {
    c = mul[c][perm[i % 8][reversed[i]]];
  }
  return c === 0;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

export function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizePhone(phone));
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
