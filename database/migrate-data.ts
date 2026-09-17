/**
 * Migration script to convert existing mock data to D1 format.
 * Generates SQL that seeds a fresh schema with catalog rows.
 *
 * Robustness rules baked in:
 *  - All keys are converted camelCase -> snake_case generically.
 *  - Every statement is INSERT OR REPLACE so re-seeding is idempotent.
 *  - PRAGMA defer_foreign_keys lets seed rows reference orgs created lazily.
 *  - Known schema mismatches (leads.budget, agreements tenant_dob, beds.room_id,
 *    staff owner_user_id, reconciliation table absent) are handled here so the
 *    output always applies cleanly to database/schema.sql.
 */

import {
  INITIAL_PROPERTIES, INITIAL_RESIDENTS, INITIAL_BOOKING_REQUESTS, INITIAL_ATTENDANCE,
  INITIAL_STAFF, INITIAL_TASKS, INITIAL_BROADCASTS, INITIAL_MEAL_PLAN, INITIAL_CHAT,
  INITIAL_TICKETS, INITIAL_USERS, INITIAL_BEDS, INITIAL_LEADS, INITIAL_METER_READINGS,
  INITIAL_DEPOSITS, INITIAL_AGREEMENTS, INITIAL_VISITORS, INITIAL_AUDIT_LOGS,
  INITIAL_SETTINGS, DEFAULT_ROLE_PERMISSIONS,
} from '../src/mockData';
import { DEFAULT_ORGANIZATION_ID } from '../src/domain/productionWorkflow';

type Row = Record<string, unknown>;

const camelToSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function snakeKeys(item: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(item)) {
    out[camelToSnake(key)] = value;
  }
  return out;
}

// Drop keys with no column in schema.sql; patch known NOT NULL gaps.
function sanitize(tableName: string, item: Row): Row {
  if (tableName !== 'users') delete item.owner_user_id;

  if (tableName === 'leads') {
    item.budget_max = (item.budget_max as number) ?? (item.budget as number) ?? 0;
    item.budget = (item.budget as number) ?? (item.budget_max as number) ?? 0;
    if (!item.expected_move_in_date) item.expected_move_in_date = item.preferred_move_in || new Date().toISOString().slice(0, 10);
    if (!item.source) item.source = 'Mock Import';
  }
  if (tableName === 'rent_agreements' && 'tenant_d_o_b' in item) {
    item.tenant_dob = item.tenant_d_o_b;
    delete item.tenant_d_o_b;
  }
  if (tableName === 'beds') {
    const residentSeeded = INITIAL_RESIDENTS.some((r) => r.id === item.current_tenant_id);
    if (!residentSeeded) {
      item.current_tenant_id = null;
      item.reserved_for_resident_id = null;
    }
    item.room_id = null; // room ids are client-side only
  }
  return item;
}

function generateInsertStatements(tableName: string, data: Row[]): string {
  if (!data || data.length === 0) return `-- No data for ${tableName}\n`;

  const statements: string[] = [];

  for (const rawItem of data) {
    const item = sanitize(tableName, snakeKeys(rawItem));
    const columns = Object.keys(item);
    const values = columns.map((col) => {
      const value = item[col];
      if (value === null || value === undefined) return 'NULL';
      if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
      if (typeof value === 'boolean') return value ? '1' : '0';
      if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
      return String(value);
    });

    statements.push(
      `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`
    );
  }

  return statements.join('\n') + '\n';
}

function generateOrganizationSQL(): string {
  return `INSERT OR REPLACE INTO organizations (id, name, owner_user_id, account_state, subscription_plan, created_at)
  VALUES ('${DEFAULT_ORGANIZATION_ID}', 'Blue Haven Operations', 'user-owner', 'Trial / Pending Setup', 'Trial', '${new Date().toISOString()}');\n`;
}

