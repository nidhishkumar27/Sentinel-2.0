import { useEffect, useState } from "react";
import { Icon, type IconName } from "../../../components/ui/Icon";
import { integrationConfig, safetyIntegrations } from "../../../app/integrations";
import type {
  AlertFeed,
  SafetyAlert,
  SafetyHazardAlert,
  WeatherOverview,
  WeatherSeverity,
  WeatherWarning,
} from "../../../types/safetyIntegrations";
import { requestApi } from "../../../services/apiClient";

type LoadState = "loading" | "unavailable" | "timeout" | "error" | "empty" | "ready";

const categoryPresentation: Record<
  SafetyAlert["category"],
  { label: string; icon: IconName }
> = {
  weather: { label: "Weather", icon: "sparkle" },
  travel: { label: "Travel", icon: "compass" },
  "public-service": { label: "Public service", icon: "alerts" },
  emergency: { label: "Emergency", icon: "sos" },
  general: { label: "General", icon: "shield" },
};

const severityClass: Record<WeatherSeverity, string> = {
  LOW: "weather-severity--low",
  MODERATE: "weather-severity--moderate",
  HIGH: "weather-severity--high",
  SEVERE: "weather-severity--severe",
};

const safetyCategoryLabels: Record<SafetyHazardAlert["category"], string> = {
  EARTHQUAKE: "Earthquake",
  FLOOD: "Flood",
  LANDSLIDE: "Landslide",
  CYCLONE: "Cyclone / severe storm",
  OTHER: "Other natural hazards",
};

const hazardSeverityRank: Record<WeatherSeverity, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  SEVERE: 4,
};

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? "Time not provided"
    : date.toLocaleString();
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatTemp(value: number | null, suffix = "°C") {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  return `${Math.round(value)}${suffix}`;
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  return `${Math.round(value)}%`;
}

function formatKph(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  return `${Math.round(value)} km/h`;
}

function getWeatherGlyph(condition: string) {
  const label = condition.toLowerCase();
  if (/storm|thunder|lightning|rain/i.test(label)) {
    return "⛈️";
  }
  if (/heat|sun|clear|dry/i.test(label)) {
    return "☀️";
  }
  if (/fog|mist|haze/i.test(label)) {
    return "🌫️";
  }
  if (/snow|ice|freeze|cold/i.test(label)) {
    return "❄️";
  }
  if (/cloud|overcast|wind/i.test(label)) {
    return "☁️";
  }
  if (/showers|drizzle|rain/i.test(label)) {
    return "🌧️";
  }
  return "🌤️";
}

function AlertCard({ alert }: { alert: SafetyAlert }) {
  const category = categoryPresentation[alert.category];

  return (
    <article className="live-alert-card">
      <span className="alert-icon alert-icon--blue">
        <Icon name={category.icon} />
      </span>
      <div className="live-alert-copy">
        <div className="live-alert-heading">
          <span className="alert-category">{category.label}</span>
          <time dateTime={alert.timestamp}>{formatTimestamp(alert.timestamp)}</time>
        </div>
        <h3>{alert.title}</h3>
        <p>{alert.message}</p>
        <span className="alert-source">Source: {alert.source}</span>
      </div>
    </article>
  );
}

function WeatherOverviewPanel({ weather }: { weather: WeatherOverview }) {
  const current = weather.current;

  return (
    <section className="weather-overview-panel">
      <div className="weather-overview-header">
        <div>
          <p className="eyebrow">Current weather</p>
          <h2>{weather.locationLabel}</h2>
        </div>
        <span className="weather-updated">
          Updated {formatTimestamp(weather.updatedAt)}
        </span>
      </div>

      <div className="weather-current-row">
        <span className="weather-current-icon" aria-hidden="true">
          {current ? getWeatherGlyph(current.condition) : "🌤️"}
        </span>
        <div className="weather-current-copy">
          <strong>{current ? formatTemp(current.temperatureC) : "—"}</strong>
          <span>{current ? current.condition : "Weather condition unavailable"}</span>
        </div>
      </div>

      <div className="weather-metric-grid">
        <div>
          <dt>Feels like</dt>
          <dd>{current ? formatTemp(current.feelsLikeC) : "—"}</dd>
        </div>
        <div>
          <dt>Humidity</dt>
          <dd>{current ? formatPercent(current.humidityPercent) : "—"}</dd>
        </div>
        <div>
          <dt>Wind</dt>
          <dd>{current ? formatKph(current.windKph) : "—"}</dd>
        </div>
        <div>
          <dt>Rain chance</dt>
          <dd>{current ? formatPercent(current.rainProbability) : "—"}</dd>
        </div>
      </div>
    </section>
  );
}

