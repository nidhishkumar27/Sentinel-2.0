import { Alert } from '../alerts/alert.model';
import { RESOURCE_CATEGORIES_FOR, Category, deriveSeverity } from '../incidents/incident.constants';
import { Incident } from '../incidents/incident.model';
import { findNearbyResources } from '../safety-map/zones.service';
import { getWeather } from '../weather/weather.service';

const DAY = 24 * 3600 * 1000;

async function weatherOrNull(lat: number, lng: number) {
  try {
    const w = await getWeather(lat, lng);
    return { summary: w.current.summary, current: w.current, advisories: w.advisories, providerTime: w.providerTime, stale: w.stale, source: w.source.name };
  } catch {
    return null;
  }
}

/**
 * Incident context sent to the AI engine (schemaVersion 1.0).
 * Contains confirmed facts + an explicit `unknown` list so the AI cannot silently guess.
 * NEVER contains the reporter's name, phone, email, contacts or Digital ID.
 */
export async function buildIncidentContext(incident: any) {
  const [lng, lat] = incident.location.coordinates as number[];
  const [resources, weather] = await Promise.all([
    findNearbyResources(lat, lng, { radiusM: 5000, categories: RESOURCE_CATEGORIES_FOR[incident.category as Category], limit: 8 }).catch(() => []),
    weatherOrNull(lat, lng),
  ]);

  const unknown: string[] = [];
  if (!incident.description) unknown.push('description_or_symptoms');
  if (incident.locationAccuracyM == null) unknown.push('location_accuracy');
  if (!weather) unknown.push('weather');
  if (!resources.length) unknown.push('nearby_verified_facilities');

  return {
    schemaVersion: '1.0',
    incident: {
      id: String(incident._id),
      reference: incident.reference,
      category: incident.category,
      severity: deriveSeverity(incident.category), // deterministic, not AI generated
      status: incident.status,
      createdAt: new Date(incident.createdAt).toISOString(),
      deviceTimestamp: incident.clientTimestamp ? new Date(incident.clientTimestamp).toISOString() : null,
      description: incident.description ?? null,
      additionalInfo: (incident.additionalInfo ?? []).map((a: any) => ({ text: a.text, at: a.at })),
    },
    location: { lat, lng, accuracyM: incident.locationAccuracyM ?? null },
    nearbyResources: resources.map((r: any) => ({ name: r.name, category: r.category, distanceM: r.distanceM, phone: r.phone ?? null, verified: r.verified })),
    weather,
    unknown,
  };
}

/** Context for area risk assessment (aggregates only). */
export async function buildAreaContext(lat: number, lng: number) {
  const since = new Date(Date.now() - 30 * DAY);
  const [resources, weather, byCategory, alerts] = await Promise.all([
    findNearbyResources(lat, lng, { radiusM: 3000, limit: 15 }).catch(() => []),
    weatherOrNull(lat, lng),
    Incident.aggregate([
      { $match: { location: { $geoWithin: { $centerSphere: [[lng, lat], 2 / 6378.1] } }, createdAt: { $gte: since }, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
    Alert.find({ active: true }).limit(5).select('title severity -_id'),
  ]);
  const now = new Date();
  return {
    schemaVersion: '1.0',
    location: { lat, lng },
    time: { iso: now.toISOString(), hourUtc: now.getUTCHours() },
    incidentsLast30DaysWithin2km: Object.fromEntries(byCategory.map((r) => [r._id, r.count])),
    nearbyResources: resources.map((r: any) => ({ name: r.name, category: r.category, distanceM: r.distanceM, verified: r.verified })),
    activeAlerts: alerts,
    weather,
    unknown: [...(weather ? [] : ['weather']), ...(resources.length ? [] : ['nearby_verified_facilities'])],
  };
}
