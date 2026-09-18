/**
 * Staff operations domain: roles, permissions, and the predefined Indian PG
 * checklists. Shared by the staff dashboard (what do I do today?), the owner
 * dashboard (who did what?), and the worker (persistence + enforcement).
 *
 * The content here is the DEFAULT template per role. Owners edit their
 * organisation's copy in the database; this file only seeds new properties.
 */

export type OpsFrequency = 'Daily' | 'Weekly' | 'Monthly';

/** The 9 operational roles the platform understands. */
export const OPS_ROLES = [
  'Warden',
  'Security Guard',
  'Housekeeping',
  'Maintenance',
  'Cook/Kitchen Staff',
  'Caretaker',
  'Reception/Front Desk',
  'Inventory/Store Staff',
  'Operations Staff',
  // Legacy duty roles kept working — they map to the closest checklist.
  'Housekeeper',
  'Mess Cook',
  'Electrician',
  'Manager',
] as const;
export type OpsRole = (typeof OPS_ROLES)[number];

export interface ChecklistItemTemplate {
  id: string;
  label: string;
  mandatory: boolean;
  /** Grouping inside the checklist card: Start of Shift, During the Day… */
  section: string;
}

export interface ChecklistTemplate {
  role: OpsRole;
  title: string;
  frequency: OpsFrequency;
  items: ChecklistItemTemplate[];
}

const item = (id: string, label: string, section: string, mandatory = false): ChecklistItemTemplate => ({
  id,
  label,
  section,
  mandatory,
});

