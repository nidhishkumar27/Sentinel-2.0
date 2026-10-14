import type { IncidentService } from "../types/incidentIntegration";

export const unavailableIncidentService: IncidentService = {
  async submitIncident(_request) {
    return { status: "unavailable" };
  },
};
