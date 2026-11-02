import axios from 'axios';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';

export interface Current {
  temperatureC: number | null;
  apparentC: number | null;
  precipitationMm: number | null;
  windSpeedKmh: number | null;
  windGustKmh: number | null;
  weatherCode: number | null;
  summary: string;
}
export interface Advisory {
  id: string;
  type: 'thunderstorm' | 'heavy_rain' | 'high_wind' | 'extreme_heat' | 'extreme_cold';
  severity: 'advisory' | 'warning' | 'severe';
  title: string;
  message: string;
  origin: 'derived'; // computed by Sentinel rules from provider data, NOT an official meteorological warning
  basis: { metric: string; value: number; threshold: number };
}

export function describeCode(code: number | null): string {
  if (code === null) return 'Unknown';
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Unclear';
}

/** Deterministic rules over provider data. Pure function so it is easy to test. */
export function deriveAdvisories(c: Current): Advisory[] {
  const out: Advisory[] = [];
  const add = (a: Omit<Advisory, 'origin'>) => out.push({ ...a, origin: 'derived' });

  if (c.weatherCode !== null && c.weatherCode >= 95)
    add({ id: 'thunderstorm', type: 'thunderstorm', severity: c.weatherCode >= 96 ? 'severe' : 'warning', title: 'Thunderstorm in the area',
      message: 'Seek sturdy shelter and avoid open areas, trees and water.', basis: { metric: 'weatherCode', value: c.weatherCode, threshold: 95 } });

  if (c.precipitationMm !== null) {
    const v = c.precipitationMm;
    const sev = v >= 20 ? 'severe' : v >= 7.6 ? 'warning' : v >= 2.5 ? 'advisory' : null;
    if (sev) add({ id: 'heavy_rain', type: 'heavy_rain', severity: sev, title: 'Heavy rain',
      message: 'Expect reduced visibility and possible waterlogging. Avoid flooded roads.', basis: { metric: 'precipitationMm_1h', value: v, threshold: sev === 'severe' ? 20 : sev === 'warning' ? 7.6 : 2.5 } });
  }
  if (c.windGustKmh !== null) {
    const v = c.windGustKmh;
    const sev = v >= 88 ? 'severe' : v >= 62 ? 'warning' : v >= 50 ? 'advisory' : null;
    if (sev) add({ id: 'high_wind', type: 'high_wind', severity: sev, title: 'Strong winds',
      message: 'Secure loose objects and stay away from trees, hoardings and the coastline.', basis: { metric: 'windGustKmh', value: v, threshold: sev === 'severe' ? 88 : sev === 'warning' ? 62 : 50 } });
  }
  if (c.apparentC !== null) {
    const v = c.apparentC;
    const heat = v >= 41 ? 'severe' : v >= 38 ? 'warning' : v >= 33 ? 'advisory' : null;
    if (heat) add({ id: 'extreme_heat', type: 'extreme_heat', severity: heat, title: 'High heat',
      message: 'Drink water, avoid direct sun and watch for signs of heat exhaustion.', basis: { metric: 'apparentC', value: v, threshold: heat === 'severe' ? 41 : heat === 'warning' ? 38 : 33 } });
    if (v <= -10) add({ id: 'extreme_cold', type: 'extreme_cold', severity: 'warning', title: 'Extreme cold',
      message: 'Limit time outdoors and keep warm.', basis: { metric: 'apparentC', value: v, threshold: -10 } });
  }
  return out;
}

interface Snapshot {
  location: { lat: number; lng: number };
  current: Current;
  advisories: Advisory[];
  source: { name: string; url: string; note: string };
  providerTime: string | null;
  fetchedAt: string;
}
const cache = new Map<string, { snap: Snapshot; at: number }>();
const keyOf = (lat: number, lng: number) => `${lat.toFixed(2)},${lng.toFixed(2)}`;
export const clearWeatherCache = () => cache.clear();

async function fetchFromProvider(lat: number, lng: number): Promise<Snapshot> {
  const { data } = await axios.get(env.WEATHER_API_URL, {
    timeout: 5000,
    params: {
      latitude: lat,
      longitude: lng,
      current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m',
      timezone: 'GMT',
    },
  });
  const c = data?.current;
  if (!c) throw new Error('Weather provider returned no data');
  const current: Current = {
    temperatureC: c.temperature_2m ?? null,
    apparentC: c.apparent_temperature ?? null,
    precipitationMm: c.precipitation ?? null,
    windSpeedKmh: c.wind_speed_10m ?? null,
    windGustKmh: c.wind_gusts_10m ?? null,
    weatherCode: c.weather_code ?? null,
    summary: describeCode(c.weather_code ?? null),
  };
  return {
    location: { lat, lng },
    current,
    advisories: deriveAdvisories(current),
    source: { name: 'Open-Meteo', url: 'https://open-meteo.com', note: 'Advisories are derived by Sentinel rules from model data; they are not official warnings.' },
    providerTime: c.time ? `${c.time}:00Z` : null,
    fetchedAt: new Date().toISOString(),
  };
}

