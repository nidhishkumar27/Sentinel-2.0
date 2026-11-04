import { useEffect, useRef } from "react";
import type { ComponentType } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { SafetyResource, UserLocation } from "../../types/safetyIntegrations";

export type SafetyMapRendererProps = { location: UserLocation | null; resources: SafetyResource[] };
export type SafetyMapRendererComponent = ComponentType<SafetyMapRendererProps>;

export function SafetyMapRenderer({ location, resources }: SafetyMapRendererProps) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current || !location) return;
    const map = L.map(container.current).setView([location.latitude, location.longitude], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
    L.marker([location.latitude, location.longitude]).addTo(map).bindPopup("Your location");
    resources.forEach((item) => L.marker([item.latitude, item.longitude]).addTo(map).bindPopup(item.name));
    return () => { map.remove(); };
  }, [location, resources]);
  if (!location) return <div className="map-unavailable" role="status">Allow location access or enter coordinates to display the map.</div>;
  return <div ref={container} className="map-renderer" role="application" aria-label="Map showing your location and nearby resources" />;
}

export const UnavailableSafetyMapRenderer = SafetyMapRenderer;
