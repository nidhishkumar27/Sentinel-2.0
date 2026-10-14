import type { ComponentType } from "react";
import type {
  SafetyResource,
  UserLocation,
} from "../../types/safetyIntegrations";

export type SafetyMapRendererProps = {
  location: UserLocation | null;
  resources: SafetyResource[];
};

export type SafetyMapRendererComponent =
  ComponentType<SafetyMapRendererProps>;

export function UnavailableSafetyMapRenderer({
  location,
  resources,
}: SafetyMapRendererProps) {
  void location;
  void resources;

  return (
    <div
      aria-label="Map preview unavailable"
      className="map-unavailable"
      role="img"
    >
      <span aria-hidden="true" className="map-grid-decoration" />
      <span className="map-unavailable-icon">⌖</span>
      <strong>No map provider connected</strong>
      <span>
        Location and resource results are not displayed on a map in this
        preview.
      </span>
    </div>
  );
}
