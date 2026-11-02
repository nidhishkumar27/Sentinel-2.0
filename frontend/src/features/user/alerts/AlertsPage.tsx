import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon, type IconName } from "../../../components/ui/Icon";
import { integrationConfig, safetyIntegrations } from "../../../app/integrations";
import type {
  AlertFeed,
  NaturalHazardCategory,
  SafetyAlert,
  SafetyHazardAlert,
  WeatherOverview,
  WeatherSeverity,
  WeatherWarning,
} from "../../../types/safetyIntegrations";

type LoadState = "loading" | "unavailable" | "timeout" | "error" | "empty" | "ready";
type AlertFilter = "all" | "weather" | "safety";

const alertFilters: { id: AlertFilter; label: string }[] = [
  { id: "all", label: "All alerts" },
  { id: "weather", label: "Weather" },
  { id: "safety", label: "Safety" },
];

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

const safetyCategoryFilters: { id: "all" | NaturalHazardCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "EARTHQUAKE", label: "Earthquake" },
  { id: "FLOOD", label: "Flood" },
  { id: "LANDSLIDE", label: "Landslide" },
  { id: "CYCLONE", label: "Cyclone / storm" },
  { id: "OTHER", label: "Other hazards" },
];

const safetyCategoryLabels: Record<NaturalHazardCategory, string> = {
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

function SafetyAlertsPanel({
  alerts,
  selectedCategory,
  onSelectCategory,
}: {
  alerts: SafetyHazardAlert[];
  selectedCategory: "all" | NaturalHazardCategory;
  onSelectCategory: (value: "all" | NaturalHazardCategory) => void;
}) {
  const geoLocation = safetyIntegrations.geolocation.getLatestLocation();
  const [permissionStatus, setPermissionStatus] = useState<ReturnType<typeof safetyIntegrations.geolocation.getPermissionStatus> extends Promise<infer T> ? T : never>("unknown");
  const [manualLocation, setManualLocation] = useState("");

  useEffect(() => {
    void safetyIntegrations.geolocation.getPermissionStatus().then(setPermissionStatus);
  }, []);

  const selectedLocation = manualLocation.trim()
    || (geoLocation ? `${geoLocation.latitude.toFixed(2)}, ${geoLocation.longitude.toFixed(2)}` : "Manual location selection");
  const visibleAlerts = [...alerts]
    .filter((alert) => selectedCategory === "all" || alert.category === selectedCategory)
    .sort((a, b) => hazardSeverityRank[b.severity] - hazardSeverityRank[a.severity]);

  return (
    <section className="weather-panel" aria-label="Safety alerts">
      <div className="section-heading section-heading--compact">
        <h2>Safety Alerts</h2>
        <span className="weather-updated">Selected location: {selectedLocation}</span>
      </div>

      <div className="alert-category-nav" aria-label="Safety alert categories">
        {safetyCategoryFilters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={selectedCategory === item.id}
            className={`alert-category-link${selectedCategory === item.id ? " alert-category-link--active" : ""}`}
            onClick={() => onSelectCategory(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="manual-location-card" aria-live="polite">
        <label htmlFor="manual-safety-location">Manual safety alert location</label>
        <input
          id="manual-safety-location"
          value={manualLocation}
          onChange={(event) => setManualLocation(event.target.value)}
          placeholder="Type a location or region"
          style={{ marginTop: "8px", width: "100%", minHeight: "38px", border: "1px solid #e6edf3", borderRadius: "8px", padding: "0 10px" }}
        />
        {permissionStatus === "denied" && (
          <p className="location-safety-note">Location access denied. Manual location selection is available for reference.</p>
        )}
        <p className="location-safety-note">Selected location: {selectedLocation}. Alerts are marked local, regional or national only when the service provides enough information.</p>
      </div>

      {visibleAlerts.length > 0 ? (
        <div className="weather-warning-list" style={{ marginTop: "16px" }}>
          {visibleAlerts.map((alert) => (
            <SafetyAlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      ) : (
        <p className="weather-empty-note" style={{ marginTop: "16px" }}>
          No natural hazard alerts are currently available for the selected safety category.
        </p>
      )}
    </section>
  );
}

export function AlertsPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [feed, setFeed] = useState<AlertFeed | null>(null);
  const [selectedSafetyCategory, setSelectedSafetyCategory] = useState<
    "all" | NaturalHazardCategory
  >("all");
  const [searchParams] = useSearchParams();
  const requestedFilter = searchParams.get("category");
  const filter: AlertFilter =
    requestedFilter === "weather" || requestedFilter === "safety"
      ? requestedFilter
      : "all";
  const filteredAlerts =
    feed?.alerts.filter((alert) =>
      filter === "all"
        ? true
        : filter === "weather"
          ? alert.category === "weather"
          : alert.category !== "weather",
    ) ?? [];

  useEffect(() => {
    let active = true;
    setState("loading");

    Promise.resolve()
      .then(() => safetyIntegrations.alerts.getAlerts())
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

  const weatherData = feed?.weather ?? null;
  const safetyAlerts = feed?.safetyAlerts ?? [];
  const showWeatherSection = filter !== "safety";
  const showSafetySection = filter !== "weather";

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

      <nav aria-label="Alert categories" className="alert-category-nav">
        {alertFilters.map((item) => (
          <Link
            aria-current={filter === item.id ? "page" : undefined}
            className={`alert-category-link${filter === item.id ? " alert-category-link--active" : ""}`}
            key={item.id}
            to={
              item.id === "all" ? "/alerts" : `/alerts?category=${item.id}`
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {state === "loading" && (
        <p className="integration-card integration-state" role="status">
          <Icon name="clock" />
          Loading alerts…
        </p>
      )}
      {state === "unavailable" && (
        <section
          className="integration-card integration-state"
          role="status"
        >
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
          <h2>No alerts returned</h2>
          <p>
            {feed.freshness === "demo"
              ? "The demo integration returned no alerts. No live information is being shown."
              : "The configured service returned an empty alert list."}
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
          {showWeatherSection && (
            <div className="weather-page-stack">
              {weatherData ? (
                <>
                  <WeatherOverviewPanel weather={weatherData} />
                  <WeatherForecastPanel weather={weatherData} />
                  <section className="weather-panel">
                    <div className="section-heading section-heading--compact">
                      <h2>Weather warnings</h2>
                    </div>
                    {weatherData.warnings.length > 0 ? (
                      <div className="weather-warning-list">
                        {weatherData.warnings.map((warning) => (
                          <WeatherWarningCard key={warning.id} warning={warning} />
                        ))}
                      </div>
                    ) : (
                      <p className="weather-empty-note">
                        No active weather warnings were reported for the available data.
                      </p>
                    )}
                  </section>
                </>
              ) : (
                <section className="integration-card integration-state" role="status">
                  <span className="integration-icon integration-icon--amber">
                    <Icon name="sparkle" />
                  </span>
                  <h2>Weather data unavailable</h2>
                  <p>
                    No current weather conditions, forecast or warnings were returned by the
                    configured service.
                  </p>
                </section>
              )}
            </div>
          )}

          {showSafetySection && (
            <SafetyAlertsPanel
              alerts={safetyAlerts}
              selectedCategory={selectedSafetyCategory}
              onSelectCategory={setSelectedSafetyCategory}
            />
          )}

          <section aria-label="Alert results" className="live-alert-list">
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
            {filteredAlerts.length > 0 ? (
              filteredAlerts.map((alert) => (
                <AlertCard alert={alert} key={alert.id} />
              ))
            ) : (
              <section className="integration-card integration-state" role="status">
                <h2>
                  {filter === "weather"
                    ? "No weather alerts returned"
                    : filter === "safety"
                      ? "No safety alerts returned"
                      : "No alerts returned"}
                </h2>
                <p>
                  {feed.freshness === "demo"
                    ? "The demo integration returned no matching alerts. No live information is being shown."
                    : `The configured service returned no ${filter === "all" ? "" : `${filter} `}alerts.`}
                </p>
              </section>
            )}
          </section>
        </>
      )}
    </div>
  );
}
