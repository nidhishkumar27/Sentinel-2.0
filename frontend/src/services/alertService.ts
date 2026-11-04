import type { AlertFeed, AlertService, Coordinates, ServiceResult } from "../types/safetyIntegrations";
import { requestApi } from "./apiClient";

type BackendAlert = {
  _id: string;
  title: string;
  message: string;
  createdAt: string;
};
type BackendWeather = {
  location: { lat: number; lng: number };
  current: { temperatureC: number | null; apparentC: number | null; precipitationMm: number | null; windSpeedKmh: number | null; summary: string };
  advisories: { id: string; type: string; severity: "advisory" | "warning" | "severe"; title: string; message: string }[];
  hourlyForecast?: { time: string | null; temperatureC: number | null; precipitationProbability: number | null; summary: string }[];
  dailyForecast?: { date: string | null; summary: string; temperatureMaxC: number | null; temperatureMinC: number | null; precipitationProbabilityMax: number | null }[];
  forecastRisks?: { id: string; type: string; severity: "advisory" | "warning" | "severe"; title: string; message: string }[];
  source: { name: string; url: string; note: string };
  fetchedAt: string;
  providerTime: string | null;
  stale: boolean;
  officialWarnings?: { status: "available" | "unavailable"; message: string; items: { id?: string; title: string; severity?: string; description?: string; source?: string; startsAt?: string; endsAt?: string; precautions?: string[] }[] };
};

const warningCategory = (type: string): "heavy-rain" | "thunderstorm" | "strong-wind" | "extreme-heat" | "extreme-cold" | "fog" => ({
  heavy_rain: "heavy-rain", thunderstorm: "thunderstorm", high_wind: "strong-wind", extreme_heat: "extreme-heat", extreme_cold: "extreme-cold",
}[type] as "heavy-rain" | "thunderstorm" | "strong-wind" | "extreme-heat" | "extreme-cold" | undefined) ?? "fog";
const warningSeverity = (severity: string): "LOW" | "MODERATE" | "HIGH" | "SEVERE" => severity === "severe" ? "SEVERE" : severity === "warning" ? "HIGH" : "MODERATE";
const officialSeverity = (severity: string): "LOW" | "MODERATE" | "HIGH" | "SEVERE" => ({ Extreme: "SEVERE", Severe: "SEVERE", Moderate: "HIGH", Minor: "MODERATE" }[severity] as "LOW" | "MODERATE" | "HIGH" | "SEVERE" | undefined) ?? "MODERATE";
const officialCategory = (text: string): "heavy-rain" | "thunderstorm" | "strong-wind" | "extreme-heat" | "extreme-cold" | "fog" => {
  const value = text.toLowerCase();
  if (/thunder|lightning|squall|cyclone|storm/.test(value)) return "thunderstorm";
  if (/wind|gust/.test(value)) return "strong-wind";
  if (/heat|hot day/.test(value)) return "extreme-heat";
  if (/cold|frost|snow/.test(value)) return "extreme-cold";
  if (/fog|visibility/.test(value)) return "fog";
  return "heavy-rain";
};

export const alertService: AlertService = {
  async getAlerts(location?: Coordinates | null): Promise<ServiceResult<AlertFeed>> {
    try {
      const rows = await requestApi<BackendAlert[]>("/alerts", { query: location ? { lat: location.latitude, lng: location.longitude } : undefined });
      const weather = location
        ? await requestApi<BackendWeather>("/weather", { query: { lat: location.latitude, lng: location.longitude } }).catch(() => null)
        : null;
      return {
        status: "success",
        value: {
          alerts: rows.map((alert) => ({
            id: alert._id,
            category: "general",
            title: alert.title,
            message: alert.message,
            timestamp: alert.createdAt,
            source: "Authority alert",
          })),
          fetchedAt: weather?.fetchedAt ?? new Date().toISOString(),
          freshness: weather?.stale ? "stale" : "fresh",
          safetyAlerts: [],
          ...(weather ? { weather: {
            locationLabel: `${weather.location.lat.toFixed(4)}, ${weather.location.lng.toFixed(4)}`,
            updatedAt: weather.providerTime ?? weather.fetchedAt,
            current: {
              locationLabel: `${weather.location.lat.toFixed(4)}, ${weather.location.lng.toFixed(4)}`,
              condition: weather.current.summary,
              icon: weather.current.summary.toLowerCase(),
              temperatureC: weather.current.temperatureC,
              feelsLikeC: weather.current.apparentC,
              humidityPercent: null,
              windKph: weather.current.windSpeedKmh,
              rainProbability: null,
              observedAt: weather.providerTime ?? weather.fetchedAt,
            },
            forecast: (weather.dailyForecast ?? []).map((day) => ({
              date: day.date ?? weather.fetchedAt,
              condition: day.summary,
              icon: day.summary.toLowerCase(),
              minC: day.temperatureMinC,
              maxC: day.temperatureMaxC,
              rainProbability: day.precipitationProbabilityMax,
            })),
            warnings: [
              ...(weather.officialWarnings?.items ?? []).map((item, index) => ({
                id: item.id ?? `official-${index}`,
                title: item.title,
                severity: officialSeverity(item.severity ?? "Unknown"),
                category: officialCategory(`${item.title} ${item.description ?? ""}`),
                location: `${weather.location.lat.toFixed(4)}, ${weather.location.lng.toFixed(4)}`,
                startsAt: item.startsAt,
                endsAt: item.endsAt,
                description: item.description ?? item.title,
                source: item.source ?? "Official weather feed",
                precautions: item.precautions ?? [],
              })),
              ...[...(weather.advisories ?? []), ...(weather.forecastRisks ?? [])].map((item) => ({
                id: item.id,
                title: item.title,
                severity: warningSeverity(item.severity),
                category: warningCategory(item.type),
                location: `${weather.location.lat.toFixed(4)}, ${weather.location.lng.toFixed(4)}`,
                description: `${item.message} ${weather.source.note}`,
                source: `${weather.source.name} · Sentinel-derived`,
                precautions: [item.message],
              })),
            ],
            ...(weather.officialWarnings ? { officialWarnings: { status: weather.officialWarnings.status, message: weather.officialWarnings.message } } : {}),
          }, alerts: [...rows.map((alert) => ({ id: alert._id, category: "general" as const, title: alert.title, message: alert.message, timestamp: alert.createdAt, source: "Authority alert" })), ...weather.advisories.map((item) => ({ id: item.id, category: "weather" as const, title: item.title, message: `${item.message} (Sentinel-derived indicator; not an official warning.)`, timestamp: weather.fetchedAt, source: `${weather.source.name} / Sentinel-derived` }))] } : {}),
        },
      };
    } catch {
      return { status: "error" };
    }
  },
};
