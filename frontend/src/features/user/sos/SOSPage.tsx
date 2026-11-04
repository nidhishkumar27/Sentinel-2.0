import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../components/ui/Icon";
import { safetyIntegrations } from "../../../app/integrations";
import { playUiSound, prepareUiSound } from "../../../services/soundEffects";
import type {
  EmergencyCategory,
  IncidentConfirmation,
  IncidentSubmissionRequest,
  IncidentSubmissionResult,
} from "../../../types/incidentIntegration";

const SUBMISSION_TIMEOUT_MS = 20_000;
const SOS_COUNTDOWN_SECONDS = 5;

type DescriptionState = {
  hasDescription: boolean;
  isVoice: boolean;
  value: string;
};

type DescriptionUpdateStatus =
  | "NO DESCRIPTION ADDED"
  | "DESCRIPTION READY TO SEND"
  | "VOICE TRANSCRIPTION READY TO SEND"
  | "DESCRIPTION INCLUDED IN INITIAL SUBMISSION"
  | "VOICE TRANSCRIPTION INCLUDED IN INITIAL SUBMISSION"
  | "UPDATE PENDING"
  | "UPDATE CONFIRMED"
  | "UPDATE FAILED"
  | "NOT ATTACHED — BACKEND UPDATE NOT SUPPORTED"
  | "UPDATE STATUS UNKNOWN";

type SubmissionState =
  | { status: "idle" }
  | { status: "submitting"; category: EmergencyCategory; submittedAt: string; description?: DescriptionState }
  | { status: "unavailable"; category?: EmergencyCategory; description?: DescriptionState }
  | { status: "unknown"; reason: "timeout" | "connection-lost" | "error"; category?: EmergencyCategory; description?: DescriptionState }
  | { status: "rejected"; category?: EmergencyCategory; description?: DescriptionState }
  | { status: "confirmed"; confirmation: IncidentConfirmation; category: EmergencyCategory; submittedAt: string; description?: DescriptionState };

function createClientIncidentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `sos-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const emergencyCategories: {
  value: EmergencyCategory;
  label: string;
  description: string;
  icon: "medical" | "police" | "fire" | "help";
}[] = [
  {
    value: "police",
    label: "POLICE",
    description: "Urgent police assistance",
    icon: "police",
  },
  {
    value: "fire",
    label: "FIRE",
    description: "Fire or hazardous smoke",
    icon: "fire",
  },
  {
    value: "medical",
    label: "MEDICAL",
    description: "Injury or health emergency",
    icon: "medical",
  },
  {
    value: "other",
    label: "LOST / DISORIENTED",
    description: "I need help navigating or locating",
    icon: "help",
  },
];

function StatusPanel({
  state,
  incidentId,
  descriptionUpdateStatus,
}: {
  state: SubmissionState;
  incidentId?: string | null;
  descriptionUpdateStatus?: DescriptionUpdateStatus;
}) {
  const stateDescription = "description" in state ? state.description : undefined;
  const descriptionStatus = stateDescription?.hasDescription
    ? stateDescription.isVoice
      ? "VOICE TRANSCRIPTION INCLUDED IN INITIAL SUBMISSION"
      : "DESCRIPTION INCLUDED IN INITIAL SUBMISSION"
    : "NO DESCRIPTION ADDED";
  const shownDescriptionStatus = descriptionUpdateStatus ?? descriptionStatus;

  if (state.status === "idle") {
    return null;
  }

  if (state.status === "submitting") {
    return (
      <div className="sos-submission-pending" role="status">
        <span aria-hidden="true" className="sos-status-spinner" />
        <div>
          <strong>SENDING EMERGENCY REQUEST...</strong>
          <p>Waiting for the configured service to confirm the request.</p>
          {incidentId && (
            <p>
              Client incident ID: <b>{incidentId}</b>
            </p>
          )}
          <p className="sos-description-state">{shownDescriptionStatus}</p>
          {state.description?.hasDescription && (
            <p className="sos-description-summary">Included in initial request: “{state.description.value}”</p>
          )}
        </div>
      </div>
    );
  }

  if (state.status === "unavailable") {
    return (
      <div className="sos-outcome sos-outcome--warning" role="alert">
        <strong>EMERGENCY SUBMISSION UNAVAILABLE</strong>
        <p>
          This frontend preview cannot contact emergency services. No emergency request was confirmed.
          Contact local emergency services directly if you need immediate help.
        </p>
        {incidentId && (
          <p>
            Client incident ID: <b>{incidentId}</b>
          </p>
        )}
        <p className="sos-description-state">{shownDescriptionStatus}</p>
      </div>
    );
  }

  if (state.status === "unknown") {
    return null;
  }

  if (state.status === "rejected") {
    return (
      <div className="sos-outcome sos-outcome--error" role="alert">
        <strong>EMERGENCY REQUEST NOT SENT</strong>
        <p>
          The connected service rejected the request. No incident was confirmed.
        </p>
        {incidentId && (
          <p>
            Client incident ID: <b>{incidentId}</b>
          </p>
        )}
        <p className="sos-description-state">{shownDescriptionStatus}</p>
      </div>
    );
  }

  const submittedAt = new Date(state.submittedAt).toLocaleString();
  const categoryLabel = state.category ? state.category.toUpperCase() : "UNKNOWN";

  return (
    <div className="sos-outcome sos-outcome--confirmed" role="status">
      <div className="sos-confirmation-header">
        <span aria-hidden="true" className="sos-confirmation-icon">
          <Icon name="check" />
        </span>
        <strong>EMERGENCY REQUEST SENT</strong>
      </div>
      <p className="sos-confirmation-message">
        Your emergency request was accepted by the configured service.
      </p>
      {incidentId && (
        <p>
          Client incident ID: <b>{incidentId}</b>
        </p>
      )}
      <p>
        Category: <b>{categoryLabel}</b>
      </p>
      <p>
        Submission time: <b>{submittedAt}</b>
      </p>
      <p className="sos-description-state">{shownDescriptionStatus}</p>
      {state.description?.hasDescription && (
        <p className="sos-description-summary">Initial request text: “{state.description.value}”</p>
      )}
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
        <p>The service confirmed submission but did not return a reference or status.</p>
      )}
    </div>
  );
}

export function SOSPage() {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [countdown, setCountdown] = useState(SOS_COUNTDOWN_SECONDS);
  const [selectedCategory, setSelectedCategory] = useState<EmergencyCategory | null>(null);
  const [description, setDescription] = useState("");
  const [descriptionSource, setDescriptionSource] = useState<"manual" | "voice" | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const [cancelledNotice, setCancelledNotice] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [submission, setSubmission] = useState<SubmissionState>({ status: "idle" });
  const [clientIncidentId, setClientIncidentId] = useState<string | null>(null);
  const [descriptionUpdateStatus, setDescriptionUpdateStatus] = useState<DescriptionUpdateStatus>("NO DESCRIPTION ADDED");
  const [pendingLocation, setPendingLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    capturedAt: string;
  } | null>(null);
  const [locationStatusMessage, setLocationStatusMessage] = useState(
    "Location unavailable. SOS will continue without coordinates.",
  );
  const recognitionRef = useRef<any>(null);
  const submitAttempted = useRef(false);
  const submissionRef = useRef<SubmissionState>({ status: "idle" });
  const descriptionSourceRef = useRef<"manual" | "voice" | null>(null);
  const clientIncidentIdRef = useRef<string | null>(null);
  const submittedDescriptionRef = useRef<string | null>(null);
  const lastDescriptionUpdateKeyRef = useRef("");
  const lateDescriptionUpdateRef = useRef<number | null>(null);
  const playedConfirmationSoundRef = useRef<string | null>(null);

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const closePopup = () => {
    if (submission.status === "submitting") {
      return;
    }
    submitAttempted.current = false;
    const unresolvedSubmission = submissionRef.current.status === "unknown";
    if (!unresolvedSubmission) {
      clientIncidentIdRef.current = null;
      submittedDescriptionRef.current = null;
      lastDescriptionUpdateKeyRef.current = "";
      submissionRef.current = { status: "idle" };
    }
    stopListening();
    setIsPopupOpen(false);
    setCountdown(SOS_COUNTDOWN_SECONDS);
    setSelectedCategory(null);
    setDescription("");
    setDescriptionSource(null);
    descriptionSourceRef.current = null;
    setVoiceError("");
    setPendingLocation(null);
    setLocationStatusMessage("Location unavailable. SOS will continue without coordinates.");
    if (!unresolvedSubmission) setClientIncidentId(null);
    setDescriptionUpdateStatus("NO DESCRIPTION ADDED");
    if (!unresolvedSubmission) setSubmission({ status: "idle" });
  };

  const refreshLocationState = async () => {
    const latest = safetyIntegrations.geolocation.getLatestLocation();
    setPendingLocation(
      latest
        ? {
            latitude: latest.latitude,
            longitude: latest.longitude,
            accuracyMeters: latest.accuracyMeters,
            capturedAt: latest.capturedAt,
          }
        : null,
    );

    const permission = await safetyIntegrations.geolocation.getPermissionStatus();
    if (permission === "denied") {
      setLocationStatusMessage("Location permission required. SOS will continue without coordinates.");
      return;
    }

    if (latest) {
      setLocationStatusMessage(
        latest.freshness === "fresh"
          ? "Fresh location is ready for the emergency request."
          : latest.freshness === "stale"
            ? "The last known location is available, but it may be outdated."
            : "Location is updating…",
      );
    }

    if (permission === "unsupported") {
      setLocationStatusMessage("This browser cannot provide a live location. SOS will continue without coordinates.");
      return;
    }

    // Calling getCurrentPosition also prompts for permission when the browser
    // reports "prompt". Previously we returned here and never requested a fix.
    const result = await safetyIntegrations.geolocation.requestCurrentLocation();
    if (result.status === "success") {
      setPendingLocation({
        latitude: result.location.latitude,
        longitude: result.location.longitude,
        accuracyMeters: result.location.accuracyMeters,
        capturedAt: result.location.capturedAt,
      });
      setLocationStatusMessage("Fresh location received and attached to the emergency request.");
      return;
    }

    if (result.status === "timeout") {
      setLocationStatusMessage("Location request timed out. SOS will continue without coordinates.");
      return;
    }

    if (result.status === "permission-denied") {
      setLocationStatusMessage("Location permission required. SOS will continue without coordinates.");
      return;
    }

    setLocationStatusMessage("Location unavailable. SOS will continue without coordinates.");
  };

  const queueLateDescriptionUpdate = (nextValue: string, reason: "late-text-edit" | "late-voice-transcript") => {
    const trimmedValue = nextValue.trim();

    if (submissionRef.current.status === "idle") {
      setDescriptionUpdateStatus(
        trimmedValue
          ? descriptionSourceRef.current === "voice"
            ? "VOICE TRANSCRIPTION READY TO SEND"
            : "DESCRIPTION READY TO SEND"
          : "NO DESCRIPTION ADDED",
      );
      return;
    }

    if (!trimmedValue) {
      setDescriptionUpdateStatus("NO DESCRIPTION ADDED");
      return;
    }

    const currentIncidentId = clientIncidentIdRef.current;
    if (!currentIncidentId) {
      setDescriptionUpdateStatus("NO DESCRIPTION ADDED");
      return;
    }

    const initialValue = submittedDescriptionRef.current?.trim() ?? "";
    if (initialValue && trimmedValue === initialValue) {
      setDescriptionUpdateStatus(
        descriptionSourceRef.current === "voice"
          ? "VOICE TRANSCRIPTION INCLUDED IN INITIAL SUBMISSION"
          : "DESCRIPTION INCLUDED IN INITIAL SUBMISSION",
      );
      return;
    }

    const updateKey = `${currentIncidentId}:${trimmedValue}:${reason}`;
    if (lastDescriptionUpdateKeyRef.current === updateKey) {
      return;
    }

    if (lateDescriptionUpdateRef.current !== null) {
      window.clearTimeout(lateDescriptionUpdateRef.current);
    }

    lateDescriptionUpdateRef.current = window.setTimeout(async () => {
      lateDescriptionUpdateRef.current = null;
      lastDescriptionUpdateKeyRef.current = updateKey;
      setDescriptionUpdateStatus("UPDATE PENDING");

      const updateDescription = safetyIntegrations.incidents.updateIncidentDescription;
      if (!updateDescription) {
        setDescriptionUpdateStatus("NOT ATTACHED — BACKEND UPDATE NOT SUPPORTED");
        return;
      }

      try {
        const result = await updateDescription({
          incidentId: currentIncidentId,
          description: trimmedValue,
          reason,
        });

        if (result.status === "confirmed") {
          setDescriptionUpdateStatus("UPDATE CONFIRMED");
          return;
        }

        if (result.status === "rejected") {
          setDescriptionUpdateStatus("UPDATE FAILED");
          return;
        }

        if (result.status === "unavailable") {
          setDescriptionUpdateStatus("NOT ATTACHED — BACKEND UPDATE NOT SUPPORTED");
          return;
        }

        setDescriptionUpdateStatus("UPDATE STATUS UNKNOWN");
      } catch {
        setDescriptionUpdateStatus("UPDATE STATUS UNKNOWN");
      }
    }, 250);
  };

  const openPopup = () => {
    if (submission.status === "submitting") {
      return;
    }
    const nextIncidentId = createClientIncidentId();
    clientIncidentIdRef.current = nextIncidentId;
    setClientIncidentId(nextIncidentId);
    submitAttempted.current = false;
    setCancelledNotice("");
    setVoiceError("");
    setDescription("");
    setDescriptionSource(null);
    descriptionSourceRef.current = null;
    setSelectedCategory(null);
    setCountdown(SOS_COUNTDOWN_SECONDS);
    submissionRef.current = { status: "idle" };
    setSubmission({ status: "idle" });
    setPendingLocation(null);
    setLocationStatusMessage("Location unavailable. SOS will continue without coordinates.");
    setDescriptionUpdateStatus("NO DESCRIPTION ADDED");
    setIsPopupOpen(true);
    void prepareUiSound("/sounds/sos-click.mp3");
    void refreshLocationState();
  };

  async function submitIncident() {
    if (submission.status === "submitting" || submission.status === "confirmed" || submission.status === "unavailable" || submission.status === "unknown" || submitAttempted.current) {
      return;
    }

    const submittedCategory = selectedCategory ?? "unknown";
    const trimmedDescription = description.trim();
    const descriptionPayload: DescriptionState | undefined = trimmedDescription
      ? {
          hasDescription: true,
          isVoice: descriptionSource === "voice",
          value: trimmedDescription,
        }
      : undefined;

    if (!clientIncidentIdRef.current) {
      const nextIncidentId = createClientIncidentId();
      clientIncidentIdRef.current = nextIncidentId;
      setClientIncidentId(nextIncidentId);
    }

    submittedDescriptionRef.current = trimmedDescription || null;
    if (trimmedDescription) {
      setDescriptionUpdateStatus(
        descriptionSourceRef.current === "voice"
          ? "VOICE TRANSCRIPTION INCLUDED IN INITIAL SUBMISSION"
          : "DESCRIPTION INCLUDED IN INITIAL SUBMISSION",
      );
    } else {
      setDescriptionUpdateStatus("NO DESCRIPTION ADDED");
    }

    submissionRef.current = {
      status: "submitting",
      category: submittedCategory,
      submittedAt: new Date().toISOString(),
      description: descriptionPayload,
    };
    submitAttempted.current = true;
    stopListening();
    setSubmission({
      status: "submitting",
      category: submittedCategory,
      submittedAt: new Date().toISOString(),
      description: descriptionPayload,
    });

    const request: IncidentSubmissionRequest = {
      clientRequestId: clientIncidentIdRef.current ?? createClientIncidentId(),
      category: submittedCategory,
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
      ...(pendingLocation
        ? {
            location: {
              latitude: pendingLocation.latitude,
              longitude: pendingLocation.longitude,
              accuracyMeters: pendingLocation.accuracyMeters,
              capturedAt: pendingLocation.capturedAt,
            },
          }
        : {}),
    };

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const requestPromise = safetyIntegrations.incidents.submitIncident(request);
      const requestId = clientIncidentIdRef.current;
      if (requestId && playedConfirmationSoundRef.current !== requestId) {
        playedConfirmationSoundRef.current = requestId;
        void playUiSound("/sounds/sos-click.mp3");
      }
      const attempt = await Promise.race([
        requestPromise.then((result) => ({ kind: "result" as const, result })),
        new Promise<{ kind: "timeout" }>((resolve) => {
          timeoutId = setTimeout(() => resolve({ kind: "timeout" }), SUBMISSION_TIMEOUT_MS);
        }),
      ]);

      if (attempt.kind === "timeout") {
        setSubmission({
          status: "unknown",
          reason: "timeout",
          category: submittedCategory,
          description: descriptionPayload,
        });
        return;
      }

      const result: IncidentSubmissionResult = attempt.result;

      if (result.status === "confirmed") {
        setSubmission({
          status: "confirmed",
          confirmation: result.confirmation,
          category: submittedCategory,
          submittedAt: new Date().toISOString(),
          description: descriptionPayload,
        });

        if (
          result.confirmation.reference &&
          pendingLocation &&
          safetyIntegrations.incidents.updateIncidentLocation
        ) {
          void safetyIntegrations.incidents.updateIncidentLocation({
            incidentId: result.confirmation.reference,
            location: {
              latitude: pendingLocation.latitude,
              longitude: pendingLocation.longitude,
              accuracyMeters: pendingLocation.accuracyMeters,
              capturedAt: pendingLocation.capturedAt,
            },
            reason: "fresh-location-update",
          });
        }
      } else if (result.status === "rejected") {
        setSubmission({
          status: "rejected",
          category: submittedCategory,
          description: descriptionPayload,
        });
      } else if (result.status === "unavailable") {
        setSubmission({
          status: "unavailable",
          category: submittedCategory,
          description: descriptionPayload,
        });
      } else {
        setSubmission({
          status: "unknown",
          reason: result.reason,
          category: submittedCategory,
          description: descriptionPayload,
        });
      }
    } catch {
      setSubmission({
        status: "unknown",
        reason: "error",
        category: submittedCategory,
        description: descriptionPayload,
      });
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  useEffect(() => {
    submissionRef.current = submission;
  }, [submission]);

  useEffect(() => {
    if (!isPopupOpen || countdown <= 0 || submission.status === "submitting" || submission.status === "confirmed" || submission.status === "unavailable" || submission.status === "unknown") {
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdown((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdown, isPopupOpen, submission]);

  useEffect(() => {
    if (!isPopupOpen || countdown > 0 || submission.status === "submitting" || submission.status === "confirmed" || submission.status === "unavailable" || submission.status === "unknown") {
      return;
    }

    void submitIncident();
  }, [countdown, isPopupOpen, submission]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  const handleSpeak = () => {
    if (typeof window === "undefined") {
      setVoiceError("Speech recognition is unavailable in this browser.");
      return;
    }

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setVoiceError("Speech recognition is not supported in this browser. You can type instead.");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceError("");
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();

      if (transcript) {
        descriptionSourceRef.current = "voice";
        setDescriptionSource("voice");
        setDescription((current) => {
          const nextValue = current ? `${current} ${transcript}`.trim() : transcript;
          if (submissionRef.current.status !== "idle") {
            void queueLateDescriptionUpdate(nextValue, "late-voice-transcript");
          }
          return nextValue;
        });
        setVoiceError("");
      }
    };

    recognition.onerror = (event: any) => {
      const message =
        event?.error === "not-allowed"
          ? "Microphone access was denied. You can type your message instead."
          : "Speech recognition could not start. You can type your message instead.";
      setVoiceError(message);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const descriptionStatusLabel = description.trim()
    ? descriptionSource === "voice"
      ? "VOICE TRANSCRIPTION READY TO SEND"
      : "DESCRIPTION READY TO SEND"
    : "NO DESCRIPTION ADDED";

  return (
    <div className="sos-page">
      <div className="sos-page-heading">
        <p className="eyebrow">EMERGENCY ASSISTANCE</p>
        <h1>Emergency SOS</h1>
        <p>Send your emergency request quickly. Choose the closest category if you know it.</p>
      </div>

      {cancelledNotice && (
        <p className="sos-cancelled-banner" role="status">
          {cancelledNotice}
        </p>
      )}

      <div className="sos-trigger-shell">
        <p className="sos-trigger-text">Sending in 5 seconds</p>
        <button
          aria-expanded={isPopupOpen}
          aria-haspopup="dialog"
          className="sos-primary-button"
          onClick={openPopup}
          type="button"
        >
          <span aria-hidden="true" className="sos-button-icon">
            <Icon name="sos" />
          </span>
          <span className="sos-button-label">SOS</span>
        </button>
        <p className="sos-trigger-copy">Send emergency help instantly.</p>
      </div>

      {!isPopupOpen && submission.status !== "idle" && (
        <StatusPanel
          state={submission}
          incidentId={clientIncidentId}
          descriptionUpdateStatus={descriptionUpdateStatus}
        />
      )}

      {isPopupOpen && (
        <div className="sos-modal-overlay">
          <div
            aria-labelledby="sos-dialog-title"
            aria-modal="true"
            className="sos-modal"
            role="dialog"
          >
            <div className="sos-modal-header">
              <div>
                <p className="eyebrow">EMERGENCY SOS</p>
                <h2 id="sos-dialog-title">Emergency SOS</h2>
              </div>
              <button className="sos-close-button" onClick={closePopup} type="button">
                <Icon name="close" />
                <span>Close</span>
              </button>
            </div>

            <p className="sos-modal-subtitle">Select the type of emergency, if known.</p>

            <div aria-live="polite" aria-atomic="true" className="sos-countdown-block">
              <span className="sos-countdown-label">Your emergency request will be sent in</span>
              <strong>{countdown > 0 ? countdown : "Request is sent"}</strong>
            </div>

            <p className="sos-location-status" role="status">
              {locationStatusMessage}
            </p>

            <div className="sos-category-grid">
              {emergencyCategories.map((option) => (
                <button
                  aria-pressed={selectedCategory === option.value}
                  className={
                    selectedCategory === option.value
                      ? "sos-category sos-category--selected"
                      : "sos-category"
                  }
                  key={option.value}
                  onClick={() => {
                    if (submission.status === "submitting") {
                      return;
                    }
                    setSelectedCategory(option.value);
                  }}
                  type="button"
                >
                  <span className={`sos-category-icon sos-category-icon--${option.icon}`}>
                    <Icon name={option.icon} />
                  </span>
                  <span className="sos-category-copy">
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="sos-text-field">
              <label htmlFor="sos-description">Describe what happened (optional)</label>
              <textarea
                id="sos-description"
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDescription(nextValue);
                  descriptionSourceRef.current = "manual";
                  setDescriptionSource("manual");
                  if (submissionRef.current.status !== "idle") {
                    void queueLateDescriptionUpdate(nextValue, "late-text-edit");
                  }
                }}
                placeholder="Tell us briefly what happened..."
                rows={4}
                value={description}
              />
              {submission.status === "idle" && (
                <p className="sos-description-status" role="status">
                  {descriptionStatusLabel}
                </p>
              )}
              {submission.status === "idle" && description.trim() && (
                <p className="sos-description-preview">Included text: “{description.trim()}”</p>
              )}
            </div>

            <div className="sos-actions-row">
              <button
                aria-pressed={isListening}
                className="sos-voice-button"
                disabled={submission.status === "submitting"}
                onClick={handleSpeak}
                type="button"
              >
                {isListening ? "Listening…" : "Speak (optional)"}
              </button>
              <button
                className="sos-cancel-button"
                disabled={submission.status === "submitting"}
                onClick={() => {
                  if (submission.status === "submitting") {
                    return;
                  }
                  setCancelledNotice("Emergency SOS cancelled. No request was sent.");
                  closePopup();
                }}
                type="button"
              >
                Cancel
              </button>
            </div>

            {voiceError && (
              <p className="sos-form-error" role="alert">
                {voiceError}
              </p>
            )}

            <p className="sos-voice-note">Speech is converted to text locally. Raw audio is not sent.</p>

            {submission.status !== "idle" && (
              <StatusPanel
                state={submission}
                incidentId={clientIncidentId}
                descriptionUpdateStatus={descriptionUpdateStatus}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
