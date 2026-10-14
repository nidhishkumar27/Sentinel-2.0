import type {
  SafetyResourceService,
  ServiceResult,
} from "../types/safetyIntegrations";

export const unavailableSafetyResourceService: SafetyResourceService = {
  async findResourcesNear(_location): Promise<ServiceResult<never[]>> {
    return { status: "unavailable" };
  },
};
