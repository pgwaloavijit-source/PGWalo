import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
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
  PermissionKey,
  Property,
  RentPlan,
  Resident,
  Stay,
  UserRole,
} from './src/types';
import { DEFAULT_ORGANIZATION_ID, buildAuditEntry } from './src/domain/productionWorkflow';

type PersistedCollection =
  | 'organizations'
  | 'properties'
  | 'residents'
  | 'beds'
  | 'stays'
  | 'rentPlans'
  | 'invoices'
  | 'payments'
  | 'paymentAllocations'
  | 'depositTransactions'
  | 'notices'
  | 'checkouts'
  | 'auditLogs';

interface Database {
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

const app = express();
const port = Number(process.env.PORT || 8787);
const databasePath = path.resolve(process.cwd(), 'data', 'pgnest-db.json');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = Boolean(supabaseUrl && supabaseServiceKey);
const recordsTable = process.env.SUPABASE_RECORDS_TABLE || 'pgnest_records';

const writePermissions = new Set<PermissionKey>([
  'resident.create',
  'resident.edit',
  'resident.move',
  'resident.checkout',
  'room.assign',
  'room.transfer',
  'invoice.create',
  'invoice.adjust',
  'payment.record',
  'payment.verify',
  'payment.refund',
  'deposit.deduct',
  'deposit.refund',
  'staff.permission_manage',
]);

const readPermissionByCollection: Record<PersistedCollection, PermissionKey> = {
  organizations: 'staff.view',
  properties: 'room.view',
  residents: 'resident.view',
  beds: 'room.view',
  stays: 'resident.view',
  rentPlans: 'invoice.view',
  invoices: 'invoice.view',
  payments: 'payment.view',
  paymentAllocations: 'payment.view',
  depositTransactions: 'deposit.view',
  notices: 'resident.view',
  checkouts: 'resident.view',
  auditLogs: 'audit.view',
};

const writePermissionByCollection: Record<PersistedCollection, PermissionKey> = {
  organizations: 'staff.permission_manage',
  properties: 'room.assign',
  residents: 'resident.edit',
  beds: 'room.assign',
  stays: 'room.transfer',
  rentPlans: 'invoice.adjust',
  invoices: 'invoice.create',
  payments: 'payment.record',
  paymentAllocations: 'payment.verify',
  depositTransactions: 'deposit.deduct',
  notices: 'resident.checkout',
  checkouts: 'resident.checkout',
  auditLogs: 'audit.view',
};

const rolePermissions: Record<UserRole, PermissionKey[]> = {
  admin: Array.from(new Set([...Object.values(readPermissionByCollection), ...writePermissions])),
  owner: Array.from(new Set([...Object.values(readPermissionByCollection), ...writePermissions])),
  manager: [
    'resident.view',
    'resident.create',
    'resident.edit',
    'resident.move',
    'resident.checkout',
    'room.view',
    'room.assign',
    'room.transfer',
    'invoice.view',
    'payment.view',
    'payment.record',
    'complaint.view',
    'complaint.assign',
    'complaint.resolve',
    'report.view',
  ],
  warden: ['resident.view', 'room.view', 'room.assign', 'complaint.view', 'complaint.assign', 'complaint.resolve'],
  accountant: [
    'resident.view',
    'invoice.view',
    'invoice.create',
    'invoice.adjust',
    'payment.view',
    'payment.record',
    'payment.verify',
    'payment.refund',
    'deposit.view',
    'deposit.deduct',
    'deposit.refund',
    'report.view',
    'report.export',
    'audit.view',
  ],
  staff: ['room.view', 'complaint.view', 'complaint.resolve'],
  resident: ['invoice.view', 'payment.view', 'payment.record', 'deposit.view', 'complaint.view'],
  public: ['room.view'],
};

const emptyDatabase = (): Database => ({
  organizations: [],
  properties: [],
  residents: [],
  beds: [],
  stays: [],
  rentPlans: [],
  invoices: [],
  payments: [],
  paymentAllocations: [],
  depositTransactions: [],
  notices: [],
  checkouts: [],
  auditLogs: [],
});

const supabaseHeaders = {
  apikey: supabaseServiceKey || '',
  Authorization: `Bearer ${supabaseServiceKey || ''}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=representation',
};

const loadSupabaseDatabase = async (): Promise<Database> => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/${recordsTable}?select=collection,data&order=updated_at.desc`,
    { headers: supabaseHeaders }
  );
  if (!response.ok) throw new Error(`Supabase load failed: ${await response.text()}`);
  const rows = (await response.json()) as Array<{ collection: PersistedCollection; data: unknown }>;
  const db = emptyDatabase();
  rows.forEach((row) => {
    if (row.collection in db) {
      (db[row.collection] as unknown[]).push(row.data);
    }
  });
  return db;
};

