import type {
  AlertService,
  ServiceResult,
} from "../types/safetyIntegrations";

export const unavailableAlertService: AlertService = {
  async getAlerts(): Promise<ServiceResult<never>> {
    return { status: "unavailable" };
  },
};
