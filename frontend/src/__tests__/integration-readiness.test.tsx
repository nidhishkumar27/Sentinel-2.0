// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppProviders } from "../app/providers";
import { AppRouter } from "../app/router";
import { integrationConfig, safetyIntegrations } from "../app/integrations";
import { AuthProvider } from "../features/user/auth/AuthProvider";
import { useAuth } from "../features/user/auth/authContext";
import { AlertsPage } from "../features/user/alerts/AlertsPage";
import { DashboardPage } from "../features/user/dashboard/DashboardPage";
import { SafetyAssistantPage } from "../features/user/safety-assistant/SafetyAssistantPage";
import { SafetyMapPage } from "../features/user/safety-map/SafetyMapPage";
import { SOSPage } from "../features/user/sos/SOSPage";
import type { AuthGateway } from "../features/user/auth/authGateway";
import type { AssistantOutcome } from "../types/assistantIntegration";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

function renderWithMemoryRouter(component: ReactNode) {
  return render(<MemoryRouter>{component}</MemoryRouter>);
}

function AuthStatusProbe() {
  const { signIn, status, user } = useAuth();
  return (
    <div>
      <p>Authentication status: {status}</p>
      {user && <p>Signed in as {user.displayName}</p>}
      <button
        onClick={() =>
          void signIn({ email: "person@example.test", password: "not-a-real-password" })
        }
        type="button"
      >
        Try sign in
      </button>
    </div>
  );
}

