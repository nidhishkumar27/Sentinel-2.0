import axios from 'axios';
import { logger } from '../../utils/logger';
import { getIncidentWeather } from '../weather/weather.service';

export type HazardSeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
export type HazardCategory = 'EARTHQUAKE' | 'FLOOD' | 'LANDSLIDE' | 'CYCLONE' | 'OTHER';

export interface HazardAlert {
  id: string;
  title: string;
  category: HazardCategory;
  severity: HazardSeverity;
  status: 'ACTIVE';
  location: string;
  description: string;
  source: string;
  lastUpdatedAt: string;
  recommendedPrecautions: string[];
  magnitude?: number | null;
  depthKm?: number | null;
  distanceKm?: number | null;
  relevance?: 'local' | 'regional' | 'national';
}

const USGS_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const EARTHQUAKE_RADIUS_KM = 500;
const EARTHQUAKE_WINDOW_DAYS = 30;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function earthquakeSeverity(magnitude: number): HazardSeverity {
  if (magnitude >= 6) return 'SEVERE';
  if (magnitude >= 5) return 'HIGH';
  if (magnitude >= 4) return 'MODERATE';
  return 'LOW';
}

/** Pure mapper (unit-tested): USGS GeoJSON → hazard alerts near a point. */
export function formatEarthquakes(raw: any, lat: number, lng: number): HazardAlert[] {
  const features = Array.isArray(raw?.features) ? raw.features : [];
  return features
    .filter((f: any) => {
      const coords = f?.geometry?.coordinates;
      const mag = f?.properties?.mag;
      return (
        mag !== null &&
        mag !== undefined &&
        mag !== '' &&
        Number.isFinite(Number(mag)) &&
        Array.isArray(coords) &&
        Number.isFinite(Number(coords[0])) &&
        Number.isFinite(Number(coords[1]))
      );
    })
    .map((f: any) => {
      const [fLng, fLat, depth] = (f.geometry.coordinates as number[]).map(Number);
      const magnitude = Number(f.properties.mag);
      const distanceKm = haversineKm(lat, lng, fLat, fLng);
      const place = String(f.properties.place ?? 'Unknown location');
      const time = Number(f.properties.time);
      return {
        id: `earthquake-${String(f.id ?? `${fLat},${fLng},${time}`)}`,
        title: `Earthquake M${magnitude.toFixed(1)} — ${place}`,
        category: 'EARTHQUAKE' as const,
        severity: earthquakeSeverity(magnitude),
        status: 'ACTIVE' as const,
        location: place,
        description: `A magnitude ${magnitude.toFixed(1)} earthquake was recorded ${Math.round(distanceKm)} km from the selected location${depth !== undefined && Number.isFinite(depth) ? ` at a depth of ${Math.round(depth)} km` : ''}. Reported by the USGS earthquake catalogue for the last ${EARTHQUAKE_WINDOW_DAYS} days.`,
        source: 'USGS Earthquake Catalog',
        lastUpdatedAt: Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString(),
        recommendedPrecautions: [
          'Drop, cover and hold on during shaking.',
          'Stay away from damaged buildings, bridges and unstable slopes after a strong quake.',
          'Check official local guidance for aftershock advisories.',
        ],
        magnitude,
        depthKm: Number.isFinite(depth) ? Math.round(depth) : null,
        distanceKm: Math.round(distanceKm),
        relevance: distanceKm <= 100 ? ('local' as const) : ('regional' as const),
      };
    })
    .filter((a: HazardAlert) => (a.distanceKm ?? Infinity) <= EARTHQUAKE_RADIUS_KM)
    .sort((a: HazardAlert, b: HazardAlert) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

interface ForecastLike {
  hourlyForecast?: { precipitationMm: number | null }[];
  dailyForecast?: {
    precipitationSumMm: number | null;
    windGustMaxKmh: number | null;
    temperatureMaxC: number | null;
    weatherCode: number | null;
  }[];
}

/** Pure mapper (unit-tested): forecast data → derived flood / landslide / cyclone / other hazard indicators. */
export function deriveHazards(forecast: ForecastLike, locationLabel: string): HazardAlert[] {
  const out: HazardAlert[] = [];
  const now = new Date().toISOString();
  const daily = forecast.dailyForecast ?? [];
  const hourly = forecast.hourlyForecast ?? [];
  const rainNext24h = hourly.reduce((sum, h) => sum + (h.precipitationMm ?? 0), 0);
  const wettestDay = Math.max(0, ...daily.map((d) => d.precipitationSumMm ?? 0));
  const maxGust = Math.max(0, ...daily.map((d) => d.windGustMaxKmh ?? 0));
  const maxTemp = Math.max(-Infinity, ...daily.map((d) => d.temperatureMaxC ?? -Infinity));
  const hasThunderstorm = daily.some((d) => (d.weatherCode ?? 0) >= 95);
  const derived = 'Sentinel-derived · Open-Meteo forecast';
  const note = 'This is a Sentinel-derived risk indicator from forecast data, not an official warning.';

  if (wettestDay >= 50 || rainNext24h >= 30) {
    const severe = wettestDay >= 100 || rainNext24h >= 50;
    out.push({
      id: 'hazard-flood',
      title: 'Flood risk from heavy rainfall',
      category: 'FLOOD',
      severity: severe ? 'SEVERE' : wettestDay >= 75 || rainNext24h >= 40 ? 'HIGH' : 'MODERATE',
      status: 'ACTIVE',
      location: locationLabel,
      description: `Heavy rainfall is forecast near ${locationLabel} (wettest day ~${Math.round(wettestDay)} mm, ~${Math.round(rainNext24h)} mm in the next 24 hours), which can cause waterlogging and local flooding. ${note}`,
      source: derived,
      lastUpdatedAt: now,
      recommendedPrecautions: ['Avoid flooded roads and underpasses.', 'Do not cross fast-moving water on foot or in a vehicle.', 'Move valuables and vehicles to higher ground if water rises.'],
      relevance: 'regional',
    });
  }

  if (wettestDay >= 75 || rainNext24h >= 50) {
    out.push({
      id: 'hazard-landslide',
      title: 'Landslide risk in hilly terrain',
      category: 'LANDSLIDE',
      severity: wettestDay >= 120 || rainNext24h >= 80 ? 'HIGH' : 'MODERATE',
      status: 'ACTIVE',
      location: locationLabel,
      description: `Very heavy rainfall is forecast near ${locationLabel}, which raises the risk of landslides and debris flows on slopes, hill roads and cuttings. ${note}`,
      source: derived,
      lastUpdatedAt: now,
      recommendedPrecautions: ['Avoid hill roads, slopes and retaining walls during and after heavy rain.', 'Watch for cracks, tilting trees or sudden muddy water — signs of slope failure.', 'Postpone travel through ghats and landslide-prone stretches when possible.'],
      relevance: 'regional',
    });
  }

  if (maxGust >= 62 || hasThunderstorm) {
    out.push({
      id: 'hazard-cyclone',
      title: hasThunderstorm ? 'Severe storm / thunderstorm risk' : 'Strong wind / storm risk',
      category: 'CYCLONE',
      severity: maxGust >= 88 ? 'SEVERE' : maxGust >= 75 || hasThunderstorm ? 'HIGH' : 'MODERATE',
      status: 'ACTIVE',
      location: locationLabel,
      description: `${hasThunderstorm ? 'Thunderstorms and ' : ''}Strong gusts up to ~${Math.round(maxGust)} km/h are forecast near ${locationLabel}. Coastal and exposed areas may see cyclone-like storm conditions. ${note}`,
      source: derived,
      lastUpdatedAt: now,
      recommendedPrecautions: ['Secure loose outdoor objects and avoid hoardings and large trees.', 'Stay away from the shoreline and avoid sea travel during storm conditions.', 'Keep devices charged and follow official storm bulletins.'],
      relevance: 'regional',
    });
  }

  if (Number.isFinite(maxTemp) && maxTemp >= 40) {
    out.push({
      id: 'hazard-heat',
      title: 'Extreme heat risk',
      category: 'OTHER',
      severity: maxTemp >= 44 ? 'SEVERE' : 'HIGH',
      status: 'ACTIVE',
      location: locationLabel,
      description: `Temperatures up to ~${Math.round(maxTemp)}°C are forecast near ${locationLabel}, creating a risk of heat exhaustion and heatstroke. ${note}`,
      source: derived,
      lastUpdatedAt: now,
      recommendedPrecautions: ['Avoid outdoor exertion during peak afternoon heat.', 'Drink water regularly and check on elderly people and children.', 'Seek shade or cooled spaces if you feel dizzy or nauseous.'],
      relevance: 'regional',
    });
  }

  return out;
}

const cache = new Map<string, { alerts: HazardAlert[]; at: number }>();
const CACHE_MS = 10 * 60 * 1000;

async function fetchEarthquakes(lat: number, lng: number): Promise<HazardAlert[]> {
  const start = new Date(Date.now() - EARTHQUAKE_WINDOW_DAYS * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data } = await axios.get(USGS_URL, {
    timeout: 6000,
    params: {
      format: 'geojson',
      starttime: start,
      latitude: lat,
      longitude: lng,
      maxradiuskm: EARTHQUAKE_RADIUS_KM,
      minmagnitude: 2.5,
      orderby: 'time',
      limit: 20,
    },
  });
  return formatEarthquakes(data, lat, lng);
}

/**
 * Natural-hazard alerts for a point: recorded earthquakes (USGS) plus
 * forecast-derived flood / landslide / cyclone / heat indicators.
 * Each source fails independently; a failed source simply contributes nothing.
 */
export async function getHazards(lat: number, lng: number, locationLabel = 'the selected location'): Promise<HazardAlert[]> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.alerts;

  const [earthquakes, derived] = await Promise.all([
    fetchEarthquakes(lat, lng).catch((e) => {
      logger.warn('earthquake feed failed:', (e as Error).message);
      return [] as HazardAlert[];
    }),
    getIncidentWeather('hazards', lat, lng)
      .then((w) => deriveHazards(w, locationLabel))
      .catch((e) => {
        logger.warn('hazard derivation failed:', (e as Error).message);
        return [] as HazardAlert[];
      }),
  ]);

  const rank: Record<HazardSeverity, number> = { LOW: 1, MODERATE: 2, HIGH: 3, SEVERE: 4 };
  const alerts = [...derived, ...earthquakes].sort((a, b) => rank[b.severity] - rank[a.severity]);
  cache.set(key, { alerts, at: Date.now() });
  return alerts;
}
