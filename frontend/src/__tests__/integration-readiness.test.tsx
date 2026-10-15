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

  it("shows SOS unavailable without claiming success or inventing a reference", async () => {
    const user = userEvent.setup();
    renderWithMemoryRouter(<SOSPage />);

    await user.click(screen.getByRole("radio", { name: /Medical/ }));
    await user.click(screen.getByRole("button", { name: "Review request" }));
    await user.click(
      screen.getByRole("button", { name: "Submit emergency request" }),
    );

    expect(
      await screen.findByText("Emergency submission unavailable"),
    ).toBeTruthy();
    expect(screen.queryByText(/Incident reference:/)).toBeNull();
    expect(
      screen.queryByText(/submission confirmed/i),
    ).toBeNull();
  });

  it("does not automatically retry an ambiguous SOS outcome", async () => {
    const submit = vi
      .spyOn(safetyIntegrations.incidents, "submitIncident")
      .mockResolvedValue({ status: "unknown", reason: "connection-lost" });
    const user = userEvent.setup();
    renderWithMemoryRouter(<SOSPage />);

    await user.click(screen.getByRole("radio", { name: /Police/ }));
    await user.click(screen.getByRole("button", { name: "Review request" }));
    await user.click(
      screen.getByRole("button", { name: "Submit emergency request" }),
    );

    expect(await screen.findByText("Submission outcome unknown")).toBeTruthy();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: "Submit emergency request" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

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
    ).toBe("/alerts?category=weather");
    expect(
      screen.getByRole("link", { name: "View safety alerts" }).getAttribute("href"),
    ).toBe("/alerts?category=safety");
  });

  it("filters alert results by weather and safety categories", async () => {
    vi.spyOn(safetyIntegrations.alerts, "getAlerts").mockResolvedValue({
      status: "success",
      value: {
        alerts: [
          {
            id: "weather-alert",
            category: "weather",
            title: "Heavy rain advisory",
            message: "A configured source reported heavy rain.",
            timestamp: "2025-01-01T12:00:00.000Z",
            source: "Test source",
          },
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
      },
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/alerts?category=weather"]}>
        <AlertsPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Heavy rain advisory" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Safety incident advisory" }),
    ).toBeNull();

    await user.click(screen.getByRole("link", { name: "Safety" }));

    expect(
      await screen.findByRole("heading", { name: "Safety incident advisory" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Heavy rain advisory" }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Safety" }).getAttribute("aria-current"),
    ).toBe("page");
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

  it("hides dashboard samples and reports unavailable data while demo mode is disabled", async () => {
    const previousDemoSetting = integrationConfig.demoEnabled;
    integrationConfig.demoEnabled = false;

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

  it("keeps the SOS route independent of authentication and other services", async () => {
    window.history.replaceState({}, "", "/sos");
    render(
      <AppProviders>
        <AppRouter />
      </AppProviders>,
    );

    expect(await screen.findByRole("heading", { name: "Request help" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("Checking account session…")).toBeNull();
    });
  });

  it("keeps all user-facing routes reachable", async () => {
    const routes = [
      { path: "/", heading: "Travel with confidence." },
      { path: "/sos", heading: "Request help" },
      { path: "/safety-map", heading: "Safety map" },
      { path: "/emergency-contacts", heading: "Emergency contacts" },
      { path: "/digital-id", heading: "Digital safety ID" },
      { path: "/alerts", heading: "Alerts" },
      { path: "/safety-assistant", heading: "Safety assistant" },
      { path: "/login", heading: "Sign in" },
      { path: "/register", heading: "Create your account" },
      { path: "/profile", heading: "Profile unavailable" },
      { path: "/logout", heading: "Sign out isn’t available" },
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
});
