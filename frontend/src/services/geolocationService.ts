import type {
  GeolocationResult,
  GeolocationService,
  GeolocationSnapshot,
  LocationFreshness,
  LocationPermissionStatus,
  LocationSource,
} from "../types/safetyIntegrations";

export const LOCATION_FRESHNESS_THRESHOLD_MS = 5 * 60_000;

function normalizePermissionStatus(
  status: PermissionStatus | null | undefined,
): LocationPermissionStatus {
  if (!status) {
    return "unknown";
  }

  if (status.state === "granted") {
    return "granted";
  }
  if (status.state === "denied") {
    return "denied";
  }
  return "prompt";
}

function determineFreshness(
  timestamp: string,
  permissionStatus: LocationPermissionStatus,
): LocationFreshness {
  if (permissionStatus === "denied") {
    return "permission-denied";
  }

  if (!timestamp) {
    return "unavailable";
  }

  const ageMs = Date.now() - new Date(timestamp).getTime();
  if (Number.isNaN(ageMs)) {
    return "unavailable";
  }
  if (ageMs <= LOCATION_FRESHNESS_THRESHOLD_MS) {
    return "fresh";
  }
  return "stale";
}

function createUnavailableSnapshot(
  permissionStatus: LocationPermissionStatus,
  source: LocationSource = "cache",
): GeolocationSnapshot {
  const timestamp = new Date().toISOString();
  return {
    latitude: 0,
    longitude: 0,
    accuracyMeters: null,
    capturedAt: timestamp,
    freshness: permissionStatus === "denied" ? "permission-denied" : "unavailable",
    source,
    isCached: true,
    acquiredAt: timestamp,
    permissionStatus,
  };
}

let latestLocation: GeolocationSnapshot | null = null;
let activeWatcherId: number | null = null;

function createSnapshot(
  position: GeolocationPosition,
  permissionStatus: LocationPermissionStatus,
  source: LocationSource,
  isCached: boolean,
): GeolocationSnapshot {
  const capturedAt = new Date(position.timestamp).toISOString();
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy,
    capturedAt,
    freshness: determineFreshness(capturedAt, permissionStatus),
    source,
    isCached,
    acquiredAt: new Date().toISOString(),
    permissionStatus,
  };
}

export const browserGeolocationService: GeolocationService = {
  getLatestLocation() {
    return latestLocation;
  },

  async getPermissionStatus(): Promise<LocationPermissionStatus> {
    if (!navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== "function") {
      return "unsupported";
    }

    try {
      if ("permissions" in navigator && navigator.permissions) {
        const status = await navigator.permissions.query({
          name: "geolocation",
        });
        return normalizePermissionStatus(status);
      }
    } catch {
      // Fall back to cached state when browser permissions API is unavailable.
    }

    return latestLocation?.permissionStatus ?? "unknown";
  },

  async requestPermission(): Promise<LocationPermissionStatus> {
    if (!navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== "function") {
      return "unsupported";
    }

    const permissionStatus = await this.getPermissionStatus();
    if (permissionStatus === "granted") {
      return "granted";
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async () => {
          const nextStatus = await this.getPermissionStatus();
          resolve(nextStatus === "granted" ? "granted" : nextStatus);
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            resolve("denied");
            return;
          }
          resolve(permissionStatus === "denied" ? "denied" : "prompt");
        },
        {
          enableHighAccuracy: true,
          maximumAge: 30_000,
          timeout: 15_000,
        },
      );
    });
  },

  requestCurrentLocation() {
    return new Promise<GeolocationResult>((resolve) => {
      if (!navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== "function") {
        resolve({ status: "unsupported" });
        return;
      }

      const permissionStatusPromise: Promise<LocationPermissionStatus> = navigator.permissions
        ? navigator.permissions
            .query({ name: "geolocation" })
            .then((status) => normalizePermissionStatus(status))
            .catch(() => latestLocation?.permissionStatus ?? "unknown")
        : Promise.resolve(latestLocation?.permissionStatus ?? "unknown");

      void permissionStatusPromise.then((status) => {
        try {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const snapshot = createSnapshot(position, status, "browser", false);
              latestLocation = snapshot;
              resolve({ status: "success", location: snapshot });
            },
            (error) => {
              if (error.code === error.PERMISSION_DENIED) {
                resolve({ status: "permission-denied" });
                return;
              }
              if (error.code === error.TIMEOUT) {
                resolve({ status: "timeout" });
                return;
              }
              resolve({ status: "unavailable" });
            },
            {
              enableHighAccuracy: true,
              maximumAge: 30_000,
              timeout: 15_000,
            },
          );
        } catch {
          resolve({ status: "unavailable" });
        }
      });
    });
  },

  watchLocation(callback) {
    if (!navigator.geolocation || typeof navigator.geolocation.watchPosition !== "function") {
      const snapshot = createUnavailableSnapshot("unsupported", "unknown");
      latestLocation = snapshot;
      callback(snapshot);
      return () => undefined;
    }

    if (activeWatcherId !== null) {
      return () => {
        this.clearWatch(activeWatcherId ?? undefined);
      };
    }

    const watcherId = navigator.geolocation.watchPosition(
      (position) => {
        const permissionStatusPromise: Promise<LocationPermissionStatus> = navigator.permissions
          ? navigator.permissions
              .query({ name: "geolocation" })
              .then((status) => normalizePermissionStatus(status))
              .catch(() => latestLocation?.permissionStatus ?? "unknown")
          : Promise.resolve(latestLocation?.permissionStatus ?? "unknown");

        void permissionStatusPromise.then((status) => {
          const snapshot = createSnapshot(position, status, "browser", false);
          latestLocation = snapshot;
          callback(snapshot);
        });
      },
      (error) => {
        const permissionStatus: LocationPermissionStatus =
          error.code === error.PERMISSION_DENIED ? "denied" : "unknown";
        const snapshot: GeolocationSnapshot = latestLocation
          ? {
              ...latestLocation,
              freshness:
                latestLocation.freshness === "fresh" ? "stale" : latestLocation.freshness,
              source: "cache",
              isCached: true,
              acquiredAt: new Date().toISOString(),
              permissionStatus,
            }
          : createUnavailableSnapshot(permissionStatus, "cache");

        latestLocation = snapshot;
        callback(snapshot);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30_000,
        timeout: 15_000,
      },
    );

    activeWatcherId = watcherId;

    return () => {
      this.clearWatch(watcherId);
    };
  },

  clearWatch(watcherId) {
    if (typeof navigator !== "undefined" && navigator.geolocation && typeof navigator.geolocation.clearWatch === "function") {
      const targetId = watcherId ?? activeWatcherId ?? undefined;
      if (typeof targetId === "number") {
        navigator.geolocation.clearWatch(targetId);
      }
    }
    if (watcherId === activeWatcherId || watcherId === undefined) {
      activeWatcherId = null;
    }
  },
};