/** Cached lookup. If the provider fails we serve the last snapshot flagged stale; if none exists → 503. */
export async function getWeather(lat: number, lng: number) {
  const key = keyOf(lat, lng);
  const hit = cache.get(key);
  const ageMin = hit ? (Date.now() - hit.at) / 60000 : Infinity;
  if (hit && ageMin < env.WEATHER_CACHE_MIN) return { ...hit.snap, stale: false, ageMinutes: Math.round(ageMin) };

  try {
    const snap = await fetchFromProvider(lat, lng);
    cache.set(key, { snap, at: Date.now() });
    return { ...snap, stale: false, ageMinutes: 0 };
  } catch (e) {
    logger.warn('weather provider failed:', (e as Error).message);
    if (hit && ageMin < env.WEATHER_STALE_MIN) return { ...hit.snap, stale: true, ageMinutes: Math.round(ageMin) };
    throw new ApiError(503, 'Weather data is currently unavailable', undefined, 'WEATHER_UNAVAILABLE');
  }
}
export interface ForecastRisk {
  id: string;
  type: 'thunderstorm' | 'heavy_rain' | 'high_wind' | 'extreme_heat';
  severity: 'advisory' | 'warning' | 'severe';
  title: string;
  message: string;
  origin: 'derived';
  basis: {
    metric: string;
    value: number;
    threshold: number;
  };
}

export interface HourlyForecast {
  time: string | null;
  temperatureC: number | null;
  precipitationMm: number | null;
  precipitationProbability: number | null;
  weatherCode: number | null;
  summary: string;
  windSpeedKmh: number | null;
  windGustKmh: number | null;
}

export interface DailyForecast {
  date: string | null;
  weatherCode: number | null;
  summary: string;
  temperatureMaxC: number | null;
  temperatureMinC: number | null;
  precipitationSumMm: number | null;
  precipitationProbabilityMax: number | null;
  windSpeedMaxKmh: number | null;
  windGustMaxKmh: number | null;
}

interface IncidentWeatherSnapshot {
  location: {
    lat: number;
    lng: number;
  };
  current: Current;
  hourlyForecast: HourlyForecast[];
  dailyForecast: DailyForecast[];
  advisories: Advisory[];
  forecastRisks: ForecastRisk[];
  riskLevel: 'low' | 'moderate' | 'high' | 'severe';
  timezone: string | null;
  utcOffsetSeconds: number | null;
  source: {
    name: string;
    url: string;
    note: string;
  };
  fetchedAt: string;
}

const incidentWeatherCache = new Map<
  string,
  { snapshot: IncidentWeatherSnapshot; at: number }
>();

function arrayValue<T>(values: unknown, index: number): T | null {
  if (!Array.isArray(values)) return null;
  return (values[index] ?? null) as T | null;
}

function getHighestSeverity(
  current: 'advisory' | 'warning' | 'severe' | null,
  next: 'advisory' | 'warning' | 'severe',
): 'advisory' | 'warning' | 'severe' {
  if (!current) return next;

  const rank = {
    advisory: 1,
    warning: 2,
    severe: 3,
  };

  return rank[next] > rank[current] ? next : current;
}