export const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    role: 'Warden',
    title: 'Warden Daily Checklist',
    frequency: 'Daily',
    items: [
      item('w-m-gate', 'Check main gate and entrance', 'Morning', true),
      item('w-m-common', 'Check common areas', 'Morning', true),
      item('w-m-corridor', 'Check corridors and staircases', 'Morning', true),
      item('w-m-washroom', 'Check washrooms', 'Morning', true),
      item('w-m-water', 'Check water supply', 'Morning', true),
      item('w-m-power', 'Check electricity / power supply', 'Morning', true),
      item('w-m-lights', 'Check lights and fans in common areas', 'Morning'),
      item('w-m-cctv', 'Check CCTV status', 'Morning', true),
      item('w-m-fire', 'Check fire extinguishers / fire access', 'Morning', true),
      item('w-m-exits', 'Check emergency exits', 'Morning', true),
      item('w-m-clean', 'Check cleanliness', 'Morning'),
      item('w-m-garbage', 'Check garbage collection', 'Morning'),
      item('w-m-complaints', 'Check pending maintenance complaints', 'Morning', true),
      item('w-m-pending', "Check previous day's pending issues", 'Morning'),
      item('w-m-attend', 'Check staff attendance', 'Morning'),
      item('w-m-roster', "Check today's staff duty / roster", 'Morning'),
      item('w-m-visitors', 'Check visitor register', 'Morning'),
      item('w-m-gate-reg', 'Check gate movement records', 'Morning'),
      item('w-d-monitor', 'Monitor common areas', 'During the Day'),
      item('w-d-residents', 'Check resident / tenant complaints', 'During the Day', true),
      item('w-d-visitor', 'Check visitor entries', 'During the Day'),
      item('w-d-incidents', 'Check unusual incidents', 'During the Day'),
      item('w-d-followup', 'Follow up on maintenance complaints', 'During the Day'),
      item('w-d-housekeeping', 'Coordinate with housekeeping', 'During the Day'),
      item('w-d-security', 'Coordinate with security', 'During the Day'),
      item('w-d-utilities', 'Check water / electricity issues', 'During the Day'),
      item('w-d-opslog', 'Update important operational issues', 'During the Day'),
      item('w-e-complaints', 'Review pending complaints', 'Evening / Closing'),
      item('w-e-maintenance', 'Review maintenance issues', 'Evening / Closing'),
      item('w-e-visitors', 'Review visitor register', 'Evening / Closing'),
      item('w-e-gate', 'Review gate movement', 'Evening / Closing'),
      item('w-e-handover', 'Verify staff handover', 'Evening / Closing'),
      item('w-e-incidents', 'Record incidents', 'Evening / Closing'),
      item('w-e-unresolved', 'Record unresolved issues', 'Evening / Closing'),
      item('w-e-escalate', 'Escalate important issues to Owner', 'Evening / Closing'),
      item('w-e-report', 'Submit daily warden report', 'Evening / Closing', true),
    ],
  },
  {
    role: 'Security Guard',
    title: 'Security Shift Checklist',
    frequency: 'Daily',
    items: [
      item('s-start-handover', 'Take handover from previous guard', 'Start of Shift', true),
      item('s-start-gate', 'Check main gate', 'Start of Shift', true),
      item('s-start-cctv', 'Check CCTV', 'Start of Shift'),
      item('s-start-visreg', 'Check visitor register', 'Start of Shift'),
      item('s-start-secreg', 'Check security register', 'Start of Shift'),
      item('s-start-keys', 'Check gate keys / access cards', 'Start of Shift'),
      item('s-start-contacts', 'Check emergency contact information', 'Start of Shift'),
      item('s-start-equip', 'Check security equipment', 'Start of Shift'),
      item('s-start-lighting', 'Check lighting around entrance', 'Start of Shift'),
      item('s-start-exits', 'Check emergency exits', 'Start of Shift'),
      item('s-d-visitor-in', 'Record visitor entry', 'During Shift', true),
      item('s-d-visitor-verify', 'Verify visitor purpose', 'During Shift'),
      item('s-d-visitor-out', 'Record visitor exit', 'During Shift'),
      item('s-d-delivery', 'Record delivery entry', 'During Shift'),
      item('s-d-vendor', 'Record vendor entry', 'During Shift'),
      item('s-d-cab', 'Record cab / auto / taxi movement', 'During Shift'),
      item('s-d-staff', 'Record staff movement', 'During Shift'),
      item('s-d-unusual', 'Record unusual activity', 'During Shift'),
      item('s-d-cctv', 'Monitor CCTV', 'During Shift'),
      item('s-d-gate', 'Monitor main gate', 'During Shift', true),
      item('s-d-entry', 'Do not allow unauthorized entry', 'During Shift', true),
      item('s-d-incident', 'Report security incidents', 'During Shift', true),
      item('s-end-visitors', 'Complete visitor records', 'End of Shift'),
      item('s-end-gate', 'Complete gate movement records', 'End of Shift'),
      item('s-end-incident', 'Record incidents', 'End of Shift'),
      item('s-end-pending', 'Record pending issues', 'End of Shift'),
      item('s-end-handover', 'Handover to next shift', 'End of Shift', true),
      item('s-end-report', 'Submit shift report', 'End of Shift', true),
    ],
  },
  {
    role: 'Housekeeping',
    title: 'Housekeeping Daily Checklist',
    frequency: 'Daily',
    items: [
      item('h-clean-entrance', 'Clean entrance', 'Daily Cleaning', true),
      item('h-clean-lobby', 'Clean lobby / reception', 'Daily Cleaning', true),
      item('h-clean-corridor', 'Clean corridors', 'Daily Cleaning', true),
      item('h-clean-stairs', 'Clean staircases', 'Daily Cleaning'),
      item('h-clean-common', 'Clean common areas', 'Daily Cleaning', true),
      item('h-clean-washroom', 'Clean washrooms', 'Daily Cleaning', true),
      item('h-clean-touch', 'Clean frequently touched surfaces', 'Daily Cleaning'),
      item('h-garbage', 'Remove garbage', 'Daily Cleaning', true),
      item('h-dustbins', 'Check dustbins', 'Daily Cleaning'),
      item('h-mop', 'Mop required areas', 'Daily Cleaning'),
      item('h-water', 'Check water availability', 'Daily Cleaning'),
      item('h-materials', 'Check cleaning materials', 'Daily Cleaning'),
      item('h-equipment', 'Check cleaning equipment', 'Daily Cleaning'),
      item('h-i-smell', 'Check for bad smell', 'Inspection'),
      item('h-i-leak', 'Check for leakage', 'Inspection'),
      item('h-i-damage', 'Check for damaged fixtures', 'Inspection'),
      item('h-i-drains', 'Check for blocked drains', 'Inspection'),
      item('h-i-lights', 'Check for broken lights / fans', 'Inspection'),
      item('h-i-report', 'Report maintenance issues', 'Inspection', true),
      item('h-i-missing', 'Report missing / damaged items', 'Inspection'),
      item('h-c-complete', 'Complete assigned cleaning', 'Closing', true),
      item('h-c-dispose', 'Dispose of garbage', 'Closing', true),
      item('h-c-store', 'Clean / store cleaning equipment', 'Closing'),
      item('h-c-stock', 'Check cleaning material stock', 'Closing'),
      item('h-c-shortage', 'Report shortages', 'Closing'),
      item('h-c-pending', 'Report pending cleaning work', 'Closing'),
      item('h-c-status', 'Submit daily cleaning status', 'Closing', true),
    ],
  },
  {
    role: 'Maintenance',
    title: 'Maintenance Daily Checklist',
    frequency: 'Daily',
    items: [
      item('m-d-electrical', 'Check electrical complaints', 'Daily Inspection', true),
      item('m-d-lights', 'Check lights', 'Daily Inspection'),
      item('m-d-fans', 'Check fans', 'Daily Inspection'),
      item('m-d-switches', 'Check switches / sockets', 'Daily Inspection'),
      item('m-d-water', 'Check water supply complaints', 'Daily Inspection', true),
      item('m-d-taps', 'Check taps', 'Daily Inspection'),
      item('m-d-toilets', 'Check toilets', 'Daily Inspection'),
      item('m-d-plumbing', 'Check plumbing / leakage', 'Daily Inspection'),
      item('m-d-doors', 'Check doors', 'Daily Inspection'),
      item('m-d-locks', 'Check locks', 'Daily Inspection'),
      item('m-d-windows', 'Check windows', 'Daily Inspection'),
      item('m-d-equipment', 'Check common-area equipment', 'Daily Inspection'),
      item('m-d-reported', 'Check reported maintenance issues', 'Daily Inspection', true),
      item('m-r-review', 'Review complaint', 'Assigned Repairs'),
      item('m-r-visit', 'Visit location', 'Assigned Repairs'),
      item('m-r-record', 'Record issue', 'Assigned Repairs'),
      item('m-r-priority', 'Set priority', 'Assigned Repairs'),
      item('m-r-start', 'Start repair', 'Assigned Repairs'),
      item('m-r-update', 'Update status', 'Assigned Repairs'),
      item('m-r-material', 'Record required material', 'Assigned Repairs'),
      item('m-r-complete', 'Complete repair', 'Assigned Repairs', true),
      item('m-r-verify', 'Verify repair', 'Assigned Repairs', true),
      item('m-r-photo', 'Take photo where required', 'Assigned Repairs'),
      item('m-r-close', 'Close task', 'Assigned Repairs'),
      item('m-c-pending', 'Review pending complaints', 'Closing'),
      item('m-c-unresolved', 'Record unresolved issues', 'Closing'),
      item('m-c-material', 'Record material requirements', 'Closing'),
      item('m-c-escalate', 'Escalate urgent issues', 'Closing'),
      item('m-c-report', 'Submit maintenance report', 'Closing', true),
    ],
  },
  {
    role: 'Cook/Kitchen Staff',
    title: 'Kitchen Daily Checklist',
    frequency: 'Daily',
    items: [
      item('k-b-clean', 'Check kitchen cleanliness', 'Before Cooking', true),
      item('k-b-surfaces', 'Clean required work surfaces', 'Before Cooking'),
      item('k-b-gas', 'Check gas / electric cooking equipment', 'Before Cooking', true),
      item('k-b-lpg', 'Check LPG / gas connection condition', 'Before Cooking', true),
      item('k-b-water', 'Check water availability', 'Before Cooking'),
      item('k-b-veg', 'Check vegetables / raw materials', 'Before Cooking'),
      item('k-b-grains', 'Check rice / flour / pulses / other ingredients', 'Before Cooking'),
      item('k-b-spices', 'Check spices and cooking materials', 'Before Cooking'),
      item('k-b-fridge', 'Check refrigerator / storage', 'Before Cooking'),
      item('k-b-leftover', "Check previous day's leftover stock", 'Before Cooking'),
      item('k-b-utensils', 'Check required utensils', 'Before Cooking'),
      item('k-d-hygiene', 'Follow required hygiene practices', 'During Cooking', true),
      item('k-d-clean', 'Keep cooking area clean', 'During Cooking'),
      item('k-d-prep', 'Check food preparation requirements', 'During Cooking'),
      item('k-d-quantity', 'Maintain required meal quantities', 'During Cooking', true),
      item('k-d-quality', 'Check food quality', 'During Cooking', true),
      item('k-d-separation', 'Keep raw and cooked food separated', 'During Cooking'),
      item('k-d-shortage', 'Record shortages', 'During Cooking'),
      item('k-d-equipment', 'Report damaged equipment', 'During Cooking'),
      item('k-d-ingredients', 'Report ingredient shortages', 'During Cooking'),
      item('k-c-store', 'Store remaining ingredients appropriately', 'Closing'),
      item('k-c-area', 'Clean cooking area', 'Closing', true),
      item('k-c-utensils', 'Clean utensils', 'Closing', true),
      item('k-c-surfaces', 'Clean work surfaces', 'Closing'),
      item('k-c-waste', 'Dispose of waste', 'Closing', true),
      item('k-c-fridge', 'Check refrigerator / storage', 'Closing'),
      item('k-c-off', 'Turn off equipment as applicable', 'Closing', true),
      item('k-c-gas', 'Check gas / electrical equipment', 'Closing', true),
      item('k-c-shortage', 'Report shortages', 'Closing'),
      item('k-c-issues', 'Report kitchen issues', 'Closing'),
      item('k-c-status', 'Submit kitchen status', 'Closing', true),
    ],
  },
  {
    role: 'Inventory/Store Staff',
    title: 'Inventory / Store Daily Checklist',
    frequency: 'Daily',
    items: [
      item('i-o-stock', 'Check opening stock', 'Opening', true),
      item('i-o-previous', "Check previous day's stock", 'Opening'),
      item('i-o-verify', 'Verify important items', 'Opening'),
      item('i-o-low', 'Check low-stock items', 'Opening', true),
      item('i-o-condition', 'Check storage condition', 'Opening'),
      item('i-d-received', 'Record received items', 'During Operations'),
      item('i-d-issued', 'Record issued items', 'During Operations'),
      item('i-d-update', 'Update stock', 'During Operations', true),
      item('i-d-quantity', 'Check quantities', 'During Operations'),
      item('i-d-damaged', 'Record damaged items', 'During Operations'),
      item('i-d-expired', 'Record expired items', 'During Operations'),
      item('i-d-storage', 'Maintain proper storage', 'During Operations'),
      item('i-d-shortage', 'Report shortages', 'During Operations'),
      item('i-c-closing', 'Verify closing stock', 'Closing', true),
      item('i-c-low', 'Identify low-stock items', 'Closing'),
      item('i-c-reorder', 'Identify items requiring reorder', 'Closing'),
      item('i-c-diff', 'Record discrepancies', 'Closing'),
      item('i-c-secure', 'Secure storage area', 'Closing', true),
      item('i-c-status', 'Submit inventory status', 'Closing', true),
    ],
  },
  {
    role: 'Reception/Front Desk',
    title: 'Front Desk Daily Checklist',
    frequency: 'Daily',
    items: [
      item('r-d-area', 'Check reception area', 'Front Desk', true),
      item('r-d-visreg', 'Check visitor register', 'Front Desk'),
      item('r-d-expected', 'Check expected visitors', 'Front Desk'),
      item('r-d-entry', 'Record visitor entries', 'Front Desk', true),
      item('r-d-exit', 'Record visitor exits', 'Front Desk'),
      item('r-d-enquiry', 'Handle resident / tenant enquiries', 'Front Desk', true),
      item('r-d-complaints', 'Record complaints', 'Front Desk', true),
      item('r-d-forward', 'Forward complaints to appropriate staff', 'Front Desk'),
      item('r-d-deliveries', 'Check deliveries', 'Front Desk'),
      item('r-d-vendor', 'Record vendor / delivery entries', 'Front Desk'),
      item('r-d-tasks', 'Check pending front-desk tasks', 'Front Desk'),
      item('r-d-handover', 'Complete handover', 'Front Desk'),
      item('r-d-report', 'Submit daily front-desk report', 'Front Desk', true),
    ],
  },
  {
    role: 'Caretaker',
    title: 'Caretaker Daily Checklist',
    frequency: 'Daily',
    items: [
      item('c-i-property', 'Inspect property', 'Caretaker', true),
      item('c-i-common', 'Check common areas', 'Caretaker'),
      item('c-i-water', 'Check water supply', 'Caretaker', true),
      item('c-i-electricity', 'Check electricity', 'Caretaker'),
      item('c-i-clean', 'Check cleanliness', 'Caretaker'),
      item('c-i-security', 'Check security', 'Caretaker'),
      item('c-i-maintenance', 'Check maintenance complaints', 'Caretaker'),
      item('c-i-residents', 'Check resident complaints', 'Caretaker'),
      item('c-i-visitors', 'Check visitor records', 'Caretaker'),
      item('c-i-housekeeping', 'Coordinate with housekeeping', 'Caretaker'),
      item('c-i-maintenance2', 'Coordinate with maintenance', 'Caretaker'),
      item('c-i-damage', 'Check property damage', 'Caretaker'),
      item('c-i-urgent', 'Report urgent issues', 'Caretaker', true),
      item('c-i-inspection', 'Complete daily property inspection', 'Caretaker', true),
      item('c-i-report', 'Submit caretaker report', 'Caretaker', true),
    ],
  },
  {
    role: 'Operations Staff',
    title: 'General Staff Shift Checklist',
    frequency: 'Daily',
    items: [
      item('g-s-tasks', 'Check assigned tasks', 'Start of Shift', true),
      item('g-s-area', 'Check work area', 'Start of Shift'),
      item('g-s-equipment', 'Check required equipment', 'Start of Shift'),
      item('g-s-materials', 'Check required materials', 'Start of Shift'),
      item('g-s-instructions', 'Review instructions', 'Start of Shift'),
      item('g-s-issues', 'Report any issue before starting work', 'Start of Shift'),
      item('g-e-tasks', 'Complete assigned tasks', 'End of Shift', true),
      item('g-e-incomplete', 'Update incomplete tasks', 'End of Shift'),
      item('g-e-problems', 'Report problems', 'End of Shift'),
      item('g-e-return', 'Return / store equipment', 'End of Shift'),
      item('g-e-handover', 'Complete handover', 'End of Shift', true),
      item('g-e-status', 'Submit shift status', 'End of Shift', true),
    ],
  },
  // Legacy duty-role mappings — reuse the closest operational checklist.
  {
    role: 'Housekeeper',
    title: 'Housekeeping Daily Checklist',
    frequency: 'Daily',
    items: [],
  },
  {
    role: 'Mess Cook',
    title: 'Kitchen Daily Checklist',
    frequency: 'Daily',
    items: [],
  },
  {
    role: 'Electrician',
    title: 'Maintenance Daily Checklist',
    frequency: 'Daily',
    items: [],
  },
  {
    role: 'Manager',
    title: 'General Staff Shift Checklist',
    frequency: 'Daily',
    items: [],
  },
];

