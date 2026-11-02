import axios from 'axios';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { toPoint } from '../../utils/geo';
import { logger } from '../../utils/logger';
import { SafetyZone } from './zone.model';

const AMENITY_TO_CATEGORY: Record<string, string> = {
  hospital: 'hospital',
  clinic: 'hospital',
  police: 'police_station',
  fire_station: 'fire_station',
};
const LABEL: Record<string, string> = { hospital: 'hospital', police_station: 'police station', fire_station: 'fire station', safe_shelter: 'shelter' };

/** OSM element → our zone shape (pure, unit-tested). Returns null for elements we cannot place or classify. */
export function osmElementToZone(el: any) {
  const tags = el?.tags ?? {};
  const lat = el?.lat ?? el?.center?.lat;
  const lng = el?.lon ?? el?.center?.lon;
  if (lat == null || lng == null || el?.id == null) return null;

  let category: string | undefined = AMENITY_TO_CATEGORY[tags.amenity];
  if (!category && (tags.emergency === 'assembly_point' || tags.social_facility === 'shelter')) category = 'safe_shelter';
  if (!category) return null;

  return {
    externalId: `${el.type}/${el.id}`,
    name: String(tags.name ?? tags['name:en'] ?? `Unnamed ${LABEL[category]}`).slice(0, 120),
    category,
    lat: Number(lat),
    lng: Number(lng),
    phone: tags.phone ?? tags['contact:phone'],
    notes: tags.operator ? `Operator: ${tags.operator}`.slice(0, 500) : undefined,
  };
}

export function buildOverpassQuery(lat: number, lng: number, radiusM: number) {
  const around = `(around:${Math.round(radiusM)},${lat},${lng})`;
  return `[out:json][timeout:30];(
  nw["amenity"~"^(hospital|clinic|police|fire_station)$"]${around};
  nw["emergency"="assembly_point"]${around};
  nw["social_facility"="shelter"]${around};
);out center tags 500;`;
}

/**
 * Imports hospitals, police and fire stations, and shelters around a point from OpenStreetMap.
 * Imported rows are UNVERIFIED unless `verify` is true; an authority reviews and verifies them.
 * Re-running is safe (upsert by source + externalId); existing verification is never reset.
 */
export async function importFacilitiesFromOSM(p: { lat: number; lng: number; radiusM: number }, o: { verify?: boolean; createdBy?: unknown } = {}) {
  let elements: any[];
  try {
    const { data } = await axios.post(env.OVERPASS_URL, `data=${encodeURIComponent(buildOverpassQuery(p.lat, p.lng, p.radiusM))}`, {
      timeout: 45_000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': env.GEOCODER_USER_AGENT },
    });
    elements = Array.isArray(data?.elements) ? data.elements : [];
  } catch (e) {
    logger.warn('overpass failed:', (e as Error).message);
    throw new ApiError(503, 'Facility data source is currently unavailable', undefined, 'FACILITY_SOURCE_UNAVAILABLE');
  }

  const zones = new Map<string, NonNullable<ReturnType<typeof osmElementToZone>>>();
  for (const el of elements) {
    const z = osmElementToZone(el);
    if (z) zones.set(z.externalId, z);
  }
  if (!zones.size) return { fetched: elements.length, usable: 0, created: 0, updated: 0 };

  const now = new Date();
  const ops = [...zones.values()].map((z) => ({
    updateOne: {
      filter: { source: 'osm', externalId: z.externalId },
      update: {
        $set: {
          name: z.name,
          category: z.category,
          location: toPoint(z.lat, z.lng),
          ...(z.phone ? { phone: z.phone } : {}),
          ...(z.notes ? { notes: z.notes } : {}),
          ...(o.verify ? { verified: true, lastVerifiedAt: now } : {}),
        },
        $setOnInsert: { radiusM: 150, ...(o.verify ? {} : { verified: false }), ...(o.createdBy ? { createdBy: o.createdBy } : {}) },
      },
      upsert: true,
    },
  }));
  const r = await SafetyZone.bulkWrite(ops as any);
  return { fetched: elements.length, usable: zones.size, created: r.upsertedCount, updated: r.modifiedCount };
}
