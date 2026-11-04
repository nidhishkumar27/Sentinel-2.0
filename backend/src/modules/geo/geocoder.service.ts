import axios from 'axios';
import { env } from '../../config/env';
import { emitToAuthorities } from '../../sockets';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import { Incident } from '../incidents/incident.model';
import { toMarker } from '../incidents/incident.presenter';

export interface Place {
  label: string;
  lat: number;
  lng: number;
  type?: string;
}
export interface ReverseResult {
  label: string;
  address: Record<string, string>;
}

/** Pure formatters (unit-tested). Provider: OpenStreetMap Nominatim. */
export function formatReverse(raw: any): ReverseResult | null {
  if (!raw || raw.error || !raw.display_name) return null;
  return { label: String(raw.display_name), address: raw.address ?? {} };
}
export function formatSearch(raw: any): Place[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && r.display_name && Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lon)))
    .map((r) => ({ label: String(r.display_name), lat: Number(r.lat), lng: Number(r.lon), type: r.type }));
}

// Nominatim blocks placeholder contacts (e.g. "you@example.com") with HTTP 403,
// which surfaces in the app as "Location search is unavailable". Fall back to a
// generic application identifier when the configured agent still has one.
const PLACEHOLDER_UA = /example\.(com|org|net)|you@|your[-\s]?(e-?mail|contact)/i;
export function resolveGeocoderUserAgent(configured: string): string {
  return PLACEHOLDER_UA.test(configured) ? 'SentinelSafetyPlatform/2.0' : configured;
}
const geocoderUserAgent = resolveGeocoderUserAgent(env.GEOCODER_USER_AGENT);
if (geocoderUserAgent !== env.GEOCODER_USER_AGENT) {
  logger.warn(
    'GEOCODER_USER_AGENT contains a placeholder contact, which Nominatim blocks (HTTP 403). ' +
      'Using a generic application identifier instead — set a real contact email to comply with the Nominatim usage policy.'
  );
}

const client = axios.create({
  baseURL: env.GEOCODER_URL,
  // Nominatim frequently takes 5s+ on uncached queries; 6s caused spurious
  // "Location search is unavailable" timeouts. Results are cached for 24h.
  timeout: 12000,
  headers: { 'User-Agent': geocoderUserAgent, 'Accept-Language': 'en' },
});

// Nominatim's usage policy allows max 1 request/second: serialise + space out calls, and cache for 24h.
let chain: Promise<unknown> = Promise.resolve();
let lastCall = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, lastCall + 1100 - Date.now());
    if (wait) await sleep(wait);
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

const TTL_MS = 24 * 3600 * 1000;
const MAX_CACHE = 2000;
const cache = new Map<string, { v: unknown; at: number }>();
function cacheGet<T>(k: string): T | undefined {
  const h = cache.get(k);
  if (!h) return undefined;
  if (Date.now() - h.at > TTL_MS) {
    cache.delete(k);
    return undefined;
  }
  return h.v as T;
}
function cacheSet(k: string, v: unknown) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
  cache.set(k, { v, at: Date.now() });
}

async function call(path: string, params: Record<string, unknown>) {
  try {
    return await throttled(async () => (await client.get(path, { params })).data);
  } catch (e) {
    logger.warn(`geocoder ${path} failed:`, (e as Error).message);
    throw new ApiError(503, 'Geocoding service is currently unavailable', undefined, 'GEOCODER_UNAVAILABLE');
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseResult | null> {
  const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = cacheGet<ReverseResult | null>(key);
  if (hit !== undefined) return hit;
  const result = formatReverse(await call('/reverse', { format: 'jsonv2', lat, lon: lng, zoom: 18, addressdetails: 1 }));
  cacheSet(key, result);
  return result;
}

export async function searchPlaces(q: string, limit = 5): Promise<Place[]> {
  const key = `s:${limit}:${q.trim().toLowerCase()}`;
  const hit = cacheGet<Place[]>(key);
  if (hit) return hit;
  const result = formatSearch(await call('/search', { format: 'jsonv2', q, limit }));
  cacheSet(key, result);
  return result;
}

/** Best-effort, background: turn the SOS coordinates into a readable address for responders. */
export async function enrichIncidentAddress(incidentId: unknown) {
  const incident: any = await Incident.findOne({ _id: incidentId, address: { $exists: false } }).select('location');
  if (!incident) return;
  const [lng, lat] = incident.location.coordinates as number[];
  const r = await reverseGeocode(lat, lng).catch(() => null);
  if (!r) return;
  const updated = await Incident.findOneAndUpdate({ _id: incidentId, address: { $exists: false } }, { $set: { address: r.label } }, { new: true });
  if (updated) emitToAuthorities('incident:updated', toMarker(updated));
}
