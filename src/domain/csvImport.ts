/**
 * CSV import engine (spec §9) — parse, map, validate, preview, commit.
 *
 * CSV is the canonical browser/server exchange. The same parser runs in the
 * Worker (commit path validates again server-side) and the browser (preview).
 * Duplicate detection is deterministic: normalized phone for residents/leads,
 * property+room+bed key for beds.
 */
import type { ImportKind, ImportPreview, ImportRowError } from './market';

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  errors: ImportRowError[];
}

/** Minimal RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF). */
export const parseCsv = (text: string): ParsedCsv => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, ''); // strip BOM

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return { headers: [], rows: [], errors: [] };
  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1);
  return {
    headers,
    rows: dataRows.map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] ?? '').trim();
      });
      return obj;
    }),
    errors: [],
  };
};

// ------------------------------------------------------------- field mappings

interface FieldSpec {
  aliases: string[];
  required: boolean;
  label: string;
}

const SHARED: Record<string, FieldSpec> = {
  name: { aliases: ['name', 'full name', 'fullname', 'resident name', 'lead name'], required: true, label: 'Name' },
  phone: { aliases: ['phone', 'mobile', 'phone number', 'mobile number', 'contact'], required: true, label: 'Phone' },
  room: { aliases: ['room', 'room number', 'room no'], required: false, label: 'Room' },
  bed: { aliases: ['bed', 'bed number', 'bed no'], required: false, label: 'Bed' },
  rent: { aliases: ['rent', 'monthly rent', 'amount', 'rent amount'], required: false, label: 'Rent' },
  deposit: { aliases: ['deposit', 'security deposit', 'deposit amount'], required: false, label: 'Deposit' },
  moveIn: { aliases: ['move in', 'move in date', 'movein', 'joining date', 'date'], required: false, label: 'Move-in date' },
  due: { aliases: ['due', 'due amount', 'outstanding', 'previous dues'], required: false, label: 'Due amount' },
  email: { aliases: ['email', 'email id'], required: false, label: 'Email' },
  source: { aliases: ['source'], required: false, label: 'Source' },
  property: { aliases: ['property', 'property name', 'pg name'], required: false, label: 'Property' },
  floor: { aliases: ['floor', 'level'], required: false, label: 'Floor' },
  sharing: { aliases: ['sharing', 'sharing type', 'room type'], required: false, label: 'Sharing type' },
  status: { aliases: ['status', 'occupancy'], required: false, label: 'Status' },
};

const KIND_FIELDS: Record<ImportKind, string[]> = {
  beds: ['name', 'floor', 'sharing', 'rent', 'deposit', 'status'],
  residents: ['name', 'phone', 'room', 'bed', 'rent', 'deposit', 'moveIn'],
  dues: ['name', 'phone', 'due'],
  deposits: ['name', 'phone', 'deposit'],
  leads: ['name', 'phone', 'email', 'source', 'rent', 'moveIn'],
};

export const normalizePhone = (raw: string): string => (raw || '').replace(/\D/g, '').slice(-10);

const isoDate = (raw: string): string | null => {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

export const CSV_TEMPLATES: Record<ImportKind, string> = {
  beds: 'Room,Floor,Sharing Type,Monthly Rent,Deposit,Status\n101,1,Single,14500,20000,Vacant\n',
  residents: 'Name,Phone,Email,Room,Bed,Monthly Rent,Deposit,Move-in Date\nRohan Deshmukh,9876543210,rohan@example.com,101,A,14500,20000,2026-08-01\n',
  dues: 'Name,Phone,Due Amount\nPriya Iyer,9865012345,3500\n',
  deposits: 'Name,Phone,Deposit Amount,Reference\nKarthik Raja,9812309876,12000,UTR-8891\n',
  leads: 'Name,Phone,Email,Source,Budget,Move-in Date,Notes\nSiddharth Roy,9988776655,sid@example.com,WhatsApp,15000,2026-10-01,Wants single room\n',
};

// ------------------------------------------------------------------ validation

export const buildImportPreview = (
  kind: ImportKind,
  csv: ParsedCsv,
  existing: { phones?: Set<string>; bedKeys?: Set<string>; names?: Set<string> } = {}
): ImportPreview => {
  const errors: ImportRowError[] = [];
  const mapped: Record<string, string>[] = [];
  const seenPhones = new Set<string>(existing.phones || []);
  const seenBedKeys = new Set<string>(existing.bedKeys || []);
  let duplicates = 0;

  csv.rows.forEach((raw, idx) => {
    const rowNo = idx + 2; // +2: header row + 1-index
    const out: Record<string, string> = {};

    // column mapping by alias (match the actual header, keep its casing)
    for (const [key, spec] of Object.entries(SHARED)) {
      const header = csv.headers.find((h) => spec.aliases.includes(h.toLowerCase()));
      if (header !== undefined) {
        out[key] = raw[header] ?? '';
      }
    }

    for (const fieldName of KIND_FIELDS[kind]) {
      const spec = SHARED[fieldName];
      if (!spec) continue;
      const value = out[fieldName] ?? '';
      if (spec.required && !value) {
        errors.push({ row: rowNo, field: spec.label, message: `${spec.label} is required` });
      }
    }

    if (kind !== 'beds') {
      const phone = normalizePhone(out.phone || '');
      if (phone.length !== 10) {
        errors.push({ row: rowNo, field: 'Phone', message: 'Phone must be a 10-digit Indian mobile number' });
      } else if (seenPhones.has(phone)) {
        duplicates += 1;
        errors.push({ row: rowNo, field: 'Phone', message: 'Duplicate phone — this person is already in the file or in the system' });
      } else {
        seenPhones.add(phone);
      }
    }

    if (kind === 'beds') {
      const key = `${(out.property || '').toLowerCase()}|${(out.name || '').toLowerCase()}`;
      if (!out.name) {
        errors.push({ row: rowNo, field: 'Room', message: 'Room name is required' });
      } else if (seenBedKeys.has(key)) {
        duplicates += 1;
        errors.push({ row: rowNo, field: 'Room', message: 'Duplicate room in file' });
      } else {
        seenBedKeys.add(key);
      }
      const rent = Number(out.rent || 0);
      if (!Number.isFinite(rent) || rent <= 0) {
        errors.push({ row: rowNo, field: 'Rent', message: 'Monthly rent must be a positive number' });
      }
    }

    if (kind === 'leads' && out.email && !/^\S+@\S+\.\S+$/.test(out.email)) {
      errors.push({ row: rowNo, field: 'Email', message: 'Email format looks invalid' });
    }

    if ((kind === 'residents' || kind === 'dues' || kind === 'deposits') && out.moveIn && !isoDate(out.moveIn)) {
      errors.push({ row: rowNo, field: 'Move-in date', message: `Could not parse date "${out.moveIn}"` });
    }

    mapped.push(out);
  });

  return {
    kind,
    headers: csv.headers,
    mappedRows: mapped,
    errors,
    validCount: Math.max(0, mapped.length - new Set(errors.map((e) => e.row)).size),
    errorCount: new Set(errors.map((e) => e.row)).size,
    duplicates,
  };
};

/** Rejection report rows for download (spec §9). */
export const rejectionReport = (preview: ImportPreview): string => {
  const lines = ['Row,Field,Error'];
  for (const e of preview.errors) {
    lines.push(`${e.row},"${e.field || ''}","${e.message.replace(/"/g, '""')}"`);
  }
  return lines.join('\n');
};