const saveSupabaseCollection = async <T extends { id: string; organizationId?: string }>(
  collection: PersistedCollection,
  rows: T[]
) => {
  if (rows.length === 0) return;
  const payload = rows.map((row) => ({
    collection,
    record_id: row.id,
    organization_id: row.organizationId || DEFAULT_ORGANIZATION_ID,
    data: row,
    updated_at: new Date().toISOString(),
  }));
  const response = await fetch(`${supabaseUrl}/rest/v1/${recordsTable}`, {
    method: 'POST',
    headers: supabaseHeaders,
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Supabase save failed: ${await response.text()}`);
};

const loadDatabase = async (): Promise<Database> => {
  if (useSupabase) return loadSupabaseDatabase();
  try {
    return JSON.parse(await fs.readFile(databasePath, 'utf8')) as Database;
  } catch {
    await fs.mkdir(path.dirname(databasePath), { recursive: true });
    const db = emptyDatabase();
    await fs.writeFile(databasePath, JSON.stringify(db, null, 2));
    return db;
  }
};

const saveDatabase = async (db: Database) => {
  if (useSupabase) {
    await Promise.all(
      (Object.keys(db) as PersistedCollection[]).map((collection) =>
        saveSupabaseCollection(collection, db[collection] as Array<{ id: string; organizationId?: string }>)
      )
    );
    return;
  }
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  await fs.writeFile(databasePath, JSON.stringify(db, null, 2));
};

const saveCollection = async <T extends { id: string; organizationId?: string }>(
  collection: PersistedCollection,
  rows: T[],
  db: Database
) => {
  if (useSupabase) {
    await saveSupabaseCollection(collection, rows);
    if (db.auditLogs.length) await saveSupabaseCollection('auditLogs', db.auditLogs);
    return;
  }
  await saveDatabase(db);
};

const getRole = (value: unknown): UserRole => {
  const role = String(value || 'public') as UserRole;
  return rolePermissions[role] ? role : 'public';
};

const assertPermission = (role: UserRole, permission: PermissionKey) => {
  if (!rolePermissions[role].includes(permission)) {
    const error = new Error(`Forbidden: ${permission}`);
    (error as Error & { status?: number }).status = 403;
    throw error;
  }
};

const getOrganizationId = (req: express.Request) =>
  String(req.header('x-organization-id') || DEFAULT_ORGANIZATION_ID);

const scoped = <T extends { organizationId?: string }>(rows: T[], organizationId: string, role: UserRole) =>
  role === 'admin' ? rows : rows.filter((row) => (row.organizationId || DEFAULT_ORGANIZATION_ID) === organizationId);

app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, storage: useSupabase ? 'supabase' : databasePath });
});

app.get('/api/bootstrap', async (req, res, next) => {
  try {
    const db = await loadDatabase();
    const role = getRole(req.header('x-user-role'));
    const organizationId = getOrganizationId(req);
    const result = emptyDatabase();
    (Object.keys(db) as PersistedCollection[]).forEach((collection) => {
      if (rolePermissions[role].includes(readPermissionByCollection[collection])) {
        (result[collection] as unknown[]) = scoped(
          db[collection] as Array<{ organizationId?: string }>,
          organizationId,
          role
        );
      }
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/bootstrap', async (req, res, next) => {
  try {
    const role = getRole(req.header('x-user-role'));
    assertPermission(role, 'staff.permission_manage');
    const organizationId = getOrganizationId(req);
    const db = await loadDatabase();
    const body = req.body as Partial<Database>;
    (Object.keys(emptyDatabase()) as PersistedCollection[]).forEach((collection) => {
      const rows = body[collection];
      if (!Array.isArray(rows) || collection === 'auditLogs') return;
      const sanitized = rows.map((row) => ({
        ...row,
        organizationId: role === 'admin' ? row.organizationId || organizationId : organizationId,
      }));
      (db[collection] as unknown[]) = [
        ...((db[collection] as Array<{ organizationId?: string }>).filter(
          (row) => role !== 'admin' && (row.organizationId || DEFAULT_ORGANIZATION_ID) !== organizationId
        ) as unknown[]),
        ...sanitized,
      ];
    });
    db.auditLogs.unshift(
      buildAuditEntry({
        user: null,
        role,
        action: 'Bootstrap Snapshot Saved',
        entityType: 'Database',
        newValue: { collections: Object.keys(body) },
      })
    );
    await saveDatabase(db);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/:collection', async (req, res, next) => {
  try {
    const collection = req.params.collection as PersistedCollection;
    const db = await loadDatabase();
    if (!(collection in db)) return res.status(404).json({ error: 'Unknown collection' });
    const role = getRole(req.header('x-user-role'));
    assertPermission(role, readPermissionByCollection[collection]);
    res.json(scoped(db[collection] as Array<{ organizationId?: string }>, getOrganizationId(req), role));
  } catch (error) {
    next(error);
  }
});

app.post('/api/:collection', async (req, res, next) => {
  try {
    const collection = req.params.collection as PersistedCollection;
    const db = await loadDatabase();
    if (!(collection in db)) return res.status(404).json({ error: 'Unknown collection' });
    const role = getRole(req.header('x-user-role'));
    const organizationId = getOrganizationId(req);
    assertPermission(role, writePermissionByCollection[collection]);

    const item = {
      ...req.body,
      organizationId: role === 'admin' ? req.body.organizationId || organizationId : organizationId,
    };
    (db[collection] as unknown[]).push(item);
    db.auditLogs.unshift(
      buildAuditEntry({
        user: null,
        role,
        action: 'API Record Created',
        entityType: collection,
        entityId: item.id,
        newValue: item,
        propertyId: item.propertyId,
      })
    );
    await saveCollection(collection, [item], db);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

app.put('/api/:collection/:id', async (req, res, next) => {
  try {
    const collection = req.params.collection as PersistedCollection;
    const db = await loadDatabase();
    if (!(collection in db)) return res.status(404).json({ error: 'Unknown collection' });
    const role = getRole(req.header('x-user-role'));
    const organizationId = getOrganizationId(req);
    assertPermission(role, writePermissionByCollection[collection]);

    const rows = db[collection] as Array<{ id: string; organizationId?: string; propertyId?: string }>;
    const index = rows.findIndex((row) => row.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Record not found' });
    const previous = rows[index];
    if (role !== 'admin' && (previous.organizationId || DEFAULT_ORGANIZATION_ID) !== organizationId) {
      return res.status(403).json({ error: 'Forbidden: organization isolation' });
    }
    const nextValue = { ...previous, ...req.body, organizationId: previous.organizationId || organizationId };
    rows[index] = nextValue;
    db.auditLogs.unshift(
      buildAuditEntry({
        user: null,
        role,
        action: 'API Record Updated',
        entityType: collection,
        entityId: req.params.id,
        previousValue: previous,
        newValue: nextValue,
        propertyId: nextValue.propertyId,
        reason: req.body.reason,
      })
    );
    await saveCollection(collection, [nextValue], db);
    res.json(nextValue);
  } catch (error) {
    next(error);
  }
});

app.use((error: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(error.status || 500).json({ error: error.message || 'Server error' });
});

app.listen(port, () => {
  console.log(`PGWalo API listening on http://localhost:${port}`);
});
