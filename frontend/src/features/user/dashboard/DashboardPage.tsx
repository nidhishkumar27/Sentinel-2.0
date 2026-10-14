import { Link } from "react-router-dom";
import { integrationConfig } from "../../../app/integrations";
import { Icon, type IconName } from "../../../components/ui/Icon";
import {
  demoDashboardData,
  type DemoAlert,
  type DemoResource,
} from "./demoDashboardData";

type DataState = "loading" | "error" | "empty" | "ready";

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

function AlertCard({ alert }: { alert: DemoAlert }) {
  return (
    <article className="alert-card">
      <span className={`alert-icon alert-icon--${alert.tone}`}>
        <Icon name={alert.icon} />
      </span>
      <span className="alert-copy">
        <span className="alert-title">{alert.title}</span>
        <span className="alert-description">{alert.description}</span>
      </span>
      <span className="demo-tag">DEMO</span>
    </article>
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
  const alerts = integrationConfig.demoEnabled ? demoDashboardData.alerts : [];

  return (
    <div className="dashboard">
      {integrationConfig.demoEnabled && (
        <div className="demo-notice" role="note">
          <Icon name="sparkle" />
          <span>
            <strong>Demo preview.</strong> The resources and alerts below are
            examples, not live or location-specific information.
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
          aria-labelledby="alerts-heading"
          className="dashboard-section alerts-section"
        >
          <div className="section-heading section-heading--compact">
            <div>
              <p className="section-eyebrow">STAY IN THE KNOW</p>
              <h2 id="alerts-heading">Recent alerts</h2>
            </div>
            <Link aria-label="View alerts" className="round-link" to="/alerts">
              <Icon name="arrow" />
            </Link>
          </div>
          <div className="alert-list">
            <DataPanel
              emptyMessage={
                integrationConfig.demoEnabled
                  ? "No example alerts to show."
                  : "No alert service is connected."
              }
              sectionName="Alerts"
              state={alerts.length > 0 ? "ready" : "empty"}
            >
              {alerts.map((alert) => (
                <AlertCard alert={alert} key={alert.title} />
              ))}
            </DataPanel>
          </div>
        </section>

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
