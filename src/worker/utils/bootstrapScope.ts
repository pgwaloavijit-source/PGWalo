const ALL_TABLES = [
  'organizations', 'properties', 'residents', 'beds', 'stays',
  'rent_plans', 'invoices', 'payments', 'payment_allocations',
  'deposit_transactions', 'notices', 'checkouts', 'audit_logs',
  'booking_requests', 'attendance_records', 'staff_members',
  'staff_tasks', 'broadcast_notifications', 'meal_plans',
  'chat_messages', 'maintenance_tickets', 'leads',
  'electricity_meter_readings', 'security_deposit_records',
  'rent_agreements', 'visitor_passes', 'system_settings', 'role_permissions',
];

const ROLE_TABLES: Record<string, string[]> = {
  public: ['properties'],
  resident: [
    'properties', 'residents', 'stays', 'rent_plans', 'invoices', 'payments',
    'payment_allocations', 'deposit_transactions', 'notices', 'rent_agreements',
    'maintenance_tickets', 'meal_plans', 'broadcast_notifications', 'visitor_passes',
  ],
  staff: [
    'properties', 'residents', 'beds', 'stays', 'staff_tasks', 'maintenance_tickets',
    'meal_plans', 'broadcast_notifications', 'visitor_passes', 'attendance_records',
  ],
  warden: [
    'properties', 'residents', 'beds', 'stays', 'staff_tasks', 'maintenance_tickets',
    'meal_plans', 'broadcast_notifications', 'visitor_passes', 'attendance_records',
    'leads',
  ],
  accountant: [
    'organizations', 'properties', 'residents', 'stays', 'rent_plans', 'invoices',
    'payments', 'payment_allocations', 'deposit_transactions', 'checkouts', 'audit_logs',
  ],
  manager: [
    'organizations', 'properties', 'residents', 'beds', 'stays', 'rent_plans',
    'invoices', 'payments', 'maintenance_tickets', 'leads', 'staff_members', 'staff_tasks',
  ],
  owner: ALL_TABLES.filter((t) => t !== 'role_permissions'),
  admin: ALL_TABLES,
  superadmin: ALL_TABLES,
};

const TABLE_LIMITS: Record<string, number> = {
  audit_logs: 200,
  invoices: 500,
  payments: 500,
  payment_allocations: 500,
  chat_messages: 150,
  maintenance_tickets: 300,
  leads: 300,
  properties: 200,
};

export function tablesForRole(role: string): string[] {
  return ROLE_TABLES[role] || ROLE_TABLES.public;
}

export function limitForTable(table: string): number | null {
  return TABLE_LIMITS[table] ?? null;
}
