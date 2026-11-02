import type { UserLocation } from "./safetyIntegrations";

export type EmergencyCategory = "medical" | "police" | "fire" | "other" | "unknown";

export type IncidentSubmissionRequest = {
  category: EmergencyCategory;
  description?: string;
  location?: UserLocation;
};

export type IncidentConfirmation = {
  reference?: string;
  status?: string;
};

export type IncidentSubmissionResult =
  | { status: "confirmed"; confirmation: IncidentConfirmation }
  | { status: "rejected"; message: string }
  | { status: "unavailable" }
  | { status: "unknown"; reason: "timeout" | "connection-lost" | "error" };

export type IncidentLocationUpdateRequest = {
  incidentId: string;
  location: UserLocation;
  reason?: "fresh-location-update" | "operator-requested-update";
};

export type IncidentDescriptionUpdateRequest = {
  incidentId: string;
  description: string;
  reason?: "late-text-edit" | "late-voice-transcript";
};

export type IncidentLocationUpdateResult =
  | { status: "confirmed"; confirmation: IncidentConfirmation }
  | { status: "rejected"; message: string }
  | { status: "unavailable" }
  | { status: "unknown"; reason: "timeout" | "connection-lost" | "error" };

export type IncidentDescriptionUpdateResult =
  | { status: "confirmed"; confirmation: IncidentConfirmation }
  | { status: "rejected"; message: string }
  | { status: "unavailable" }
  | { status: "unknown"; reason: "timeout" | "connection-lost" | "error" };

export interface IncidentService {
  submitIncident(
    request: IncidentSubmissionRequest,
  ): Promise<IncidentSubmissionResult>;
  updateIncidentLocation?: (
    request: IncidentLocationUpdateRequest,
  ) => Promise<IncidentLocationUpdateResult>;
  updateIncidentDescription?: (
    request: IncidentDescriptionUpdateRequest,
  ) => Promise<IncidentDescriptionUpdateResult>;
}