function deriveForecastRisks(
  hourly: HourlyForecast[],
  daily: DailyForecast[],
): ForecastRisk[] {
  const risks: ForecastRisk[] = [];

  const add = (risk: ForecastRisk) => risks.push(risk);

  // Rain risk over the next 24 hours.
  const maxRainProbability = Math.max(
    0,
    ...hourly.map((h) => h.precipitationProbability ?? 0),
  );

  const totalRain = hourly.reduce(
    (sum, h) => sum + (h.precipitationMm ?? 0),
    0,
  );

  let rainSeverity: 'advisory' | 'warning' | 'severe' | null = null;
  let rainThreshold = 40;

  if (maxRainProbability >= 90 || totalRain >= 30) {
    rainSeverity = 'severe';
    rainThreshold = maxRainProbability >= 90 ? 90 : 30;
  } else if (maxRainProbability >= 70 || totalRain >= 15) {
    rainSeverity = 'warning';
    rainThreshold = maxRainProbability >= 70 ? 70 : 15;
  } else if (maxRainProbability >= 40 || totalRain >= 7.6) {
    rainSeverity = 'advisory';
    rainThreshold = maxRainProbability >= 40 ? 40 : 7.6;
  }

  if (rainSeverity) {
    const usingProbability = maxRainProbability >= 40;

    add({
      id: 'forecast_rain',
      type: 'heavy_rain',
      severity: rainSeverity,
      title: 'Rain risk in the forecast',
      message:
        'Rain is forecast near this incident. Monitor conditions and avoid flooded roads.',
      origin: 'derived',
      basis: {
        metric: usingProbability
          ? 'precipitationProbabilityPercent_next24h'
          : 'precipitationTotalMm_next24h',
        value: usingProbability ? maxRainProbability : totalRain,
        threshold: rainThreshold,
      },
    });
  }

  // Strong wind risk over the next 7 days.
  const maxWindGust = Math.max(
    0,
    ...daily.map((d) => d.windGustMaxKmh ?? 0),
  );

  let windSeverity: 'advisory' | 'warning' | 'severe' | null = null;
  let windThreshold = 50;

  if (maxWindGust >= 88) {
    windSeverity = 'severe';
    windThreshold = 88;
  } else if (maxWindGust >= 62) {
    windSeverity = 'warning';
    windThreshold = 62;
  } else if (maxWindGust >= 50) {
    windSeverity = 'advisory';
    windThreshold = 50;
  }

  if (windSeverity) {
    add({
      id: 'forecast_wind',
      type: 'high_wind',
      severity: windSeverity,
      title: 'Strong winds in the forecast',
      message:
        'Strong wind gusts are forecast. Take care around trees, hoardings and loose structures.',
      origin: 'derived',
      basis: {
        metric: 'windGustMaxKmh_next7days',
        value: maxWindGust,
        threshold: windThreshold,
      },
    });
  }

  // High temperature risk over the next 7 days.
  const maxTemperature = Math.max(
    -Infinity,
    ...daily.map((d) => d.temperatureMaxC ?? -Infinity),
  );

  let heatSeverity: 'advisory' | 'warning' | 'severe' | null = null;
  let heatThreshold = 33;

  if (maxTemperature >= 40) {
    heatSeverity = 'severe';
    heatThreshold = 40;
  } else if (maxTemperature >= 37) {
    heatSeverity = 'warning';
    heatThreshold = 37;
  } else if (maxTemperature >= 33) {
    heatSeverity = 'advisory';
    heatThreshold = 33;
  }

  if (heatSeverity) {
    add({
      id: 'forecast_heat',
      type: 'extreme_heat',
      severity: heatSeverity,
      title: 'High temperatures in the forecast',
      message:
        'High temperatures are forecast. Plan outdoor response activity carefully and stay hydrated.',
      origin: 'derived',
      basis: {
        metric: 'temperatureMaxC_next7days',
        value: maxTemperature,
        threshold: heatThreshold,
      },
    });
  }

  // Thunderstorm risk over the next 24 hours.
  const thunderstorm = hourly.find(
    (h) => h.weatherCode !== null && h.weatherCode >= 95,
  );

  if (thunderstorm?.weatherCode !== null && thunderstorm?.weatherCode !== undefined) {
    add({
      id: 'forecast_thunderstorm',
      type: 'thunderstorm',
      severity: thunderstorm.weatherCode >= 96 ? 'severe' : 'warning',
      title: 'Thunderstorm in the forecast',
      message:
        'Thunderstorms are forecast near this incident. Avoid open areas, trees and exposed locations.',
      origin: 'derived',
      basis: {
        metric: 'weatherCode_next24h',
        value: thunderstorm.weatherCode,
        threshold: 95,
      },
    });
  }

  return risks;
}

function calculateRiskLevel(
  advisories: Advisory[],
  forecastRisks: ForecastRisk[],
): 'low' | 'moderate' | 'high' | 'severe' {
  const severities = [
    ...advisories.map((a) => a.severity),
    ...forecastRisks.map((a) => a.severity),
  ];

  if (severities.includes('severe')) return 'severe';
  if (severities.includes('warning')) return 'high';
  if (severities.includes('advisory')) return 'moderate';

  return 'low';
}

