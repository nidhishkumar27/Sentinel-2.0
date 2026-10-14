import type { UserLocation } from "./safetyIntegrations";

export type EmergencyCategory = "medical" | "police" | "fire" | "other";

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

export interface IncidentService {
  submitIncident(
    request: IncidentSubmissionRequest,
  ): Promise<IncidentSubmissionResult>;
}
