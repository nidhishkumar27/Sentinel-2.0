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
      },
    };
  },
};
