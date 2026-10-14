import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { safetyIntegrations } from "../../../app/integrations";
import { Icon } from "../../../components/ui/Icon";
import type {
  EmergencyCategory,
  IncidentConfirmation,
  IncidentSubmissionRequest,
  IncidentSubmissionResult,
} from "../../../types/incidentIntegration";
import type {
  GeolocationFailure,
  UserLocation,
} from "../../../types/safetyIntegrations";

const DESCRIPTION_MAX_LENGTH = 500;
const SUBMISSION_TIMEOUT_MS = 20_000;

const emergencyCategories: {
  value: EmergencyCategory;
  title: string;
  description: string;
  icon: "medical" | "police" | "fire" | "help";
}[] = [
  {
    value: "medical",
    title: "Medical",
    description: "Injury or urgent health concern",
    icon: "medical",
  },
  {
    value: "police",
    title: "Police",
    description: "Request police assistance",
    icon: "police",
  },
  {
    value: "fire",
    title: "Fire",
    description: "Fire or immediate fire risk",
    icon: "fire",
  },
  {
    value: "other",
    title: "Other",
    description: "Another urgent situation",
    icon: "help",
  },
];

const locationMessages: Record<GeolocationFailure, string> = {
  "permission-denied":
    "Location permission was denied. Allow access in browser settings or enter coordinates manually.",
  timeout:
    "The location request timed out. Try again or enter coordinates manually.",
  unavailable:
    "Your browser could not provide a location. You can retry or enter coordinates manually.",
};

type LocationState =
  | "idle"
  | "requesting"
  | "permission-denied"
  | "timeout"
  | "unavailable"
  | "manual";

type SubmissionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "unavailable" }
  | { status: "unknown"; reason: "timeout" | "connection-lost" | "error" }
  | { status: "rejected" }
  | { status: "confirmed"; confirmation: IncidentConfirmation };

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function describeUnknownOutcome(reason: "timeout" | "connection-lost" | "error") {
  if (reason === "timeout") {
    return "The submission timed out. Its outcome is unknown; do not submit again unless the backend can confirm whether it created an incident.";
  }
  if (reason === "connection-lost") {
    return "The connection was lost while submitting. The outcome is unknown; do not submit again unless the backend can confirm whether it created an incident.";
  }
  return "The submission result could not be confirmed. Its outcome is unknown; do not submit again unless the backend can confirm whether it created an incident.";
}

function StatusPanel({ state }: { state: SubmissionState }) {
  if (state.status === "idle") {
    return null;
  }

  if (state.status === "submitting") {
    return (
      <p className="sos-submission-pending" role="status">
        Submitting to the configured incident service. Wait for its response;
        this does not yet confirm an incident was created.
      </p>
    );
  }

  if (state.status === "unavailable") {
    return (
      <div className="sos-outcome sos-outcome--warning" role="alert">
        <strong>Emergency submission unavailable</strong>
        <p>
          This frontend preview cannot contact emergency services. No
          emergency request was confirmed. Contact local emergency services
          directly if you need immediate help.
        </p>
      </div>
    );
  }

  if (state.status === "unknown") {
    return (
      <div className="sos-outcome sos-outcome--warning" role="alert">
        <strong>Submission outcome unknown</strong>
        <p>{describeUnknownOutcome(state.reason)}</p>
        <p>
          This app cannot contact emergency services until a real backend
          integration is configured. Contact local emergency services directly
          if you need immediate help.
        </p>
      </div>
    );
  }

  if (state.status === "rejected") {
    return (
      <div className="sos-outcome sos-outcome--error" role="alert">
        <strong>Request not accepted</strong>
        <p>
          The connected service did not accept the request. No incident was
          confirmed.
        </p>
        <p>
          This app is not a replacement for local emergency services. Contact
          them directly if you need immediate help.
        </p>
      </div>
    );
  }

  return (
    <div className="sos-outcome sos-outcome--confirmed" role="status">
      <strong>Incident submission confirmed by the connected service</strong>
      {state.confirmation.reference && (
        <p>
          Incident reference: <b>{state.confirmation.reference}</b>
        </p>
      )}
      {state.confirmation.status && (
        <p>
          Service-reported status: <b>{state.confirmation.status}</b>
        </p>
      )}
      {!state.confirmation.reference && !state.confirmation.status && (
        <p>
          The service confirmed submission but did not return a reference or
          status.
        </p>
      )}
      <p>Contact local emergency services directly if immediate help is needed.</p>
    </div>
  );
}

