import { useEffect, useState } from "react";
import { Icon, type IconName } from "../../../components/ui/Icon";
import { integrationConfig, safetyIntegrations } from "../../../app/integrations";
import type { AlertFeed, SafetyAlert } from "../../../types/safetyIntegrations";

type LoadState =
  | "loading"
  | "unavailable"
  | "timeout"
  | "error"
  | "empty"
  | "ready";

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

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? "Time not provided"
    : date.toLocaleString();
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

export function AlertsPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [feed, setFeed] = useState<AlertFeed | null>(null);

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
          setState(result.value.alerts.length === 0 ? "empty" : "ready");
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
              The last response is marked stale (received{" "}
              {formatTimestamp(feed.fetchedAt)}).
            </p>
          )}
        </section>
      )}
      {state === "ready" && feed && (
        <section aria-label="Safety alerts" className="live-alert-list">
          {feed.freshness === "stale" && (
            <p className="stale-data-banner" role="status">
              These alerts may be out of date. Last response received{" "}
              {formatTimestamp(feed.fetchedAt)}.
            </p>
          )}
          {feed.freshness === "demo" && (
            <p className="integration-demo-banner" role="note">
              Demo alert data — not current or location-specific.
            </p>
          )}
          {feed.alerts.map((alert) => (
            <AlertCard alert={alert} key={alert.id} />
          ))}
        </section>
      )}
    </div>
  );
}
