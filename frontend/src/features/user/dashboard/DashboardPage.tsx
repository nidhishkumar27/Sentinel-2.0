import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  integrationConfig,
  safetyIntegrations,
} from "../../../app/integrations";
import { Icon, type IconName } from "../../../components/ui/Icon";
import {
  demoDashboardData,
  type DemoResource,
} from "./demoDashboardData";
import type {
  AlertFeed,
  ServiceFailure,
  SafetyAlert,
} from "../../../types/safetyIntegrations";

type DataState = "loading" | "error" | "empty" | "ready";
type AlertLoadState = "loading" | ServiceFailure | "ready";
type AlertGroup = "weather" | "safety";

function DataPanel({
  state,
  children,
  emptyMessage,
  sectionName,
}: {
  state: DataState;
  children: React.ReactNode;
  emptyMessage: string;
  sectionName: string;
}) {
  if (state === "loading") {
    return (
      <p className="data-message" role="status">
        Loading {sectionName}…
      </p>
    );
  }

  if (state === "error") {
    return (
      <p className="data-message data-message--error" role="alert">
        {sectionName} could not be loaded. Please try again later.
      </p>
    );
  }

  if (state === "empty") {
    return <p className="data-message">{emptyMessage}</p>;
  }

  return <>{children}</>;
}

function ResourceCard({ resource }: { resource: DemoResource }) {
  return (
    <article className="resource-card">
      <span className={`resource-icon resource-icon--${resource.tone}`}>
        <Icon name={resource.icon} />
      </span>
      <span className="resource-copy">
        <span className="resource-title">{resource.title}</span>
        <span className="resource-description">{resource.description}</span>
      </span>
      <span aria-label="Demo item" className="demo-tag">
        DEMO
      </span>
    </article>
  );
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? "Time not provided"
    : date.toLocaleString();
}

function DashboardAlertItem({ alert }: { alert: SafetyAlert }) {
  return (
    <article className="live-alert-card">
      <span className="alert-icon alert-icon--blue">
        <Icon name={alert.category === "weather" ? "sparkle" : "shield"} />
      </span>
      <div className="live-alert-copy">
        <div className="live-alert-heading">
          <span className="alert-category">
            {alert.category === "weather" ? "Weather" : alert.category}
          </span>
          <time dateTime={alert.timestamp}>
            {formatTimestamp(alert.timestamp)}
          </time>
        </div>
        <h3>{alert.title}</h3>
        <p>{alert.message}</p>
        <span className="alert-source">Source: {alert.source}</span>
      </div>
    </article>
  );
}