export const templateForRole = (role: string): ChecklistTemplate | undefined =>
  CHECKLIST_TEMPLATES.find((t) => t.role === role);

/**
 * Legacy duty roles inherit the items of the modern role they map to, so an
 * old "Mess Cook" staff member still gets the kitchen checklist.
 */
export function itemsForRole(role: string): ChecklistItemTemplate[] {
  const template = templateForRole(role);
  if (template && template.items.length > 0) return template.items;
  const alias: Record<string, string> = {
    Housekeeper: 'Housekeeping',
    'Mess Cook': 'Cook/Kitchen Staff',
    Electrician: 'Maintenance',
    Manager: 'Operations Staff',
  };
  const mapped = alias[role] ? templateForRole(alias[role]) : undefined;
  return mapped?.items || [];
}

export const titleForRole = (role: string): string =>
  templateForRole(role)?.title || `${role} Daily Checklist`;

/** Roles a staff member holds — merges the legacy single role with multi-roles. */
export function rolesOf(staff: { role: string; roles?: string[] }): string[] {
  const base = rolesList(staff.roles) || [];
  if (base.length > 0) return base;
  return staff.role ? [staff.role] : [];
}

function rolesList(roles?: string[]): string[] | null {
  if (Array.isArray(roles) && roles.length > 0) return roles;
  return null;
}