async function fetchIncidentWeather(
  lat: number,
  lng: number,
): Promise<IncidentWeatherSnapshot> {
  const { data } = await axios.get(env.WEATHER_API_URL, {
    timeout: 8000,
    params: {
      latitude: lat,
      longitude: lng,
      current:
        'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m',
      hourly:
        'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m',
      daily:
        'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max',
      forecast_days: 7,
      timezone: 'auto',
    },
  });

  const c = data?.current;
  const h = data?.hourly;
  const d = data?.daily;

  if (!c || !h || !d) {
    throw new Error('Weather provider returned incomplete forecast data');
  }

  const current: Current = {
    temperatureC: c.temperature_2m ?? null,
    apparentC: c.apparent_temperature ?? null,
    precipitationMm: c.precipitation ?? null,
    windSpeedKmh: c.wind_speed_10m ?? null,
    windGustKmh: c.wind_gusts_10m ?? null,
    weatherCode: c.weather_code ?? null,
    summary: describeCode(c.weather_code ?? null),
  };

  const hourlyTimes = Array.isArray(h.time) ? h.time : [];
  const hourlyCount = Math.min(hourlyTimes.length, 24);

  const hourlyForecast: HourlyForecast[] = Array.from(
    { length: hourlyCount },
    (_, i) => {
      const weatherCode = arrayValue<number>(h.weather_code, i);

      return {
        time: arrayValue<string>(h.time, i),
        temperatureC: arrayValue<number>(h.temperature_2m, i),
        precipitationMm: arrayValue<number>(h.precipitation, i),
        precipitationProbability: arrayValue<number>(
          h.precipitation_probability,
          i,
        ),
        weatherCode,
        summary: describeCode(weatherCode),
        windSpeedKmh: arrayValue<number>(h.wind_speed_10m, i),
        windGustKmh: arrayValue<number>(h.wind_gusts_10m, i),
      };
    },
  );

  const dailyTimes = Array.isArray(d.time) ? d.time : [];
  const dailyCount = Math.min(dailyTimes.length, 7);

  const dailyForecast: DailyForecast[] = Array.from(
    { length: dailyCount },
    (_, i) => {
      const weatherCode = arrayValue<number>(d.weather_code, i);

      return {
        date: arrayValue<string>(d.time, i),
        weatherCode,
        summary: describeCode(weatherCode),
        temperatureMaxC: arrayValue<number>(d.temperature_2m_max, i),
        temperatureMinC: arrayValue<number>(d.temperature_2m_min, i),
        precipitationSumMm: arrayValue<number>(d.precipitation_sum, i),
        precipitationProbabilityMax: arrayValue<number>(
          d.precipitation_probability_max,
          i,
        ),
        windSpeedMaxKmh: arrayValue<number>(d.wind_speed_10m_max, i),
        windGustMaxKmh: arrayValue<number>(d.wind_gusts_10m_max, i),
      };
    },
  );

  const advisories = deriveAdvisories(current);
  const forecastRisks = deriveForecastRisks(hourlyForecast, dailyForecast);

  return {
    location: { lat, lng },
    current,
    hourlyForecast,
    dailyForecast,
    advisories,
    forecastRisks,
    riskLevel: calculateRiskLevel(advisories, forecastRisks),
    timezone: data.timezone ?? null,
    utcOffsetSeconds: data.utc_offset_seconds ?? null,
    source: {
      name: 'Open-Meteo',
      url: 'https://open-meteo.com',
      note:
        'Risk indicators are derived by Sentinel from forecast data. They are not official government or IMD warnings.',
    },
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetches weather for the saved incident location.
 * Uses a coordinate-based cache and stale fallback, like the existing weather endpoint.
 */
export async function getIncidentWeather(
  incidentId: string,
  lat: number,
  lng: number,
  address?: string,
) {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = incidentWeatherCache.get(key);
  const ageMin = hit
    ? (Date.now() - hit.at) / 60000
    : Infinity;

  if (hit && ageMin < env.WEATHER_CACHE_MIN) {
    return {
      incidentId,
      address: address ?? null,
      ...hit.snapshot,
      officialWarnings: {
        status: 'not_integrated' as const,
        items: [],
        message: 'Official IMD/government warning feeds are not integrated yet.',
      },
      stale: false,
      ageMinutes: Math.round(ageMin),
    };
  }

  try {
    const snapshot = await fetchIncidentWeather(lat, lng);
    incidentWeatherCache.set(key, {
      snapshot,
      at: Date.now(),
    });

    return {
      incidentId,
      address: address ?? null,
      ...snapshot,
      officialWarnings: {
        status: 'not_integrated' as const,
        items: [],
        message: 'Official IMD/government warning feeds are not integrated yet.',
      },
      stale: false,
      ageMinutes: 0,
    };
  } catch (e) {
    logger.warn(
      'incident weather provider failed:',
      (e as Error).message,
    );

    if (hit && ageMin < env.WEATHER_STALE_MIN) {
      return {
        incidentId,
        address: address ?? null,
        ...hit.snapshot,
        officialWarnings: {
          status: 'not_integrated' as const,
          items: [],
          message: 'Official IMD/government warning feeds are not integrated yet.',
        },
        stale: true,
        ageMinutes: Math.round(ageMin),
      };
    }

    throw new ApiError(
      503,
      'Incident weather forecast is currently unavailable',
      undefined,
      'WEATHER_UNAVAILABLE',
    );
  }
}