function DashboardAlertSection({
  group,
  state,
  feed,
}: {
  group: AlertGroup;
  state: AlertLoadState;
  feed: AlertFeed | null;
}) {
  const isWeather = group === "weather";
  const heading = isWeather ? "Weather Alerts" : "Safety Alerts";
  const headingId = `${group}-alerts-heading`;
  const categoryAlerts =
    feed?.alerts.filter((alert) =>
      isWeather ? alert.category === "weather" : alert.category !== "weather",
    ) ?? [];
  const linkTo = `/alerts?category=${group}`;

  return (
    <section aria-labelledby={headingId} className="alerts-section">
      <div className="section-heading section-heading--compact">
        <div>
          <p className="section-eyebrow">
            {isWeather ? "WEATHER HAZARDS" : "INCIDENTS & ADVISORIES"}
          </p>
          <h2 id={headingId}>{heading}</h2>
        </div>
        <Link
          aria-label={`View ${heading.toLowerCase()}`}
          className="text-link"
          to={linkTo}
        >
          View all <Icon name="arrow" />
        </Link>
      </div>
      <p className="dashboard-alert-description">
        {isWeather
          ? "Heavy rain, flooding, storms and extreme heat when reported by a configured source."
          : "Safety incidents and advisories returned by configured sources."}
      </p>
      {state === "loading" && (
        <p className="data-message" role="status">
          Loading {isWeather ? "weather" : "safety"} alerts…
        </p>
      )}
      {state === "unavailable" && (
        <p className="data-message" role="status">
          {heading} unavailable. No alert service is connected.
        </p>
      )}
      {state === "timeout" && (
        <p className="data-message data-message--error" role="alert">
          {heading} request timed out. No alert response was confirmed.
        </p>
      )}
      {state === "error" && (
        <p className="data-message data-message--error" role="alert">
          {heading} could not be loaded. Try again later.
        </p>
      )}
      {state === "ready" && feed && (
        <>
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
          {categoryAlerts.length > 0 ? (
            <div className="live-alert-list">
              {categoryAlerts.slice(0, 2).map((alert) => (
                <DashboardAlertItem alert={alert} key={alert.id} />
              ))}
            </div>
          ) : (
            <p className="data-message" role="status">
              {feed.freshness === "demo"
                ? `The demo alert service returned no ${isWeather ? "weather" : "safety"} alerts. No live information is shown.`
                : `No ${isWeather ? "weather" : "safety"} alerts were returned by the configured service.`}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function QuickAction({
  title,
  description,
  icon,
  to,
}: {
  title: string;
  description: string;
  icon: IconName;
  to: string;
}) {
  return (
    <Link className="quick-action" to={to}>
      <span className="quick-action-icon">
        <Icon name={icon} />
      </span>
      <span className="quick-action-copy">
        <span className="quick-action-title">{title}</span>
        <span className="quick-action-description">{description}</span>
      </span>
      <Icon className="quick-action-arrow" name="chevron" />
    </Link>
  );
}

export function DashboardPage() {
  const resources = integrationConfig.demoEnabled
    ? demoDashboardData.resources
    : [];
  const [alertState, setAlertState] = useState<AlertLoadState>("loading");
  const [alertFeed, setAlertFeed] = useState<AlertFeed | null>(null);

  useEffect(() => {
    let active = true;

    Promise.resolve()
      .then(() => safetyIntegrations.alerts.getAlerts())
      .then(
        (result) => {
          if (!active) {
            return;
          }
          if (result.status !== "success") {
            setAlertState(result.status);
            return;
          }
          setAlertFeed(result.value);
          setAlertState("ready");
        },
        () => {
          if (active) {
            setAlertState("error");
          }
        },
      );

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="dashboard">
      {integrationConfig.demoEnabled && (
        <div className="demo-notice" role="note">
          <Icon name="sparkle" />
          <span>
            <strong>Demo preview.</strong> Resource examples are not
            location-specific. Alerts appear only when returned by the
            selected alert service.
          </span>
        </div>
      )}

      <section aria-labelledby="welcome-heading" className="welcome-row">
        <div>
          <p className="eyebrow">A SAFER WAY TO EXPLORE</p>
          <h1 id="welcome-heading">Travel with confidence.</h1>
          <p className="welcome-copy">
            Your safety tools, ready when you need them.
          </p>
        </div>
        <span aria-hidden="true" className="welcome-decoration">
          <Icon name="compass" />
        </span>
      </section>

      <section aria-labelledby="emergency-heading" className="emergency-card">
        <span className="emergency-orb emergency-orb--one" />
        <span className="emergency-orb emergency-orb--two" />
        <div className="emergency-copy">
          <span className="emergency-kicker">
            <span className="emergency-kicker-dot" />
            HERE IF YOU NEED IT
          </span>
          <h2 id="emergency-heading">Need help right now?</h2>
          <p>
            Open the emergency assistance screen for guidance. SOS submission
            isn’t connected in this preview.
          </p>
          <Link className="emergency-button" to="/sos">
            <Icon name="sos" />
            View emergency options
            <Icon className="button-arrow" name="arrow" />
          </Link>
          <span className="emergency-disclaimer">
            No emergency request will be sent from this demo.
          </span>
        </div>
        <div aria-hidden="true" className="emergency-art">
          <span className="emergency-art-ring emergency-art-ring--outer" />
          <span className="emergency-art-ring emergency-art-ring--inner" />
          <span className="emergency-art-shield">
            <Icon name="shield" />
          </span>
          <span className="emergency-art-sparkle emergency-art-sparkle--one">
            ✳
          </span>
          <span className="emergency-art-sparkle emergency-art-sparkle--two">
            ✳
          </span>
        </div>
      </section>

      <div aria-label="Weather and safety alerts" className="dashboard-alert-grid">
        <DashboardAlertSection
          feed={alertFeed}
          group="weather"
          state={alertState}
        />
        <DashboardAlertSection
          feed={alertFeed}
          group="safety"
          state={alertState}
        />
      </div>

      <section aria-labelledby="resources-heading" className="dashboard-section">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">BE PREPARED</p>
            <h2 id="resources-heading">Safety resources</h2>
          </div>
          <Link className="text-link" to="/safety-map">
            Explore map <Icon name="arrow" />
          </Link>
        </div>
        <div className="resource-grid">
          <DataPanel
            emptyMessage={
              integrationConfig.demoEnabled
                ? "No example resources to show yet."
                : "No safety-resource service is connected."
            }
            sectionName="Safety resources"
            state={resources.length > 0 ? "ready" : "empty"}
          >
            {resources.map((resource) => (
              <ResourceCard key={resource.title} resource={resource} />
            ))}
          </DataPanel>
        </div>
      </section>

      <div className="dashboard-lower-grid">
        <section
          aria-labelledby="quick-actions-heading"
          className="dashboard-section actions-section"
        >
          <div className="section-heading section-heading--compact">
            <div>
              <p className="section-eyebrow">ONE TAP AWAY</p>
              <h2 id="quick-actions-heading">Quick actions</h2>
            </div>
          </div>
          <div className="quick-action-list">
            <QuickAction
              description="Manage who to reach"
              icon="contacts"
              title="Emergency contacts"
              to="/emergency-contacts"
            />
            <QuickAction
              description="Your safety profile"
              icon="id"
              title="Digital ID"
              to="/digital-id"
            />
            <QuickAction
              description="Get travel guidance"
              icon="assistant"
              title="Safety assistant"
              to="/safety-assistant"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
