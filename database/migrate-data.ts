/**
 * Migration script to convert existing mock data to D1 format
 * This script helps migrate from the current TypeScript data structure to D1 SQL
 */

import {
  Property,
  Resident,
  BookingRequest,
  AttendanceRecord,
  StaffMember,
  StaffTask,
  BroadcastNotification,
  MealPlanDay,
  ChatMessage,
  MaintenanceTicket,
  UserAccount,
  Bed,
  Lead,
  ElectricityMeterReading,
  PropertyElectricityReconciliation,
  SecurityDepositRecord,
  RentAgreement,
  VisitorPass,
  AuditLogEntry,
  SystemSettings,
  RolePermissions,
  Stay,
  RentPlan,
  Invoice,
  Payment,
  PaymentAllocation,
  DepositTransaction,
  Notice,
  Checkout,
} from '../src/types';
import { INITIAL_PROPERTIES, INITIAL_RESIDENTS, INITIAL_BOOKING_REQUESTS, INITIAL_ATTENDANCE, INITIAL_STAFF, INITIAL_TASKS, INITIAL_BROADCASTS, INITIAL_MEAL_PLAN, INITIAL_CHAT, INITIAL_TICKETS, INITIAL_USERS, INITIAL_BEDS, INITIAL_LEADS, INITIAL_METER_READINGS, INITIAL_RECONCILIATION, INITIAL_DEPOSITS, INITIAL_AGREEMENTS, INITIAL_VISITORS, INITIAL_AUDIT_LOGS, INITIAL_SETTINGS, DEFAULT_ROLE_PERMISSIONS } from '../src/mockData';
import { DEFAULT_ORGANIZATION_ID } from '../src/domain/productionWorkflow';

// Helper function to convert JavaScript objects to SQL INSERT statements
function generateInsertStatements(tableName: string, data: any[]): string {
  if (!data || data.length === 0) return `-- No data for ${tableName}\n`;

  const statements: string[] = [];
  
  for (const item of data) {
    const columns = Object.keys(item);
    const values = columns.map(col => {
      const value = item[col];
      if (value === null || value === undefined) return 'NULL';
      if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
      if (typeof value === 'boolean') return value ? '1' : '0';
      if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
      return String(value);
    });
    
    statements.push(
      `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`
    );
  }
  
  return statements.join('\n') + '\n';
}

// Convert organization
function generateOrganizationSQL(): string {
  const org = {
    id: DEFAULT_ORGANIZATION_ID,
    name: 'Blue Haven Operations',
    owner_user_id: 'user-owner',
    account_state: 'Trial / Pending Setup',
    subscription_plan: 'Trial',
    created_at: new Date().toISOString(),
  };
  
  return `INSERT INTO organizations (id, name, owner_user_id, account_state, subscription_plan, created_at)
  VALUES ('${org.id}', '${org.name}', '${org.owner_user_id}', '${org.account_state}', '${org.subscription_plan}', '${org.created_at}');\n`;
}