describe("frontend integration readiness", () => {
  it("does not establish an auth session when the gateway is unavailable", async () => {
    const gateway: AuthGateway = {
      getCurrentUser: vi.fn().mockResolvedValue({
        status: "failure",
        code: "unavailable",
      }),
      signIn: vi.fn().mockResolvedValue({
        status: "failure",
        code: "unavailable",
      }),
      register: vi.fn().mockResolvedValue({
        status: "failure",
        code: "unavailable",
      }),
      signOut: vi.fn().mockResolvedValue({
        status: "failure",
        code: "unavailable",
      }),
    };
    const user = userEvent.setup();

    render(
      <AuthProvider gateway={gateway}>
        <AuthStatusProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("Authentication status: unavailable")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Try sign in" }));

    expect(await screen.findByText("Authentication status: unavailable")).toBeTruthy();
    expect(screen.queryByText(/Signed in as/)).toBeNull();
    expect(gateway.signIn).toHaveBeenCalledTimes(1);
  });

  it(
    "opens the SOS popup immediately and starts a five-second countdown",
    async () => {
      const user = userEvent.setup();
      renderWithMemoryRouter(<SOSPage />);

      await user.click(screen.getByRole("button", { name: "SOS" }));

      expect(screen.getByRole("dialog", { name: /Emergency SOS/i })).toBeTruthy();
      expect(screen.getByText("5")).toBeTruthy();

      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(screen.getByText("4")).toBeTruthy();
    },
    15000,
  );

  it(
    "shows all categories and keeps the countdown running after selection",
    async () => {
      const user = userEvent.setup();
      renderWithMemoryRouter(<SOSPage />);

      await user.click(screen.getByRole("button", { name: "SOS" }));
      expect(screen.getByRole("button", { name: /POLICE/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /FIRE/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /MEDICAL/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /LOST \/ DISORIENTED/i })).toBeTruthy();

      await user.click(screen.getByRole("button", { name: /MEDICAL/i }));
      await new Promise((resolve) => setTimeout(resolve, 3100));

      expect(screen.getByText("2")).toBeTruthy();
      expect(screen.getByRole("button", { name: /MEDICAL/i }).getAttribute("aria-pressed")).toBe("true");
    },
    15000,
  );

  it("includes a non-empty typed description in the initial request and shows the ready-to-send state", async () => {
    const submit = vi
      .spyOn(safetyIntegrations.incidents, "submitIncident")
      .mockResolvedValue({ status: "unavailable" });
    const user = userEvent.setup();
    renderWithMemoryRouter(<SOSPage />);

    await user.click(screen.getByRole("button", { name: "SOS" }));
    const textarea = screen.getByLabelText("Describe what happened (optional)");
    await user.type(textarea, "Someone is following me.");

    expect(screen.getByText("DESCRIPTION READY TO SEND")).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 5100));

    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Someone is following me." }),
      );
    }, { timeout: 10000 });

    expect(screen.getByText(/DESCRIPTION INCLUDED IN INITIAL SUBMISSION/i)).toBeTruthy();
  }, 20000);

  it("omits an empty description from the initial submission request", async () => {
    const submit = vi
      .spyOn(safetyIntegrations.incidents, "submitIncident")
      .mockResolvedValue({ status: "unavailable" });
    const user = userEvent.setup();
    renderWithMemoryRouter(<SOSPage />);

    await user.click(screen.getByRole("button", { name: "SOS" }));
    await new Promise((resolve) => setTimeout(resolve, 5100));

    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith(
        expect.not.objectContaining({ description: expect.any(String) }),
      );
    }, { timeout: 10000 });

    expect(screen.getByText("NO DESCRIPTION ADDED")).toBeTruthy();
  }, 20000);

  it("includes voice transcription in the description field and initial request before submission", async () => {
    class FakeSpeechRecognition {
      public lang: string | undefined;
      public interimResults: boolean | undefined;
      public continuous: boolean | undefined;
      public onstart: (() => void) | null = null;
      public onresult: ((event: any) => void) | null = null;
      public onerror: ((event: any) => void) | null = null;
      public onend: (() => void) | null = null;
      public start = () => {
        this.onstart?.();
        this.onresult?.({ results: [[{ transcript: "I am injured." }]] });
        this.onend?.();
      };
      public stop = vi.fn();
    }

    Object.defineProperty(window, "SpeechRecognition", {
      value: FakeSpeechRecognition,
      configurable: true,
    });

    const submit = vi
      .spyOn(safetyIntegrations.incidents, "submitIncident")
      .mockResolvedValue({ status: "unavailable" });
    const user = userEvent.setup();
    renderWithMemoryRouter(<SOSPage />);

    await user.click(screen.getByRole("button", { name: "SOS" }));
    await user.click(screen.getByRole("button", { name: /Speak \(optional\)/i }));

    const textarea = screen.getByLabelText("Describe what happened (optional)") as HTMLTextAreaElement;
    expect(textarea.value).toBe("I am injured.");
    expect(screen.getByText("VOICE TRANSCRIPTION READY TO SEND")).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 5100));

    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({ description: "I am injured." }),
      );
    }, { timeout: 10000 });

    expect(screen.getByText(/VOICE TRANSCRIPTION INCLUDED IN INITIAL SUBMISSION/i)).toBeTruthy();
  }, 20000);

  it(
    "shows a sending state and prevents duplicates while the SOS request is in flight",
    async () => {
      const submit = vi
        .spyOn(safetyIntegrations.incidents, "submitIncident")
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ status: "unavailable" }), 200)),
        );
      const user = userEvent.setup();
      renderWithMemoryRouter(<SOSPage />);

      await user.click(screen.getByRole("button", { name: "SOS" }));
      await new Promise((resolve) => setTimeout(resolve, 5100));

      await waitFor(() => {
        expect(submit).toHaveBeenCalledTimes(1);
        expect(screen.getByText("SENDING EMERGENCY REQUEST...")).toBeTruthy();
      }, { timeout: 10000 });
    },
    20000,
  );

  it(
    "submits with UNKNOWN when no category is chosen before the countdown ends and never shows a success message for an unavailable service",
    async () => {
      const submit = vi
        .spyOn(safetyIntegrations.incidents, "submitIncident")
        .mockResolvedValue({ status: "unavailable" });
      const user = userEvent.setup();
      renderWithMemoryRouter(<SOSPage />);

      await user.click(screen.getByRole("button", { name: "SOS" }));
      await new Promise((resolve) => setTimeout(resolve, 5100));

      await waitFor(() => {
        expect(submit).toHaveBeenCalledWith(
          expect.objectContaining({ category: "unknown" }),
        );
      }, { timeout: 10000 });

      expect(await screen.findByText("EMERGENCY SUBMISSION UNAVAILABLE")).toBeTruthy();
      expect(screen.queryByText("EMERGENCY REQUEST SENT")).toBeNull();
      expect(screen.queryByText("IT WAS SENT")).toBeNull();
    },
    20000,
  );

  it(
    "renders a confirmed SOS status with reference and category when the adapter confirms",
    async () => {
      const submit = vi.spyOn(safetyIntegrations.incidents, "submitIncident").mockResolvedValue({
        status: "confirmed",
        confirmation: {
          reference: "INC-1001",
          status: "received",
        },
      });
      const user = userEvent.setup();
      renderWithMemoryRouter(<SOSPage />);

      await user.click(screen.getByRole("button", { name: "SOS" }));
      await user.click(screen.getByRole("button", { name: /MEDICAL/i }));
      await new Promise((resolve) => setTimeout(resolve, 5100));

      await waitFor(() => {
        expect(submit).toHaveBeenCalledWith(
          expect.objectContaining({ category: "medical" }),
        );
      }, { timeout: 10000 });

      expect(await screen.findByText("EMERGENCY REQUEST SENT")).toBeTruthy();
      expect(screen.getByText(/Incident reference:/i)).toBeTruthy();
      expect(screen.getByText(/INC-1001/i)).toBeTruthy();
      expect(screen.getByText(/Category:/i)).toBeTruthy();
    },
    20000,
  );

  it("preserves a late voice transcription for the same incident and keeps the original client ID", async () => {
    class LateVoiceRecognition {
      public lang: string | undefined;
      public interimResults: boolean | undefined;
      public continuous: boolean | undefined;
      public onstart: (() => void) | null = null;
      public onresult: ((event: any) => void) | null = null;
      public onerror: ((event: any) => void) | null = null;
      public onend: (() => void) | null = null;
      public start = () => {
        this.onstart?.();
        setTimeout(() => {
          this.onresult?.({ results: [[{ transcript: "I am injured." }]] });
          this.onend?.();
        }, 6100);
      };
      public stop = vi.fn();
    }

    Object.defineProperty(window, "SpeechRecognition", {
      value: LateVoiceRecognition,
      configurable: true,
    });

    const submitSpy = vi.spyOn(safetyIntegrations.incidents, "submitIncident").mockResolvedValue({
      status: "confirmed",
      confirmation: { reference: "INC-2001", status: "received" },
    });
    const updateSpy = vi
      .spyOn(safetyIntegrations.incidents, "updateIncidentDescription")
      .mockResolvedValue({
        status: "confirmed",
        confirmation: { reference: "INC-2001", status: "updated" },
      });
    const user = userEvent.setup();
    renderWithMemoryRouter(<SOSPage />);

    await user.click(screen.getByRole("button", { name: "SOS" }));
    await user.click(screen.getByRole("button", { name: /Speak \(optional\)/i }));
    await new Promise((resolve) => setTimeout(resolve, 7000));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1), { timeout: 15000 });
    expect(submitSpy).toHaveBeenCalledTimes(1);

    const incidentText = screen.getByText(/Client incident ID:/i).textContent ?? "";
    const match = incidentText.match(/Client incident ID:\s*(.+)$/i);
    const incidentId = match ? match[1].trim() : "";

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ incidentId, description: "I am injured." }),
    );
    expect(screen.getByText("UPDATE CONFIRMED")).toBeTruthy();
  }, 25000);

  it("keeps late text edits with the original incident ID and notifies when backend updates are unsupported", async () => {
    const submitSpy = vi.spyOn(safetyIntegrations.incidents, "submitIncident").mockResolvedValue({
      status: "confirmed",
      confirmation: { reference: "INC-2002", status: "received" },
    });
    const updateSpy = vi
      .spyOn(safetyIntegrations.incidents, "updateIncidentDescription")
      .mockResolvedValue({ status: "unavailable" });
    const user = userEvent.setup();
    renderWithMemoryRouter(<SOSPage />);

    await user.click(screen.getByRole("button", { name: "SOS" }));
    await new Promise((resolve) => setTimeout(resolve, 5100));

    const textarea = screen.getByLabelText("Describe what happened (optional)") as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, "I am lost.");

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1), { timeout: 15000 });
    expect(submitSpy).toHaveBeenCalledTimes(1);

    const incidentText = screen.getByText(/Client incident ID:/i).textContent ?? "";
    const match = incidentText.match(/Client incident ID:\s*(.+)$/i);
    const incidentId = match ? match[1].trim() : "";

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ incidentId, description: "I am lost." }),
    );
    expect(screen.getByText("NOT ATTACHED — BACKEND UPDATE NOT SUPPORTED")).toBeTruthy();
  }, 25000);

  it("marks failed description updates as UPDATE FAILED", async () => {
    vi.spyOn(safetyIntegrations.incidents, "submitIncident").mockResolvedValue({
      status: "confirmed",
      confirmation: { reference: "INC-2003", status: "received" },
    });
    vi.spyOn(safetyIntegrations.incidents, "updateIncidentDescription").mockResolvedValue({
      status: "rejected",
      message: "service rejected update",
    });
    const user = userEvent.setup();
    renderWithMemoryRouter(<SOSPage />);

    await user.click(screen.getByRole("button", { name: "SOS" }));
    await new Promise((resolve) => setTimeout(resolve, 5100));
    const textarea = screen.getByLabelText("Describe what happened (optional)") as HTMLTextAreaElement;
    await user.type(textarea, "Emergency details updated.");

    await waitFor(() => expect(screen.getByText("UPDATE FAILED")).toBeTruthy(), {
      timeout: 15000,
    });
  }, 25000);

  it(
    "renders a rejected status when the service rejects the request",
    async () => {
      vi.spyOn(safetyIntegrations.incidents, "submitIncident").mockResolvedValue({
        status: "rejected",
        message: "not accepted",
      });
      const user = userEvent.setup();
      renderWithMemoryRouter(<SOSPage />);

      await user.click(screen.getByRole("button", { name: "SOS" }));
      await new Promise((resolve) => setTimeout(resolve, 5100));

      expect(await screen.findByText("EMERGENCY REQUEST NOT SENT")).toBeTruthy();
    },
    20000,
  );

  it(
    "does not show a request-status card when the service result is uncertain",
    async () => {
      const submit = vi.spyOn(safetyIntegrations.incidents, "submitIncident").mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ status: "unknown", reason: "timeout" }), 1000)),
      );
      const user = userEvent.setup();
      renderWithMemoryRouter(<SOSPage />);

      await user.click(screen.getByRole("button", { name: "SOS" }));
      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1), { timeout: 7000 });
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(screen.queryByText("REQUEST NOT CONFIRMED")).toBeNull();
    },
    20000,
  );

  it("does not request browser geolocation when the map first loads", () => {
    const requestLocation = vi
      .spyOn(safetyIntegrations.geolocation, "requestCurrentLocation")
      .mockResolvedValue({ status: "permission-denied" });

    renderWithMemoryRouter(<SafetyMapPage />);

    expect(requestLocation).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Use my current location" }),
    ).toBeTruthy();
  });

  it("rejects manual map coordinates outside latitude and longitude bounds", async () => {
    const user = userEvent.setup();
    renderWithMemoryRouter(<SafetyMapPage />);

    await user.type(screen.getByLabelText("Latitude"), "91");
    await user.type(screen.getByLabelText("Longitude"), "0");
    await user.click(screen.getByRole("button", { name: "Use these coordinates" }));

    expect(screen.getByRole("alert").textContent).toMatch(
      /valid latitude.*longitude/i,
    );
    expect(screen.queryByText("Manual coordinates entered")).toBeNull();
  });

  it("tracks the latest geolocation snapshot and freshness metadata", async () => {
    const getCurrentPosition = vi.fn((success) => {
      success({
        coords: {
          latitude: 12.34,
          longitude: 56.78,
          accuracy: 9,
        },
        timestamp: Date.now(),
      });
    });
    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    const result = await safetyIntegrations.geolocation.requestCurrentLocation();

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.location.latitude).toBe(12.34);
      expect(result.location.longitude).toBe(56.78);
      expect(result.location.accuracyMeters).toBe(9);
      expect(result.location.freshness).toBe("fresh");
      expect(safetyIntegrations.geolocation.getLatestLocation()).toMatchObject({
        latitude: 12.34,
        longitude: 56.78,
      });
    }
  });

  it("falls back to a cached fix when a fresh current-location fix is unavailable", async () => {
    const watchPosition = vi.fn((_success: unknown, error: (e: unknown) => void) => {
      error({
        code: 2,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: "Position unavailable",
      });
      return 7;
    });
    const getCurrentPosition = vi.fn((success: (p: unknown) => void) => {
      success({
        coords: { latitude: 13.08, longitude: 80.27, accuracy: 4800 },
        timestamp: Date.now(),
      });
    });
    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition, watchPosition, clearWatch: vi.fn() },
    });

    const result = await safetyIntegrations.geolocation.requestCurrentLocation();

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.location.latitude).toBe(13.08);
      expect(result.location.longitude).toBe(80.27);
    }
    expect(getCurrentPosition).toHaveBeenCalled();
  });

  it("shows the honest unavailable alerts state", async () => {
    vi.spyOn(safetyIntegrations.alerts, "getAlerts").mockResolvedValue({
      status: "unavailable",
    });

    renderWithMemoryRouter(<AlertsPage />);

    expect(await screen.findByRole("heading", { name: "Alerts unavailable" })).toBeTruthy();
  });

  it("shows an explicit timeout state when the alert adapter reports one", async () => {
    vi.spyOn(safetyIntegrations.alerts, "getAlerts").mockResolvedValue({
      status: "timeout",
    });

    renderWithMemoryRouter(<AlertsPage />);

    expect(
      await screen.findByRole("heading", { name: "Alert request timed out" }),
    ).toBeTruthy();
    expect(screen.getByText(/No alert response was confirmed/)).toBeTruthy();
  });

  it("shows separate dashboard weather and safety cards with unavailable states and category links", async () => {
    vi.spyOn(safetyIntegrations.alerts, "getAlerts").mockResolvedValue({
      status: "unavailable",
    });

    renderWithMemoryRouter(<DashboardPage />);

    expect(
      screen.getByRole("heading", { name: "Weather Alerts" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Safety Alerts" }),
    ).toBeTruthy();
    expect(
      await screen.findByText(
        "Weather Alerts unavailable. No alert service is connected.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Safety Alerts unavailable. No alert service is connected.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "View weather alerts" }).getAttribute("href"),
    ).toBe("/alerts");
    expect(
      screen.getByRole("link", { name: "View safety alerts" }).getAttribute("href"),
    ).toBe("/alerts");
  });

  it("shows weather and safety alerts together in one unified location card", async () => {
    vi.spyOn(safetyIntegrations.alerts, "getAlerts").mockResolvedValue({
      status: "success",
      value: {
        alerts: [
          {
            id: "safety-alert",
            category: "emergency",
            title: "Safety incident advisory",
            message: "A configured source reported a safety advisory.",
            timestamp: "2025-01-01T12:00:00.000Z",
            source: "Test source",
          },
        ],
        fetchedAt: "2025-01-01T12:00:00.000Z",
        freshness: "fresh",
        weather: {
          locationLabel: "Test Town",
          updatedAt: "2025-01-01T12:00:00.000Z",
          current: null,
          forecast: [],
          warnings: [
            {
              id: "warning-rain",
              title: "Heavy rainfall warning",
              severity: "HIGH",
              category: "heavy-rain",
              location: "Test Town",
              description: "Intense rainfall may lead to flash flooding.",
              source: "National weather service",
              precautions: [],
            },
          ],
        },
      },
    });

    renderWithMemoryRouter(<AlertsPage />);

    expect(
      await screen.findByRole("heading", { name: "Location alerts" }),
    ).toBeTruthy();
    expect(screen.getByText("Heavy rainfall warning")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Safety incident advisory" }),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Safety" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Flood" })).toBeNull();
  });

  it("renders the current weather overview, seven-day forecast and active weather warnings", async () => {
    vi.spyOn(safetyIntegrations.alerts, "getAlerts").mockResolvedValue({
      status: "success",
      value: {
        alerts: [
          {
            id: "weather-alert-1",
            category: "weather",
            title: "Heavy rain advisory",
            message: "Flooding risk in coastal roads.",
            timestamp: "2025-01-01T12:00:00.000Z",
            source: "Test weather provider",
          },
        ],
        fetchedAt: "2025-01-01T12:00:00.000Z",
        freshness: "fresh",
        weather: {
          locationLabel: "Wellington",
          updatedAt: "2025-01-01T12:00:00.000Z",
          current: {
            locationLabel: "Wellington",
            condition: "Heavy rain",
            icon: "rain",
            temperatureC: 18,
            feelsLikeC: 17,
            humidityPercent: 88,
            windKph: 31,
            rainProbability: 76,
            observedAt: "2025-01-01T12:00:00.000Z",
          },
          forecast: [
            { date: "2025-01-01", condition: "Heavy rain", icon: "rain", minC: 15, maxC: 19, rainProbability: 80 },
            { date: "2025-01-02", condition: "Thunderstorm", icon: "storm", minC: 14, maxC: 18, rainProbability: 90 },
            { date: "2025-01-03", condition: "Sunny", icon: "sun", minC: 16, maxC: 22, rainProbability: 10 },
          ],
          warnings: [
            {
              id: "warning-rain",
              title: "Heavy rainfall warning",
              severity: "HIGH",
              category: "heavy-rain",
              location: "Wellington",
              startsAt: "2025-01-01T10:00:00.000Z",
              endsAt: "2025-01-02T04:00:00.000Z",
              description: "Intense rainfall may lead to flash flooding near low-lying areas.",
              source: "National weather service",
              precautions: ["Avoid flooded roads.", "Secure loose outdoor items."],
            },
          ],
        },
      },
    });

    renderWithMemoryRouter(<AlertsPage />);

    expect(await screen.findByText("Current weather")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Wellington" })).toBeTruthy();
    expect(screen.getAllByText("18°C").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Heavy rain").length).toBeGreaterThan(0);
    expect(screen.getByText("7-day forecast")).toBeTruthy();
    expect(screen.getByText("Heavy rainfall warning")).toBeTruthy();
    expect(screen.getByText("HIGH")).toBeTruthy();
    expect(screen.getByText("Recommended precautions")).toBeTruthy();
    expect(screen.getByText("Avoid flooded roads.")).toBeTruthy();
  });

  it("renders all forecast days when fewer than seven are returned", async () => {
    vi.spyOn(safetyIntegrations.alerts, "getAlerts").mockResolvedValue({
      status: "success",
      value: {
        alerts: [],
        fetchedAt: "2025-01-01T12:00:00.000Z",
        freshness: "fresh",
        weather: {
          locationLabel: "Lisbon",
          updatedAt: "2025-01-01T12:00:00.000Z",
          current: null,
          forecast: [
            { date: "2025-01-01", condition: "Cloudy", icon: "cloud", minC: 10, maxC: 15, rainProbability: 20 },
            { date: "2025-01-02", condition: "Sunny", icon: "sun", minC: 11, maxC: 17, rainProbability: 5 },
          ],
          warnings: [],
        },
      },
    });

    renderWithMemoryRouter(<AlertsPage />);

    expect(await screen.findByText("7-day forecast")).toBeTruthy();
    expect(screen.getByText("Cloudy")).toBeTruthy();
    expect(screen.getByText("Sunny")).toBeTruthy();
    expect(screen.queryByText("No forecast data is available for this location.")).toBeNull();
  });

  it("shows a loading state while the weather alert service is still resolving", async () => {
    vi.spyOn(safetyIntegrations.alerts, "getAlerts").mockImplementation(
      () => new Promise(() => undefined),
    );

    renderWithMemoryRouter(<AlertsPage />);

    expect(screen.getByText("Loading alerts…")).toBeTruthy();
  });

  it("shows an error state when the weather alert service fails", async () => {
    vi.spyOn(safetyIntegrations.alerts, "getAlerts").mockRejectedValue(new Error("Network failed"));

    renderWithMemoryRouter(<AlertsPage />);

    expect(await screen.findByRole("heading", { name: "Alerts could not be loaded" })).toBeTruthy();
  });

  it("shows a clear unavailable state when the weather service returns no weather data", async () => {
    vi.spyOn(safetyIntegrations.alerts, "getAlerts").mockResolvedValue({
      status: "success",
      value: {
        alerts: [],
        fetchedAt: "2025-01-01T12:00:00.000Z",
        freshness: "fresh",
      },
    });

    renderWithMemoryRouter(<AlertsPage />);

    expect(await screen.findByRole("heading", { name: "Weather data unavailable" })).toBeTruthy();
    expect(screen.getByText(/Choose your current location to load current conditions/i)).toBeTruthy();
  });

  it("shows an explicit timeout state for safety-resource searches", async () => {
    vi.spyOn(safetyIntegrations.resources, "findResourcesNear").mockResolvedValue({
      status: "timeout",
    });
    const user = userEvent.setup();
    renderWithMemoryRouter(<SafetyMapPage />);

    await user.click(screen.getByText("Enter coordinates manually"));
    await user.type(screen.getByLabelText("Latitude"), "12");
    await user.type(screen.getByLabelText("Longitude"), "34");
    await user.click(screen.getByRole("button", { name: "Use these coordinates" }));
    await user.click(
      screen.getByRole("button", {
        name: "Find resources near these coordinates",
      }),
    );

    expect(
      await screen.findByText(/safety-resource request timed out/i),
    ).toBeTruthy();
  });

  it("shows unavailable assistant and no generated answer by default", async () => {
    const ask = vi.spyOn(safetyIntegrations.assistant, "ask");
    const user = userEvent.setup();
    renderWithMemoryRouter(<SafetyAssistantPage />);

    await user.type(screen.getByLabelText("Your question"), "What should I know?");
    await user.click(screen.getByRole("button", { name: "Send question" }));

    expect(await screen.findByText("Assistant unavailable")).toBeTruthy();
    expect(ask).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Assistant · AI/)).toBeNull();
    expect(screen.queryByRole("link", { name: /source/i })).toBeNull();
  });

  it("renders citations only from the service and links only safe HTTP(S) URLs", async () => {
    vi.spyOn(safetyIntegrations.assistant, "ask").mockResolvedValue({
      status: "success",
      response: {
        answer: "Use information from a reliable source.",
        citations: [
          { title: "Official visitor guidance", url: "https://example.test/guide" },
          { title: "Unsafe scheme", url: "javascript:alert(1)" },
          { title: "Malformed URL", url: "not a URL" },
          { title: "URL containing credentials", url: "https://user:pass@example.test/" },
        ],
      },
    });
    const user = userEvent.setup();
    renderWithMemoryRouter(<SafetyAssistantPage />);

    await user.type(screen.getByLabelText("Your question"), "How do I prepare?");
    await user.click(screen.getByRole("button", { name: "Send question" }));

    expect(
      await screen.findByText("Use information from a reliable source."),
    ).toBeTruthy();
    const safeLink = screen.getByRole("link", {
      name: "Official visitor guidance (opens in a new tab)",
    });
    expect(safeLink.getAttribute("href")).toBe("https://example.test/guide");
    expect(safeLink.getAttribute("target")).toBe("_blank");
    expect(safeLink.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("Unsafe scheme", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("Malformed URL", { selector: "span" })).toBeTruthy();
    expect(
      screen.getByText("URL containing credentials", { selector: "span" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("link", {
        name: /Unsafe scheme|Malformed URL|URL containing credentials/,
      }),
    ).toBeNull();
  });

  it("shows insufficient evidence without inventing an answer", async () => {
    vi.spyOn(safetyIntegrations.assistant, "ask").mockResolvedValue({
      status: "insufficient-evidence",
      citations: [],
    });
    const user = userEvent.setup();
    renderWithMemoryRouter(<SafetyAssistantPage />);

    await user.type(screen.getByLabelText("Your question"), "Is this area safe?");
    await user.click(screen.getByRole("button", { name: "Send question" }));

    expect(await screen.findByText("Not enough evidence")).toBeTruthy();
    expect(screen.queryByText("Assistant · AI")).toBeNull();
  });

  it("announces pending assistant work and hides raw service errors", async () => {
    let resolveOutcome: (outcome: AssistantOutcome) => void = () => undefined;
    vi.spyOn(safetyIntegrations.assistant, "ask").mockReturnValue(
      new Promise((resolve) => {
        resolveOutcome = resolve;
      }),
    );
    const user = userEvent.setup();
    renderWithMemoryRouter(<SafetyAssistantPage />);

    await user.type(screen.getByLabelText("Your question"), "Will this response wait?");
    await user.click(screen.getByRole("button", { name: "Send question" }));

    expect(
      screen.getByRole("status", { name: "Waiting for assistant response" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Waiting…" }).hasAttribute("disabled")).toBe(
      true,
    );

    resolveOutcome({ status: "error" });

    expect(await screen.findByText("The response could not be loaded")).toBeTruthy();
    expect(screen.queryByText(/raw service trace/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Retry question" })).toBeTruthy();
  });

  it("clears the assistant conversation from page memory", async () => {
    vi.spyOn(safetyIntegrations.assistant, "ask").mockResolvedValue({
      status: "success",
      response: { answer: "A service-supplied answer.", citations: [] },
    });
    const user = userEvent.setup();
    renderWithMemoryRouter(<SafetyAssistantPage />);

    await user.type(screen.getByLabelText("Your question"), "A test question");
    await user.click(screen.getByRole("button", { name: "Send question" }));
    expect(await screen.findByText("A service-supplied answer.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "New conversation" }));

    expect(
      screen.getByRole("heading", { name: "What would you like to know?" }),
    ).toBeTruthy();
    expect(screen.queryByText("A test question")).toBeNull();
    expect((screen.getByLabelText("Your question") as HTMLTextAreaElement).value).toBe("");
  });

  it("hides dashboard samples and reports API errors while demo mode is disabled", async () => {
    const previousDemoSetting = integrationConfig.demoEnabled;
    integrationConfig.demoEnabled = false;
    vi.spyOn(safetyIntegrations.alerts, "getAlerts").mockResolvedValue({ status: "unavailable" });

    try {
      renderWithMemoryRouter(<DashboardPage />);

      expect(screen.queryByText("Demo preview.")).toBeNull();
      expect(screen.queryByText("Medical support")).toBeNull();
      expect(screen.queryByText("Sample travel advisory")).toBeNull();
      expect(screen.getByText("No safety-resource service is connected.")).toBeTruthy();
      expect(
        await screen.findByText(
          "Weather Alerts unavailable. No alert service is connected.",
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(
          "Safety Alerts unavailable. No alert service is connected.",
        ),
      ).toBeTruthy();
    } finally {
      integrationConfig.demoEnabled = previousDemoSetting;
    }
  });

  it("protects the SOS route when no user session is active", async () => {
    window.history.replaceState({}, "", "/sos");
    render(
      <AppProviders>
        <AppRouter />
      </AppProviders>,
    );

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
  });

  it("keeps all user-facing routes reachable", async () => {
    const routes = [
      { path: "/", heading: "Sentinel keeps every journey safe." },
      { path: "/user", heading: "Travel with confidence." },
      { path: "/sos", heading: "Sign in" },
      { path: "/safety-map", heading: "Sign in" },
      { path: "/emergency-contacts", heading: "Sign in" },
      { path: "/alerts", heading: "Sign in" },
      { path: "/safety-assistant", heading: "Sign in" },
      { path: "/login", heading: "Sign in" },
      { path: "/register", heading: "Create your account" },
      { path: "/profile", heading: "Sign in to view your profile" },
      { path: "/logout", heading: "No active session" },
    ];

    for (const route of routes) {
      cleanup();
      window.history.replaceState({}, "", route.path);
      render(
        <AppProviders>
          <AppRouter />
        </AppProviders>,
      );
      expect(
        await screen.findByRole("heading", { name: route.heading }),
      ).toBeTruthy();
    }
  });

  it("offers user and authority sign in and sign up from the home page", async () => {
    window.history.replaceState({}, "", "/");
    render(
      <AppProviders>
        <AppRouter />
      </AppProviders>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Sentinel keeps every journey safe.",
      }),
    ).toBeTruthy();
    for (const href of [
      "/login",
      "/register",
      "/authority/login",
      "/authority/register",
    ]) {
      expect(document.querySelector(`a[href="${href}"]`)).toBeTruthy();
    }
  });

  it("renders natural hazard alerts in one list sorted by severity", async () => {
    vi.spyOn(safetyIntegrations.alerts, "getAlerts").mockResolvedValue({
      status: "success",
      value: {
        alerts: [],
        fetchedAt: new Date().toISOString(),
        freshness: "demo",
        safetyAlerts: [
          {
            id: "hazard-earthquake",
            title: "Earthquake advisory",
            category: "EARTHQUAKE",
            severity: "HIGH",
            status: "UPDATED",
            location: "Fault line region",
            description: "Seismic activity was reported near the central fault line.",
            source: "National earthquake office",
            lastUpdatedAt: new Date().toISOString(),
            magnitude: 6.4,
            depthKm: 31,
            recommendedPrecautions: ["Take cover immediately if indoors."],
            relevance: "regional",
          },
          {
            id: "hazard-flood",
            title: "River overflow advisory",
            category: "FLOOD",
            severity: "MODERATE",
            status: "ACTIVE",
            location: "Centennial Valley",
            description: "Flooding is expected near the river corridor after heavy rain.",
            source: "Local authority",
            lastUpdatedAt: new Date().toISOString(),
            river: "Centennial River",
            recommendedPrecautions: ["Avoid flooded roads."],
            relevance: "local",
          },
          {
            id: "hazard-cyclone",
            title: "Cyclone warning",
            category: "CYCLONE",
            severity: "SEVERE",
            status: "ACTIVE",
            location: "Coastal belt",
            description: "Strong gusts and intense rain are expected along the coast.",
            source: "Storm centre",
            lastUpdatedAt: new Date().toISOString(),
            recommendedPrecautions: ["Secure outdoor items and avoid the shoreline."],
            relevance: "regional",
          },
        ],
      },
    });

    renderWithMemoryRouter(<AlertsPage />);

    expect(await screen.findByText("Earthquake advisory")).toBeTruthy();
    expect(screen.getByText("Cyclone warning")).toBeTruthy();
    expect(screen.getByText("River overflow advisory")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Flood" })).toBeNull();

    const text = document.body.textContent ?? "";
    expect(text.indexOf("Cyclone warning")).toBeLessThan(
      text.indexOf("Earthquake advisory"),
    );
    expect(text.indexOf("Earthquake advisory")).toBeLessThan(
      text.indexOf("River overflow advisory"),
    );
  });

  it("shows manual location guidance and a denied-permission notice when geolocation is blocked", async () => {
    vi.spyOn(safetyIntegrations.alerts, "getAlerts").mockResolvedValue({
      status: "success",
      value: {
        alerts: [],
        fetchedAt: new Date().toISOString(),
        freshness: "demo",
        safetyAlerts: [
          {
            id: "hazard-expired",
            title: "Expired landslide note",
            category: "LANDSLIDE",
            severity: "LOW",
            status: "EXPIRED",
            location: "North ridge",
            description: "Official advisory is no longer active.",
            source: "District office",
            lastUpdatedAt: new Date().toISOString(),
            recommendedPrecautions: ["Avoid unstable slopes."],
            relevance: "local",
          },
        ],
      },
    });
    vi.spyOn(safetyIntegrations.geolocation, "getPermissionStatus").mockResolvedValue("denied");
    const user = userEvent.setup();
    renderWithMemoryRouter(<AlertsPage />);

    expect(await screen.findByText(/Location access denied/i)).toBeTruthy();

    const input = screen.getByLabelText("Search location");
    await user.clear(input);
    await user.type(input, "Pahalgam");

    expect(screen.getAllByText(/Selected location:/i).length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Pahalgam")).toBeTruthy();
    expect(screen.getByText("EXPIRED")).toBeTruthy();
  });

  it("shows an empty safety state when no hazard feed is available", async () => {
    vi.spyOn(safetyIntegrations.alerts, "getAlerts").mockResolvedValue({
      status: "success",
      value: {
        alerts: [],
        fetchedAt: new Date().toISOString(),
        freshness: "demo",
        safetyAlerts: [],
      },
    });
    renderWithMemoryRouter(<AlertsPage />);

    expect(await screen.findByText("Safety Alerts")).toBeTruthy();
    expect(
      screen.getByText("No natural hazard alerts are currently available for the selected location."),
    ).toBeTruthy();
  });

  it("shows an unavailable-state message when the safety alert service cannot respond", async () => {
    vi.spyOn(safetyIntegrations.alerts, "getAlerts").mockResolvedValue({
      status: "unavailable",
    });
    renderWithMemoryRouter(<AlertsPage />);

    expect(await screen.findByText("Alerts unavailable")).toBeTruthy();
  });
});
