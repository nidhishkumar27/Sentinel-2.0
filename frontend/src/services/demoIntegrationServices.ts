import type {
  AlertService,
  SafetyResourceService,
} from "../types/safetyIntegrations";

export const demoSafetyResourceService: SafetyResourceService = {
  async findResourcesNear(_location) {
    return {
      status: "success",
      value: [],
    };
  },
};

export const demoAlertService: AlertService = {
  async getAlerts() {
    return {
      status: "success",
      value: {
        alerts: [],
        fetchedAt: new Date().toISOString(),
        freshness: "demo",
        safetyAlerts: [
          {
            id: "demo-earthquake-1",
            title: "Earthquake advisory",
            category: "EARTHQUAKE",
            severity: "HIGH",
            status: "UPDATED",
            location: "Near Wellington Fault Line",
            description: "Reported seismic activity in the fault zone with limited impact on nearby communities.",
            source: "National seismic monitoring network",
            lastUpdatedAt: new Date().toISOString(),
            magnitude: 5.8,
            depthKm: 18,
            distanceKm: 22,
            recommendedPrecautions: [
              "Take cover if indoors and avoid damaged structures.",
              "Check local official guidance before travelling.",
            ],
            relevance: "regional",
          },
          {
            id: "demo-flood-1",
            title: "Flood warning",
            category: "FLOOD",
            severity: "MODERATE",
            status: "ACTIVE",
            location: "Lower river corridor",
            description: "River levels are elevated in low-lying districts after sustained rainfall.",
            source: "Regional flood authority",
            lastUpdatedAt: new Date().toISOString(),
            river: "North River",
            recommendedPrecautions: [
              "Avoid flooded roads and low-water crossings.",
              "Follow regional evacuation guidance from officials.",
            ],
            relevance: "local",
          },
        ],
      },
    };
  },
};