function WeatherForecastPanel({ weather }: { weather: WeatherOverview }) {
  const forecast = weather.forecast.slice(0, 7);

  return (
    <section className="weather-panel">
      <div className="section-heading section-heading--compact">
        <h2>7-day forecast</h2>
      </div>

      {forecast.length > 0 ? (
        <div className="weather-forecast-grid">
          {forecast.map((day) => (
            <article className="weather-forecast-item" key={`${day.date}-${day.condition}`}>
              <span className="weather-forecast-icon" aria-hidden="true">
                {getWeatherGlyph(day.condition)}
              </span>
              <strong>{formatShortDate(day.date)}</strong>
              <span>{day.condition}</span>
              <div className="weather-forecast-temps">
                <span>{formatTemp(day.minC)}</span>
                <span>{formatTemp(day.maxC)}</span>
              </div>
              <small>Rain {formatPercent(day.rainProbability)}</small>
            </article>
          ))}
        </div>
      ) : (
        <p className="weather-empty-note">No forecast data is available for this location.</p>
      )}
    </section>
  );
}

function WeatherWarningCard({ warning }: { warning: WeatherWarning }) {
  const period = warning.startsAt || warning.endsAt
    ? `${warning.startsAt ? formatTimestamp(warning.startsAt) : "Start time unavailable"}${warning.endsAt ? ` — ${formatTimestamp(warning.endsAt)}` : ""}`
    : "Time period unavailable";

  return (
    <article className="weather-warning-card">
      <div className="weather-warning-row">
        <div>
          <p className="weather-warning-label">{warning.title}</p>
          <span className={`weather-severity ${severityClass[warning.severity]}`}>
            {warning.severity}
          </span>
        </div>
      </div>

      <dl className="weather-warning-meta">
        <div>
          <dt>Location</dt>
          <dd>{warning.location}</dd>
        </div>
        <div>
          <dt>Period</dt>
          <dd>{period}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{warning.source}</dd>
        </div>
      </dl>

      <p className="weather-warning-description">{warning.description}</p>

      {warning.precautions.length > 0 && (
        <div className="weather-warning-precautions">
          <strong>Recommended precautions</strong>
          <ul>
            {warning.precautions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function SafetyAlertCard({ alert }: { alert: SafetyHazardAlert }) {
  const detailLabels = [
    { label: "Category", value: safetyCategoryLabels[alert.category] },
    { label: "Status", value: alert.status },
    { label: "Location", value: alert.location },
    { label: "Source", value: alert.source || "Source unavailable" },
    { label: "Updated", value: formatTimestamp(alert.lastUpdatedAt) },
  ];

  return (
    <article className="weather-warning-card">
      <div className="weather-warning-row">
        <div>
          <p className="weather-warning-label">{alert.title}</p>
          <span className={`weather-severity ${severityClass[alert.severity]}`}>
            {alert.severity}
          </span>
        </div>
        <span className="safety-alert-tag">{safetyCategoryLabels[alert.category]}</span>
      </div>

      <dl className="weather-warning-meta">
        {alert.magnitude !== null && alert.magnitude !== undefined && (
          <div>
            <dt>Magnitude</dt>
            <dd>{`M ${alert.magnitude.toFixed(1)}`}</dd>
          </div>
        )}
        {alert.depthKm !== null && alert.depthKm !== undefined && (
          <div>
            <dt>Depth</dt>
            <dd>{`${alert.depthKm} km`}</dd>
          </div>
        )}
        {alert.distanceKm !== null && alert.distanceKm !== undefined && (
          <div>
            <dt>Distance</dt>
            <dd>{`${Math.round(alert.distanceKm)} km`}</dd>
          </div>
        )}
        {alert.river && (
          <div>
            <dt>Water body</dt>
            <dd>{alert.river}</dd>
          </div>
        )}
        {!alert.river && !alert.magnitude && !alert.depthKm && !alert.distanceKm && (
          <div>
            <dt>Area</dt>
            <dd>{alert.location}</dd>
          </div>
        )}
      </dl>

      <details className="safety-hazard-details">
        <summary>View details</summary>
        <div className="safety-hazard-body">
          <p>{alert.description || "No hazard description was provided."}</p>

          <dl className="safety-hazard-meta">
            {detailLabels.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>

          {alert.startsAt || alert.endsAt ? (
            <p className="safety-hazard-timeframe">
              {alert.startsAt ? `From ${formatTimestamp(alert.startsAt)}` : "From start time unavailable"}
              {alert.endsAt ? ` to ${formatTimestamp(alert.endsAt)}` : ""}
            </p>
          ) : (
            <p className="safety-hazard-timeframe">Time period unavailable</p>
          )}

          {alert.recommendedPrecautions.length > 0 && (
            <div className="weather-warning-precautions">
              <strong>Recommended precautions</strong>
              <ul>
                {alert.recommendedPrecautions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </article>
  );
}

type Place = { label: string; lat: number; lng: number };

async function reverseLabel(latitude: number, longitude: number): Promise<string | null> {
  const place = await requestApi<{ label: string } | null>("/geo/reverse", {
    query: { lat: latitude, lng: longitude },
  }).catch(() => null);
  return place?.label ?? null;
}

function LocationAlertsPanel({
  weather,
  hazards,
  authorityAlerts,
  onLocationSelected,
}: {
  weather: WeatherOverview | null;
  hazards: SafetyHazardAlert[];
  authorityAlerts: SafetyAlert[];
  onLocationSelected: (location: { latitude: number; longitude: number }) => void;
}) {
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>("unknown");
  const [manualLocation, setManualLocation] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<Place[]>([]);
  const [locationSearchState, setLocationSearchState] = useState("");

  useEffect(() => {
    void safetyIntegrations.geolocation.getPermissionStatus().then(setPermissionStatus);
    const latest = safetyIntegrations.geolocation.getLatestLocation();
    if (latest?.source === "browser") {
      void reverseLabel(latest.latitude, latest.longitude).then((label) => {
        if (label) setCurrentAddress(label);
      });
    }
  }, []);

  const selectedLabel =
    selectedPlace?.label ?? currentAddress ?? "Use your current location or search for a place";
  const visibleHazards = [...hazards].sort(
    (a, b) => hazardSeverityRank[b.severity] - hazardSeverityRank[a.severity],
  );

  async function handleUseCurrentLocation() {
    setRequestingLocation(true);
    setLocationSearchState("");
    const result = await safetyIntegrations.geolocation.requestCurrentLocation();
    if (result.status === "success") {
      const { latitude, longitude } = result.location;
      setSelectedPlace(null);
      setManualLocation("");
      setLocationSuggestions([]);
      const label = await reverseLabel(latitude, longitude);
      setCurrentAddress(label ?? "Your current location");
      setLocationSearchState(
        label ? `Showing alerts for ${label}.` : "Showing alerts for your current location.",
      );
      onLocationSelected(result.location);
      void requestApi("/users/me/location", {
        method: "PATCH",
        body: { lat: latitude, lng: longitude },
      }).catch(() => undefined);
    } else if (result.status === "permission-denied") {
      setPermissionStatus("denied");
      setLocationSearchState("Location permission was denied. Search for a location instead.");
    } else {
      setLocationSearchState("Location is unavailable. Search for a location instead.");
    }
    setRequestingLocation(false);
  }

  async function handleSearch() {
    setLocationSearchState("Searching locations…");
    try {
      const places = await requestApi<Place[]>("/geo/search", {
        query: { q: manualLocation.trim(), limit: 5 },
      });
      setLocationSuggestions(places);
      setLocationSearchState(
        places.length ? "Choose a result to load alerts for that location." : "No matching location found.",
      );
    } catch {
      setLocationSearchState("Location search is unavailable. Use your current location instead.");
    }
  }

  function handleSelectPlace(place: Place) {
    setSelectedPlace(place);
    setCurrentAddress(null);
    setManualLocation(place.label);
    setLocationSuggestions([]);
    setLocationSearchState(`Loading alerts for ${place.label}…`);
    onLocationSelected({ latitude: place.lat, longitude: place.lng });
  }

  return (
    <section className="weather-panel location-alerts-panel" aria-label="Location alerts">
      <div className="section-heading section-heading--compact">
        <h2>Location alerts</h2>
        <span className="weather-updated">Selected location: {selectedLabel}</span>
      </div>

      <div className="manual-location-card" aria-live="polite">
        <div className="location-picker-row">
          <button
            type="button"
            className="integration-secondary-button"
            disabled={requestingLocation}
            onClick={() => void handleUseCurrentLocation()}
          >
            {requestingLocation ? "Getting location…" : "Use my current location"}
          </button>
          <div className="safety-location-search">
            <input
              aria-label="Search location"
              value={manualLocation}
              onChange={(event) => {
                setManualLocation(event.target.value);
                setLocationSuggestions([]);
                setLocationSearchState("");
              }}
              placeholder="Type a town, city or region"
            />
            <button
              type="button"
              className="integration-secondary-button"
              disabled={manualLocation.trim().length < 3}
              onClick={() => void handleSearch()}
            >
              Search
            </button>
          </div>
        </div>
        {currentAddress && (
          <p className="location-safety-note">Your location: {currentAddress}</p>
        )}
        {locationSearchState && (
          <p className="location-safety-note" role="status">{locationSearchState}</p>
        )}
        {locationSuggestions.length > 0 && (
          <div className="safety-location-results" aria-label="Location search results">
            {locationSuggestions.map((place) => (
              <button
                type="button"
                key={`${place.lat},${place.lng}`}
                onClick={() => handleSelectPlace(place)}
              >
                {place.label}
              </button>
            ))}
          </div>
        )}
        {permissionStatus === "denied" && (
          <p className="location-safety-note">
            Location access denied. Search for a town, city or region instead.
          </p>
        )}
      </div>

      {weather ? (
        <div className="weather-page-stack location-report-stack">
          <WeatherOverviewPanel weather={weather} />
          <WeatherForecastPanel weather={weather} />
          <section className="weather-panel">
            <div className="section-heading section-heading--compact">
              <h2>Weather warnings</h2>
            </div>
            {weather.warnings.length > 0 ? (
              <div className="weather-warning-list">
                {weather.warnings.map((warning) => (
                  <WeatherWarningCard key={warning.id} warning={warning} />
                ))}
              </div>
            ) : (
              <p className="weather-empty-note">
                {weather.officialWarnings?.message ?? "Official warning status is unavailable."} Sentinel-derived forecast indicators are shown separately and are not official warnings.
              </p>
            )}
          </section>
        </div>
      ) : (
        <section className="integration-card integration-state location-report-stack" role="status">
          <span className="integration-icon integration-icon--amber">
            <Icon name="sparkle" />
          </span>
          <h2>Weather data unavailable</h2>
          <p>
            Choose your current location to load current conditions and Sentinel-derived advisories from the backend weather API.
          </p>
          <button className="integration-secondary-button" onClick={() => void handleUseCurrentLocation()} type="button">
            Use my current location
          </button>
        </section>
      )}

      <div className="location-report-section">
        <h3>Safety Alerts</h3>
        {visibleHazards.length > 0 ? (
          <div className="weather-warning-list">
            {visibleHazards.map((alert) => (
              <SafetyAlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        ) : (
          <p className="weather-empty-note">
            No natural hazard alerts are currently available for the selected location.
          </p>
        )}
      </div>

      {authorityAlerts.length > 0 && (
        <div className="location-report-section">
          <h3>Authority alerts</h3>
          <div className="live-alert-list">
            {authorityAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function AlertsPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [feed, setFeed] = useState<AlertFeed | null>(null);
  const [refreshError, setRefreshError] = useState("");

  useEffect(() => {
    let active = true;
    setState("loading");

    Promise.resolve()
      .then(() => {
        const latest = safetyIntegrations.geolocation.getLatestLocation();
        return safetyIntegrations.alerts.getAlerts(latest?.source === "browser" ? latest : null);
      })
      .then(
        (result) => {
          if (!active) {
            return;
          }
          if (result.status !== "success") {
            setState(result.status);
            return;
          }
          setFeed(result.value);
          setState("ready");
        },
        () => {
          if (active) {
            setState("error");
          }
        },
      );

    return () => {
      active = false;
    };
  }, []);

  async function refreshForLocation(location: { latitude: number; longitude: number }) {
    setRefreshError("");
    const result = await safetyIntegrations.alerts.getAlerts(location);
    if (result.status === "success") {
      setFeed(result.value);
      setState("ready");
    } else {
      setRefreshError("Alerts could not be refreshed. Check your connection and try again.");
    }
  }

  return (
    <div className="integration-page">
      <div className="integration-page-heading">
        <p className="eyebrow">INFORMATION FROM CONNECTED SOURCES</p>
        <h1>Alerts</h1>
        <p>
          Alerts are shown only when returned by a configured service. Check
          official sources for current local guidance.
        </p>
      </div>

      {integrationConfig.demoEnabled && (
        <p className="integration-demo-banner" role="note">
          Demo integration enabled. The demo service contains no real or
          location-specific alerts.
        </p>
      )}

      {state === "loading" && (
        <p className="integration-card integration-state" role="status">
          <Icon name="clock" />
          Loading alerts…
        </p>
      )}
      {state === "unavailable" && (
        <section className="integration-card integration-state" role="status">
          <span className="integration-icon integration-icon--amber">
            <Icon name="alerts" />
          </span>
          <h2>Alerts unavailable</h2>
          <p>
            No alert service is connected, so Sentinel cannot provide current
            alerts here.
          </p>
        </section>
      )}
      {state === "error" && (
        <section className="integration-card integration-state" role="alert">
          <span className="integration-icon integration-icon--amber">
            <Icon name="alerts" />
          </span>
          <h2>Alerts could not be loaded</h2>
          <p>The connected service returned an error. Try again later.</p>
        </section>
      )}
      {state === "timeout" && (
        <section className="integration-card integration-state" role="alert">
          <span className="integration-icon integration-icon--amber">
            <Icon name="clock" />
          </span>
          <h2>Alert request timed out</h2>
          <p>
            No alert response was confirmed. Check official sources for current
            local guidance.
          </p>
        </section>
      )}
      {state === "empty" && feed && (
        <section className="integration-card integration-state" role="status">
          <span className="integration-icon integration-icon--blue">
            <Icon name="check" />
          </span>
          <h2>No active alerts for this location</h2>
          <p>
            {feed.freshness === "demo"
              ? "The demo integration returned no alerts. No live information is being shown."
              : "The alerts request completed, but no current authority alerts matched this location. Weather advisories and official warnings appear in the Weather section above when available."}
          </p>
          {feed.freshness === "stale" && (
            <p className="stale-data-banner">
              The last response is marked stale (received {formatTimestamp(feed.fetchedAt)}).
            </p>
          )}
        </section>
      )}
      {state === "ready" && feed && (
        <>
          {feed.freshness === "stale" && (
            <p className="stale-data-banner" role="status">
              These alerts may be out of date. Last response received {formatTimestamp(feed.fetchedAt)}.
            </p>
          )}
          {feed.freshness === "demo" && (
            <p className="integration-demo-banner" role="note">
              Demo alert data — not current or location-specific.
            </p>
          )}
          {refreshError && (
            <p className="integration-error" role="alert">{refreshError}</p>
          )}
          <LocationAlertsPanel
            weather={feed.weather ?? null}
            hazards={feed.safetyAlerts ?? []}
            authorityAlerts={feed.alerts.filter((alert) => alert.category !== "weather")}
            onLocationSelected={refreshForLocation}
          />
        </>
      )}
    </div>
  );
}
