export type ServiceFailure = "unavailable" | "timeout" | "error";

export type ServiceResult<T> =
  | { status: "success"; value: T }
  | { status: ServiceFailure };

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type UserLocation = Coordinates & {
  accuracyMeters: number | null;
  capturedAt: string;
};

export type GeolocationFailure =
  | "permission-denied"
  | "timeout"
  | "unavailable"
  | "unsupported";

export type LocationPermissionStatus =
  | "granted"
  | "denied"
  | "prompt"
  | "unsupported"
  | "unknown";

export type LocationFreshness =
  | "fresh"
  | "stale"
  | "acquiring"
  | "unavailable"
  | "permission-denied";

export type LocationSource = "browser" | "cache" | "manual" | "unknown";

export type GeolocationSnapshot = UserLocation & {
  freshness: LocationFreshness;
  source: LocationSource;
  isCached: boolean;
  acquiredAt: string;
  permissionStatus: LocationPermissionStatus;
};

export type GeolocationResult =
  | { status: "success"; location: GeolocationSnapshot }
  | { status: GeolocationFailure };

export interface GeolocationService {
  requestCurrentLocation(): Promise<GeolocationResult>;
  getPermissionStatus(): Promise<LocationPermissionStatus>;
  getLatestLocation(): GeolocationSnapshot | null;
  requestPermission(): Promise<LocationPermissionStatus>;
  watchLocation(
    callback: (snapshot: GeolocationSnapshot) => void,
  ): () => void;
  clearWatch(watcherId?: number): void;
}

export type SafetyResourceCategory =
  | "medical"
  | "police"
  | "tourist-support"
  | "other";

export type SafetyResource = {
  id: string;
  name: string;
  category: SafetyResourceCategory;
  latitude: number;
  longitude: number;
  source: string;
  lastUpdatedAt: string;
};

export interface SafetyResourceService {
  findResourcesNear(
    location: Coordinates,
  ): Promise<ServiceResult<SafetyResource[]>>;
}

export type AlertCategory =
  | "weather"
  | "travel"
  | "public-service"
  | "emergency"
  | "general";

export type SafetyAlert = {
  id: string;
  category: AlertCategory;
  title: string;
  message: string;
  timestamp: string;
  source: string;
};

export type AlertFreshness = "fresh" | "stale" | "demo";

export type WeatherSeverity = "LOW" | "MODERATE" | "HIGH" | "SEVERE";

export type NaturalHazardCategory =
  | "EARTHQUAKE"
  | "FLOOD"
  | "LANDSLIDE"
  | "CYCLONE"
  | "OTHER";

export type NaturalHazardStatus = "ACTIVE" | "EXPIRED" | "UPDATED" | "INFORMATIONAL";

export type NaturalHazardRelevance = "local" | "regional" | "national" | "unknown";

export type SafetyHazardAlert = {
  id: string;
  title: string;
  category: NaturalHazardCategory;
  severity: WeatherSeverity;
  status: NaturalHazardStatus;
  location: string;
  description: string;
  source: string;
  startsAt?: string;
  endsAt?: string;
  lastUpdatedAt: string;
  recommendedPrecautions: string[];
  magnitude?: number | null;
  depthKm?: number | null;
  distanceKm?: number | null;
  river?: string;
  relevance?: NaturalHazardRelevance;
};

export type WeatherWarning = {
  id: string;
  title: string;
  severity: WeatherSeverity;
  category: "heavy-rain" | "thunderstorm" | "strong-wind" | "extreme-heat" | "extreme-cold" | "fog";
  location: string;
  startsAt?: string;
  endsAt?: string;
  description: string;
  source: string;
  precautions: string[];
};

export type WeatherForecastDay = {
  date: string;
  condition: string;
  icon: string;
  minC: number | null;
  maxC: number | null;
  rainProbability: number | null;
};

export type WeatherCurrentCondition = {
  locationLabel: string;
  condition: string;
  icon: string;
  temperatureC: number | null;
  feelsLikeC: number | null;
  humidityPercent: number | null;
  windKph: number | null;
  rainProbability: number | null;
  observedAt: string;
};

export type WeatherOverview = {
  locationLabel: string;
  updatedAt: string;
  current: WeatherCurrentCondition | null;
  forecast: WeatherForecastDay[];
  warnings: WeatherWarning[];
};

export type AlertFeed = {
  alerts: SafetyAlert[];
  fetchedAt: string;
  freshness: AlertFreshness;
  weather?: WeatherOverview | null;
  safetyAlerts?: SafetyHazardAlert[];
};

export interface AlertService {
  getAlerts(): Promise<ServiceResult<AlertFeed>>;
}