// Main migration function
export function generateMigrationSQL(): string {
  let sql = '-- PGNest Data Migration Script\n';
  sql += '-- Generated for Cloudflare D1 database\n';
  sql += `-- Organization: ${DEFAULT_ORGANIZATION_ID}\n\n`;

  // Insert organization first
  sql += generateOrganizationSQL();
  sql += '\n';

  // Convert properties
  const properties = INITIAL_PROPERTIES.map(prop => ({
    ...prop,
    organization_id: prop.organization_id || DEFAULT_ORGANIZATION_ID,
    gallery_images: JSON.stringify(prop.galleryImages),
    rooms: JSON.stringify(prop.rooms),
    amenities: JSON.stringify(prop.amenities),
    rules: JSON.stringify(prop.rules),
    food_included: prop.foodIncluded ? 1 : 0,
    verified: prop.verified ? 1 : 0,
    featured: prop.featured ? 1 : 0,
    status: prop.status || 'Active',
    default_rent_due_day: prop.defaultRentDueDay || 7,
    total_floors: prop.totalFloors,
    modules: JSON.stringify(prop.modules || {
      foodManagement: prop.foodIncluded,
      attendance: true,
      visitorManagement: true,
      onlinePayments: true,
      chat: true,
    }),
  }));
  sql += generateInsertStatements('properties', properties);
  sql += '\n';

  // Convert residents
  const residents = INITIAL_RESIDENTS.map(res => ({
    ...res,
    organization_id: res.organizationId || DEFAULT_ORGANIZATION_ID,
    kyc_verified: res.kycVerified ? 1 : 0,
    onboarding_checklist: JSON.stringify(res.onboardingChecklist || {}),
    status: res.status || 'Active',
    deposit_state: res.depositState || 'Held',
    agreement_state: res.agreementState || 'Pending',
    previous_dues: res.previousDues || 0,
    advance_balance: res.advanceBalance || 0,
    outstanding_balance: res.outstandingBalance || (res.rentStatus === 'Paid' ? 0 : res.monthlyRent),
    notice_period_days: res.noticePeriodDays || 30,
  }));
  sql += generateInsertStatements('residents', residents);
  sql += '\n';

  // Convert booking requests
  const bookingRequests = INITIAL_BOOKING_REQUESTS.map(req => ({
    ...req,
    organization_id: req.organizationId || DEFAULT_ORGANIZATION_ID,
  }));
  sql += generateInsertStatements('booking_requests', bookingRequests);
  sql += '\n';

  // Convert attendance
  sql += generateInsertStatements('attendance_records', INITIAL_ATTENDANCE);
  sql += '\n';

  // Convert staff
  sql += generateInsertStatements('staff_members', INITIAL_STAFF);
  sql += '\n';

  // Convert tasks
  sql += generateInsertStatements('staff_tasks', INITIAL_TASKS);
  sql += '\n';

  // Convert broadcasts
  sql += generateInsertStatements('broadcast_notifications', INITIAL_BROADCASTS);
  sql += '\n';

  // Convert meal plans
  sql += generateInsertStatements('meal_plans', INITIAL_MEAL_PLAN);
  sql += '\n';

  // Convert chat
  sql += generateInsertStatements('chat_messages', INITIAL_CHAT);
  sql += '\n';

  // Convert tickets
  sql += generateInsertStatements('maintenance_tickets', INITIAL_TICKETS);
  sql += '\n';

  // Convert users
  const users = INITIAL_USERS.filter(u => 
    !u.id.startsWith('user-owner') && 
    !u.id.startsWith('user-resident') && 
    !u.id.startsWith('user-staff') &&
    !u.id.startsWith('user-admin') &&
    !u.id.startsWith('user-manager') &&
    !u.id.startsWith('user-warden') &&
    !u.id.startsWith('user-accountant')
  );
  sql += generateInsertStatements('users', users);
  sql += '\n';

  // Convert beds
  const beds = INITIAL_BEDS.map(bed => ({
    ...bed,
    organization_id: bed.organizationId || DEFAULT_ORGANIZATION_ID,
  }));
  sql += generateInsertStatements('beds', beds);
  sql += '\n';

  // Convert leads
  sql += generateInsertStatements('leads', INITIAL_LEADS);
  sql += '\n';

  // Convert meter readings
  sql += generateInsertStatements('electricity_meter_readings', INITIAL_METER_READINGS);
  sql += '\n';

  // Convert reconciliation
  sql += generateInsertStatements('property_electricity_reconciliation', INITIAL_RECONCILIATION);
  sql += '\n';

  // Convert deposits
  sql += generateInsertStatements('security_deposit_records', INITIAL_DEPOSITS);
  sql += '\n';

  // Convert agreements
  sql += generateInsertStatements('rent_agreements', INITIAL_AGREEMENTS);
  sql += '\n';

  // Convert visitors
  sql += generateInsertStatements('visitor_passes', INITIAL_VISITORS);
  sql += '\n';

  // Convert audit logs
  sql += generateInsertStatements('audit_logs', INITIAL_AUDIT_LOGS);
  sql += '\n';

  // Convert settings
  sql += generateInsertStatements('system_settings', [INITIAL_SETTINGS]);
  sql += '\n';

  // Convert role permissions
  const rolePermissions = Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role, perms]) => ({
    role,
    permissions: JSON.stringify(perms),
  }));
  sql += generateInsertStatements('role_permissions', rolePermissions);
  sql += '\n';

  return sql;
}

// Generate initial stays and rent plans from residents
function generateInitialDataSQL(): string {
  let sql = '-- Initial stays and rent plans derived from residents\n\n';

  // Generate stays from residents
  const stays = INITIAL_RESIDENTS
    .filter(resident => resident.roomNumber && resident.bedNumber)
    .map(resident => {
      const bed = INITIAL_BEDS.find(
        b => b.propertyId === resident.propertyId && 
        (b.id === resident.bedNumber || b.bedNumber === resident.bedNumber)
      );
      
      return {
        id: `stay-${resident.id}`,
        organization_id: resident.organizationId || DEFAULT_ORGANIZATION_ID,
        resident_id: resident.id,
        property_id: resident.propertyId,
        room_id: bed?.roomId,
        room_number: resident.roomNumber,
        bed_id: bed?.id || `${resident.propertyId}-${resident.roomNumber}-${resident.bedNumber}`,
        bed_number: bed?.bedNumber || resident.bedNumber,
        start_date: resident.moveInDate,
        monthly_rent_at_start: resident.monthlyRent,
        status: (resident.status === 'Checked Out' || resident.status === 'Archived') ? 'Closed' : 'Current',
      };
    });
  
  sql += generateInsertStatements('stays', stays);
  sql += '\n';

  // Generate rent plans from residents
  const rentPlans = INITIAL_RESIDENTS.map(resident => {
    const property = INITIAL_PROPERTIES.find(p => p.id === resident.propertyId);
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
  
  sql += generateInsertStatements('rent_plans', rentPlans);
  sql += '\n';

  return sql;
}

// Main export
export function generateFullMigrationSQL(): string {
  return generateMigrationSQL() + generateInitialDataSQL();
}

// CLI usage (if needed for development)
// Run with: npx tsx database/migrate-data.ts > database/data-migration.sql