export function localIsoDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const VISIT_SLOTS = [
  { id: 'Morning (10:00 AM - 12:00 PM)', label: 'Morning · 10:00 AM – 12:00 PM', endHour: 12 },
  { id: 'Afternoon (2:00 PM - 4:00 PM)', label: 'Afternoon · 2:00 PM – 4:00 PM', endHour: 16 },
  { id: 'Evening (5:00 PM - 7:00 PM)', label: 'Evening · 5:00 PM – 7:00 PM', endHour: 19 },
] as const;

export type VisitSlotId = (typeof VISIT_SLOTS)[number]['id'];

export function availableVisitSlots(date: string, now = new Date()): typeof VISIT_SLOTS[number][] {
  if (date > localIsoDate(now)) return [...VISIT_SLOTS];
  if (date < localIsoDate(now)) return [];
  const hour = now.getHours() + now.getMinutes() / 60;
  return VISIT_SLOTS.filter((slot) => hour < slot.endHour - 0.25);
}

export function defaultVisitDate(now = new Date()): string {
  const today = localIsoDate(now);
  return availableVisitSlots(today, now).length ? today : localIsoDate(new Date(now.getTime() + 86400000));
}

export function defaultVisitSlot(date: string, now = new Date()): VisitSlotId {
  return (availableVisitSlots(date, now)[0]?.id || VISIT_SLOTS[0].id) as VisitSlotId;
}
