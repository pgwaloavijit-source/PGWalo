type ListingRecord = Record<string, unknown>;

export function compactMediaUrl(url?: string, fallback = '') {
  if (!url) return fallback;
  if (url.startsWith('/api/media') || url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('data:') && url.length > 450000) return fallback;
  return url;
}

export function rowToProperty(row: ListingRecord): ListingRecord {
  const parseJson = (value: unknown, fallback: unknown) => {
    if (Array.isArray(value) || (value && typeof value === 'object' && !Array.isArray(value))) return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }
    return fallback;
  };

  const rooms = parseJson(row.rooms, []);
  const gallery = parseJson(row.gallery_images ?? row.galleryImages, []) as string[];
  const amenities = parseJson(row.amenities, []);
  const rules = parseJson(row.rules, []);
  const cover = compactMediaUrl(
    String(row.cover_image ?? row.coverImage ?? ''),
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'
  );

  return {
    id: String(row.id),
    organizationId: String(row.organization_id ?? row.organizationId ?? ''),
    status: row.status || 'Active',
    name: String(row.name || 'PG'),
    tagline: String(row.tagline || ''),
    gender: row.gender || 'Unisex',
    city: String(row.city || ''),
    locality: String(row.locality || ''),
    address: String(row.address || ''),
    lat: Number(row.lat) || 0,
    lng: Number(row.lng) || 0,
    placeLabel: String(row.place_label ?? row.placeLabel ?? ''),
    coverImage: cover,
    galleryImages: (gallery.length ? gallery : [cover]).map((u) => compactMediaUrl(u, cover)).filter(Boolean),
    startingPrice: Number(row.starting_price ?? row.startingPrice) || 0,
    rating: Number(row.rating) || 0,
    reviewCount: Number(row.review_count ?? row.reviewCount) || 0,
    rooms: Array.isArray(rooms) ? rooms : [],
    amenities: Array.isArray(amenities) ? amenities : [],
    rules: Array.isArray(rules) ? rules : [],
    noticePeriodDays: Number(row.notice_period_days ?? row.noticePeriodDays) || 30,
    gateClosingTime: String((row.gate_closing_time ?? row.gateClosingTime) || ''),
    foodIncluded: Boolean(row.food_included ?? row.foodIncluded),
    verified: Boolean(row.verified),
    featured: Boolean(row.featured),
    contactPhone: String(row.contact_phone ?? row.contactPhone ?? ''),
    contactEmail: String(row.contact_email ?? row.contactEmail ?? ''),
    ownerName: String(row.owner_name ?? row.ownerName ?? ''),
    ownerUserId: String(row.owner_user_id ?? row.ownerUserId ?? ''),
    listingStatus: 'Active',
    floors: Number(row.total_floors ?? row.floors) || undefined,
  };
}

export function propertyToRow(property: ListingRecord) {
  const fallback = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80';
  const cover = compactMediaUrl(String(property.coverImage || ''), fallback);
  const gallery = (Array.isArray(property.galleryImages) ? property.galleryImages as string[] : [])
    .map((u) => compactMediaUrl(u, ''))
    .filter(Boolean)
    .slice(0, 6);
  return {
    id: property.id,
    organization_id: property.organizationId || `org-${property.ownerUserId || 'public'}`,
    status: property.status || 'Active',
    name: property.name,
    tagline: property.tagline || '',
    gender: property.gender || 'Unisex',
    city: property.city,
    locality: property.locality,
    address: property.address || `${property.locality || ''}, ${property.city || ''}`.replace(/^, |, $/g, ''),
    lat: Number(property.lat) || 0,
    lng: Number(property.lng) || 0,
    cover_image: cover,
    gallery_images: JSON.stringify(gallery.length ? gallery : [cover]),
    starting_price: Number(property.startingPrice) || 0,
    rating: property.rating || 0,
    review_count: property.reviewCount || 0,
    rooms: JSON.stringify(property.rooms || []),
    amenities: JSON.stringify(property.amenities || []),
    rules: JSON.stringify(property.rules || []),
    notice_period_days: property.noticePeriodDays || 30,
    gate_closing_time: property.gateClosingTime || '',
    food_included: property.foodIncluded ? 1 : 0,
    verified: property.verified ? 1 : 0,
    featured: property.featured ? 1 : 0,
    contact_phone: property.contactPhone || '',
    contact_email: property.contactEmail || '',
    owner_name: property.ownerName || '',
    owner_user_id: property.ownerUserId || '',
    place_label: property.placeLabel || '',
    default_rent_due_day: property.defaultRentDueDay || 7,
    total_floors: property.floors || property.totalFloors || 1,
  };
}
