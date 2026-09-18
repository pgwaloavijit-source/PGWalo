import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { addCorsHeaders } from '../utils/cors';

function json(data: unknown, status = 200) {
  return addCorsHeaders(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

/** A cheap instruction model on Workers AI; swapped here, nowhere else. */
const TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

const INR = (n: unknown): string => {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? `₹${v.toLocaleString('en-IN')}` : '';
};

function templateCopy(p: Record<string, unknown>): {
  headline: string;
  description: string;
  highlights: string[];
} {
  const name = String(p.propertyName || 'This PG');
  const city = String(p.city || 'your city');
  const locality = String(p.locality || city);
  const food = String(p.foodType || '');
  const gender = String(p.gender || 'Unisex');
  const min = INR(p.minRent);
  const highlights = [
    `Prime location in ${locality}, ${city}`,
    min ? `Plans from ${min}/month (all-inclusive)` : 'Flexible plans for every budget',
    food ? `Food: ${food}` : 'Meals available',
    'Verified listing with online visits & instant booking',
  ];
  return {
    headline: `${name} — Comfortable co-living in ${locality}, ${city}`,
    description: `Stay at ${name}, a ${gender === 'Unisex' ? 'co-living' : gender.toLowerCase()} PG in ${locality}, ${city}. Well-ventilated rooms, regular cleaning and a safe, friendly community.${food ? ` Includes ${food}.` : ''}${min ? ` Rents start at ${min}/month` : ''} with transparent billing and a simple move-in process. Book a visit or reserve your bed online in minutes.`,
    highlights,
  };
}

function extractJson(text: string): { headline?: string; description?: string; highlights?: string[] } | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { headline?: string; description?: string; highlights?: string[] };
    return parsed;
  } catch {
    return null;
  }
}

export async function aiListingCopyHandler(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = await authMiddleware(request, env);
  if (!auth.success) return json({ error: auth.error }, 401);

  const body = (await request.json().catch(() => ({}))) as { property?: Record<string, unknown> };
  const property = body.property || {};
  if (!String(property.propertyName || '').trim()) {
    return json({ error: 'propertyName is required' }, 400);
  }

  const fallback = templateCopy(property);
  if (!env.AI) {
    // No AI binding (e.g. local dev): the structured template IS the product —
    // deterministic, on-brand copy every time.
    return json({ ...fallback, source: 'template' });
  }

  try {
    const name = String(property.propertyName);
    const city = String(property.city || '');
    const locality = String(property.locality || '');
    const food = String(property.foodType || 'meals available');
    const gender = String(property.gender || 'Unisex');
    const min = INR(property.minRent);
    const max = INR(property.maxRent);
    const range = min && max && min !== max ? `${min}–${max}` : min || 'affordable';

    const prompt = [
      { role: 'system', content: 'You write short, factual PG-rental listing copy for the Indian market. Never invent amenities, addresses or prices that were not given. Reply with JSON only.' },
      {
        role: 'user',
        content: `Write listing copy for this PG. JSON object with keys "headline" (max 70 chars), "description" (2-3 sentences), "highlights" (exactly 4 short strings). Facts: name=${name}; area=${locality}; city=${city}; occupants=${gender}; food=${food}; monthly rent range=${range}.`,
      },
    ];

    const result = await env.AI.run(TEXT_MODEL, {
      messages: prompt,
      max_tokens: 420,
    } as never);

    const raw = typeof result === 'string' ? result : ((result as { response?: string }).response ?? '');
    const parsed = extractJson(raw);
    if (parsed?.headline && parsed?.description) {
      return json({
        headline: String(parsed.headline).slice(0, 140),
        description: String(parsed.description).slice(0, 900),
        highlights: Array.isArray(parsed.highlights)
          ? parsed.highlights.map((h) => String(h).slice(0, 120)).slice(0, 6)
          : fallback.highlights,
        source: 'ai',
      });
    }
    return json({ ...fallback, source: 'template' });
  } catch {
    // Quota, model error, cold start — the owner still gets good copy.
    return json({ ...fallback, source: 'template' });
  }
}
