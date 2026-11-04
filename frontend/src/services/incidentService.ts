import type { IncidentService, IncidentSubmissionRequest, IncidentSubmissionResult, IncidentLocationUpdateRequest, IncidentDescriptionUpdateRequest } from "../types/incidentIntegration";
import { ApiClientError, requestApi } from "./apiClient";

type BackendIncident = { id: string; reference: string; status: string };
type IncidentEnvelope = { data: BackendIncident; meta?: { duplicate?: boolean } };

function failed(error: unknown): IncidentSubmissionResult {
  if (error instanceof ApiClientError && error.status === 0) return { status: "unknown", reason: "connection-lost" };
  if (error instanceof ApiClientError && error.status >= 400 && error.status < 500) return { status: "rejected", message: error.message };
  return { status: "unknown", reason: "error" };
}

export const incidentService: IncidentService = {
  async submitIncident(request: IncidentSubmissionRequest) {
    if (request.category === "unknown" || !request.location) {
      return { status: "rejected", message: request.category === "unknown"
        ? "Choose an incident category. The backend requires one of medical, police, fire, or other."
        : "A location is required to create an incident. Enable location access and try again." };
    }
    try {
      const response = await requestApi<IncidentEnvelope>("/incidents", {
        method: "POST",
        body: {
          category: request.category,
          description: request.description,
          lat: request.location.latitude,
          lng: request.location.longitude,
          accuracyM: request.location.accuracyMeters ?? undefined,
          clientTimestamp: request.location.capturedAt,
          clientRequestId: request.clientRequestId,
        },
      });
      return {
        status: "confirmed",
        confirmation: { reference: response.data.reference, status: response.data.status },
      };
    } catch (error) {
      return failed(error);
    }
  },
  async updateIncidentLocation(request: IncidentLocationUpdateRequest) {
    try {
      await requestApi<unknown>(`/incidents/${encodeURIComponent(request.incidentId)}/location`, {
        method: "POST",
        body: {
          lat: request.location.latitude,
          lng: request.location.longitude,
          accuracyM: request.location.accuracyMeters ?? undefined,
        },
      });
      return { status: "confirmed", confirmation: { status: "updated" } };
    } catch (error) {
      return failed(error);
    }
  },
  async updateIncidentDescription(request: IncidentDescriptionUpdateRequest) {
    try {
      await requestApi<unknown>(`/incidents/${encodeURIComponent(request.incidentId)}/details`, {
        method: "POST",
        body: { text: request.description },
      });
      return { status: "confirmed", confirmation: { status: "updated" } };
    } catch (error) {
      return failed(error);
    }
  },
};