export function generateMigrationSQL(): string {
  let sql = '-- PGNest Data Migration Script\n';
  sql += '-- Generated for Cloudflare D1 database\n';
  sql += `-- Organization: ${DEFAULT_ORGANIZATION_ID}\n\n`;
  sql += 'PRAGMA defer_foreign_keys = true;\n\n';

  sql += generateOrganizationSQL();
  sql += '\n';

  // Properties: keep only schema columns; JSON-encode the array/object fields.
  const properties = INITIAL_PROPERTIES.map((prop) => {
    const row: Row = {
      id: prop.id,
      organization_id: (prop as unknown as Row).organization_id || prop.organizationId || DEFAULT_ORGANIZATION_ID,
      status: prop.status || 'Active',
      name: prop.name,
      tagline: prop.tagline,
      gender: prop.gender,
      city: prop.city,
      locality: prop.locality,
      address: prop.address,
      lat: prop.lat,
      lng: prop.lng,
      cover_image: prop.coverImage,
      gallery_images: JSON.stringify(prop.galleryImages || []),
      starting_price: prop.startingPrice,
      rating: prop.rating,
      review_count: prop.reviewCount || 0,
      rooms: JSON.stringify(prop.rooms || []),
      amenities: JSON.stringify(prop.amenities || []),
      rules: JSON.stringify(prop.rules || []),
      notice_period_days: prop.noticePeriodDays || 30,
      gate_closing_time: prop.gateClosingTime || '22:00',
      food_included: prop.foodIncluded ? 1 : 0,
      verified: prop.verified ? 1 : 0,
      featured: prop.featured ? 1 : 0,
      contact_phone: prop.contactPhone || '',
      contact_email: prop.contactEmail || '',
      owner_name: prop.ownerName || '',
      default_rent_due_day: prop.defaultRentDueDay || 7,
      total_floors: prop.totalFloors ?? null,
      modules: JSON.stringify(prop.modules || {
        foodManagement: prop.foodIncluded,
        attendance: true,
        visitorManagement: true,
        onlinePayments: true,
        chat: true,
      }),
    };
    return row;
  });
  sql += generateInsertStatements('properties', properties);
  sql += '\n';

  // Residents: keep only schema columns.
  const residents = INITIAL_RESIDENTS.map((res) => {
    const row: Row = {
      id: res.id,
      organization_id: res.organizationId || DEFAULT_ORGANIZATION_ID,
      status: res.status || 'Active',
      name: res.name,
      email: res.email,
      phone: res.phone,
      avatar: res.avatar || null,
      property_id: res.propertyId,
      property_name: res.propertyName || null,
      room_number: res.roomNumber || null,
      room_type: res.roomType || null,
      bed_number: res.bedNumber || null,
      monthly_rent: res.monthlyRent || 0,
      deposit_amount: res.depositAmount || 0,
      move_in_date: res.moveInDate || null,
      rent_status: res.rentStatus || 'Pending',
      rent_due_date: res.rentDueDate || null,
      last_payment_date: res.lastPaymentDate || null,
      emergency_contact: res.emergencyContact || null,
      kyc_verified: res.kycVerified ? 1 : 0,
      notes: res.notes || null,
      deposit_state: res.depositState || 'Held',
      agreement_state: res.agreementState || 'Pending',
      previous_dues: res.previousDues || 0,
      advance_balance: res.advanceBalance || 0,
      outstanding_balance: res.outstandingBalance ?? (res.rentStatus === 'Paid' ? 0 : res.monthlyRent || 0),
      notice_period_days: res.noticePeriodDays || 30,
    };
    return row;
  });
  sql += generateInsertStatements('residents', residents);
  sql += '\n';

  // Booking requests: keep only schema columns.
  const bookingRequests = INITIAL_BOOKING_REQUESTS.map((req) => {
    const row: Row = {
      id: req.id,
      organization_id: (req as unknown as Row).organization_id || req.organizationId || DEFAULT_ORGANIZATION_ID,
      resident_status: (req as unknown as Row).resident_status || null,
      reserved_bed_id: req.reservedBedId || null,
      reservation_expiry: req.reservationExpiry || null,
      token_amount: (req as unknown as Row).token_amount ?? req.tokenAmount ?? null,
      applicant_name: req.applicantName,
      email: req.email,
      phone: req.phone,
      property_id: req.propertyId,
      property_name: req.propertyName,
      room_type: req.roomType || 'Double',
      preferred_move_in_date: req.preferredMoveInDate,
      occupancy_type: req.occupancyType || 'Working Professional',
      status: req.status || 'Pending',
      request_date: req.requestDate,
      message: req.message || null,
      type: req.type || 'booking',
      visit_date: req.visitDate || null,
      visit_time_slot: req.visitTimeSlot || null,
      reference_id: (req as unknown as Row).reference_id || req.referenceId || req.id,
      allocated_room_number: req.allocatedRoomNumber || null,
      allocated_bed_number: req.allocatedBedNumber || null,
    };
    return row;
  });
  sql += generateInsertStatements('booking_requests', bookingRequests);
  sql += '\n';

  sql += generateInsertStatements('attendance_records', INITIAL_ATTENDANCE as unknown as Row[]);
  sql += '\n';
  sql += generateInsertStatements('staff_members', INITIAL_STAFF as unknown as Row[]);
  sql += '\n';
  sql += generateInsertStatements('staff_tasks', INITIAL_TASKS as unknown as Row[]);
  sql += '\n';
  sql += generateInsertStatements('broadcast_notifications', INITIAL_BROADCASTS as unknown as Row[]);
  sql += '\n';
  sql += generateInsertStatements('meal_plans', INITIAL_MEAL_PLAN as unknown as Row[]);
  sql += '\n';
  sql += generateInsertStatements('chat_messages', INITIAL_CHAT as unknown as Row[]);
  sql += '\n';
  sql += generateInsertStatements('maintenance_tickets', INITIAL_TICKETS as unknown as Row[]);
  sql += '\n';

  const users = (INITIAL_USERS as unknown as Row[]).filter((u) => {
    const id = String(u.id || '');
    return !/^(user-owner|user-resident|user-staff|user-admin|user-manager|user-warden|user-accountant)/.test(id);
  });
  sql += generateInsertStatements('users', users);
  sql += '\n';

  const beds = (INITIAL_BEDS as unknown as Row[]).map((bed) => ({
    ...bed,
    organization_id: (bed.organization_id as string) || (bed.organizationId as string) || DEFAULT_ORGANIZATION_ID,
  }));
  sql += generateInsertStatements('beds', beds);
  sql += '\n';

  sql += generateInsertStatements('leads', INITIAL_LEADS as unknown as Row[]);
  sql += '\n';
  sql += generateInsertStatements('electricity_meter_readings', INITIAL_METER_READINGS as unknown as Row[]);
  sql += '\n';
  // property_electricity_reconciliation has no table in schema.sql — skipped.
  sql += '-- skipped property_electricity_reconciliation (no D1 table)\n\n';
  // Deposits/agreements for residents that were not seeded (user-xxx demo rows)
  // would violate FKs, so keep only rows whose resident_id exists.
  const seededResidentIds = new Set(INITIAL_RESIDENTS.map((r) => r.id));
  const deposits = (INITIAL_DEPOSITS as unknown as Row[]).filter((d) => seededResidentIds.has(String(d.residentId ?? d.resident_id)));
  sql += generateInsertStatements('security_deposit_records', deposits);
  sql += '\n';
  const agreements = (INITIAL_AGREEMENTS as unknown as Row[]).filter((a) => seededResidentIds.has(String(a.residentId ?? a.resident_id)));
  sql += generateInsertStatements('rent_agreements', agreements);
  sql += '\n';
  sql += generateInsertStatements('visitor_passes', INITIAL_VISITORS as unknown as Row[]);
  sql += '\n';
  sql += generateInsertStatements('audit_logs', INITIAL_AUDIT_LOGS as unknown as Row[]);
  sql += '\n';

  sql += generateInsertStatements('system_settings', [INITIAL_SETTINGS as unknown as Row]);
  sql += '\n';

  const rolePermissions = Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role, perms]) => ({
    role,
    permissions: JSON.stringify(perms),
  }));
  sql += generateInsertStatements('role_permissions', rolePermissions);
  sql += '\n';

  return sql;
}

