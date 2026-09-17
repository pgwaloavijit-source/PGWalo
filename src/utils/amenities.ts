export const AMENITIES = [
  { id: 'wifi', name: 'Wi-Fi' },
  { id: 'ac', name: 'AC' },
  { id: 'three_time_food', name: '3-Time Food' },
  { id: 'washing_machine_iron', name: 'Washing Machine & Iron' },
  { id: 'attached_western_washroom', name: 'Attached Western Washroom' },
  { id: 'generator_backup', name: 'Generator Backup' },
  { id: 'cctv_biometric', name: 'CCTV/Biometric' },
  { id: 'gym_yoga', name: 'Gym/Yoga' },
  { id: 'ro_water', name: 'RO Water' },
  { id: 'housekeeping', name: 'Housekeeping' },
  { id: 'hot_water', name: 'Hot Water' },
  { id: 'parking', name: 'Parking' },
  { id: 'study_table_chair', name: 'Study Table/Chair' },
  { id: 'refrigerator', name: 'Refrigerator' },
  { id: 'laundry', name: 'Laundry' },
  { id: 'lift', name: 'Lift' },
  { id: 'tv_lounge', name: 'TV Lounge' },
  { id: 'rooftop', name: 'Rooftop' },
  { id: 'security_guard', name: 'Security Guard' },
  { id: 'fire_safety', name: 'Fire Safety' },
  { id: 'power_backup', name: 'Power Backup' },
  { id: 'drinking_water', name: 'Drinking Water' },
  { id: 'kitchen_access', name: 'Kitchen Access' },
  { id: 'balcony', name: 'Balcony' },
  { id: 'smart_tv', name: 'Smart TV' },
] as const;

export const AMENITY_LABELS: Record<string, string> = Object.fromEntries(
  AMENITIES.map((amenity) => [amenity.id, amenity.name])
);

const AMENITY_ALIASES: Record<string, string> = {
  high_speed_wifi: 'wifi',
  high_speed_wi_fi: 'wifi',
  wifi: 'wifi',
  wi_fi: 'wifi',
  air_conditioning: 'ac',
  ac: 'ac',
  homely_food: 'three_time_food',
  food: 'three_time_food',
  three_time_homely_food: 'three_time_food',
  washing_machine_iron: 'washing_machine_iron',
  attached_bath: 'attached_western_washroom',
  attached_bathroom: 'attached_western_washroom',
  attached_western_washroom: 'attached_western_washroom',
  generator_backup: 'generator_backup',
  cctv: 'cctv_biometric',
  cctv_biometric_entry: 'cctv_biometric',
  cctv_biometric: 'cctv_biometric',
  fitness_gym_yoga: 'gym_yoga',
  gym: 'gym_yoga',
  gym_yoga: 'gym_yoga',
  mineral_ro_water: 'ro_water',
  ro_water: 'ro_water',
  daily_housekeeping: 'housekeeping',
  housekeeping: 'housekeeping',
  hot_water_geyser: 'hot_water',
  geyser: 'hot_water',
  hot_water: 'hot_water',
  covered_parking: 'parking',
  parking: 'parking',
  study_table: 'study_table_chair',
  study_zone: 'study_table_chair',
  study_table_chair: 'study_table_chair',
  refrigerator: 'refrigerator',
  laundry_service: 'laundry',
  laundry: 'laundry',
  lift_elevator: 'lift',
  lift: 'lift',
  common_tv_lounge: 'tv_lounge',
  tv_lounge: 'tv_lounge',
  rooftop_terrace: 'rooftop',
  terrace: 'rooftop',
  rooftop: 'rooftop',
  security_guard: 'security_guard',
  fire_safety_system: 'fire_safety',
  fire_safety: 'fire_safety',
  power_backup: 'power_backup',
  drinking_water: 'drinking_water',
  kitchen_access: 'kitchen_access',
  balcony: 'balcony',
  tv: 'smart_tv',
  smart_tv: 'smart_tv',
};

export const normalizeAmenityId = (value: string) => {
  const key = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return AMENITY_ALIASES[key] || key;
};

export const normalizeAmenities = (ids: string[] = []) => {
  const allowed = new Set(AMENITIES.map((amenity) => amenity.id));
  return Array.from(new Set(ids.map(normalizeAmenityId).filter((id) => allowed.has(id))));
};

export const amenityLabel = (id: string) => AMENITY_LABELS[normalizeAmenityId(id)] || id.replace(/[-_]/g, ' ');
