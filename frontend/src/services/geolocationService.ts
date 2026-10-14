import type {
  GeolocationResult,
  GeolocationService,
} from "../types/safetyIntegrations";

export const browserGeolocationService: GeolocationService = {
  requestCurrentLocation() {
    return new Promise<GeolocationResult>((resolve) => {
      if (!navigator.geolocation) {
        resolve({ status: "unavailable" });
        return;
      }

      try {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              status: "success",
              location: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracyMeters: position.coords.accuracy,
                capturedAt: new Date(position.timestamp).toISOString(),
              },
            });
          },
          (error) => {
            if (error.code === error.PERMISSION_DENIED) {
              resolve({ status: "permission-denied" });
            } else if (error.code === error.TIMEOUT) {
              resolve({ status: "timeout" });
            } else {
              resolve({ status: "unavailable" });
            }
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15_000,
          },
        );
      } catch {
        resolve({ status: "unavailable" });
      }
    });
  },
};
