import { useState, type FormEvent } from "react";
import { Icon } from "../../../components/ui/Icon";
import {
  integrationConfig,
  safetyIntegrations,
} from "../../../app/integrations";
import type { SafetyMapRendererComponent } from "../../../components/maps/SafetyMapRenderer";
import type {
  GeolocationFailure,
  SafetyResource,
  UserLocation,
} from "../../../types/safetyIntegrations";

type LocationState =
  | "idle"
  | "requesting"
  | "permission-denied"
  | "timeout"
  | "unavailable"
  | "manual";

type ResourceState =
  | "idle"
  | "loading"
  | "unavailable"
  | "timeout"
  | "error"
  | "empty"
  | "ready";

const locationMessages: Record<GeolocationFailure, string> = {
  "permission-denied":
    "Location permission was denied. You can allow it in your browser settings, or enter coordinates manually.",
  timeout:
    "The location request timed out. Try again or enter coordinates manually.",
  unavailable:
    "Your browser could not provide a location. Try again or enter coordinates manually.",
};

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

export function SafetyMapPage({
  MapRenderer = safetyIntegrations.mapRenderer,
}: {
  MapRenderer?: SafetyMapRendererComponent;
}) {
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [resourceState, setResourceState] = useState<ResourceState>("idle");
  const [resources, setResources] = useState<SafetyResource[]>([]);
  const [latitudeInput, setLatitudeInput] = useState("");
  const [longitudeInput, setLongitudeInput] = useState("");
  const [manualError, setManualError] = useState("");

  async function requestLocation() {
    setLocationState("requesting");
    setLocation(null);
    setResourceState("idle");
    setResources([]);

    try {
      const result =
        await safetyIntegrations.geolocation.requestCurrentLocation();
      if (result.status !== "success") {
        setLocationState(result.status);
        return;
      }

      setLocation(result.location);
      setLocationState("idle");
    } catch {
      setLocationState("unavailable");
    }
  }

  function setManualLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const latitude = Number(latitudeInput);
    const longitude = Number(longitudeInput);

    if (
      !latitudeInput.trim() ||
      !longitudeInput.trim() ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      setManualError(
        "Enter a valid latitude (−90 to 90) and longitude (−180 to 180).",
      );
      return;
    }

    setManualError("");
    setResources([]);
    setResourceState("idle");
    setLocation({
      latitude,
      longitude,
      accuracyMeters: null,
      capturedAt: new Date().toISOString(),
    });
    setLocationState("manual");
  }

  async function findResources() {
    if (!location) {
      return;
    }

    setResourceState("loading");
    setResources([]);

    try {
      const result =
        await safetyIntegrations.resources.findResourcesNear(location);
      if (result.status !== "success") {
        setResourceState(result.status);
        return;
      }

      setResources(result.value);
      setResourceState(result.value.length === 0 ? "empty" : "ready");
    } catch {
      setResourceState("error");
    }
  }

  return (
    <div className="integration-page">
      <div className="integration-page-heading">
        <p className="eyebrow">EXPLORE WITH CARE</p>
        <h1>Safety map</h1>
        <p>
          Location is requested only when you choose to share it. Coordinates
          do not indicate whether a place is safe.
        </p>
      </div>

      {integrationConfig.demoEnabled && (
        <p className="integration-demo-banner" role="note">
          Demo integration enabled. Resource results remain empty, and no map
          provider or live location-based data is connected.
        </p>
      )}

      <section aria-labelledby="location-heading" className="integration-card">
        <div className="integration-section-heading">
          <span className="integration-icon integration-icon--blue">
            <Icon name="map" />
          </span>
          <div>
            <h2 id="location-heading">Your location</h2>
            <p>Nothing is requested until you press the button below.</p>
          </div>
        </div>
        <button
          className="integration-primary-button"
          disabled={locationState === "requesting"}
          onClick={requestLocation}
          type="button"
        >
          <Icon name="compass" />
          {locationState === "requesting"
            ? "Requesting location…"
            : "Use my current location"}
        </button>
        {locationState !== "idle" &&
          locationState !== "manual" &&
          locationState !== "requesting" && (
            <p className="integration-error" role="alert">
              {locationMessages[locationState]}
            </p>
          )}
        {locationState === "requesting" && (
          <p className="integration-status" role="status">
            Waiting for your browser’s location response…
          </p>
        )}

        {location && (
          <div aria-live="polite" className="location-result">
            <div className="location-result-heading">
              <Icon name="check" />
              <strong>
                {locationState === "manual"
                  ? "Manual coordinates entered"
                  : "Browser location available"}
              </strong>
            </div>
            <dl className="coordinate-grid">
              <div>
                <dt>Latitude</dt>
                <dd>{formatCoordinate(location.latitude)}</dd>
              </div>
              <div>
                <dt>Longitude</dt>
                <dd>{formatCoordinate(location.longitude)}</dd>
              </div>
              {location.accuracyMeters !== null && (
                <div>
                  <dt>Reported accuracy</dt>
                  <dd>
                    {Math.round(location.accuracyMeters)} m
                    <span className="coordinate-qualifier">
                      Browser estimate
                    </span>
                  </dd>
                </div>
              )}
            </dl>
            <p className="location-safety-note">
              Coordinates are not a safety assessment. This preview does not
              save your location.
            </p>
            <button
              className="integration-secondary-button"
              disabled={resourceState === "loading"}
              onClick={findResources}
              type="button"
            >
              {resourceState === "loading"
                ? "Checking resource service…"
                : "Find resources near these coordinates"}
            </button>
            {resourceState === "unavailable" && (
              <p className="integration-notice" role="status">
                No safety-resource service is connected. No nearby resources
                can be confirmed.
              </p>
            )}
            {resourceState === "error" && (
              <p className="integration-error" role="alert">
                The safety-resource service returned an error. Try again later.
              </p>
            )}
            {resourceState === "timeout" && (
              <p className="integration-error" role="alert">
                The safety-resource request timed out. No nearby resources
                were confirmed.
              </p>
            )}
            {resourceState === "empty" && (
              <p className="integration-empty" role="status">
                {integrationConfig.demoEnabled
                  ? "The demo resource service returned no results. No real or location-specific resources are included."
                  : "The connected resource service returned no resources for this search."}
              </p>
            )}
            {resourceState === "ready" && (
              <ul className="resource-results" aria-label="Safety resources">
                {resources.map((resource) => (
                  <li key={resource.id}>
                    <strong>{resource.name}</strong>
                    <span>
                      {resource.category} · Source: {resource.source}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <details className="manual-location-card">
        <summary>Enter coordinates manually</summary>
        <p>
          Use coordinates you already know. This does not verify a place or
          provide a safety assessment.
        </p>
        <form className="manual-location-form" onSubmit={setManualLocation}>
          <div className="form-field">
            <label htmlFor="manual-latitude">Latitude</label>
            <input
              autoComplete="off"
              className="form-input"
              disabled={locationState === "requesting"}
              id="manual-latitude"
              inputMode="decimal"
              onChange={(event) => {
                setLatitudeInput(event.target.value);
                setManualError("");
              }}
              placeholder="−90 to 90"
              step="any"
              type="number"
              value={latitudeInput}
            />
          </div>
          <div className="form-field">
            <label htmlFor="manual-longitude">Longitude</label>
            <input
              autoComplete="off"
              className="form-input"
              disabled={locationState === "requesting"}
              id="manual-longitude"
              inputMode="decimal"
              onChange={(event) => {
                setLongitudeInput(event.target.value);
                setManualError("");
              }}
              placeholder="−180 to 180"
              step="any"
              type="number"
              value={longitudeInput}
            />
          </div>
          <button
            className="integration-secondary-button"
            disabled={locationState === "requesting"}
            type="submit"
          >
            Use these coordinates
          </button>
        </form>
        {manualError && (
          <p className="integration-error" role="alert">
            {manualError}
          </p>
        )}
      </details>

      <section aria-labelledby="map-heading" className="integration-card">
        <div className="integration-section-heading">
          <span className="integration-icon integration-icon--amber">
            <Icon name="compass" />
          </span>
          <div>
            <h2 id="map-heading">Map preview</h2>
            <p>No map or safety markers are shown unless a provider is connected.</p>
          </div>
        </div>
        <MapRenderer location={location} resources={resources} />
      </section>
    </div>
  );
}
