import type { Coordinates, SafetyResource, SafetyResourceService, ServiceResult } from "../types/safetyIntegrations";
import { requestApi } from "./apiClient";

type BackendResource = {
  _id: string;
  name: string;
  category: "police_station" | "hospital" | "fire_station" | "safe_shelter" | "high_risk" | "caution";
  source: string;
  lastVerifiedAt: string | null;
  location: { type: "Point"; coordinates: [number, number] };
};

function toResource(item: BackendResource): SafetyResource {
  const category = item.category === "hospital" ? "medical"
    : item.category === "police_station" ? "police" : "other";
  return {
    id: item._id,
    name: item.name,
    category,
    latitude: item.location.coordinates[1],
    longitude: item.location.coordinates[0],
    source: item.source,
    lastUpdatedAt: item.lastVerifiedAt,
  };
}

export const safetyResourceService: SafetyResourceService = {
  async findResourcesNear(location: Coordinates): Promise<ServiceResult<SafetyResource[]>> {
    try {
      const rows = await requestApi<BackendResource[]>("/safety-map/nearby", {
        query: { lat: location.latitude, lng: location.longitude, verifiedOnly: "true" },
      });
      return { status: "success", value: rows.map(toResource) };
    } catch {
      return { status: "error" };
    }
  },
};