export function SOSPage() {
  const [category, setCategory] = useState<EmergencyCategory | null>(null);
  const [description, setDescription] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [latitudeInput, setLatitudeInput] = useState("");
  const [longitudeInput, setLongitudeInput] = useState("");
  const [locationError, setLocationError] = useState("");
  const [step, setStep] = useState<"details" | "review">("details");
  const [submission, setSubmission] = useState<SubmissionState>({
    status: "idle",
  });
  const [categoryError, setCategoryError] = useState("");
  const submissionAttempted = useRef(false);

  const submissionStarted =
    submission.status === "submitting" ||
    submission.status === "confirmed" ||
    submission.status === "unavailable" ||
    submission.status === "unknown";

  async function captureLocation() {
    setLocationState("requesting");
    setLocation(null);
    setLocationError("");

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

  function useManualLocation() {
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
      setLocationError(
        "Enter a valid latitude (−90 to 90) and longitude (−180 to 180).",
      );
      return;
    }

    setLocationError("");
    setLocation({
      latitude,
      longitude,
      accuracyMeters: null,
      capturedAt: new Date().toISOString(),
    });
    setLocationState("manual");
  }

  function reviewRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCategoryError("");
    setDescriptionError("");

    let valid = true;
    if (!category) {
      setCategoryError("Choose the emergency category that best fits.");
      valid = false;
    }
    if (description.length > DESCRIPTION_MAX_LENGTH) {
      setDescriptionError(
        `Keep the description to ${DESCRIPTION_MAX_LENGTH} characters or fewer.`,
      );
      valid = false;
    }
    if (!valid) {
      return;
    }
    setStep("review");
  }

  async function submitIncident() {
    if (!category || submissionAttempted.current || submissionStarted) {
      return;
    }

    submissionAttempted.current = true;
    setSubmission({ status: "submitting" });
    const request: IncidentSubmissionRequest = {
      category,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(location ? { location } : {}),
    };

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const attempt = await Promise.race([
        safetyIntegrations.incidents
          .submitIncident(request)
          .then((result) => ({ kind: "result" as const, result })),
        new Promise<{ kind: "timeout" }>((resolve) => {
          timeoutId = setTimeout(
            () => resolve({ kind: "timeout" }),
            SUBMISSION_TIMEOUT_MS,
          );
        }),
      ]);

      if (attempt.kind === "timeout") {
        setSubmission({ status: "unknown", reason: "timeout" });
        return;
      }

      const result: IncidentSubmissionResult = attempt.result;
      if (result.status === "confirmed") {
        setSubmission({
          status: "confirmed",
          confirmation: result.confirmation,
        });
      } else if (result.status === "rejected") {
        setSubmission({ status: "rejected" });
      } else if (result.status === "unavailable") {
        setSubmission({ status: "unavailable" });
      } else {
        setSubmission({ status: "unknown", reason: result.reason });
      }
    } catch {
      setSubmission({ status: "unknown", reason: "error" });
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  function editRequest() {
    if (
      submission.status === "submitting" ||
      submission.status === "unknown" ||
      submission.status === "confirmed" ||
      submission.status === "unavailable"
    ) {
      return;
    }
    setStep("details");
  }

  return (
    <div className="sos-page">
      <div className="sos-page-heading">
        <p className="eyebrow">EMERGENCY ASSISTANCE</p>
        <h1>Request help</h1>
        <p>
          Share the details you choose. Review them before any submission is
          attempted.
        </p>
      </div>

      <div className="sos-critical-notice" role="note">
        <Icon name="sos" />
        <p>
          <strong>This preview cannot contact emergency services.</strong> A
          submission is not confirmed until a connected service explicitly
          confirms it. For immediate help, contact your local emergency
          services directly.
        </p>
      </div>

      <div className="sos-progress" aria-label={`Step ${step === "details" ? 1 : 2} of 2`}>
        <span className={step === "details" ? "sos-step sos-step--active" : "sos-step sos-step--done"}>
          <span>1</span> Details
        </span>
        <span aria-hidden="true" className="sos-step-line" />
        <span className={step === "review" ? "sos-step sos-step--active" : "sos-step"}>
          <span>2</span> Review
        </span>
      </div>

      {step === "details" ? (
        <form className="sos-card" noValidate onSubmit={reviewRequest}>
          <fieldset className="sos-fieldset">
            <legend>
              What kind of emergency is this? <span aria-hidden="true">*</span>
            </legend>
            <p className="sos-helper">
              Choose the closest match. This choice does not dispatch a
              particular service.
            </p>
            <div className="sos-category-grid">
              {emergencyCategories.map((option) => (
                <label
                  className={`sos-category${category === option.value ? " sos-category--selected" : ""}`}
                  key={option.value}
                >
                  <input
                    checked={category === option.value}
                    disabled={submissionStarted}
                    name="emergency-category"
                    onChange={() => {
                      setCategory(option.value);
                      setCategoryError("");
                    }}
                    type="radio"
                    value={option.value}
                  />
                  <span className={`sos-category-icon sos-category-icon--${option.value}`}>
                    <Icon name={option.icon} />
                  </span>
                  <span className="sos-category-copy">
                    <strong>{option.title}</strong>
                    <span>{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
            {categoryError && (
              <p className="sos-form-error" role="alert">
                {categoryError}
              </p>
            )}
          </fieldset>

          <div className="sos-field">
            <label htmlFor="sos-description">What happened? (optional)</label>
            <p className="sos-helper">
              Share only what may help. Do not include passwords or payment
              details.
            </p>
            <textarea
              aria-describedby="sos-description-count"
              className="sos-textarea"
              disabled={submissionStarted}
              id="sos-description"
              maxLength={DESCRIPTION_MAX_LENGTH + 1}
              onChange={(event) => {
                setDescription(event.target.value);
                setDescriptionError("");
              }}
              rows={4}
              value={description}
            />
            <div className="sos-description-meta">
              {descriptionError && (
                <span className="sos-form-error" role="alert">
                  {descriptionError}
                </span>
              )}
              <span id="sos-description-count">
                {description.length}/{DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
          </div>

          <section aria-labelledby="sos-location-heading" className="sos-location-section">
            <div className="sos-subsection-heading">
              <div>
                <h2 id="sos-location-heading">Location (optional)</h2>
                <p>
                  Location is requested only when you ask for it. You can
                  continue without a location.
                </p>
              </div>
              <Icon name="map" />
            </div>
            <button
              className="integration-secondary-button"
              disabled={locationState === "requesting" || submissionStarted}
              onClick={captureLocation}
              type="button"
            >
              <Icon name="compass" />
              {locationState === "requesting"
                ? "Requesting location…"
                : "Use my current location"}
            </button>
            {locationState === "requesting" && (
              <p className="integration-status" role="status">
                Waiting for your browser’s location response…
              </p>
            )}
            {locationState !== "idle" &&
              locationState !== "manual" &&
              locationState !== "requesting" && (
                <p className="integration-error" role="alert">
                  {locationMessages[locationState]}
                </p>
              )}
            {location && (
              <div className="sos-location-result" role="status">
                <strong>
                  {locationState === "manual"
                    ? "Manual coordinates entered"
                    : "Browser location available"}
                </strong>
                <span>
                  {formatCoordinate(location.latitude)},{" "}
                  {formatCoordinate(location.longitude)}
                </span>
                {location.accuracyMeters !== null && (
                  <span>
                    Browser-reported accuracy:{" "}
                    {Math.round(location.accuracyMeters)} m
                  </span>
                )}
                <span>Coordinates do not indicate whether a place is safe.</span>
              </div>
            )}
            <details className="manual-location-card sos-manual-location">
              <summary>Enter location manually</summary>
              <div className="manual-location-form">
                <div className="form-field">
                  <label htmlFor="sos-latitude">Latitude</label>
                  <input
                    autoComplete="off"
                    className="form-input"
                    disabled={submissionStarted}
                    id="sos-latitude"
                    inputMode="decimal"
                    onChange={(event) => {
                      setLatitudeInput(event.target.value);
                      setLocationError("");
                    }}
                    placeholder="−90 to 90"
                    step="any"
                    type="number"
                    value={latitudeInput}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="sos-longitude">Longitude</label>
                  <input
                    autoComplete="off"
                    className="form-input"
                    disabled={submissionStarted}
                    id="sos-longitude"
                    inputMode="decimal"
                    onChange={(event) => {
                      setLongitudeInput(event.target.value);
                      setLocationError("");
                    }}
                    placeholder="−180 to 180"
                    step="any"
                    type="number"
                    value={longitudeInput}
                  />
                </div>
                <button
                  className="integration-secondary-button"
                  disabled={submissionStarted || locationState === "requesting"}
                  onClick={useManualLocation}
                  type="button"
                >
                  Use these coordinates
                </button>
              </div>
              {locationError && (
                <p className="sos-form-error" role="alert">
                  {locationError}
                </p>
              )}
            </details>
          </section>

          <div className="sos-form-actions">
            <Link className="account-cancel-link" to="/">
              <Icon name="arrow" />
              Return to dashboard
            </Link>
            <button
              className="auth-submit sos-continue-button"
              disabled={submissionStarted}
              type="submit"
            >
              Review request
              <Icon name="arrow" />
            </button>
          </div>
          <StatusPanel state={submission} />
        </form>
      ) : (
        <section aria-labelledby="sos-review-heading" className="sos-card">
          <div className="sos-review-heading">
            <span className="integration-icon integration-icon--amber">
              <Icon name="sos" />
            </span>
            <div>
              <h2 id="sos-review-heading">Review your request</h2>
              <p>Check these details before choosing whether to submit.</p>
            </div>
          </div>
          <dl className="sos-review-list">
            <div>
              <dt>Category</dt>
              <dd>
                {emergencyCategories.find((item) => item.value === category)
                  ?.title ?? "Not selected"}
              </dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{description.trim() || "No description provided"}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>
                {location
                  ? `${formatCoordinate(location.latitude)}, ${formatCoordinate(location.longitude)}${location.accuracyMeters === null ? " (manual)" : ` (±${Math.round(location.accuracyMeters)} m browser estimate)`}`
                  : "No location included"}
              </dd>
            </div>
          </dl>

          <p className="sos-review-caution">
            Submitting does not guarantee delivery. Do not rely on this preview
            to contact emergency services. Contact local emergency services
            directly if you need immediate help.
          </p>
          <StatusPanel state={submission} />
          <div className="sos-form-actions sos-review-actions">
            {submission.status === "idle" ? (
              <button
                className="account-cancel-link sos-edit-button"
                onClick={editRequest}
                type="button"
              >
                <Icon name="arrow" />
                Edit details
              </button>
            ) : (
              <Link className="account-cancel-link" to="/">
                <Icon name="arrow" />
                Return to dashboard
              </Link>
            )}
            {submission.status === "idle" && (
              <button
                className="auth-submit sos-submit-button"
                onClick={submitIncident}
                type="button"
              >
                Submit emergency request
              </button>
            )}
            {submission.status === "submitting" && (
              <button
                className="auth-submit sos-submit-button"
                disabled
                type="button"
              >
                Submitting…
              </button>
            )}
          </div>
          <Link className="sos-safe-exit" to="/">
            <Icon name="arrow" />
            Return to dashboard without submitting
          </Link>
        </section>
      )}
    </div>
  );
}