// Generate initial stays and rent plans derived from residents
function generateInitialDataSQL(): string {
  let sql = '-- Initial stays and rent plans derived from residents\n\n';

  const stays = INITIAL_RESIDENTS
    .filter((resident) => resident.roomNumber && resident.bedNumber)
    .map((resident) => {
      const bed = INITIAL_BEDS.find(
        (b) => b.propertyId === resident.propertyId &&
          (b.id === resident.bedNumber || b.bedNumber === resident.bedNumber)
      );

      return {
        id: `stay-${resident.id}`,
        organization_id: resident.organizationId || DEFAULT_ORGANIZATION_ID,
        resident_id: resident.id,
        property_id: resident.propertyId,
        room_id: bed?.roomId || null,
        room_number: resident.roomNumber,
        bed_id: bed?.id || `${resident.propertyId}-${resident.roomNumber}-${resident.bedNumber}`,
        bed_number: bed?.bedNumber || resident.bedNumber,
        start_date: resident.moveInDate,
        monthly_rent_at_start: resident.monthlyRent,
        status: (resident.status === 'Checked Out' || resident.status === 'Archived') ? 'Closed' : 'Current',
      };
    });

  sql += generateInsertStatements('stays', stays as unknown as Row[]);
  sql += '\n';

  const rentPlans = INITIAL_RESIDENTS.map((resident) => {
    const property = INITIAL_PROPERTIES.find((p) => p.id === resident.propertyId);
    return {
      id: `rent-plan-${resident.id}`,
      organization_id: resident.organizationId || DEFAULT_ORGANIZATION_ID,
      resident_id: resident.id,
      property_id: resident.propertyId,
      monthly_rent: resident.monthlyRent,
      due_day: property?.defaultRentDueDay || 7,
      effective_from: resident.moveInDate,
      status: 'Active',
    };
  });

  sql += generateInsertStatements('rent_plans', rentPlans as unknown as Row[]);
  sql += '\n';

  return sql;
}

export function generateFullMigrationSQL(): string {
  return generateMigrationSQL() + generateInitialDataSQL();
}
