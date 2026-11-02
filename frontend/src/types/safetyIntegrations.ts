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

export type AlertFeed = {
  alerts: SafetyAlert[];
  fetchedAt: string;
  freshness: AlertFreshness;
};

export interface AlertService {
  getAlerts(): Promise<ServiceResult<AlertFeed>>;
}
